const { UtilityBill, Apartment, Property, Tenant, User, Lease } = require('../models');

class UtilityService {
  _inc() {
    return [
      {
        model: Apartment, as: 'apartment',
        attributes: ['id', 'apartment_number', 'apartment_type', 'property_id'],
        include: [
          { model: Property, as: 'property', attributes: ['id', 'property_name', 'city', 'utilities_enabled'] },
          { model: Tenant, as: 'tenants', required: false, where: { status: 'active' }, include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }] },
        ],
      },
      { model: User, as: 'creator', attributes: ['id', 'full_name'] },
    ];
  }

  // conso = nouvel index - ancien index ; total = conso*prix + poubelle + transport + autre
  _computeTotal(p) {
    const conso = Math.max(0, Number(p.current_index) - Number(p.previous_index));
    return conso * Number(p.unit_price || 0)
      + Number(p.garbage_fee || 0) + Number(p.transport_fee || 0) + Number(p.other_fee || 0);
  }

  getAll(filters = {}) {
    const where = {};
    if (filters.apartment_id) where.apartment_id = filters.apartment_id;
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.period_month) where.period_month = filters.period_month;
    if (filters.period_year) where.period_year = filters.period_year;
    return UtilityBill.findAll({
      where, include: this._inc(),
      order: [['period_year', 'DESC'], ['period_month', 'DESC'], ['id', 'DESC']],
    });
  }

  async getById(id) {
    const b = await UtilityBill.findByPk(id, { include: this._inc() });
    if (!b) throw Object.assign(new Error('Facture introuvable'), { status: 404 });
    return b;
  }

  // Dernière facture d'un logement (pour reporter l'ancien index + prix/frais)
  getLast(apartmentId, type = 'electricity') {
    return UtilityBill.findOne({
      where: { apartment_id: apartmentId, type },
      order: [['period_year', 'DESC'], ['period_month', 'DESC'], ['id', 'DESC']],
    });
  }

  async create(data, user) {
    if (!data.apartment_id) throw Object.assign(new Error('Logement requis'), { status: 400 });
    const type = data.type === 'water' ? 'water' : 'electricity';

    // Report automatique de l'ancien index depuis la dernière facture si non fourni
    let previous = data.previous_index;
    if (previous == null || previous === '') {
      const last = await this.getLast(data.apartment_id, type);
      previous = last ? last.current_index : 0;
    }

    const payload = {
      apartment_id: data.apartment_id, type,
      period_month: data.period_month, period_year: data.period_year,
      previous_index: previous, current_index: data.current_index || 0,
      unit_price: data.unit_price || 0,
      garbage_fee: data.garbage_fee || 0, transport_fee: data.transport_fee || 0,
      other_fee: data.other_fee || 0, other_label: data.other_label || null,
      notes: data.notes || null, created_by: user ? user.id : null,
      status: data.status === 'paid' ? 'paid' : 'pending',
      paid_date: data.status === 'paid' ? (data.paid_date || new Date().toISOString().slice(0, 10)) : null,
    };
    if (Number(payload.current_index) < Number(payload.previous_index)) {
      throw Object.assign(new Error('Le nouvel index doit être supérieur ou égal à l\'ancien index.'), { status: 400 });
    }
    payload.total_amount = this._computeTotal(payload);
    const bill = await UtilityBill.create(payload);
    return this.getById(bill.id);
  }

  async update(id, data) {
    const b = await UtilityBill.findByPk(id);
    if (!b) throw Object.assign(new Error('Facture introuvable'), { status: 404 });
    const merged = {
      previous_index: data.previous_index ?? b.previous_index,
      current_index: data.current_index ?? b.current_index,
      unit_price: data.unit_price ?? b.unit_price,
      garbage_fee: data.garbage_fee ?? b.garbage_fee,
      transport_fee: data.transport_fee ?? b.transport_fee,
      other_fee: data.other_fee ?? b.other_fee,
      other_label: data.other_label ?? b.other_label,
      type: data.type ?? b.type,
      period_month: data.period_month ?? b.period_month,
      period_year: data.period_year ?? b.period_year,
      notes: data.notes ?? b.notes,
      status: data.status ?? b.status,
    };
    if (Number(merged.current_index) < Number(merged.previous_index)) {
      throw Object.assign(new Error('Le nouvel index doit être supérieur ou égal à l\'ancien index.'), { status: 400 });
    }
    merged.total_amount = this._computeTotal(merged);
    merged.paid_date = merged.status === 'paid' ? (b.paid_date || new Date().toISOString().slice(0, 10)) : null;
    await b.update(merged);
    return this.getById(id);
  }

  // Marquer payé / en attente
  async setPaid(id, paid) {
    const b = await UtilityBill.findByPk(id);
    if (!b) throw Object.assign(new Error('Facture introuvable'), { status: 404 });
    await b.update({ status: paid ? 'paid' : 'pending', paid_date: paid ? new Date().toISOString().slice(0, 10) : null });
    return this.getById(id);
  }

  // Justificatif de paiement (image / PDF)
  async setProof(id, url) {
    const b = await UtilityBill.findByPk(id);
    if (!b) throw Object.assign(new Error('Facture introuvable'), { status: 404 });
    await b.update({ payment_proof: url });
    return this.getById(id);
  }

  async remove(id) {
    const b = await UtilityBill.findByPk(id);
    if (!b) throw Object.assign(new Error('Facture introuvable'), { status: 404 });
    await b.destroy();
    return true;
  }

  // Factures du locataire connecté (ses logements)
  async getMine(userId) {
    const tenant = await Tenant.findOne({ where: { user_id: userId }, include: [{ model: Lease, as: 'leases', attributes: ['apartment_id'] }] });
    if (!tenant) return [];
    const ids = new Set();
    if (tenant.apartment_id) ids.add(tenant.apartment_id);
    (tenant.leases || []).forEach((l) => l.apartment_id && ids.add(l.apartment_id));
    if (!ids.size) return [];
    return UtilityBill.findAll({
      where: { apartment_id: [...ids] }, include: this._inc(),
      order: [['period_year', 'DESC'], ['period_month', 'DESC'], ['id', 'DESC']],
    });
  }
}
module.exports = new UtilityService();
