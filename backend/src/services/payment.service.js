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
    if (filters.created_by) where.created_by = filters.created_by;
    if (filters.userOrPropertyCondition) {
      Object.assign(where, filters.userOrPropertyCondition);
    }
    if (Array.isArray(filters.ownerPropertyIds)) {
      where['$apartment.property_id$'] = { [Op.in]: filters.ownerPropertyIds };
    }
    return Payment.findAll({ where, include: this._inc(), order: [['payment_date', 'DESC']] });
  }
  async remove(id) {
    const { Receipt, PaymentHistory, Apartment } = require('../models');
    const p = await Payment.findByPk(id, {
      include: [{ model: Apartment, as: 'apartment' }],
    });
    if (!p) throw Object.assign(new Error('Paiement introuvable'), { status: 404 });

    const apartmentId = p.apartment_id;
    const propId = p.apartment?.property_id;
    const pDate = p.payment_date;

    // 1. Supprimer les reçus associés à ce paiement pour qu'ils disparaissent immédiatement
    await Receipt.destroy({ where: { payment_id: id } });
    // 2. Supprimer l'historique associé
    await PaymentHistory.destroy({ where: { payment_id: id } });
    // 3. Détruire le paiement de la base de données
    await p.destroy();

    // 4. Nettoyer les surcharges obsolètes pour ce logement si liées à ce paiement
    if (apartmentId) {
      try {
        const { sequelize } = require('../config/database');
        await sequelize.query(
          `DELETE FROM situation_overrides WHERE apartment_id = :aptId AND payment_date = :pDate`,
          { replacements: { aptId: apartmentId, pDate } }
        );
      } catch (_) {}
    }

    // 5. Temps réel : notifier les dashboards
    try {
      emitPayment('supprime', { id }, propId);
      emitDashboard();
    } catch (_) {}

    logger.info('🗑️ Paiement et reçu supprimés définitivement', { paymentId: id });
    return true;
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
    if (user && user.id && !data.created_by) data.created_by = user.id;

    // Détection automatique intelligente de la période si non renseignée
    if ((!data.period_start || !data.period_end) && data.tenant_id) {
      try {
        const tenant = await Tenant.findByPk(data.tenant_id, {
          include: [
            { model: Lease, as: 'leases', where: { status: 'active' }, required: false },
            { model: Apartment, as: 'apartment' },
            { model: Payment, as: 'payments', where: { status: 'completed' }, required: false },
          ],
        });
        if (tenant) {
          const lease = (tenant.leases || [])[0];
          const monthly = (lease && num(lease.monthly_rent)) || (tenant.apartment && num(tenant.apartment.rent_amount)) || 0;
          if (!data.period_start) {
            const pastPays = (tenant.payments || []).filter(p => p.period_end).sort((a, b) => new Date(b.period_end) - new Date(a.period_end));
            if (pastPays.length > 0 && pastPays[0].period_end) {
              data.period_start = pastPays[0].period_end;
            } else {
              const ledgerService = require('./ledger.service');
              const led = ledgerService.computeFromTenant(tenant);
              if (led && led.prochaine_echeance) {
                data.period_start = led.prochaine_echeance;
              } else if (lease && lease.start_date) {
                data.period_start = lease.start_date;
              } else if (tenant.start_date) {
                data.period_start = tenant.start_date;
              } else {
                data.period_start = data.payment_date;
              }
            }
          }
          if (!data.period_end && data.period_start && monthly > 0 && Number(data.amount) > 0) {
            const months = Math.max(1, Math.floor(Number(data.amount) / monthly));
            const s = new Date(data.period_start);
            if (!isNaN(s.getTime())) {
              const e = new Date(s);
              e.setMonth(e.getMonth() + months);
              data.period_end = e.toISOString().slice(0, 10);
            }
          }
        }
      } catch (err) {
        logger.warn('Auto-détection période backend échouée:', { error: err.message });
      }
    }

    const p = await Payment.create(data);
    const sansPreuve = !p.payment_proof && p.status === 'awaiting_confirmation';
    await this._log(p.id, 'created', `Paiement créé : ${Number(p.amount)} FCFA${sansPreuve ? ' (en attente de justification)' : ''}`, p, user);
    const full = await this.getById(p.id);

    if (p.status === 'completed') {
      try {
        const receiptService = require('./receipt.service');
        await receiptService.generateRentReceipt(p.id, user?.id, {
          period_start: p.period_start,
          period_end: p.period_end,
          observations: p.observations,
        });
      } catch (err) { logger.warn('Auto-génération reçu échouée:', { error: err.message }); }
      await this._syncSituationOverride(full || p);
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
    if (p.status === 'completed') {
      try {
        const receiptService = require('./receipt.service');
        await receiptService.generateRentReceipt(p.id, user?.id, {
          period_start: p.period_start,
          period_end: p.period_end,
          observations: p.observations,
        });
      } catch (err) { logger.warn('Mise à jour reçu lors modification paiement échouée:', { error: err.message }); }
    }
    const full = await this.getById(id);
    if (p.status === 'completed') {
      await this._syncSituationOverride(full || p);
    }
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
      await this._syncSituationOverride(p);
    }
    return this.getById(id);
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

  // Synchronisation automatique bidirectionnelle vers la table situation_overrides
  async _syncSituationOverride(payment) {
    try {
      if (!payment || !payment.apartment_id || payment.status !== 'completed') return;
      const { sequelize } = require('../config/database');
      const { Apartment, Property, Tenant, User, Payment } = require('../models');
      const { Op } = require('sequelize');

      const apt = await Apartment.findByPk(payment.apartment_id, {
        include: [
          { model: Property, as: 'property' },
          { model: Tenant, as: 'tenants', where: { status: 'active' }, required: false, include: [{ model: User, as: 'user' }] },
        ],
      });
      if (!apt) return;

      const propId = apt.property_id;
      const pDate = payment.payment_date ? String(payment.payment_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
      const ym = pDate.slice(0, 7);

      const [tYear, tMonth] = ym.split('-');
      const lastDayNum = new Date(Number(tYear), Number(tMonth), 0).getDate();
      const startOfMonth = `${ym}-01`;
      const endOfMonth = `${ym}-${String(lastDayNum).padStart(2, '0')}`;

      const monthPayments = await Payment.findAll({
        where: {
          apartment_id: apt.id,
          status: 'completed',
          payment_date: { [Op.between]: [startOfMonth, endOfMonth] },
        },
        order: [['payment_date', 'DESC'], ['id', 'DESC']],
      });

      const sumVersement = monthPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      const monthlyRent = parseFloat(apt.rent_amount) || 0;

      const lastWithEnd = monthPayments.find((p) => p.period_end) || payment;
      let arriere = 0;
      let anticipation = 0;
      let periodePaiement = '—';

      if (lastWithEnd && lastWithEnd.period_end && monthlyRent > 0) {
        const eDate = new Date(lastWithEnd.period_end);
        const endYear = eDate.getFullYear();
        const endMonth = eDate.getMonth() + 1;
        const diffMonths = (Number(tYear) - endYear) * 12 + (Number(tMonth) - endMonth);
        if (diffMonths < 0) {
          anticipation = Math.abs(diffMonths) * monthlyRent;
          arriere = 0;
        } else if (diffMonths > 0) {
          arriere = diffMonths * monthlyRent;
          anticipation = 0;
        } else {
          arriere = 0;
          anticipation = 0;
        }
        if (lastWithEnd.period_start) {
          const fmtFR = (d) => {
            const s = String(d).slice(0, 10);
            const p = s.split('-');
            return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
          };
          periodePaiement = `du ${fmtFR(lastWithEnd.period_start)} au ${fmtFR(lastWithEnd.period_end)}`;
        }
      }

      const methodLabels = {
        cash: 'Espèces',
        especes: 'Espèces',
        bank_transfer: 'Virement bancaire',
        virement: 'Virement bancaire',
        orange_money: 'Orange Money',
        mtn_mobile_money: 'MTN Mobile Money',
        campay: 'Mobile Money',
        cheque: 'Chèque',
        autre: 'Autre',
      };
      const modePaiement = methodLabels[payment.payment_method] || payment.payment_method || 'Espèces';
      const obs = payment.observations || (arriere === 0 ? "À jour" : `Impayé ${arriere} FCFA`);

      const [existing] = await sequelize.query(
        `SELECT id FROM situation_overrides WHERE apartment_id = :aptId AND period_ym = :ym LIMIT 1`,
        { replacements: { aptId: apt.id, ym } }
      );

      if (existing && existing.length > 0) {
        await sequelize.query(
          `UPDATE situation_overrides SET
            tenant_id = :tenantId,
            versement_mois = :versement,
            arriere_loyer = :arriere,
            anticipation = :anticipation,
            payment_date = :pDate,
            period_start = :pStart,
            period_end = :pEnd,
            periode_paiement = :periodePaiement,
            mode_paiement = :modePaiement,
            observations = :obs,
            updated_at = NOW()
          WHERE id = :id`,
          {
            replacements: {
              tenantId: payment.tenant_id || null,
              versement: sumVersement,
              arriere,
              anticipation,
              pDate,
              pStart: lastWithEnd?.period_start || null,
              pEnd: lastWithEnd?.period_end || null,
              periodePaiement,
              modePaiement,
              obs,
              id: existing[0].id,
            },
          }
        );
      } else {
        let tName = 'Locataire';
        let tPhone = '—';
        const activeTenant = (apt.tenants || [])[0];
        if (activeTenant && activeTenant.user) {
          tName = activeTenant.user.full_name || tName;
          tPhone = activeTenant.user.phone || tPhone;
        } else if (payment.tenant_id) {
          const tObj = await Tenant.findByPk(payment.tenant_id, { include: [{ model: User, as: 'user' }] });
          if (tObj && tObj.user) {
            tName = tObj.user.full_name || tName;
            tPhone = tObj.user.phone || tPhone;
          }
        }

        await sequelize.query(
          `INSERT INTO situation_overrides (
            property_id, apartment_id, tenant_id, period_ym,
            numero_chambre, nom_locataire, telephone, montant_loyer,
            description_logement, arriere_loyer, anticipation, versement_mois,
            payment_date, period_start, period_end,
            periode_paiement, mode_paiement, caution, observations,
            created_at, updated_at
          ) VALUES (
            :propId, :aptId, :tenantId, :ym,
            :aptNum, :tName, :tPhone, :rent,
            :desc, :arriere, :anticipation, :versement,
            :pDate, :pStart, :pEnd,
            :periodePaiement, :modePaiement, 0, :obs,
            NOW(), NOW()
          )`,
          {
            replacements: {
              propId,
              aptId: apt.id,
              tenantId: payment.tenant_id || null,
              ym,
              aptNum: apt.apartment_number,
              tName,
              tPhone,
              rent: monthlyRent,
              desc: apt.description || apt.apartment_type || 'Logement',
              arriere,
              anticipation,
              versement: sumVersement,
              pDate,
              pStart: lastWithEnd?.period_start || null,
              pEnd: lastWithEnd?.period_end || null,
              periodePaiement,
              modePaiement,
              obs,
            },
          }
        );
      }
    } catch (err) {
      logger.warn('Synchronisation situation_overrides échouée:', { error: err.message });
    }
  }
}
module.exports = new PaymentService();
