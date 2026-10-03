const { Apartment, Property, Tenant, User, Lease, Payment, Maintenance, UtilityBill } = require('../models');
const { Op } = require('sequelize');

class ApartmentService {
  async getAll(filters = {}, ownerPropertyIds = null, assignedPropertyIds = null) {
    const where = {};
    if (filters.property_id) where.property_id = filters.property_id;
    if (filters.status) where.status = filters.status;
    if (Array.isArray(ownerPropertyIds)) {
      where.property_id = { [Op.in]: ownerPropertyIds };
    }
    const all = await Apartment.findAll({
      where,
      include: [
        { model: Property, as: 'property', attributes: ['id', 'property_name', 'city'] },
        { model: Tenant, as: 'tenants', where: { status: 'active' }, required: false, include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }] },
      ],
      order: [['created_at', 'DESC']],
    });

    if (Array.isArray(assignedPropertyIds) && assignedPropertyIds.length > 0) {
      const assigned = all.filter((a) => assignedPropertyIds.includes(Number(a.property_id)));
      const others = all.filter((a) => !assignedPropertyIds.includes(Number(a.property_id)));
      assigned.forEach((a) => { a.dataValues.is_assigned = true; });
      others.forEach((a) => { a.dataValues.is_assigned = false; });
      return [...assigned, ...others];
    }

    return all;
  }
  async getById(id) {
    const a = await Apartment.findByPk(id, {
      include: [
        { model: Property, as: 'property' },
        { model: Tenant, as: 'tenants', include: [{ model: User, as: 'user' }] },
      ],
    });
    if (!a) throw Object.assign(new Error('Appartement introuvable'), { status: 404 });
    return a;
  }
  create(data) { return Apartment.create(data); }
  async update(id, data) {
    const a = await Apartment.findByPk(id);
    if (!a) throw Object.assign(new Error('Appartement introuvable'), { status: 404 });
    await a.update(data); return this.getById(id);
  }
  async remove(id) {
    const a = await Apartment.findByPk(id);
    if (!a) throw Object.assign(new Error('Appartement introuvable'), { status: 404 });

    await Lease.destroy({ where: { apartment_id: id } });
    await Payment.destroy({ where: { apartment_id: id } });
    await Maintenance.destroy({ where: { apartment_id: id } });
    await UtilityBill.destroy({ where: { apartment_id: id } });
    await Tenant.destroy({ where: { apartment_id: id } });
    await a.destroy();
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
module.exports = new ApartmentService();
