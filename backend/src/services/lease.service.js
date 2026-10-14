const { Lease, Tenant, Apartment, Property, User } = require('../models');
const { Op } = require('sequelize');

class LeaseService {
  _tenantInc() { return { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }] }; }
  getAll(filters = {}) {
    const where = {};
    if (filters.status) where.status = filters.status;
    if (filters.tenant_id) where.tenant_id = filters.tenant_id;
    if (filters.apartment_id) where.apartment_id = filters.apartment_id;
    if (Array.isArray(filters.ownerPropertyIds)) {
      where['$apartment.property_id$'] = { [Op.in]: filters.ownerPropertyIds };
    }
    return Lease.findAll({
      where,
      include: [
        this._tenantInc(),
        {
          model: Apartment,
          as: 'apartment',
          attributes: ['id', 'apartment_number', 'apartment_type', 'rent_amount', 'property_id'],
          include: [{ model: Property, as: 'property', attributes: ['id', 'property_name', 'city'] }],
        },
      ],
      order: [['created_at', 'DESC']],
    });
  }
  async getById(id) {
    const l = await Lease.findByPk(id, {
      include: [this._tenantInc(), { model: Apartment, as: 'apartment', include: [{ model: Property, as: 'property' }] }],
    });
    if (!l) throw Object.assign(new Error('Contrat introuvable'), { status: 404 });
    return l;
  }
  async create(data) {
    const l = await Lease.create(data);
    await Apartment.update({ status: 'occupied' }, { where: { id: data.apartment_id } });
    return this.getById(l.id);
  }
  async update(id, data) {
    const l = await Lease.findByPk(id);
    if (!l) throw Object.assign(new Error('Contrat introuvable'), { status: 404 });
    await l.update(data);
    if (data.status && !['active', 'pending'].includes(data.status)) {
      await Apartment.update({ status: 'free' }, { where: { id: l.apartment_id } });
    }
    return this.getById(id);
  }
  async remove(id) {
    const l = await Lease.findByPk(id);
    if (!l) throw Object.assign(new Error('Contrat introuvable'), { status: 404 });
    await l.destroy(); return true;
  }
  async attachContract(id, filePath) {
    const l = await Lease.findByPk(id);
    if (!l) throw Object.assign(new Error('Contrat introuvable'), { status: 404 });
    l.contract_file = filePath; await l.save(); return l;
  }
  async renew(id, data = {}) {
    const l = await Lease.findByPk(id);
    if (!l) throw Object.assign(new Error('Contrat introuvable'), { status: 404 });
    const renewalCount = (l.renewal_count || 0) + 1;
    const endDate = data.end_date;
    const monthlyRent = data.monthly_rent || l.monthly_rent;
    const durationMonths = data.duration_months || l.duration_months;

    await l.update({
      end_date: endDate,
      monthly_rent: monthlyRent,
      duration_months: durationMonths,
      renewal_count: renewalCount,
      status: 'active',
    });

    // Mettre à jour la date de fin sur la fiche locataire
    if (l.tenant_id) {
      await Tenant.update({ end_date: endDate }, { where: { id: l.tenant_id } });
    }
    await Apartment.update({ status: 'occupied' }, { where: { id: l.apartment_id } });
    return this.getById(id);
  }
}
module.exports = new LeaseService();
