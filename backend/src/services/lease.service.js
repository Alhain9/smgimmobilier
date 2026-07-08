const { Lease, Tenant, Apartment, Property, User } = require('../models');

class LeaseService {
  _tenantInc() { return { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }] }; }
  getAll() {
    return Lease.findAll({
      include: [this._tenantInc(), { model: Apartment, as: 'apartment', include: [{ model: Property, as: 'property', attributes: ['property_name'] }] }],
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
  async renew(id, endDate, monthlyRent) {
    const l = await Lease.findByPk(id);
    if (!l) throw Object.assign(new Error('Contrat introuvable'), { status: 404 });
    await l.update({
      end_date: endDate,
      monthly_rent: monthlyRent,
      status: 'active',
    });
    await Apartment.update({ status: 'occupied' }, { where: { id: l.apartment_id } });
    return this.getById(id);
  }
}
module.exports = new LeaseService();
