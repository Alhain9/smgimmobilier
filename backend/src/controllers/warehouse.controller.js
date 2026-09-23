// ============ Contrôleur Entrepôts & Stocks Multi-Sites — SMG IMMOBILIER ============
const { Warehouse, StockItem, User, Property, sequelize } = require('../models');
const { logger } = require('../config/logger');

class WarehouseController {
  /**
   * GET /api/warehouses
   * Liste des entrepôts avec filtrage par ville, immeuble et statistiques
   */
  async list(req, res) {
    try {
      const { city, warehouse_type, property_id, is_active } = req.query;
      const where = {};

      if (city) where.city = city;
      if (warehouse_type) where.warehouse_type = warehouse_type;
      if (property_id) where.property_id = property_id;
      if (is_active !== undefined) where.is_active = is_active === 'true' || is_active === '1';

      const warehouses = await Warehouse.findAll({
        where,
        include: [
          { model: User, as: 'manager', attributes: ['id', 'full_name', 'phone', 'email'] },
          { model: Property, as: 'property', attributes: ['id', 'property_name', 'address', 'city'] },
          { model: StockItem, as: 'items', attributes: ['id', 'quantity', 'quantity_loaned', 'unit_price_avg', 'item_type'] },
        ],
        order: [['city', 'ASC'], ['name', 'ASC']],
      });

      // Calculer les KPI de chaque entrepôt
      const data = warehouses.map((w) => {
        const items = w.items || [];
        const totalItemsCount = items.length;
        const totalStockQty = items.reduce((s, it) => s + parseFloat(it.quantity || 0), 0);
        const totalLoanedQty = items.reduce((s, it) => s + parseFloat(it.quantity_loaned || 0), 0);
        const totalStockValue = items.reduce((s, it) => s + (parseFloat(it.quantity || 0) * parseFloat(it.unit_price_avg || 0)), 0);

        return {
          id: w.id,
          name: w.name,
          city: w.city,
          warehouse_type: w.warehouse_type || 'mixed',
          description: w.description || null,
          address: w.address,
          property_id: w.property_id,
          property: w.property,
          phone: w.phone,
          is_active: w.is_active,
          manager: w.manager,
          created_at: w.createdAt,
          stats: {
            items_count: totalItemsCount,
            total_quantity: Math.round(totalStockQty * 100) / 100,
            loaned_quantity: Math.round(totalLoanedQty * 100) / 100,
            total_value: Math.round(totalStockValue),
          },
        };
      });

      // Liste des villes distinctes disponibles
      const cities = [...new Set(warehouses.map((w) => w.city))];

      return res.json({
        success: true,
        data,
        cities,
      });
    } catch (err) {
      logger.error('Erreur récupération entrepôts:', err);
      return res.status(500).json({ success: false, message: 'Erreur lors de la récupération des entrepôts' });
    }
  }

  /**
   * GET /api/warehouses/:id
   * Détails d'un entrepôt spécifique et de son inventaire
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const warehouse = await Warehouse.findByPk(id, {
        include: [
          { model: User, as: 'manager', attributes: ['id', 'full_name', 'phone', 'email'] },
          { model: Property, as: 'property', attributes: ['id', 'property_name', 'address', 'city'] },
          { model: StockItem, as: 'items' },
        ],
      });

      if (!warehouse) {
        return res.status(404).json({ success: false, message: 'Entrepôt non trouvé' });
      }

      return res.json({ success: true, data: warehouse });
    } catch (err) {
      logger.error('Erreur récupération entrepôt:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  /**
   * POST /api/warehouses
   * Créer un nouvel entrepôt
   */
  async create(req, res) {
    try {
      const { name, city, address, property_id, manager_id, phone, warehouse_type, description } = req.body;

      if (!name || !city) {
        return res.status(400).json({ success: false, message: 'Le nom et la ville sont obligatoires' });
      }

      const warehouse = await Warehouse.create({
        name: name.trim(),
        city: city.trim(),
        warehouse_type: ['stocks', 'equipment', 'mixed'].includes(warehouse_type) ? warehouse_type : 'mixed',
        description: description ? description.trim() : null,
        address: address ? address.trim() : null,
        property_id: property_id ? parseInt(property_id, 10) : null,
        manager_id: manager_id ? parseInt(manager_id, 10) : null,
        phone: phone ? phone.trim() : null,
        is_active: true,
      });

      logger.info('🏢 Nouvel entrepôt créé', { id: warehouse.id, name: warehouse.name, city: warehouse.city, type: warehouse.warehouse_type });
      return res.status(201).json({ success: true, message: 'Entrepôt créé avec succès', data: warehouse });
    } catch (err) {
      logger.error('Erreur création entrepôt:', err);
      return res.status(500).json({ success: false, message: err.message || 'Erreur lors de la création de l\'entrepôt' });
    }
  }

  /**
   * PUT /api/warehouses/:id
   * Mettre à jour un entrepôt
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const warehouse = await Warehouse.findByPk(id);

      if (!warehouse) {
        return res.status(404).json({ success: false, message: 'Entrepôt non trouvé' });
      }

      const { name, city, address, property_id, manager_id, phone, warehouse_type, description, is_active } = req.body;

      await warehouse.update({
        name: name !== undefined ? name.trim() : warehouse.name,
        city: city !== undefined ? city.trim() : warehouse.city,
        warehouse_type: warehouse_type !== undefined ? warehouse_type : warehouse.warehouse_type,
        description: description !== undefined ? (description ? description.trim() : null) : warehouse.description,
        address: address !== undefined ? address.trim() : warehouse.address,
        property_id: property_id !== undefined ? (property_id ? parseInt(property_id, 10) : null) : warehouse.property_id,
        manager_id: manager_id !== undefined ? (manager_id ? parseInt(manager_id, 10) : null) : warehouse.manager_id,
        phone: phone !== undefined ? phone.trim() : warehouse.phone,
        is_active: is_active !== undefined ? Boolean(is_active) : warehouse.is_active,
      });

      return res.json({ success: true, message: 'Entrepôt mis à jour avec succès', data: warehouse });
    } catch (err) {
      logger.error('Erreur mise à jour entrepôt:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }

  /**
   * DELETE /api/warehouses/:id
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      const warehouse = await Warehouse.findByPk(id);

      if (!warehouse) {
        return res.status(404).json({ success: false, message: 'Entrepôt non trouvé' });
      }

      // Vérifier si des articles sont rattachés
      const itemCount = await StockItem.count({ where: { warehouse_id: id } });
      if (itemCount > 0) {
        // Désactivation au lieu d'une suppression brute pour préserver l'intégrité
        await warehouse.update({ is_active: false });
        return res.json({ success: true, message: `Entrepôt désactivé (${itemCount} article(s) encore rattaché(s))` });
      }

      await warehouse.destroy();
      return res.json({ success: true, message: 'Entrepôt supprimé avec succès' });
    } catch (err) {
      logger.error('Erreur suppression entrepôt:', err);
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
}

module.exports = new WarehouseController();
