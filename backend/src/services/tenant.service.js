const { Tenant, User, Role, Apartment, Lease, Payment, Property } = require('../models');

// Aplatit la fiche locataire pour le frontend (nom/email/phone via user, cni = national_id)
// Logement « effectif » : l'apartment_id direct sinon celui du bail actif (le lien se fait via le contrat)
const flatten = (t) => {
  if (!t) return t;
  const o = t.toJSON ? t.toJSON() : t;
  let apt = o.apartment;
  if (!apt && Array.isArray(o.leases) && o.leases.length) {
    const lease = o.leases.find((l) => l.status === 'active' && l.apartment) || o.leases.find((l) => l.apartment);
    if (lease) apt = lease.apartment;
  }
  return {
    ...o,
    apartment: apt || null,
    full_name: o.user ? o.user.full_name : null,
    email: o.user ? o.user.email : null,
    phone: o.user ? o.user.phone : null,
    cni: o.national_id || null,
    property_name: apt && apt.property ? apt.property.property_name : null,
    apartment_label: apt
      ? `${apt.apartment_number}${apt.apartment_type ? ' · ' + apt.apartment_type : ''}`
      : null,
  };
};

class TenantService {
  // Logement + immeuble associés (réutilisé en liste et en détail)
  _apartmentInclude(attrs) {
    return {
      model: Apartment, as: 'apartment',
      attributes: attrs || ['id', 'apartment_number', 'apartment_type', 'floor', 'rent_amount'],
      include: [{ model: Property, as: 'property', attributes: ['id', 'property_name', 'city', 'district'] }],
    };
  }
  _includeList() {
    return [
      { model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'phone', 'status'] },
      this._apartmentInclude(['id', 'apartment_number', 'apartment_type', 'floor']),
      // Bail (séparé pour éviter la multiplication de lignes) → logement effectif si non attribué directement
      { model: Lease, as: 'leases', separate: true, attributes: ['id', 'apartment_id', 'status', 'monthly_rent', 'start_date'], include: [this._apartmentInclude(['id', 'apartment_number', 'apartment_type', 'floor'])] },
    ];
  }
  async getAll() {
    const list = await Tenant.findAll({ include: this._includeList(), order: [['created_at', 'DESC']] });
    return list.map(flatten);
  }
  async getById(id) {
    const t = await Tenant.findByPk(id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'phone'] },
        this._apartmentInclude(),
        { model: Lease, as: 'leases', include: [this._apartmentInclude()] },
        { model: Payment, as: 'payments' },
      ],
      order: [[{ model: Payment, as: 'payments' }, 'payment_date', 'DESC']],
    });
    if (!t) throw Object.assign(new Error('Locataire introuvable'), { status: 404 });
    return flatten(t);
  }
  // Crée un compte utilisateur (rôle Locataire) + fiche locataire
  async create(data) {
    let userId = data.user_id;
    if (!userId) {
      const role = await Role.findOne({ where: { role_name: 'Locataire' } });
      const user = await User.create({
        full_name: data.full_name, email: data.email, phone: data.phone,
        password: data.password || 'loc123', role_id: role.id,
      });
      userId = user.id;
    }
    const tenant = await Tenant.create({
      user_id: userId, apartment_id: data.apartment_id || null, national_id: data.cni || data.national_id,
      profession: data.profession, emergency_contact: data.emergency_contact,
      start_date: data.start_date, end_date: data.end_date, status: data.status || 'active',
    });
    if (data.apartment_id) await Apartment.update({ status: 'occupied' }, { where: { id: data.apartment_id } });
    return this.getById(tenant.id);
  }
  async update(id, data) {
    const t = await Tenant.findByPk(id);
    if (!t) throw Object.assign(new Error('Locataire introuvable'), { status: 404 });
    await t.update({
      apartment_id: data.apartment_id ?? t.apartment_id,
      national_id: data.cni ?? data.national_id ?? t.national_id,
      profession: data.profession ?? t.profession,
      emergency_contact: data.emergency_contact ?? t.emergency_contact,
      start_date: data.start_date ?? t.start_date,
      end_date: data.end_date ?? t.end_date,
      status: data.status ?? t.status,
    });
    if (t.user_id && (data.full_name || data.email || data.phone)) {
      const u = await User.findByPk(t.user_id);
      if (u) await u.update({ full_name: data.full_name ?? u.full_name, email: data.email ?? u.email, phone: data.phone ?? u.phone });
    }
    return this.getById(id);
  }
  async remove(id) {
    const t = await Tenant.findByPk(id);
    if (!t) throw Object.assign(new Error('Locataire introuvable'), { status: 404 });
    await t.destroy(); return true;
  }
  async getByUserId(userId) {
    const t = await Tenant.findOne({
      where: { user_id: userId },
      include: [
        this._apartmentInclude(),
        { model: Lease, as: 'leases', include: [this._apartmentInclude()] },
        { model: Payment, as: 'payments' },
        { model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'phone'] },
      ],
    });
    if (!t) throw Object.assign(new Error('Profil locataire introuvable'), { status: 404 });
    return flatten(t);
  }
}
module.exports = new TenantService();
