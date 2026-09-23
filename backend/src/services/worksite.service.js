// ============ Service Chantiers Internes & Externes — SMG IMMOBILIER ============
const { Worksite, WorksiteTask, WorksiteMaterial, WorksitePhoto, Property, User, StockItem, StockMovement, Warehouse, WorksiteEquipmentLoan, sequelize } = require('../models');
const { Op } = require('sequelize');
const { logger } = require('../config/logger');

const num = (v) => parseFloat(v) || 0;

class WorksiteService {
  _inc() {
    return [
      { model: Property, as: 'property', attributes: ['id', 'property_name', 'city', 'address'] },
      { model: User, as: 'manager', attributes: ['id', 'full_name', 'phone'] },
      {
        model: WorksiteTask, as: 'tasks',
        include: [{ model: User, as: 'assignee', attributes: ['id', 'full_name'] }],
      },
      {
        model: WorksiteMaterial, as: 'materialsUsed',
        include: [
          { model: StockItem, as: 'stockItem', attributes: ['id', 'item_code', 'name', 'unit', 'category', 'item_type'] },
          { model: User, as: 'declarer', attributes: ['id', 'full_name'] },
        ],
      },
      {
        model: WorksiteEquipmentLoan, as: 'equipmentLoans',
        include: [
          { model: StockItem, as: 'stockItem', attributes: ['id', 'item_code', 'name', 'unit', 'category', 'item_type'] },
          { model: Warehouse, as: 'sourceWarehouse', attributes: ['id', 'name', 'city', 'address'] },
          { model: Warehouse, as: 'returnWarehouse', attributes: ['id', 'name', 'city', 'address'] },
          { model: User, as: 'creator', attributes: ['id', 'full_name'] },
        ],
      },
      { model: WorksitePhoto, as: 'photos', include: [{ model: User, as: 'uploader', attributes: ['id', 'full_name'] }] },
    ];
  }

  async getAll(filters = {}) {
    const where = {};
    if (filters.worksite_type) where.worksite_type = filters.worksite_type;
    if (filters.status) where.status = filters.status;
    if (filters.property_id) where.property_id = filters.property_id;
    if (filters.search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${filters.search}%` } },
        { client_name: { [Op.like]: `%${filters.search}%` } },
        { location: { [Op.like]: `%${filters.search}%` } },
        { contractor: { [Op.like]: `%${filters.search}%` } },
      ];
    }

    return Worksite.findAll({
      where,
      include: [
        { model: Property, as: 'property', attributes: ['id', 'property_name', 'city'] },
        { model: User, as: 'manager', attributes: ['id', 'full_name'] },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  async getById(id) {
    const ws = await Worksite.findByPk(id, { include: this._inc() });
    if (!ws) throw Object.assign(new Error('Chantier introuvable'), { status: 404 });
    return ws;
  }

  async create(data, userId) {
    if (!data.manager_id && userId) data.manager_id = userId;
    const ws = await Worksite.create(data);
    logger.info('🏗️ Nouveau chantier créé', { id: ws.id, title: ws.title, type: ws.worksite_type });
    return this.getById(ws.id);
  }

  async update(id, data) {
    const ws = await Worksite.findByPk(id);
    if (!ws) throw Object.assign(new Error('Chantier introuvable'), { status: 404 });
    if (data.status === 'completed' && !ws.end_date_actual) {
      data.end_date_actual = new Date().toISOString().slice(0, 10);
    }
    await ws.update(data);
    return this.getById(id);
  }

  async remove(id) {
    const ws = await Worksite.findByPk(id);
    if (!ws) throw Object.assign(new Error('Chantier introuvable'), { status: 404 });
    await ws.destroy();
    return true;
  }

  // ===== Gestion des tâches / jalons =====
  async addTask(worksiteId, taskData) {
    const ws = await Worksite.findByPk(worksiteId);
    if (!ws) throw Object.assign(new Error('Chantier introuvable'), { status: 404 });

    const task = await WorksiteTask.create({
      worksite_id: worksiteId,
      title: taskData.title,
      description: taskData.description || null,
      assigned_to: taskData.assigned_to || null,
      start_date: taskData.start_date || null,
      end_date: taskData.end_date || null,
      progress_percent: taskData.progress_percent || 0,
      status: taskData.status || 'pending',
    });

    await this._recalcProgress(worksiteId);
    return task;
  }

  async updateTask(taskId, taskData) {
    const task = await WorksiteTask.findByPk(taskId);
    if (!task) throw Object.assign(new Error('Tâche introuvable'), { status: 404 });
    await task.update(taskData);
    await this._recalcProgress(task.worksite_id);
    return task;
  }

  async removeTask(taskId) {
    const task = await WorksiteTask.findByPk(taskId);
    if (!task) throw Object.assign(new Error('Tâche introuvable'), { status: 404 });
    const wsId = task.worksite_id;
    await task.destroy();
    await this._recalcProgress(wsId);
    return true;
  }

  async _recalcProgress(worksiteId) {
    const tasks = await WorksiteTask.findAll({ where: { worksite_id: worksiteId } });
    if (!tasks.length) return;
    const totalProg = tasks.reduce((s, t) => s + num(t.progress_percent), 0);
    const avgProg = Math.round(totalProg / tasks.length);
    await Worksite.update({ progress_percent: avgProg }, { where: { id: worksiteId } });
  }

  // ===== Déclaration de matériaux consommables prélevés du stock =====
  async declareMaterials(worksiteId, materialsArray, userId = null) {
    const ws = await Worksite.findByPk(worksiteId);
    if (!ws) throw Object.assign(new Error('Chantier introuvable'), { status: 404 });

    const transaction = await sequelize.transaction();
    try {
      let addedMaterialCost = 0;

      for (const m of materialsArray) {
        const stockItem = await StockItem.findByPk(m.stock_item_id, { transaction });
        if (!stockItem) {
          throw new Error(`Article de stock #${m.stock_item_id} introuvable`);
        }

        const qty = num(m.quantity);
        if (qty <= 0) continue;

        const currentStock = num(stockItem.quantity);
        if (currentStock < qty) {
          throw new Error(`Stock insuffisant pour « ${stockItem.name} » (Disponible : ${currentStock} ${stockItem.unit}, Demandé : ${qty})`);
        }

        const unitCost = num(stockItem.unit_price_avg) || num(stockItem.last_purchase_price) || 0;
        const totalCost = qty * unitCost;
        const stockAfter = currentStock - qty;

        await stockItem.update({ quantity: stockAfter }, { transaction });

        await StockMovement.create({
          stock_item_id: stockItem.id,
          movement_type: 'out_worksite',
          quantity: qty,
          stock_before: currentStock,
          stock_after: stockAfter,
          unit_cost: unitCost,
          total_cost: totalCost,
          reference_type: 'worksite',
          reference_id: ws.id,
          notes: `Consommé pour chantier « ${ws.title} »`,
          created_by: userId || null,
        }, { transaction });

        await WorksiteMaterial.create({
          worksite_id: ws.id,
          stock_item_id: stockItem.id,
          quantity_used: qty,
          unit_cost: unitCost,
          total_cost: totalCost,
          declared_by: userId || null,
          date_used: new Date(),
        }, { transaction });

        addedMaterialCost += totalCost;
      }

      const newMaterialCost = num(ws.material_cost) + addedMaterialCost;
      const newSpentAmount = newMaterialCost + num(ws.labor_cost) + num(ws.other_cost);

      await ws.update({
        material_cost: newMaterialCost,
        spent_amount: newSpentAmount,
      }, { transaction });

      await transaction.commit();
      logger.info('🏗️ Matériel consommé sur chantier', { worksiteId, addedCost: addedMaterialCost });

      return this.getById(worksiteId);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  // ===== Prêter un équipement / outil depuis un entrepôt vers un chantier =====
  async loanEquipment(worksiteId, loanData, userId = null) {
    const ws = await Worksite.findByPk(worksiteId);
    if (!ws) throw Object.assign(new Error('Chantier introuvable'), { status: 404 });

    const stockItem = await StockItem.findByPk(loanData.stock_item_id);
    if (!stockItem) throw Object.assign(new Error('Article / Équipement introuvable'), { status: 404 });

    const warehouseId = loanData.warehouse_id || stockItem.warehouse_id;
    if (!warehouseId) throw new Error('Veuillez spécifier l\'entrepôt source');

    const warehouse = await Warehouse.findByPk(warehouseId);
    if (!warehouse) throw new Error('Entrepôt source introuvable');

    const qty = num(loanData.quantity) || 1;
    if (qty <= 0) throw new Error('La quantité doit être supérieure à 0');

    const available = num(stockItem.quantity) - num(stockItem.quantity_loaned);
    if (available < qty) {
      throw new Error(`Quantité insuffisante en entrepôt pour « ${stockItem.name} » (Disponible au prêt : ${available} ${stockItem.unit}, Demandé : ${qty})`);
    }

    const transaction = await sequelize.transaction();
    try {
      const newLoaned = num(stockItem.quantity_loaned) + qty;
      await stockItem.update({ quantity_loaned: newLoaned }, { transaction });

      const loan = await WorksiteEquipmentLoan.create({
        worksite_id: ws.id,
        stock_item_id: stockItem.id,
        warehouse_id: warehouseId,
        quantity: qty,
        assigned_date: loanData.assigned_date || new Date().toISOString().slice(0, 10),
        status: 'loaned',
        condition_notes: loanData.condition_notes || null,
        created_by: userId || null,
      }, { transaction });

      await StockMovement.create({
        stock_item_id: stockItem.id,
        movement_type: 'out_worksite',
        quantity: qty,
        stock_before: num(stockItem.quantity),
        stock_after: num(stockItem.quantity),
        unit_cost: num(stockItem.unit_price_avg),
        total_cost: qty * num(stockItem.unit_price_avg),
        reference_type: 'worksite',
        reference_id: ws.id,
        notes: `Prêt de ${qty} ${stockItem.unit} depuis ${warehouse.name} pour chantier « ${ws.title} »`,
        created_by: userId || null,
      }, { transaction });

      await transaction.commit();
      logger.info('🛠️ Équipement prêté au chantier', { worksiteId, stock_item_id: stockItem.id, quantity: qty, warehouseId });
      return this.getById(worksiteId);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  // ===== Restituer un équipement à l'entrepôt =====
  async returnEquipment(worksiteId, loanId, returnData, userId = null) {
    const loan = await WorksiteEquipmentLoan.findOne({
      where: { id: loanId, worksite_id: worksiteId },
      include: [
        { model: StockItem, as: 'stockItem' },
        { model: Warehouse, as: 'sourceWarehouse' },
      ],
    });

    if (!loan) throw Object.assign(new Error('Prêt d\'équipement introuvable'), { status: 404 });
    if (loan.status === 'returned') throw new Error('Cet équipement a déjà été totalement restitué à l\'entrepôt');

    const remainingToReturn = num(loan.quantity) - num(loan.returned_quantity);
    const returnQty = returnData.returned_quantity ? num(returnData.returned_quantity) : remainingToReturn;
    if (returnQty <= 0 || returnQty > remainingToReturn) {
      throw new Error(`Quantité de retour invalide (Restant à restituer : ${remainingToReturn})`);
    }

    const returnWarehouseId = returnData.return_warehouse_id || loan.warehouse_id;
    const destWarehouse = await Warehouse.findByPk(returnWarehouseId);
    if (!destWarehouse) throw new Error('Entrepôt de restitution introuvable');

    const transaction = await sequelize.transaction();
    try {
      const stockItem = loan.stockItem;
      const newLoaned = Math.max(0, num(stockItem.quantity_loaned) - returnQty);
      await stockItem.update({ quantity_loaned: newLoaned }, { transaction });

      const newReturnedQty = num(loan.returned_quantity) + returnQty;
      const isFullReturn = newReturnedQty >= num(loan.quantity);

      const notesArr = [];
      if (loan.condition_notes) notesArr.push(loan.condition_notes);
      if (returnData.condition_notes) notesArr.push(`Retour le ${new Date().toLocaleDateString('fr-FR')} : ${returnData.condition_notes}`);

      await loan.update({
        returned_quantity: newReturnedQty,
        returned_date: returnData.returned_date || new Date().toISOString().slice(0, 10),
        return_warehouse_id: returnWarehouseId,
        status: isFullReturn ? 'returned' : 'partially_returned',
        condition_notes: notesArr.join(' | '),
      }, { transaction });

      await StockMovement.create({
        stock_item_id: stockItem.id,
        movement_type: 'return_worksite',
        quantity: returnQty,
        stock_before: num(stockItem.quantity),
        stock_after: num(stockItem.quantity),
        unit_cost: num(stockItem.unit_price_avg),
        total_cost: returnQty * num(stockItem.unit_price_avg),
        reference_type: 'worksite',
        reference_id: worksiteId,
        notes: `Restitution de ${returnQty} ${stockItem.unit} à l'entrepôt ${destWarehouse.name}. ${returnData.condition_notes || ''}`,
        created_by: userId || null,
      }, { transaction });

      await transaction.commit();
      logger.info('↩️ Équipement restitué à l\'entrepôt', { worksiteId, loanId, returnQty, returnWarehouseId });
      return this.getById(worksiteId);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  // ===== Liste des équipements prêtés pour un chantier =====
  async getEquipmentLoans(worksiteId) {
    return WorksiteEquipmentLoan.findAll({
      where: { worksite_id: worksiteId },
      include: [
        { model: StockItem, as: 'stockItem' },
        { model: Warehouse, as: 'sourceWarehouse' },
        { model: Warehouse, as: 'returnWarehouse' },
        { model: User, as: 'creator', attributes: ['id', 'full_name'] },
      ],
      order: [['assigned_date', 'DESC']],
    });
  }

  // ===== Ajout de photos (avant / pendant / après) =====
  async addPhoto(worksiteId, photoUrl, phase = 'during', caption = null, userId = null) {
    const ws = await Worksite.findByPk(worksiteId);
    if (!ws) throw Object.assign(new Error('Chantier introuvable'), { status: 404 });

    return WorksitePhoto.create({
      worksite_id: worksiteId,
      photo_url: photoUrl,
      phase,
      caption,
      uploaded_by: userId,
    });
  }
}

module.exports = new WorksiteService();
