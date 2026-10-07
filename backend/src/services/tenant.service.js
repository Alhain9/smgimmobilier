const { Op } = require('sequelize');
const { Tenant, User, Role, Apartment, Lease, Payment, Property, Receipt } = require('../models');

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

  const debtAcknowledged = parseFloat(o.debt_acknowledged) || 0;
  const isDeparted = ['inactive', 'terminated'].includes(o.status);

  let totalRepaid = 0;
  let debtRemaining = debtAcknowledged;
  if (Array.isArray(o.payments)) {
    const payments = o.payments.filter((p) => !p.tenant_id || Number(p.tenant_id) === Number(o.id));
    if (isDeparted && debtAcknowledged > 0) {
      const departureDate = o.end_date;
      const repaymentPayments = payments.filter((p) => {
        if (p.status !== 'completed') return false;
        if (departureDate && p.payment_date && String(p.payment_date).slice(0, 10) >= departureDate) return true;
        if (p.observations && (p.observations.toLowerCase().includes('dette') || p.observations.toLowerCase().includes('apurement') || p.observations.toLowerCase().includes('reconnaissance'))) return true;
        return false;
      });
      totalRepaid = repaymentPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      debtRemaining = Math.max(0, debtAcknowledged - totalRepaid);
    }
  }

  return {
    ...o,
    apartment: apt || null,
    full_name: o.user ? o.user.full_name : null,
    email: o.user ? o.user.email : null,
    phone: o.user ? o.user.phone : null,
    cni: o.national_id || null,
    civility: o.civility || 'Monsieur',
    cni_delivery_date: o.cni_delivery_date || null,
    cni_delivery_place: o.cni_delivery_place || null,
    property_name: apt && apt.property ? apt.property.property_name : null,
    property_id: apt && apt.property ? apt.property.id : (apt ? apt.property_id : null),
    apartment_label: apt
      ? `${apt.apartment_number}${apt.apartment_type ? ' · ' + apt.apartment_type : ''}`
      : null,
    is_departed: isDeparted,
    departure_reason: o.departure_reason || null,
    debt_acknowledged: debtAcknowledged,
    debt_due_date: o.debt_due_date || null,
    debt_repaid: totalRepaid,
    debt_remaining: debtRemaining,
    is_debt_settled: isDeparted ? (debtAcknowledged > 0 ? debtRemaining <= 0 : !!o.is_debt_settled) : false,
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
      { model: Lease, as: 'leases', separate: true, attributes: ['id', 'apartment_id', 'status', 'monthly_rent', 'start_date', 'end_date'], include: [this._apartmentInclude(['id', 'apartment_number', 'apartment_type', 'floor'])] },
      { model: Payment, as: 'payments', separate: true, attributes: ['id', 'amount', 'status', 'payment_date', 'observations', 'tenant_id'] },
    ];
  }
  async getAll(filters = {}, ownerPropertyIds = null, assignedPropertyIds = null) {
    const where = {};
    if (filters.status) where.status = filters.status;
    const list = await Tenant.findAll({ where, include: this._includeList(), order: [['created_at', 'DESC']] });
    let mapped = list.map(flatten);

    if (filters.debtors === 'true' || filters.debtors === true) {
      // Filtrer les anciens locataires ayant une dette reconnue non soldée ou un solde débiteur
      mapped = mapped.filter((t) => t.is_departed && ((t.debt_acknowledged > 0 && !t.is_debt_settled) || t.debt_remaining > 0));
    }

    if (Array.isArray(ownerPropertyIds)) {
      mapped = mapped.filter((t) => {
        const propId = t.apartment && t.apartment.property ? t.apartment.property.id : (t.apartment ? t.apartment.property_id : null);
        return propId && ownerPropertyIds.includes(Number(propId));
      });
    }
    if (Array.isArray(assignedPropertyIds) && assignedPropertyIds.length > 0) {
      mapped.forEach((t) => {
        const propId = t.apartment && t.apartment.property ? t.apartment.property.id : (t.apartment ? t.apartment.property_id : null);
        t.is_assigned = !!(propId && assignedPropertyIds.includes(Number(propId)));
      });
      const assigned = mapped.filter((t) => t.is_assigned);
      const others = mapped.filter((t) => !t.is_assigned);
      return [...assigned, ...others];
    }
    return mapped;
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
    const rawCni = data.cni ?? data.national_id;
    const cleanCni = (rawCni && typeof rawCni === 'string' && rawCni.trim()) ? rawCni.trim() : null;
    if (cleanCni) {
      const existing = await Tenant.findOne({ where: { national_id: cleanCni } });
      if (existing) {
        throw Object.assign(new Error(`Le numéro CNI "${cleanCni}" est déjà enregistré pour un autre locataire.`), { status: 400 });
      }
    }

    const startDate = data.start_date || new Date().toISOString().slice(0, 10);
    let endDate = data.end_date || null;
    const durationMonths = data.duration_months ? parseInt(data.duration_months, 10) : (data.duration_preset ? parseInt(data.duration_preset, 10) : 12);

    if (!endDate && data.apartment_id) {
      const endD = new Date(startDate);
      endD.setMonth(endD.getMonth() + durationMonths);
      endD.setDate(endD.getDate() - 1);
      endDate = endD.toISOString().slice(0, 10);
    }

    const tenant = await Tenant.create({
      user_id: userId,
      civility: data.civility || 'Monsieur',
      apartment_id: data.apartment_id || null,
      national_id: cleanCni,
      cni_delivery_date: data.cni_delivery_date || null,
      cni_delivery_place: data.cni_delivery_place || null,
      profession: data.profession || null,
      emergency_contact: data.emergency_contact || null,
      start_date: startDate,
      end_date: endDate,
      status: data.status || 'active',
    });

    if (data.apartment_id) {
      const apt = await Apartment.findByPk(data.apartment_id);
      if (apt) {
        await apt.update({ status: 'occupied' });

        // Créer automatiquement le contrat de bail si demandé ou si un loyer/logement est spécifié
        if (data.create_lease !== false) {
          const monthlyRent = parseFloat(data.monthly_rent) || parseFloat(apt.rent_amount) || 0;
          const depositAmount = data.deposit_amount !== undefined ? parseFloat(data.deposit_amount) : monthlyRent;

          await Lease.create({
            tenant_id: tenant.id,
            apartment_id: data.apartment_id,
            start_date: startDate,
            end_date: endDate,
            duration_months: durationMonths,
            monthly_rent: monthlyRent,
            deposit_amount: depositAmount,
            status: 'active',
          });
        }
      }
    }

    return this.getById(tenant.id);
  }
  async update(id, data) {
    const t = await Tenant.findByPk(id);
    if (!t) throw Object.assign(new Error('Locataire introuvable'), { status: 404 });

    const rawCni = data.cni !== undefined ? data.cni : data.national_id;
    let cleanCni = t.national_id;
    if (rawCni !== undefined) {
      cleanCni = (rawCni && typeof rawCni === 'string' && rawCni.trim()) ? rawCni.trim() : null;
    }

    if (cleanCni && cleanCni !== t.national_id) {
      const existingCni = await Tenant.findOne({ where: { national_id: cleanCni, id: { [Op.ne]: id } } });
      if (existingCni) {
        throw Object.assign(new Error(`Le numéro CNI "${cleanCni}" est déjà attribué à un autre locataire.`), { status: 400 });
      }
    }

    const oldApartmentId = t.apartment_id;
    const newApartmentId = data.apartment_id !== undefined ? (data.apartment_id ? parseInt(data.apartment_id, 10) : null) : t.apartment_id;

    await t.update({
      civility: data.civility !== undefined ? data.civility : t.civility,
      apartment_id: newApartmentId,
      national_id: cleanCni,
      cni_delivery_date: data.cni_delivery_date !== undefined ? data.cni_delivery_date : t.cni_delivery_date,
      cni_delivery_place: data.cni_delivery_place !== undefined ? data.cni_delivery_place : t.cni_delivery_place,
      profession: data.profession !== undefined ? (data.profession ? data.profession.trim() : null) : t.profession,
      emergency_contact: data.emergency_contact !== undefined ? (data.emergency_contact ? data.emergency_contact.trim() : null) : t.emergency_contact,
      start_date: data.start_date ?? t.start_date,
      end_date: data.end_date ?? t.end_date,
      status: data.status ?? t.status,
    });

    if (newApartmentId && newApartmentId !== oldApartmentId) {
      await Apartment.update({ status: 'occupied' }, { where: { id: newApartmentId } });
      if (oldApartmentId) {
        const remaining = await Tenant.count({ where: { apartment_id: oldApartmentId, status: 'active', id: { [Op.ne]: id } } });
        if (remaining === 0) await Apartment.update({ status: 'free' }, { where: { id: oldApartmentId } });
      }
    }

    const newEmail = data.email ? data.email.trim() : null;
    const newName = data.full_name ? data.full_name.trim() : null;

    // Vérifier si le user_id est partagé avec d'autres fiches locataires
    let isSharedUser = false;
    if (t.user_id) {
      const sharingCount = await Tenant.count({ where: { user_id: t.user_id, id: { [Op.ne]: id } } });
      if (sharingCount > 0) isSharedUser = true;
    }

    if (t.user_id && !isSharedUser) {
      const u = await User.findByPk(t.user_id);
      if (u) {
        if (newEmail && newEmail !== u.email) {
          const emailExists = await User.findOne({ where: { email: newEmail, id: { [Op.ne]: u.id } } });
          if (emailExists) {
            throw Object.assign(new Error(`L'adresse email "${newEmail}" est déjà utilisée par un autre utilisateur.`), { status: 400 });
          }
        }
        const updateData = {};
        if (newName) updateData.full_name = newName;
        if (newEmail) updateData.email = newEmail;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.password && typeof data.password === 'string' && data.password.trim() !== '') {
          updateData.password = data.password.trim();
        }
        if (Object.keys(updateData).length > 0) {
          await u.update(updateData);
        }
      }
    } else if (newName || newEmail || isSharedUser) {
      // Création d'un compte utilisateur dédié et unique pour ce locataire uniquement
      const fallbackEmail = newEmail || `locataire_${id}_${Date.now().toString().slice(-4)}@smg-immobilier.com`;
      const emailExists = await User.findOne({ where: { email: fallbackEmail } });
      if (emailExists && newEmail) {
        throw Object.assign(new Error(`L'adresse email "${newEmail}" est déjà utilisée par un autre compte.`), { status: 400 });
      }
      const role = await Role.findOne({ where: { role_name: 'Locataire' } });
      const roleId = role ? role.id : 6;
      const newUser = await User.create({
        full_name: newName || (t.user ? t.user.full_name : 'Locataire'),
        email: fallbackEmail,
        phone: data.phone || (t.user ? t.user.phone : null),
        password: (data.password && data.password.trim()) || 'loc123',
        role_id: roleId,
      });
      await t.update({ user_id: newUser.id });
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
        { 
          model: Payment, 
          as: 'payments',
          include: [{ model: Receipt, as: 'receipts', attributes: ['id', 'receipt_number', 'receipt_type', 'status'] }]
        },
        { model: Receipt, as: 'receipts' },
        { model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'phone'] },
      ],
      order: [
        [{ model: Payment, as: 'payments' }, 'payment_date', 'DESC'],
        [{ model: Receipt, as: 'receipts' }, 'created_at', 'DESC'],
      ],
    });
    if (!t) throw Object.assign(new Error('Profil locataire introuvable'), { status: 404 });
    const ledgerService = require('./ledger.service');
    const led = ledgerService.computeFromTenant(t);
    const flat = flatten(t);
    return {
      ...flat,
      due_info: {
        prochaine_echeance: led.prochaine_echeance,
        jours_restants: led.jours_restants,
        statut_echeance: led.statut_echeance,
        echeance_message: led.echeance_message,
        loyer_mensuel: led.loyer_mensuel,
        solde: led.solde,
        mois_dus: led.mois_dus,
        total_valide: led.total_valide,
      },
    };
  }

  async vacate(id, data = {}) {
    const t = await Tenant.findByPk(id, {
      include: [
        { model: Apartment, as: 'apartment' },
        { model: Lease, as: 'leases', where: { status: 'active' }, required: false },
        { model: Payment, as: 'payments' },
      ],
    });
    if (!t) throw Object.assign(new Error('Locataire introuvable'), { status: 404 });

    const departureDate = data.departure_date || new Date().toISOString().slice(0, 10);
    const departureReason = data.departure_reason || 'Départ / Fin de contrat';
    const debtAcknowledged = data.debt_acknowledged !== undefined ? parseFloat(data.debt_acknowledged) : 0;
    const debtDueDate = data.debt_due_date || null;
    const notes = data.observations ? String(data.observations).trim() : '';

    // Clôturer les baux actifs de ce locataire
    const leases = t.leases || [];
    for (const l of leases) {
      await l.update({ status: 'terminated', end_date: departureDate });
    }

    let obs = t.observations || '';
    const debtText = debtAcknowledged > 0 
      ? ` Reconnaissance de dette signée : ${Math.round(debtAcknowledged).toLocaleString('fr-FR')} FCFA${debtDueDate ? ` (Échéance: ${debtDueDate})` : ''}.` 
      : '';
    const departureLog = `[Sortie le ${departureDate} - Motif : ${departureReason}]${debtText}${notes ? ` Note: ${notes}` : ''}`;
    obs = obs ? `${obs}\n${departureLog}` : departureLog;

    await t.update({
      status: 'inactive',
      end_date: departureDate,
      departure_reason: departureReason,
      debt_acknowledged: debtAcknowledged,
      debt_due_date: debtDueDate,
      is_debt_settled: debtAcknowledged <= 0,
      observations: obs,
    });

    // Libérer le logement s'il n'y a plus d'autre locataire actif
    if (t.apartment_id) {
      const remaining = await Tenant.count({
        where: { apartment_id: t.apartment_id, status: 'active', id: { [Op.ne]: id } },
      });
      if (remaining === 0) {
        await Apartment.update({ status: 'free' }, { where: { id: t.apartment_id } });
      }
    }

    return this.getById(id);
  }

  async settleDebt(id, data = {}, user = null) {
    const t = await Tenant.findByPk(id, {
      include: [
        { model: Apartment, as: 'apartment' },
        { model: User, as: 'user' },
        { model: Payment, as: 'payments' },
      ],
    });
    if (!t) throw Object.assign(new Error('Locataire introuvable'), { status: 404 });

    const amount = parseFloat(data.amount);
    if (!amount || amount <= 0) {
      throw Object.assign(new Error('Montant du versement invalide'), { status: 400 });
    }

    const paymentDate = data.payment_date || new Date().toISOString().slice(0, 10);
    const paymentMethod = data.payment_method || 'cash';
    const note = data.observations ? String(data.observations).trim() : 'Règlement reconnaissance de dette';

    // Créer le paiement d'apurement
    const paymentService = require('./payment.service');
    const payment = await paymentService.create({
      tenant_id: t.id,
      apartment_id: t.apartment_id || null,
      amount,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      status: 'completed',
      observations: note,
    }, user);

    // Mettre à jour l'observation du locataire
    let obs = t.observations || '';
    obs = `${obs}\n[Règlement dette du ${paymentDate}] Versement de ${Math.round(amount).toLocaleString('fr-FR')} FCFA (${paymentMethod}). ${note}`;

    // Vérifier si la dette reconnue est désormais totalement soldée
    const allPayments = await Payment.findAll({
      where: { tenant_id: t.id, status: 'completed' },
    });
    const departureDate = t.end_date;
    const debtAck = parseFloat(t.debt_acknowledged) || 0;
    const repaymentPayments = allPayments.filter((p) => {
      if (departureDate && p.payment_date && String(p.payment_date).slice(0, 10) >= departureDate) return true;
      if (p.observations && (p.observations.toLowerCase().includes('dette') || p.observations.toLowerCase().includes('apurement') || p.observations.toLowerCase().includes('reconnaissance'))) return true;
      return false;
    });
    const totalRepaid = repaymentPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const isSettled = debtAck > 0 ? (totalRepaid >= debtAck) : true;

    await t.update({
      observations: obs,
      is_debt_settled: isSettled,
    });

    return {
      tenant: await this.getById(id),
      payment,
      is_settled: isSettled,
      total_repaid: totalRepaid,
      remaining_debt: Math.max(0, debtAck - totalRepaid),
    };
  }
}
module.exports = new TenantService();
