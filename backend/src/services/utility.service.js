const { UtilityBill, Apartment, Property, Tenant, User, Lease, Receipt } = require('../models');
const { emitDashboard, emitNotification } = require('../config/socket');
const { Op } = require('sequelize');

class UtilityService {
  _inc() {
    return [
      {
        model: Apartment, as: 'apartment',
        attributes: ['id', 'apartment_number', 'apartment_type', 'property_id'],
        include: [
          { model: Property, as: 'property', attributes: ['id', 'property_name', 'city', 'utilities_enabled', 'electricity_price', 'water_price', 'garbage_fee', 'transport_fee'] },
          { model: Tenant, as: 'tenants', required: false, where: { status: 'active' }, include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone', 'email'] }] },
        ],
      },
      { model: User, as: 'creator', attributes: ['id', 'full_name'] },
    ];
  }

  // conso = nouvel index - ancien index ; total = conso*prix + poubelle + transport + autre + impayer
  _computeTotal(p) {
    const rawConso = Math.max(0, Number(p.current_index || 0) - Number(p.previous_index || 0));
    const conso = Math.round(rawConso * 100) / 100;
    return conso * Number(p.unit_price || 0)
      + Number(p.garbage_fee || 0)
      + Number(p.transport_fee || 0)
      + Number(p.other_fee || 0)
      + Number(p.impayer || 0);
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

  // Dernière facture d'un logement (pour reporter l'ancien index + prix/frais et calculer les impayés antérieurs)
  async getLast(apartmentId, type = 'electricity') {
    const last = await UtilityBill.findOne({
      where: { apartment_id: apartmentId, type },
      order: [['period_year', 'DESC'], ['period_month', 'DESC'], ['id', 'DESC']],
    });

    // Calculer le cumul des impayés antérieurs en attente pour ce logement
    const pendingBills = await UtilityBill.findAll({
      where: { apartment_id: apartmentId, type, status: 'pending' },
    });
    const totalUnpaid = pendingBills.reduce((s, b) => s + Number(b.total_amount || 0), 0);

    return {
      current_index: last ? Number(last.current_index) : 0,
      previous_index: last ? Number(last.previous_index) : 0,
      unit_price: last ? Number(last.unit_price) : 0,
      garbage_fee: last ? Number(last.garbage_fee) : 0,
      transport_fee: last ? Number(last.transport_fee) : 0,
      impayer: totalUnpaid,
      due_date: last ? last.due_date : null,
      last_bill: last,
    };
  }

  async create(data, user) {
    if (!data.apartment_id) throw Object.assign(new Error('Logement requis'), { status: 400 });
    const type = data.type === 'water' ? 'water' : 'electricity';

    // Report automatique de l'ancien index depuis la dernière facture si non fourni
    let previous = data.previous_index;
    let impayer = data.impayer != null ? Number(data.impayer) : 0;
    if (previous == null || previous === '') {
      const lastInfo = await this.getLast(data.apartment_id, type);
      previous = lastInfo ? lastInfo.current_index : 0;
      if (data.impayer == null) impayer = lastInfo ? lastInfo.impayer : 0;
    }

    const payload = {
      apartment_id: data.apartment_id, type,
      period_month: data.period_month, period_year: data.period_year,
      previous_index: previous, current_index: data.current_index || 0,
      unit_price: data.unit_price || 0,
      garbage_fee: data.garbage_fee || 0, transport_fee: data.transport_fee || 0,
      impayer: impayer || 0,
      other_fee: data.other_fee || 0, other_label: data.other_label || null,
      due_date: data.due_date || null,
      payment_method: data.payment_method || 'Espèces',
      notes: data.notes || null, created_by: user ? user.id : null,
      status: data.status === 'paid' ? 'paid' : 'pending',
      paid_date: data.status === 'paid' ? (data.paid_date || new Date().toISOString().slice(0, 10)) : null,
    };
    if (Number(payload.current_index) < Number(payload.previous_index)) {
      throw Object.assign(new Error('Le nouvel index doit être supérieur ou égal à l\'ancien index.'), { status: 400 });
    }
    payload.total_amount = this._computeTotal(payload);
    const bill = await UtilityBill.create(payload);

    // Si créée directement avec le statut 'paid', générer le reçu
    if (payload.status === 'paid') {
      try {
        const receiptService = require('./receipt.service');
        await receiptService.generateUtilityReceipt(bill.id, user ? user.id : null, payload.payment_method);
      } catch (_) {}
    }

    try {
      emitDashboard();
    } catch (_) {}

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
      impayer: data.impayer ?? b.impayer,
      other_fee: data.other_fee ?? b.other_fee,
      other_label: data.other_label ?? b.other_label,
      type: data.type ?? b.type,
      period_month: data.period_month ?? b.period_month,
      period_year: data.period_year ?? b.period_year,
      due_date: data.due_date ?? b.due_date,
      payment_method: data.payment_method ?? b.payment_method,
      receipt_number: data.receipt_number ?? b.receipt_number,
      notes: data.notes ?? b.notes,
      status: data.status ?? b.status,
    };
    if (Number(merged.current_index) < Number(merged.previous_index)) {
      throw Object.assign(new Error('Le nouvel index doit être supérieur ou égal à l\'ancien index.'), { status: 400 });
    }
    merged.total_amount = this._computeTotal(merged);
    merged.paid_date = merged.status === 'paid' ? (data.paid_date || b.paid_date || new Date().toISOString().slice(0, 10)) : null;
    await b.update(merged);

    try {
      emitDashboard();
    } catch (_) {}

    return this.getById(id);
  }

  // Marquer payé / en attente (génère automatiquement un reçu lors du règlement)
  async setPaid(id, paid, user = null, paymentMethod = 'Espèces') {
    const b = await UtilityBill.findByPk(id);
    if (!b) throw Object.assign(new Error('Facture introuvable'), { status: 404 });
    
    let receipt = null;
    if (paid) {
      const payDate = new Date().toISOString().slice(0, 10);
      await b.update({
        status: 'paid',
        paid_date: payDate,
        payment_method: paymentMethod || b.payment_method || 'Espèces',
      });
      try {
        const receiptService = require('./receipt.service');
        receipt = await receiptService.generateUtilityReceipt(id, user ? user.id : null, paymentMethod);
      } catch (_) {}
    } else {
      await b.update({ status: 'pending', paid_date: null });
    }

    try { emitDashboard(); } catch (_) {}
    return { bill: await this.getById(id), receipt };
  }

  // Justificatif de paiement (image / PDF)
  async setProof(id, url) {
    const b = await UtilityBill.findByPk(id);
    if (!b) throw Object.assign(new Error('Facture introuvable'), { status: 404 });
    await b.update({ payment_proof: url });
    return this.getById(id);
  }

  // Paiement d'une facture de charges avec génération systématique d'un reçu
  async pay(id, data = {}, proofUrl = null, user = null) {
    const b = await UtilityBill.findByPk(id);
    if (!b) throw Object.assign(new Error('Facture introuvable'), { status: 404 });

    const payDate = data.paid_date || new Date().toISOString().slice(0, 10);
    const method = data.payment_method || 'Espèces';

    const updateData = {
      status: 'paid',
      paid_date: payDate,
      payment_method: method,
    };
    if (proofUrl) updateData.payment_proof = proofUrl;
    if (data.notes) updateData.notes = (b.notes ? b.notes + '\n' : '') + data.notes;
    await b.update(updateData);

    let receipt = null;
    try {
      const receiptService = require('./receipt.service');
      receipt = await receiptService.generateUtilityReceipt(id, user ? user.id : null, method);
    } catch (_) {}

    try { emitDashboard(); } catch (_) {}
    return { bill: await this.getById(id), receipt };
  }

  async remove(id) {
    const b = await UtilityBill.findByPk(id);
    if (!b) throw Object.assign(new Error('Facture introuvable'), { status: 404 });
    await b.destroy();
    try { emitDashboard(); } catch (_) {}
    return true;
  }

  // Factures du locataire connecté (tous ses logements et contrats)
  async getMine(userId) {
    const tenants = await Tenant.findAll({
      where: { user_id: userId },
      include: [{ model: Lease, as: 'leases', attributes: ['apartment_id'] }],
    });
    if (!tenants.length) return [];

    const ids = new Set();
    tenants.forEach((t) => {
      if (t.apartment_id) ids.add(t.apartment_id);
      (t.leases || []).forEach((l) => l.apartment_id && ids.add(l.apartment_id));
    });

    const directLeases = await Lease.findAll({
      include: [{ model: Tenant, as: 'tenant', where: { user_id: userId } }],
      attributes: ['apartment_id'],
    });
    directLeases.forEach((l) => {
      if (l.apartment_id) ids.add(l.apartment_id);
    });

    if (!ids.size) return [];
    return UtilityBill.findAll({
      where: { apartment_id: [...ids] },
      include: this._inc(),
      order: [['period_year', 'DESC'], ['period_month', 'DESC'], ['id', 'DESC']],
    });
  }

  // Tableau de bord : KPIs d'électricité et de charges
  async getDashboardStats() {
    const all = await UtilityBill.findAll({ where: { type: 'electricity' } });
    const apartmentsCount = await Apartment.count();

    const totalFactures = all.length;
    let totalCollecte = 0;
    let totalImpaye = 0;
    let nbImpayes = 0;

    all.forEach((f) => {
      const amount = Number(f.total_amount || 0);
      if (f.status === 'paid') {
        totalCollecte += amount;
      } else {
        totalImpaye += amount;
        nbImpayes++;
      }
    });

    return {
      total_logements: apartmentsCount,
      total_factures: totalFactures,
      total_collecte: totalCollecte,
      total_impaye: totalImpaye,
      nb_impayes: nbImpayes,
    };
  }

  // Récapitulatif mensuel de l'électricité
  async getRecapByMonth() {
    const bills = await UtilityBill.findAll({
      where: { type: 'electricity' },
      order: [['period_year', 'DESC'], ['period_month', 'DESC']],
    });

    const MONTH_NAMES = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const groups = {};

    bills.forEach((b) => {
      const key = `${b.period_year}-${String(b.period_month).padStart(2, '0')}`;
      if (!groups[key]) {
        groups[key] = {
          mois: `${MONTH_NAMES[b.period_month] || b.period_month} ${b.period_year}`,
          code: key,
          nb_factures: 0,
          total_facture: 0,
          total_collecte: 0,
          total_impaye: 0,
        };
      }
      const g = groups[key];
      const amt = Number(b.total_amount || 0);
      g.nb_factures++;
      g.total_facture += amt;
      if (b.status === 'paid') g.total_collecte += amt;
      else g.total_impaye += amt;
    });

    return Object.values(groups).map((g) => ({
      ...g,
      moyenne_facture: g.nb_factures > 0 ? (g.total_facture / g.nb_factures) : 0,
    }));
  }

  // Récapitulatif par logement avec historique complet
  async getRecapByApartment(apartmentId) {
    const apt = await Apartment.findByPk(apartmentId, {
      include: [
        { model: Property, as: 'property' },
        { model: Tenant, as: 'tenants', required: false, where: { status: 'active' }, include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }] },
      ],
    });
    if (!apt) throw Object.assign(new Error('Logement introuvable'), { status: 404 });

    const bills = await UtilityBill.findAll({
      where: { apartment_id: apartmentId, type: 'electricity' },
      order: [['period_year', 'DESC'], ['period_month', 'DESC'], ['id', 'DESC']],
    });

    const MONTH_NAMES = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    let totalConso = 0;
    let totalCollecte = 0;
    let totalImpaye = 0;

    const list = bills.map((b) => {
      const conso = Math.max(0, Number(b.current_index) - Number(b.previous_index));
      const amt = Number(b.total_amount || 0);
      totalConso += conso;
      if (b.status === 'paid') totalCollecte += amt;
      else totalImpaye += amt;

      return {
        id: b.id,
        mois: `${MONTH_NAMES[b.period_month] || b.period_month} ${b.period_year}`,
        period_month: b.period_month,
        period_year: b.period_year,
        ancien_index: Number(b.previous_index),
        nouvel_index: Number(b.current_index),
        consommation_kwh: conso,
        prix_kwh: Number(b.unit_price),
        poubelle: Number(b.garbage_fee),
        transport: Number(b.transport_fee),
        impayer: Number(b.impayer || 0),
        montant_total: amt,
        status: b.status,
        paid_date: b.paid_date,
        due_date: b.due_date,
        receipt_number: b.receipt_number,
      };
    });

    return {
      apartment: {
        id: apt.id,
        apartment_number: apt.apartment_number,
        apartment_type: apt.apartment_type,
        property_name: apt.property ? apt.property.property_name : '—',
        tenant_name: (apt.tenants && apt.tenants[0] && apt.tenants[0].user) ? apt.tenants[0].user.full_name : '—',
      },
      nb_factures: bills.length,
      total_consommation_kwh: totalConso,
      total_collecte: totalCollecte,
      total_impaye: totalImpaye,
      factures: list,
    };
  }

  // Préparation de la saisie d'index par immeuble
  async batchPrepare(propertyId, type = 'electricity') {
    if (!propertyId) throw Object.assign(new Error('Veuillez spécifier un immeuble'), { status: 400 });
    const property = await Property.findByPk(propertyId, {
      include: [{
        model: Apartment, as: 'apartments',
        include: [{
          model: Tenant, as: 'tenants', required: false, where: { status: 'active' },
          include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }]
        }]
      }]
    });
    if (!property) throw Object.assign(new Error('Immeuble introuvable'), { status: 404 });

    const apts = property.apartments || [];
    const items = [];

    for (const apt of apts) {
      const lastInfo = await this.getLast(apt.id, type);
      const tenant = (apt.tenants || [])[0];
      items.push({
        apartment_id: apt.id,
        apartment_number: apt.apartment_number,
        tenant_name: tenant && tenant.user ? tenant.user.full_name : '—',
        previous_index: lastInfo ? lastInfo.current_index : 0,
        unit_price: type === 'water' ? (property.water_price || 0) : (property.electricity_price || 0),
        garbage_fee: property.garbage_fee || 0,
        transport_fee: property.transport_fee || 0,
        impayer: lastInfo ? lastInfo.impayer : 0,
      });
    }

    return {
      property_id: property.id,
      property_name: property.property_name,
      utilities_enabled: property.utilities_enabled,
      type,
      items,
    };
  }

  // Génération en masse des factures d'un immeuble
  async batchCreate(data, user) {
    const { property_id, type, period_month, period_year, items, due_date } = data;
    if (!property_id || !items || !Array.isArray(items)) {
      throw Object.assign(new Error('Données de saisie de masse invalides'), { status: 400 });
    }

    const created = [];
    for (const item of items) {
      if (item.current_index !== undefined && item.current_index !== null && item.current_index !== '') {
        const bill = await this.create({
          apartment_id: item.apartment_id,
          type,
          period_month,
          period_year,
          previous_index: item.previous_index || 0,
          current_index: item.current_index,
          unit_price: item.unit_price,
          garbage_fee: item.garbage_fee,
          transport_fee: item.transport_fee,
          impayer: item.impayer || 0,
          other_fee: item.other_fee || 0,
          other_label: item.other_label || null,
          due_date: item.due_date || due_date || null,
          status: 'pending',
        }, user);
        created.push(bill);
      }
    }
    return { count: created.length, bills: created };
  }
}
module.exports = new UtilityService();
