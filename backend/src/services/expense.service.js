const { Expense, Maintenance, Apartment, Property, User } = require('../models');
const { Op } = require('sequelize');

class ExpenseService {
  async getAll(query = {}, ownerPropertyIds = null, assignedPropertyIds = null, user = null) {
    const where = {};

    // 1. Filtrage strict par propriété pour les bailleurs
    if (Array.isArray(ownerPropertyIds)) {
      if (query.property_id) {
        const pId = Number(query.property_id);
        if (!ownerPropertyIds.includes(pId)) {
          return []; // Pas autorisé à voir cette propriété
        }
        where.property_id = pId;
      } else {
        where.property_id = { [Op.in]: ownerPropertyIds };
      }
    } else if (Array.isArray(assignedPropertyIds) && assignedPropertyIds.length > 0) {
      // Gestionnaire / Comptable avec immeubles assignés
      if (query.property_id) {
        const pId = Number(query.property_id);
        if (!assignedPropertyIds.includes(pId)) return [];
        where.property_id = pId;
      } else {
        where.property_id = { [Op.in]: assignedPropertyIds };
      }
    } else if (query.property_id) {
      where.property_id = Number(query.property_id);
    }

    // 2. Filtre par type de dépense (ex: gardiennage, maintenance, utility, etc.)
    if (query.expense_type) {
      where.expense_type = query.expense_type;
    }

    // 3. Filtre par mois / période (ex: 2026-09 ou Septembre 2026)
    if (query.period_month) {
      where.period_month = { [Op.like]: `%${query.period_month}%` };
    }

    // 4. Filtre par date de paiement / création
    if (query.start_date && query.end_date) {
      where[Op.or] = [
        { payment_date: { [Op.between]: [query.start_date, query.end_date] } },
        { created_at: { [Op.between]: [`${query.start_date} 00:00:00`, `${query.end_date} 23:59:59`] } },
      ];
    } else if (query.start_date) {
      where[Op.or] = [
        { payment_date: { [Op.gte]: query.start_date } },
        { created_at: { [Op.gte]: `${query.start_date} 00:00:00` } },
      ];
    }

    // 5. Recherche par mot-clé (gardien, équipement, fournisseur, etc.)
    if (query.search) {
      const q = `%${query.search.trim()}%`;
      where[Op.or] = [
        { item_name: { [Op.like]: q } },
        { caretaker_name: { [Op.like]: q } },
        { category: { [Op.like]: q } },
        { supplier: { [Op.like]: q } },
      ];
    }

    return Expense.findAll({
      where,
      include: [
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'property_name', 'address', 'city', 'caretaker_name', 'caretaker_phone', 'caretaker_salary', 'owner_id'],
          include: [{ model: User, as: 'owner', attributes: ['id', 'full_name', 'phone'] }],
        },
        {
          model: Maintenance,
          as: 'maintenance',
          attributes: ['id', 'title', 'apartment_id', 'status'],
          include: [{ model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number'] }],
        },
        { model: User, as: 'creator', attributes: ['id', 'full_name', 'role_id'] },
      ],
      order: [
        ['payment_date', 'DESC'],
        ['created_at', 'DESC'],
      ],
    });
  }

  async getStats(query = {}, ownerPropertyIds = null, assignedPropertyIds = null) {
    const list = await this.getAll(query, ownerPropertyIds, assignedPropertyIds);
    let totalAmount = 0;
    let caretakerAmount = 0;
    let maintenanceAmount = 0;
    let utilityAmount = 0;
    let otherAmount = 0;

    list.forEach((e) => {
      const price = parseFloat(e.total_price || (e.unit_price * (e.quantity || 1)) || 0);
      totalAmount += price;
      if (e.expense_type === 'gardiennage' || (e.category && e.category.toLowerCase().includes('gardien'))) {
        caretakerAmount += price;
      } else if (e.expense_type === 'maintenance' || e.maintenance_id) {
        maintenanceAmount += price;
      } else if (e.expense_type === 'utility') {
        utilityAmount += price;
      } else {
        otherAmount += price;
      }
    });

    return {
      totalCount: list.length,
      totalAmount,
      caretakerAmount,
      maintenanceAmount,
      utilityAmount,
      otherAmount,
    };
  }

  async getById(id, ownerPropertyIds = null) {
    const e = await Expense.findByPk(id, {
      include: [
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'property_name', 'address', 'city', 'caretaker_name', 'caretaker_phone', 'caretaker_salary', 'owner_id'],
          include: [{ model: User, as: 'owner', attributes: ['id', 'full_name', 'phone'] }],
        },
        {
          model: Maintenance,
          as: 'maintenance',
          include: [{ model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number'] }],
        },
        { model: User, as: 'creator', attributes: ['id', 'full_name'] },
      ],
    });
    if (!e) throw Object.assign(new Error('Dépense introuvable'), { status: 404 });

    if (Array.isArray(ownerPropertyIds)) {
      const pId = e.property_id || (e.maintenance?.apartment?.property_id);
      if (!pId || !ownerPropertyIds.includes(Number(pId))) {
        throw Object.assign(new Error('Accès refusé à cette dépense'), { status: 403 });
      }
    }

    return e;
  }

  async create(data, userId = null) {
    const payload = { ...data };
    if (userId) payload.created_by = userId;

    // Coerce is_landlord_expense from FormData string to boolean
    if ('is_landlord_expense' in payload) {
      payload.is_landlord_expense = payload.is_landlord_expense === '1' || payload.is_landlord_expense === true || payload.is_landlord_expense === 1;
    }

    // Si c'est un salaire de gardiennage — auto-set landlord expense
    if (payload.expense_type === 'gardiennage' && !('is_landlord_expense' in data)) {
      payload.is_landlord_expense = true;
    }

    if (payload.expense_type === 'gardiennage') {
      if (!payload.category) payload.category = 'Gardiennage & Sécurité';
      if (!payload.payment_date) payload.payment_date = new Date().toISOString().slice(0, 10);
      payload.quantity = 1;
      if (payload.amount && !payload.unit_price) payload.unit_price = payload.amount;

      // Si le nom du gardien n'est pas fourni mais la propriété l'est, auto-compléter depuis l'immeuble
      if (payload.property_id && !payload.caretaker_name) {
        const prop = await Property.findByPk(payload.property_id);
        if (prop && prop.caretaker_name) {
          payload.caretaker_name = prop.caretaker_name;
        }
      }
      if (!payload.item_name) {
        payload.item_name = `Salaire Gardien${payload.caretaker_name ? ` - ${payload.caretaker_name}` : ''}${payload.period_month ? ` (${payload.period_month})` : ''}`;
      }
    }

    // Si lié à une maintenance et sans property_id direct, trouver la propriété via l'appartement
    if (payload.maintenance_id && !payload.property_id) {
      const maint = await Maintenance.findByPk(payload.maintenance_id, {
        include: [{ model: Apartment, as: 'apartment', attributes: ['property_id'] }],
      });
      if (maint?.apartment?.property_id) {
        payload.property_id = maint.apartment.property_id;
      }
    }

    const e = await Expense.create(payload);
    await e.reload({
      include: [
        { model: Property, as: 'property', attributes: ['id', 'property_name'] },
        { model: Maintenance, as: 'maintenance', attributes: ['id', 'title'] },
      ],
    });
    return e;
  }

  async update(id, data, ownerPropertyIds = null) {
    if (Array.isArray(ownerPropertyIds)) {
      throw Object.assign(new Error('Action interdite pour les propriétaires (lecture seule)'), { status: 403 });
    }
    const e = await Expense.findByPk(id);
    if (!e) throw Object.assign(new Error('Dépense introuvable'), { status: 404 });
    delete data.total_price;
    await e.update(data);
    return this.getById(id);
  }

  async remove(id, ownerPropertyIds = null) {
    if (Array.isArray(ownerPropertyIds)) {
      throw Object.assign(new Error('Action interdite pour les propriétaires (lecture seule)'), { status: 403 });
    }
    const e = await Expense.findByPk(id);
    if (!e) throw Object.assign(new Error('Dépense introuvable'), { status: 404 });
    await e.destroy();
    return true;
  }

  async bulkRemove(ids, ownerPropertyIds = null) {
    if (Array.isArray(ownerPropertyIds)) {
      throw Object.assign(new Error('Action interdite pour les propriétaires (lecture seule)'), { status: 403 });
    }
    if (!Array.isArray(ids) || !ids.length) return 0;
    const { Op } = require('sequelize');
    const count = await Expense.destroy({ where: { id: { [Op.in]: ids } } });
    return count;
  }
}

module.exports = new ExpenseService();
