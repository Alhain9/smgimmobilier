// ============ Service Stock & Consommables — SMG IMMOBILIER ============
const { StockItem, StockPurchase, StockPurchaseItem, StockMovement, Supplier, User, sequelize } = require('../models');
const { Op } = require('sequelize');
const { logger } = require('../config/logger');

const num = (v) => parseFloat(v) || 0;

class StockService {
  // ===== Numérotation automatique des achats =====
  async _nextPurchaseNumber() {
    const year = new Date().getFullYear();
    const prefix = `ACH-${year}`;
    const last = await StockPurchase.findOne({
      where: { purchase_number: { [Op.like]: `${prefix}-%` } },
      order: [['id', 'DESC']],
      attributes: ['purchase_number'],
    });

    let seq = 1;
    if (last && last.purchase_number) {
      const parts = last.purchase_number.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    return `${prefix}-${String(seq).padStart(5, '0')}`;
  }

  // ===== Génération code article auto =====
  async _nextItemCode(category) {
    const pfx = (category || 'GEN').slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    const last = await StockItem.findOne({
      where: { item_code: { [Op.like]: `${pfx}-%` } },
      order: [['id', 'DESC']],
      attributes: ['item_code'],
    });
    let seq = 1;
    if (last && last.item_code) {
      const parts = last.item_code.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    return `${pfx}-${String(seq).padStart(4, '0')}`;
  }

  // ===== Liste des articles en stock =====
  async getAllItems(filters = {}) {
    const { Warehouse } = require('../models');
    const where = {};
    if (filters.category) where.category = filters.category;
    if (filters.item_type) where.item_type = filters.item_type;
    if (filters.warehouse_id) where.warehouse_id = filters.warehouse_id;
    if (filters.is_active != null) where.is_active = filters.is_active;
    if (filters.search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${filters.search}%` } },
        { item_code: { [Op.like]: `%${filters.search}%` } },
        { category: { [Op.like]: `%${filters.search}%` } },
      ];
    }
    if (filters.low_stock) {
      where[Op.and] = sequelize.where(
        sequelize.col('StockItem.quantity'),
        '<=',
        sequelize.col('StockItem.min_alert_threshold')
      );
    }

    const warehouseWhere = {};
    if (filters.city) {
      warehouseWhere.city = filters.city;
    }

    const items = await StockItem.findAll({
      where,
      include: [
        {
          model: Warehouse,
          as: 'warehouse',
          where: Object.keys(warehouseWhere).length ? warehouseWhere : undefined,
          required: Boolean(filters.city),
          attributes: ['id', 'name', 'city', 'address', 'phone'],
        },
      ],
      order: [['name', 'ASC']],
    });

    return items.map((it) => {
      const o = it.toJSON();
      o.is_low_stock = num(o.quantity) <= num(o.min_alert_threshold);
      o.stock_value = num(o.quantity) * num(o.unit_price_avg);
      o.available_quantity = Math.max(0, num(o.quantity) - num(o.quantity_loaned));
      return o;
    });
  }

  // ===== Détail d'un article avec ses derniers mouvements =====
  async getItemById(id) {
    const item = await StockItem.findByPk(id, {
      include: [
        {
          model: StockMovement, as: 'movements',
          limit: 30,
          order: [['created_at', 'DESC']],
          include: [{ model: User, as: 'author', attributes: ['id', 'full_name'] }],
        },
      ],
    });
    if (!item) throw Object.assign(new Error('Article de stock introuvable'), { status: 404 });
    const o = item.toJSON();
    o.is_low_stock = num(o.quantity) <= num(o.min_alert_threshold);
    o.stock_value = num(o.quantity) * num(o.unit_price_avg);
    return o;
  }

  // ===== Créer un nouvel article =====
  async createItem(data) {
    if (!data.item_code) {
      data.item_code = await this._nextItemCode(data.category);
    }
    const item = await StockItem.create(data);
    logger.info('📦 Nouvel article de stock créé', { item_code: item.item_code, name: item.name });
    return item;
  }

  // ===== Mettre à jour un article =====
  async updateItem(id, data) {
    const item = await StockItem.findByPk(id);
    if (!item) throw Object.assign(new Error('Article de stock introuvable'), { status: 404 });
    await item.update(data);
    return item;
  }

  // ===== Supprimer / désactiver un article =====
  async removeItem(id) {
    const item = await StockItem.findByPk(id);
    if (!item) throw Object.assign(new Error('Article de stock introuvable'), { status: 404 });
    await item.update({ is_active: false });
    return true;
  }

  // ===== Enregistrer un Achat / Réception de stock =====
  async recordPurchase(data, userId) {
    const items = data.items || [];
    if (!items.length) throw Object.assign(new Error('Le bon d\'achat doit comporter au moins un article'), { status: 400 });

    const transaction = await sequelize.transaction();

    try {
      const purchaseNumber = await this._nextPurchaseNumber();

      let totalAmount = 0;
      items.forEach((it) => {
        totalAmount += num(it.quantity) * num(it.unit_price);
      });

      const purchase = await StockPurchase.create({
        purchase_number: purchaseNumber,
        supplier_id: data.supplier_id || null,
        purchase_date: data.purchase_date || new Date().toISOString().slice(0, 10),
        total_amount: totalAmount,
        invoice_number: data.invoice_number || null,
        invoice_file: data.invoice_file || null,
        notes: data.notes || null,
        created_by: userId || null,
        status: 'received',
      }, { transaction });

      // Traiter chaque ligne d'article
      for (const line of items) {
        const stockItem = await StockItem.findByPk(line.stock_item_id, { transaction });
        if (!stockItem) throw new Error(`Article ID ${line.stock_item_id} introuvable`);

        const qty = num(line.quantity);
        const unitPrice = num(line.unit_price);
        const lineTotal = qty * unitPrice;

        await StockPurchaseItem.create({
          purchase_id: purchase.id,
          stock_item_id: stockItem.id,
          quantity: qty,
          unit_price: unitPrice,
          total_price: lineTotal,
        }, { transaction });

        const stockBefore = num(stockItem.quantity);
        const stockAfter = stockBefore + qty;

        // Calcul du PUMP (Prix Unitaire Moyen Pondéré)
        const oldVal = stockBefore * num(stockItem.unit_price_avg);
        const newVal = lineTotal;
        const newPump = stockAfter > 0 ? (oldVal + newVal) / stockAfter : unitPrice;

        await stockItem.update({
          quantity: stockAfter,
          unit_price_avg: newPump,
          last_purchase_price: unitPrice,
        }, { transaction });

        // Journal immuable du mouvement
        await StockMovement.create({
          stock_item_id: stockItem.id,
          movement_type: 'in_purchase',
          quantity: qty,
          stock_before: stockBefore,
          stock_after: stockAfter,
          unit_cost: unitPrice,
          total_cost: lineTotal,
          reference_type: 'purchase',
          reference_id: purchase.id,
          notes: `Réception Achat N° ${purchaseNumber}${data.invoice_number ? ` (Facture ${data.invoice_number})` : ''}`,
          created_by: userId || null,
        }, { transaction });
      }

      await transaction.commit();
      logger.info('📦 Réception d\'achat de stock validée', { purchase_number: purchaseNumber, total: totalAmount });

      return this.getPurchaseById(purchase.id);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  // ===== Liste des achats / réceptions =====
  async getPurchases(filters = {}) {
    const where = {};
    if (filters.supplier_id) where.supplier_id = filters.supplier_id;
    if (filters.status) where.status = filters.status;
    if (filters.start && filters.end) {
      where.purchase_date = { [Op.between]: [filters.start, filters.end] };
    }

    return StockPurchase.findAll({
      where,
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'name', 'phone', 'city'] },
        { model: User, as: 'creator', attributes: ['id', 'full_name'] },
        {
          model: StockPurchaseItem, as: 'items',
          include: [{ model: StockItem, as: 'stockItem', attributes: ['id', 'item_code', 'name', 'unit'] }],
        },
      ],
      order: [['purchase_date', 'DESC']],
    });
  }

  // ===== Détail d'un achat =====
  async getPurchaseById(id) {
    const purchase = await StockPurchase.findByPk(id, {
      include: [
        { model: Supplier, as: 'supplier' },
        { model: User, as: 'creator', attributes: ['id', 'full_name', 'phone'] },
        {
          model: StockPurchaseItem, as: 'items',
          include: [{ model: StockItem, as: 'stockItem' }],
        },
      ],
    });
    if (!purchase) throw Object.assign(new Error('Achat de stock introuvable'), { status: 404 });
    return purchase;
  }

  // ===== Liste des mouvements de stock (Journal complet) =====
  async getMovements(filters = {}) {
    const where = {};
    if (filters.stock_item_id) where.stock_item_id = filters.stock_item_id;
    if (filters.movement_type) where.movement_type = filters.movement_type;
    if (filters.reference_type) where.reference_type = filters.reference_type;
    if (filters.start && filters.end) {
      where.created_at = { [Op.between]: [`${filters.start} 00:00:00`, `${filters.end} 23:59:59`] };
    }

    return StockMovement.findAll({
      where,
      include: [
        { model: StockItem, as: 'stockItem', attributes: ['id', 'item_code', 'name', 'unit', 'category'] },
        { model: User, as: 'author', attributes: ['id', 'full_name'] },
      ],
      order: [['created_at', 'DESC']],
      limit: filters.limit ? parseInt(filters.limit, 10) : 200,
    });
  }

  // ===== Transfert de stock entre deux entrepôts =====
  async transferStock({ stock_item_id, from_warehouse_id, to_warehouse_id, quantity, notes }, userId) {
    const { Warehouse } = require('../models');
    const qty = num(quantity);
    if (qty <= 0) throw new Error('La quantité à transférer doit être positive');
    if (from_warehouse_id === to_warehouse_id) throw new Error('L\'entrepôt source et l\'entrepôt destination doivent être différents');

    const sourceItem = await StockItem.findByPk(stock_item_id);
    if (!sourceItem) throw new Error('Article source introuvable');
    if (num(sourceItem.quantity) < qty) {
      throw new Error(`Stock insuffisant à l'entrepôt source (Disponible : ${sourceItem.quantity} ${sourceItem.unit})`);
    }

    const [fromW, toW] = await Promise.all([
      Warehouse.findByPk(from_warehouse_id),
      Warehouse.findByPk(to_warehouse_id),
    ]);
    if (!fromW || !toW) throw new Error('Entrepôt source ou destination introuvable');

    const transaction = await sequelize.transaction();
    try {
      // Déduire de l'entrepôt source
      const sourceBefore = num(sourceItem.quantity);
      const sourceAfter = sourceBefore - qty;
      await sourceItem.update({ quantity: sourceAfter }, { transaction });

      // Chercher si l'article existe déjà dans l'entrepôt destination
      let destItem = await StockItem.findOne({
        where: {
          item_code: sourceItem.item_code,
          warehouse_id: to_warehouse_id,
        },
        transaction,
      });

      if (!destItem) {
        destItem = await StockItem.create({
          warehouse_id: to_warehouse_id,
          item_code: sourceItem.item_code,
          name: sourceItem.name,
          category: sourceItem.category,
          item_type: sourceItem.item_type,
          unit: sourceItem.unit,
          quantity: qty,
          min_alert_threshold: sourceItem.min_alert_threshold,
          unit_price_avg: sourceItem.unit_price_avg,
          last_purchase_price: sourceItem.last_purchase_price,
          location: `Transféré depuis ${fromW.name}`,
          description: sourceItem.description,
        }, { transaction });
      } else {
        await destItem.update({ quantity: num(destItem.quantity) + qty }, { transaction });
      }

      await StockMovement.create({
        stock_item_id: sourceItem.id,
        movement_type: 'adjustment_out',
        quantity: qty,
        stock_before: sourceBefore,
        stock_after: sourceAfter,
        unit_cost: num(sourceItem.unit_price_avg),
        total_cost: qty * num(sourceItem.unit_price_avg),
        reference_type: 'other',
        notes: `Transfert de ${fromW.name} vers ${toW.name}. ${notes || ''}`,
        created_by: userId || null,
      }, { transaction });

      await transaction.commit();
      logger.info('📦 Transfert de stock effectué', { stock_item_id, from_warehouse_id, to_warehouse_id, quantity: qty });
      return { success: true, message: `Transfert de ${qty} ${sourceItem.unit} effectué de ${fromW.name} vers ${toW.name}` };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  // ===== Alertes stock bas =====
  async getLowStockAlerts() {
    return this.getAllItems({ low_stock: true, is_active: true });
  }

  // ===== Statistiques de synthèse du stock =====
  async getStockSummary() {
    const items = await StockItem.findAll({ where: { is_active: true } });
    const totalArticles = items.length;
    const totalValue = items.reduce((s, it) => s + (num(it.quantity) * num(it.unit_price_avg)), 0);
    const lowStockCount = items.filter((it) => num(it.quantity) <= num(it.min_alert_threshold)).length;
    const outOfStockCount = items.filter((it) => num(it.quantity) <= 0).length;

    // Répartition par catégorie
    const byCatMap = {};
    items.forEach((it) => {
      const cat = it.category || 'Autre';
      if (!byCatMap[cat]) byCatMap[cat] = { category: cat, count: 0, total_value: 0 };
      byCatMap[cat].count += 1;
      byCatMap[cat].total_value += num(it.quantity) * num(it.unit_price_avg);
    });

    return {
      total_articles: totalArticles,
      total_stock_value: totalValue,
      low_stock_count: lowStockCount,
      out_of_stock_count: outOfStockCount,
      by_category: Object.values(byCatMap).sort((a, b) => b.total_value - a.total_value),
    };
  }
}

module.exports = new StockService();
