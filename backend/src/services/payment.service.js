const { Payment, Tenant, Apartment, User, Property, PaymentHistory } = require('../models');
const { Op } = require('sequelize');
const kangService = require('./kang.service');
const { emitPayment, emitDashboard } = require('../config/socket');
const { createAuditEntry } = require('../middlewares/audit.middleware');
const { logger } = require('../config/logger');

class PaymentService {
  // Journalise une modification (non bloquant) : snapshot montant + statut + auteur
  async _log(paymentId, action, description, payment, user) {
    try {
      await PaymentHistory.create({
        payment_id: paymentId, action, description,
        amount: payment ? payment.amount : null,
        status: payment ? payment.status : null,
        changed_by: user ? user.id : null,
      });
    } catch (_) { /* non bloquant */ }
  }

  _inc() {
    return [
      { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }] },
      { model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number', 'apartment_type'],
        include: [{ model: Property, as: 'property', attributes: ['id', 'property_name', 'city', 'district'] }] },
      { model: User, as: 'declarant', attributes: ['id', 'full_name'] },
    ];
  }
  getAll(filters = {}) {
    const where = {};
    if (filters.status) where.status = filters.status;
    if (filters.tenant_id) where.tenant_id = filters.tenant_id;
    return Payment.findAll({ where, include: this._inc(), order: [['payment_date', 'DESC']] });
  }
  async getById(id, currentUser) {
    const p = await Payment.findByPk(id, { include: this._inc() });
    if (!p) throw Object.assign(new Error('Paiement introuvable'), { status: 404 });
    if (currentUser && currentUser.role === 'locataire') {
      const tenant = await Tenant.findOne({ where: { user_id: currentUser.id } });
      if (!tenant || p.tenant_id !== tenant.id) throw Object.assign(new Error('Paiement introuvable'), { status: 404 });
    }
    return p;
  }
  async create(data, user) {
    if (!data.payment_date) data.payment_date = new Date().toISOString().slice(0, 10);
    const p = await Payment.create(data);
    const sansPreuve = !p.payment_proof && p.status === 'awaiting_confirmation';
    await this._log(p.id, 'created', `Paiement créé : ${Number(p.amount)} FCFA${sansPreuve ? ' (en attente de justification)' : ''}`, p, user);
    const full = await this.getById(p.id);
    // Temps réel : notifier les dashboards
    try {
      const propId = full.apartment?.property?.id || full.apartment?.property_id;
      emitPayment('nouveau', { id: full.id, amount: full.amount, status: full.status, tenant: full.tenant?.user?.full_name }, propId);
      emitDashboard();
    } catch (_) { /* socket non bloquant */ }
    logger.info('Paiement créé', { paymentId: p.id, amount: p.amount, tenantId: p.tenant_id });
    return full;
  }
  // Modification d'un paiement (montant, date, statut, preuve) + journal des changements
  async update(id, data, user) {
    const p = await Payment.findByPk(id);
    if (!p) throw Object.assign(new Error('Paiement introuvable'), { status: 404 });
    const changes = [];
    if (data.amount != null && Number(data.amount) !== Number(p.amount)) changes.push(`Montant : ${Number(p.amount)} → ${Number(data.amount)} FCFA`);
    if (data.payment_date && String(data.payment_date) !== String(p.payment_date)) changes.push(`Date : ${p.payment_date} → ${data.payment_date}`);
    if (data.status && data.status !== p.status) changes.push(`Statut : ${p.status} → ${data.status}`);
    if (data.payment_proof && data.payment_proof !== p.payment_proof) changes.push('Preuve ajoutée');
    await p.update(data);
    await this._log(id, 'updated', changes.join(' · ') || 'Modification', p, user);
    const full = await this.getById(id);
    try {
      const propId = full.apartment?.property?.id;
      emitPayment('modifie', { id: full.id, amount: full.amount, status: full.status }, propId);
      emitDashboard();
    } catch (_) {}
    return full;
  }
  // Ajout d'une preuve après coup : la preuve valide le paiement s'il était en attente de justification
  async addProof(id, url, user) {
    const p = await Payment.findByPk(id);
    if (!p) throw Object.assign(new Error('Paiement introuvable'), { status: 404 });
    const wasAwaiting = p.status === 'awaiting_confirmation';
    await p.update({ payment_proof: url, ...(wasAwaiting ? { status: 'completed' } : {}) });
    await this._log(id, 'proof_added', 'Preuve ajoutée' + (wasAwaiting ? ' → paiement validé' : ''), p, user);
    return this.getById(id);
  }
  async remove(id) {
    const p = await Payment.findByPk(id);
    if (!p) throw Object.assign(new Error('Paiement introuvable'), { status: 404 });
    await p.destroy(); return true;
  }
  getDebts() {
    return Payment.findAll({ where: { status: { [Op.in]: ['pending', 'failed'] } }, include: this._inc(), order: [['payment_date', 'ASC']] });
  }

  // ===== Locataire : déclarer un paiement (espèces + preuve, ou Mobile Money CamPay) =====
  async declare(data, currentUser, file) {
    const tenant = await Tenant.findOne({ where: { user_id: currentUser.id } });
    if (!tenant) throw Object.assign(new Error('Profil locataire introuvable'), { status: 404 });
    if (!data.amount || Number(data.amount) <= 0) throw Object.assign(new Error('Montant invalide'), { status: 400 });

    const payload = {
      tenant_id: tenant.id,
      apartment_id: tenant.apartment_id || null,
      amount: data.amount,
      payment_date: new Date().toISOString().slice(0, 10),
      created_by: currentUser.id,
      status: 'awaiting_confirmation',
    };

    if (data.payment_method === 'cash') {
      if (!file) throw Object.assign(new Error('Une preuve de paiement est requise pour un paiement en espèces'), { status: 400 });
      payload.payment_method = 'cash';
      payload.payment_proof = `/uploads/payments/${file.filename}`;
      const payment = await Payment.create(payload);
      await this._log(payment.id, 'created', `Déclaration locataire : ${Number(data.amount)} FCFA (espèces, preuve fournie)`, payment, currentUser);
      return { payment: await this.getById(payment.id), message: 'Paiement enregistré, en attente de vérification par votre gestionnaire.' };
    }

    if (['kang', 'campay'].includes(data.payment_method)) {
      if (!data.phone) throw Object.assign(new Error('Numéro de téléphone requis pour le paiement Mobile Money'), { status: 400 });
      payload.payment_method = 'kang';
      const payment = await Payment.create(payload);
      await this._log(payment.id, 'created', `Déclaration locataire : ${Number(data.amount)} FCFA (Mobile Money Kang)`, payment, currentUser);
      try {
        const result = await kangService.initiateCollection({
          amount: data.amount, phone: data.phone,
          externalReference: `PAY-${payment.id}`,
          description: 'Paiement loyer SMG Immobilier',
        });
        await payment.update({ campay_reference: result.reference }); // colonne réutilisée comme référence fournisseur
        return { payment: await this.getById(payment.id), message: 'Vérifiez votre téléphone pour valider le paiement Mobile Money.' };
      } catch (err) {
        await payment.update({ status: 'failed' });
        throw err;
      }
    }

    throw Object.assign(new Error('Méthode de paiement invalide'), { status: 400 });
  }

  // ===== Staff : valider ou rejeter un paiement en attente de vérification =====
  async verify(id, decision, user) {
    if (!['completed', 'failed'].includes(decision)) throw Object.assign(new Error('Décision invalide'), { status: 400 });
    const p = await Payment.findByPk(id);
    if (!p) throw Object.assign(new Error('Paiement introuvable'), { status: 404 });
    if (p.status !== 'awaiting_confirmation') throw Object.assign(new Error("Ce paiement n'est pas en attente de vérification"), { status: 400 });
    await p.update({ status: decision });
    await this._log(id, decision === 'completed' ? 'validated' : 'rejected', decision === 'completed' ? 'Paiement validé' : 'Paiement rejeté', p, user);
    const full = await this.getById(id);
    try {
      emitPayment(decision === 'completed' ? 'valide' : 'rejete', { id: full.id, amount: full.amount, status: decision }, null);
      emitDashboard();
    } catch (_) {}
    return full;
  }

  // ===== Webhook Kang : mise à jour automatique du statut =====
  async handleKangWebhook(payload) {
    const { reference, status } = kangService.parseWebhook(payload);
    if (!reference) return;
    const p = await Payment.findOne({ where: { campay_reference: reference } });
    if (!p) return;
    if (status === 'completed') {
      await p.update({ status: 'completed' });
      await this._log(p.id, 'validated', 'Paiement validé (confirmation Mobile Money Kang)', p, null);
    } else if (status === 'failed') {
      await p.update({ status: 'failed' });
    }
  }
}
module.exports = new PaymentService();
