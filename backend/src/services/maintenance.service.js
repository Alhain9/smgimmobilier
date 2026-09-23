const { Maintenance, Apartment, User, MaintenanceImage, Property, Tenant, Expense, Task, MaintenanceMaterial, StockItem, StockMovement, sequelize } = require('../models');
const notificationService = require('./notification.service');
const { emitMaintenance, emitDashboard, emitNotification } = require('../config/socket');
const { logger } = require('../config/logger');

const num = (v) => parseFloat(v) || 0;

class MaintenanceService {
  _inc() {
    return [
      { model: Apartment, as: 'apartment', include: [{ model: Property, as: 'property', attributes: ['id', 'property_name', 'city', 'district'] }] },
      { model: User, as: 'technician', attributes: ['id', 'full_name'] },
      { model: User, as: 'team', attributes: ['id', 'full_name'], through: { attributes: [] } },
    ];
  }
  getAll(filters = {}) {
    const where = {};
    if (filters.status) where.status = filters.status;
    if (filters.assigned_technician_id) where.assigned_technician_id = filters.assigned_technician_id;
    return Maintenance.findAll({ where, include: this._inc(), order: [['created_at', 'DESC']] });
  }
  async getById(id) {
    const m = await Maintenance.findByPk(id, {
      include: [
        ...this._inc(),
        { model: MaintenanceImage, as: 'images', separate: true },
        { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }] },
        { model: Expense, as: 'expenses', separate: true, include: [{ model: User, as: 'creator', attributes: ['id', 'full_name'] }] },
        { model: Task, as: 'tasks', separate: true, include: [{ model: User, as: 'assignee', attributes: ['id', 'full_name'] }] },
        {
          model: MaintenanceMaterial, as: 'materialsUsed', separate: true,
          include: [
            { model: StockItem, as: 'stockItem', attributes: ['id', 'item_code', 'name', 'unit', 'category'] },
            { model: User, as: 'declarer', attributes: ['id', 'full_name'] },
          ],
        },
      ],
    });
    if (!m) throw Object.assign(new Error('Maintenance introuvable'), { status: 404 });
    return m;
  }
  // Définit l'équipe de techniciens d'un chantier (remplace l'existante) + notifie
  async setTeam(id, userIds) {
    const m = await Maintenance.findByPk(id);
    if (!m) throw Object.assign(new Error('Maintenance introuvable'), { status: 404 });
    const ids = [...new Set((userIds || []).map(Number).filter(Boolean))];
    await m.setTeam(ids);
    // Si aucun technicien principal défini, prendre le premier de l'équipe
    if (!m.assigned_technician_id && ids.length) {
      m.assigned_technician_id = ids[0];
      if (m.status === 'reported') m.status = 'in_progress';
      await m.save();
    }
    for (const uid of ids) {
      try {
        await notificationService.create({
          user_id: uid,
          title: 'Affectation à un chantier',
          message: `Vous faites partie de l'équipe du chantier « ${m.title} ».`,
        });
      } catch (_) { /* non bloquant */ }
    }
    return this.getById(id);
  }
  async create(data) {
    const m = await Maintenance.create(data);
    try {
      const full = await this.getById(m.id);
      const propId = full.apartment?.property?.id;
      emitMaintenance('nouvelle', { id: m.id, title: m.title, status: m.status }, propId);
      emitDashboard();
    } catch (_) {}
    logger.info('Maintenance créée', { maintenanceId: m.id, title: m.title });
    return m;
  }
  async update(id, data) {
    const m = await Maintenance.findByPk(id);
    if (!m) throw Object.assign(new Error('Maintenance introuvable'), { status: 404 });
    if (data.status === 'completed' && !m.completed_at) data.completed_at = new Date();
    const oldStatus = m.status;
    await m.update(data);
    try {
      const full = await this.getById(id);
      const propId = full.apartment?.property?.id;
      if (data.status && data.status !== oldStatus) {
        emitMaintenance('statut_change', { id: m.id, title: m.title, oldStatus, newStatus: data.status }, propId);
      } else {
        emitMaintenance('modifiee', { id: m.id, title: m.title }, propId);
      }
      emitDashboard();
    } catch (_) {}
    logger.info('Maintenance mise à jour', { maintenanceId: id, status: m.status });
    return this.getById(id);
  }
  async assign(id, technicianId) {
    const m = await Maintenance.findByPk(id);
    if (!m) throw Object.assign(new Error('Maintenance introuvable'), { status: 404 });
    m.assigned_technician_id = technicianId;
    if (m.status === 'reported') m.status = 'in_progress';
    await m.save();
    // Notifie le technicien assigné
    try {
      await notificationService.create({
        user_id: technicianId,
        title: 'Nouvelle intervention assignée',
        message: `La maintenance « ${m.title} » vous a été assignée.`,
      });
    } catch (_) { /* non bloquant */ }
    return this.getById(id);
  }
  async remove(id) {
    const m = await Maintenance.findByPk(id);
    if (!m) throw Object.assign(new Error('Maintenance introuvable'), { status: 404 });
    await m.destroy(); return true;
  }
  addImage(maintenanceId, imageUrl, type) {
    return MaintenanceImage.create({ maintenance_id: maintenanceId, image_url: imageUrl, image_type: type });
  }

  // ===== Déclarer du matériel utilisé sur une intervention =====
  // Déduit automatiquement le stock et crée la dépense imputée à l'immeuble
  async declareMaterials(maintenanceId, materials = [], userId) {
    if (!Array.isArray(materials) || !materials.length) {
      throw Object.assign(new Error('Veuillez spécifier les articles utilisés'), { status: 400 });
    }

    const maintenance = await Maintenance.findByPk(maintenanceId, {
      include: [{ model: Apartment, as: 'apartment' }],
    });
    if (!maintenance) throw Object.assign(new Error('Maintenance introuvable'), { status: 404 });

    const propertyId = maintenance.apartment ? maintenance.apartment.property_id : null;
    const transaction = await sequelize.transaction();

    try {
      for (const line of materials) {
        const stockItem = await StockItem.findByPk(line.stock_item_id, { transaction });
        if (!stockItem) throw new Error(`Article ID ${line.stock_item_id} introuvable en stock`);

        const qty = num(line.quantity);
        if (qty <= 0) continue;

        const currentStock = num(stockItem.quantity);
        if (currentStock < qty) {
          throw new Error(`Stock insuffisant pour « ${stockItem.name} » (Disponible : ${currentStock} ${stockItem.unit}, Demandé : ${qty})`);
        }

        const unitCost = num(stockItem.unit_price_avg) || num(stockItem.last_purchase_price) || 0;
        const totalCost = qty * unitCost;
        const stockAfter = currentStock - qty;

        // 1. Déduire le stock
        await stockItem.update({ quantity: stockAfter }, { transaction });

        // 2. Journaliser le mouvement de stock
        await StockMovement.create({
          stock_item_id: stockItem.id,
          movement_type: 'out_maintenance',
          quantity: qty,
          stock_before: currentStock,
          stock_after: stockAfter,
          unit_cost: unitCost,
          total_cost: totalCost,
          reference_type: 'maintenance',
          reference_id: maintenance.id,
          notes: `Utilisé pour intervention « ${maintenance.title} »`,
          created_by: userId || null,
        }, { transaction });

        // 3. Enregistrer le matériel utilisé
        await MaintenanceMaterial.create({
          maintenance_id: maintenance.id,
          stock_item_id: stockItem.id,
          quantity_used: qty,
          unit_cost: unitCost,
          total_cost: totalCost,
          declared_by: userId || null,
          date_used: new Date(),
        }, { transaction });

        // 4. Imputer la dépense sur l'immeuble (pour le rapport financier du bailleur)
        await Expense.create({
          maintenance_id: maintenance.id,
          property_id: propertyId,
          expense_type: 'maintenance',
          item_name: `${stockItem.name} (${qty} ${stockItem.unit})`,
          category: stockItem.category || 'Maintenance',
          quantity: qty,
          unit_price: unitCost,
          total_price: totalCost,
          created_by: userId || null,
        }, { transaction });
      }

      await transaction.commit();
      logger.info('🔧 Matériel consommé sur maintenance', { maintenanceId, count: materials.length });

      try {
        const propId = maintenance.apartment?.property_id;
        emitMaintenance('materiel_ajoute', { id: maintenance.id }, propId);
        emitDashboard();
      } catch (_) {}

      return this.getById(maintenanceId);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
}
module.exports = new MaintenanceService();
