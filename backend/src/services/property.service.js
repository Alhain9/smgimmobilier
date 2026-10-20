const { Property, Apartment, Tenant, Lease, Payment, Maintenance, UtilityBill, User, ManagerProperty } = require('../models');
const { Op } = require('sequelize');

class PropertyService {
  /**
   * Retourne tous les immeubles.
   * Si assignedPropertyIds est fourni (gestionnaire/comptable), les immeubles affectés
   * au gestionnaire apparaissent EN PREMIER, puis tous les autres.
   */
  async getAll(filters = {}, ownerPropertyIds = null, assignedPropertyIds = null) {
    const where = {};
    if (Array.isArray(ownerPropertyIds)) {
      where.id = { [Op.in]: ownerPropertyIds };
    } else if (filters && filters.owner_id) {
      where.owner_id = filters.owner_id;
    }

    const include = [
      { model: Apartment, as: 'apartments' },
      { model: User, as: 'owner', attributes: ['id', 'full_name', 'phone', 'email'] },
    ];

    const all = await Property.findAll({
      where,
      include,
      order: [['created_at', 'DESC']],
    });

    // Si le gestionnaire a des immeubles affectés, les mettre en premier
    if (Array.isArray(assignedPropertyIds) && assignedPropertyIds.length > 0) {
      const assigned = all.filter((p) => assignedPropertyIds.includes(Number(p.id)));
      const others = all.filter((p) => !assignedPropertyIds.includes(Number(p.id)));
      // Marquer les immeubles affectés pour le frontend
      assigned.forEach((p) => { p.dataValues.is_assigned = true; });
      others.forEach((p) => { p.dataValues.is_assigned = false; });
      return [...assigned, ...others];
    }

    return all;
  }
  async getById(id) {
    const p = await Property.findByPk(id, {
      include: [
        { model: Apartment, as: 'apartments' },
        { model: User, as: 'owner', attributes: ['id', 'full_name', 'phone', 'email'] },
      ],
    });
    if (!p) throw Object.assign(new Error('Immeuble introuvable'), { status: 404 });
    return p;
  }
  // Préfixe de numérotation par type de logement
  _prefix(type) {
    const map = {
      appartement: 'APP', studio: 'STU', chambre: 'CHB', duplex: 'DUP', villa: 'VIL',
      boutique: 'BTQ', bureau: 'BUR', magasin: 'MAG', espace_commercial: 'ECO',
    };
    return map[type] || String(type || 'LOG').slice(0, 3).toUpperCase();
  }

  // Crée l'immeuble et, si une composition est fournie, génère automatiquement les logements sans collision de numéro
  async create(data) {
    const { composition, ...propData } = data;
    const { sequelize } = require('../config/database');
    const transaction = await sequelize.transaction();

    try {
      const property = await Property.create(propData, { transaction });

      if (Array.isArray(composition) && composition.length) {
        const rows = [];
        let total = 0;
        const prefixCounters = {};

        composition.forEach((c) => {
          const type = c.apartment_type || c.type;
          let count = parseInt(c.count != null ? c.count : c.nombre, 10) || 0;
          const rent = parseFloat(c.rent_amount != null ? c.rent_amount : c.loyer) || 0;
          if (!type || count <= 0) return;
          if (count > 200) count = 200; // garde-fou
          const prefix = this._prefix(type);
          if (!prefixCounters[prefix]) prefixCounters[prefix] = 0;

          for (let i = 1; i <= count && total < 500; i++, total++) {
            prefixCounters[prefix]++;
            rows.push({
              property_id: property.id,
              apartment_number: `${prefix}-${String(prefixCounters[prefix]).padStart(2, '0')}`,
              apartment_type: type,
              rent_amount: rent,
              status: 'free',
            });
          }
        });

        if (rows.length) {
          await Apartment.bulkCreate(rows, { transaction });
        }
      }

      await transaction.commit();
      return this.getById(property.id);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  async update(id, data) {
    const p = await Property.findByPk(id);
    if (!p) throw Object.assign(new Error('Immeuble introuvable'), { status: 404 });
    await p.update(data); return this.getById(id);
  }

  async remove(id) {
    const p = await Property.findByPk(id);
    if (!p) throw Object.assign(new Error('Immeuble introuvable'), { status: 404 });

    const { Receipt, Expense, PaymentHistory } = require('../models');
    const { sequelize } = require('../config/database');
    const { emitDashboard } = require('../config/socket');

    // 1. Trouver TOUS les logements de cet immeuble, y compris ceux déjà soft-deleted
    const apts = await Apartment.findAll({
      where: { property_id: id },
      paranoid: false,
    });
    const aptIds = apts.map(a => a.id);

    // 2. Cascade delete de toutes les entités liées aux logements
    if (aptIds.length) {
      const pays = await Payment.findAll({ where: { apartment_id: aptIds } });
      const payIds = pays.map(x => x.id);
      if (payIds.length) {
        await PaymentHistory.destroy({ where: { payment_id: payIds } });
        await Receipt.destroy({ where: { payment_id: payIds } });
      }
      await Receipt.destroy({ where: { apartment_id: aptIds } });
      await Payment.destroy({ where: { apartment_id: aptIds } });
      await Lease.destroy({ where: { apartment_id: aptIds } });
      await Maintenance.destroy({ where: { apartment_id: aptIds } });
      await UtilityBill.destroy({ where: { apartment_id: aptIds } });
      await Tenant.destroy({ where: { apartment_id: aptIds } });
      try {
        await sequelize.query('DELETE FROM situation_overrides WHERE apartment_id IN (:aptIds)', {
          replacements: { aptIds },
        });
      } catch (_) {}
      await Apartment.destroy({ where: { property_id: id }, force: true });
    }

    // 3. Nettoyer les entités directement rattachées à la propriété
    await Receipt.destroy({ where: { property_id: id } });
    await Expense.destroy({ where: { property_id: id } });
    await ManagerProperty.destroy({ where: { property_id: id } });
    try {
      await sequelize.query('DELETE FROM situation_overrides WHERE property_id = :propId', {
        replacements: { propId: id },
      });
    } catch (_) {}

    await p.destroy();

    // 4. Notification en temps réel du dashboard
    try {
      emitDashboard();
    } catch (_) {}

    return true;
  }

  async bulkRemove(ids) {
    if (!Array.isArray(ids) || !ids.length) return 0;
    let count = 0;
    for (const id of ids) {
      try {
        await this.remove(id);
        count++;
      } catch (_) {}
    }
    return count;
  }
}
module.exports = new PropertyService();
