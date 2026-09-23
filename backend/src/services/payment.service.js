const { Payment, Tenant, Apartment, User, Property, PaymentHistory } = require('../models');
const { Op } = require('sequelize');
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
  async getAll(filters = {}) {
    await this.syncPendingPayments();
    const where = {};
    if (filters.status) where.status = filters.status;
    if (filters.tenant_id) where.tenant_id = filters.tenant_id;
    return Payment.findAll({ where, include: this._inc(), order: [['payment_date', 'DESC']] });
  }
  async getById(id, currentUser) {
    let p = await Payment.findByPk(id, { include: this._inc() });
    if (!p) throw Object.assign(new Error('Paiement introuvable'), { status: 404 });

    if (['awaiting_confirmation', 'pending'].includes(p.status) && p.campay_reference) {
      await this.syncPendingPayments();
      p = await Payment.findByPk(id, { include: this._inc() });
    }

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
    if (p.status === 'completed') {
      try {
        const receiptService = require('./receipt.service');
        await receiptService.generateRentReceipt(p.id, user?.id);
      } catch (err) { logger.warn('Auto-génération reçu échouée:', { error: err.message }); }
    }
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
    const wasCompleted = p.status === 'completed';
    await p.update(data);
    await this._log(id, 'updated', changes.join(' · ') || 'Modification', p, user);
    if (data.status === 'completed' && !wasCompleted) {
      try {
        const receiptService = require('./receipt.service');
        await receiptService.generateRentReceipt(p.id, user?.id);
      } catch (err) { logger.warn('Auto-génération reçu échouée:', { error: err.message }); }
    }
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
    if (wasAwaiting) {
      try {
        const receiptService = require('./receipt.service');
        await receiptService.generateRentReceipt(p.id, user?.id);
      } catch (err) { logger.warn('Auto-génération reçu échouée:', { error: err.message }); }
    }
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

    if (['campay', 'orange_money', 'mtn_mobile_money', 'mobile_money'].includes(data.payment_method)) {
      if (!data.phone) throw Object.assign(new Error('Numéro de téléphone requis pour le paiement Mobile Money'), { status: 400 });
      payload.payment_method = data.payment_method.includes('orange') ? 'orange_money' : (data.payment_method.includes('mtn') ? 'mtn_mobile_money' : 'campay');
      const payment = await Payment.create(payload);
      await this._log(payment.id, 'created', `Déclaration locataire : ${Number(data.amount)} FCFA (Mobile Money CamPay)`, payment, currentUser);
      try {
        const campayService = require('./campay.service');
        const result = await campayService.initiateCollection({
          amount: data.amount,
          phone: data.phone,
          externalReference: `PAY-${payment.id}`,
          description: `Paiement loyer Appt ${tenant.apartment_id || ''} SMG Immobilier`,
        });
        await payment.update({ campay_reference: result.reference });

        const full = await this.getById(payment.id);
        try {
          emitPayment('nouveau', { id: full.id, amount: full.amount, status: full.status, tenant: full.tenant?.user?.full_name }, full.apartment?.property_id);
          emitDashboard();
        } catch (_) {}

        return {
          payment: full,
          ussd_code: result.ussd_code,
          operator: result.operator,
          message: `Demande envoyée sur le numéro ${data.phone}. Veuillez valider par code secret Mobile Money (${result.ussd_code || 'USSD'}) sur votre téléphone.`
        };
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
    if (decision === 'completed') {
      try {
        const receiptService = require('./receipt.service');
        await receiptService.generateRentReceipt(p.id, user?.id);
      } catch (err) { logger.warn('Auto-génération reçu échouée:', { error: err.message }); }
    }
    const full = await this.getById(id);
    try {
      emitPayment(decision === 'completed' ? 'valide' : 'rejete', { id: full.id, amount: full.amount, status: decision }, null);
      emitDashboard();
    } catch (_) {}
    return full;
  }

  // ===== Webhook CamPay : mise à jour automatique et instantanée du statut et notifications =====
  async handleCampayWebhook(payload) {
    const campayService = require('./campay.service');
    const parsed = campayService.parseWebhook(payload);
    logger.info('Webhook CamPay reçu', { parsed, payload });

    let payment = null;
    if (parsed.reference) {
      payment = await Payment.findOne({ where: { campay_reference: parsed.reference } });
    }
    if (!payment && parsed.externalReference && parsed.externalReference.startsWith('PAY-')) {
      const payId = parsed.externalReference.replace('PAY-', '');
      payment = await Payment.findByPk(payId);
    }

    if (!payment) {
      logger.warn('Paiement introuvable pour le Webhook CamPay', { reference: parsed.reference, ext: parsed.externalReference });
      return;
    }

    if (parsed.status === 'completed') {
      await payment.update({ status: 'completed' });
      await this._log(payment.id, 'validated', 'Paiement validé automatiquement via Mobile Money (CamPay)', payment, null);

      try {
        const receiptService = require('./receipt.service');
        await receiptService.generateRentReceipt(payment.id, null);
      } catch (err) { logger.warn('Auto-génération reçu échouée:', { error: err.message }); }

      const full = await this.getById(payment.id);
      const tenantName = full.tenant?.user?.full_name || 'Locataire';
      const tenantUserId = full.tenant?.user_id;

      // Notifications automatique en base
      const { Notification } = require('../models');
      if (tenantUserId) {
        await Notification.create({
          user_id: tenantUserId,
          title: 'Paiement confirmé !',
          message: `Votre paiement de ${Number(full.amount).toLocaleString('fr-FR')} FCFA a été reçu et validé avec succès par Mobile Money.`,
          is_read: false,
        }).catch(() => {});
      }

      // Notifier le manager
      try {
        const managers = await User.findAll({ where: { role_id: [1, 2, 3] } });
        for (const mgr of managers) {
          await Notification.create({
            user_id: mgr.id,
            title: 'Nouveau versement Mobile Money',
            message: `Paiement de ${Number(full.amount).toLocaleString('fr-FR')} FCFA validé automatiquement pour ${tenantName}.`,
            is_read: false,
          }).catch(() => {});
        }
      } catch (_) {}

      // Émission événements Socket.IO
      try {
        emitPayment('valide', { id: full.id, amount: full.amount, status: 'completed', tenant: tenantName }, full.apartment?.property_id);
        emitDashboard();
      } catch (_) {}

    } else if (parsed.status === 'failed') {
      await payment.update({ status: 'failed' });
      await this._log(payment.id, 'rejected', 'Paiement Mobile Money échoué ou annulé', payment, null);
    }
  }

  // ===== Synchronisation automatique des paiements en attente avec l'API CamPay =====
  async syncPendingPayments() {
    try {
      const pendingPayments = await Payment.findAll({
        where: {
          status: { [Op.in]: ['awaiting_confirmation', 'pending'] },
          campay_reference: { [Op.ne]: null }
        }
      });

      if (!pendingPayments || !pendingPayments.length) return 0;

      const campayService = require('./campay.service');
      let updatedCount = 0;

      for (const p of pendingPayments) {
        if (!p.campay_reference) continue;
        try {
          const statusRes = await campayService.checkStatus(p.campay_reference);
          const rawStatus = (statusRes.status || '').toUpperCase();

          if (['SUCCESSFUL', 'SUCCESS', 'COMPLETED'].includes(rawStatus)) {
            await p.update({ status: 'completed' });
            await this._log(p.id, 'validated', 'Paiement validé automatiquement via API CamPay (Sync)', p, null);

            const full = await Payment.findByPk(p.id, { include: this._inc() });
            const tenantName = full?.tenant?.user?.full_name || 'Locataire';
            const tenantUserId = full?.tenant?.user_id;

            // Notifications automatique en base
            const { Notification } = require('../models');
            if (tenantUserId) {
              await Notification.create({
                user_id: tenantUserId,
                title: 'Paiement confirmé !',
                message: `Votre paiement de ${Number(full.amount).toLocaleString('fr-FR')} FCFA a été reçu et validé avec succès par Mobile Money.`,
                is_read: false,
              }).catch(() => {});
            }

            try {
              const managers = await User.findAll({ where: { role_id: [1, 2, 3] } });
              for (const mgr of managers) {
                await Notification.create({
                  user_id: mgr.id,
                  title: 'Nouveau versement Mobile Money',
                  message: `Paiement de ${Number(full.amount).toLocaleString('fr-FR')} FCFA validé automatiquement pour ${tenantName}.`,
                  is_read: false,
                }).catch(() => {});
              }
            } catch (_) {}

            try {
              emitPayment('valide', { id: full.id, amount: full.amount, status: 'completed', tenant: tenantName }, full.apartment?.property_id);
              emitDashboard();
            } catch (_) {}

            updatedCount++;
          } else if (['FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED'].includes(rawStatus)) {
            await p.update({ status: 'failed' });
            await this._log(p.id, 'rejected', `Paiement Mobile Money annulé ou échoué (${rawStatus})`, p, null);
            updatedCount++;
          }
        } catch (err) {
          logger.warn(`Erreur lors de la vérification du statut CamPay (${p.campay_reference})`, { error: err.message });
        }
      }
      return updatedCount;
    } catch (e) {
      logger.error('Erreur globale syncPendingPayments', { error: e.message });
      return 0;
    }
  }
}
module.exports = new PaymentService();
