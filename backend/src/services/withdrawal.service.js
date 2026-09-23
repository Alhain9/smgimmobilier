const { Withdrawal, User, Payment, Notification } = require('../models');
const campayService = require('./campay.service');
const { emitDashboard } = require('../config/socket');
const { logger } = require('../config/logger');

class WithdrawalService {
  /**
   * Récupère le solde réel de l'agrégateur CamPay et la synthèse des retraits de la plateforme.
   */
  async getBalance() {
    let campayBalance = null;
    try {
      campayBalance = await campayService.getBalance();
    } catch (e) {
      logger.warn('Impossible de récupérer le solde CamPay direct', { error: e.message });
    }

    // Calcul interne du solde encaissé vs retiré (retraits 'completed' uniquement)
    const totalCollected = await Payment.sum('amount', { where: { status: 'completed' } }) || 0;
    const totalWithdrawn = await Withdrawal.sum('amount', { where: { status: 'completed' } }) || 0;
    const availableBalance = Math.max(0, totalCollected - totalWithdrawn);

    return {
      campay_live: campayBalance,
      total_collected: totalCollected,
      total_withdrawn: totalWithdrawn,
      available_balance: availableBalance,
      currency: 'XAF',
    };
  }

  /**
   * Effectue une demande de retrait ou virement Mobile Money / Point de dépôt.
   */
  async create(data, currentUser) {
    const amount = parseFloat(data.amount);
    if (!amount || amount <= 0) {
      throw Object.assign(new Error('Le montant du retrait doit être supérieur à 0 FCFA'), { status: 400 });
    }

    const phone = String(data.phone || '').trim();
    if (!phone) {
      throw Object.assign(new Error('Le numéro de téléphone du bénéficiaire est requis'), { status: 400 });
    }

    const withdrawalType = data.withdrawal_type || 'mobile_money';
    const recipientName = data.recipient_name || currentUser.full_name;
    const ref = `WDR-${Date.now()}`;
    let code = null;

    if (withdrawalType === 'cash_code') {
      code = 'CASH-' + Math.floor(100000 + Math.random() * 900000);
    }

    // Traitement selon le mode de retrait
    if (withdrawalType === 'mobile_money') {
      let campayRes = null;
      try {
        campayRes = await campayService.withdraw({
          amount,
          phone,
          description: `Retrait SMG Immobilier - ${recipientName}`,
          externalReference: ref,
        });
      } catch (err) {
        logger.error('Erreur API Retrait CamPay', { error: err.message });
        campayRes = { success: false, message: err.message };
      }

      if (!campayRes || !campayRes.success) {
        const rawMsg = campayRes?.message || 'Retrait refusé par l\'agrégateur';
        let userMsg = `Le retrait par API CamPay n'a pas pu aboutir (${rawMsg}).`;

        if (rawMsg.includes('UNAUTHORIZED') || rawMsg.includes('API WITHDRAWALS')) {
          userMsg = `L'API CamPay a refusé le virement automatique ("API WITHDRAWALS UNAUTHORIZED"). Par mesure de sécurité bancaire, CamPay exige l'activation explicite des paiements sortants par API dans votre espace marchand (https://demo.campay.net ou https://campay.net). En attendant cette activation par le support CamPay, vous pouvez réaliser vos retraits directement sur votre tableau de bord CamPay.`;
        }

        // On enregistre l'échec en base pour que l'historique montre 'failed' sans impacter le solde
        await Withdrawal.create({
          amount,
          phone,
          recipient_name: recipientName,
          withdrawal_type: withdrawalType,
          reference: ref,
          status: 'failed',
          description: `Échec API CamPay : ${rawMsg}`,
          created_by: currentUser.id,
        });

        throw Object.assign(new Error(userMsg), { status: 400 });
      }

      // Si CamPay a accepté l'opération avec succès
      const withdrawal = await Withdrawal.create({
        amount,
        phone,
        recipient_name: recipientName,
        withdrawal_type: withdrawalType,
        reference: ref,
        campay_reference: campayRes?.reference || null,
        status: 'completed',
        description: data.description || `Retrait effectué par ${currentUser.full_name}`,
        created_by: currentUser.id,
      });

      try {
        const managers = await User.findAll({ where: { role_id: [1, 2, 3] } });
        for (const mgr of managers) {
          await Notification.create({
            user_id: mgr.id,
            title: '💸 Retrait Mobile Money validé',
            message: `Transfert de ${amount.toLocaleString('fr-FR')} FCFA envoyé avec succès vers ${recipientName} (${phone}).`,
            is_read: false,
          }).catch(() => {});
        }
        emitDashboard();
      } catch (_) {}

      return {
        withdrawal: await this.getById(withdrawal.id),
        message: `Transfert de ${amount.toLocaleString('fr-FR')} FCFA envoyé avec succès vers le numéro ${phone}.`,
      };

    } else {
      // Retrait interne par Code / Point de dépôt
      const withdrawal = await Withdrawal.create({
        amount,
        phone,
        recipient_name: recipientName,
        withdrawal_type: withdrawalType,
        reference: ref,
        code,
        status: 'completed',
        description: data.description || `Code de retrait généré par ${currentUser.full_name}`,
        created_by: currentUser.id,
      });

      try {
        const managers = await User.findAll({ where: { role_id: [1, 2, 3] } });
        for (const mgr of managers) {
          await Notification.create({
            user_id: mgr.id,
            title: '🎟 Code de retrait point de dépôt',
            message: `Un code de retrait de ${amount.toLocaleString('fr-FR')} FCFA (${code}) a été créé pour ${recipientName}.`,
            is_read: false,
          }).catch(() => {});
        }
        emitDashboard();
      } catch (_) {}

      return {
        withdrawal: await this.getById(withdrawal.id),
        code,
        message: `Code de retrait généré : ${code}. Le bénéficiaire peut récupérer les fonds en point de dépôt avec ce code.`,
      };
    }
  }

  async getAll(filters = {}) {
    const where = {};
    if (filters.status) where.status = filters.status;
    return Withdrawal.findAll({
      where,
      include: [{ model: User, as: 'creator', attributes: ['id', 'full_name', 'phone', 'email'] }],
      order: [['created_at', 'DESC']],
    });
  }

  async getById(id) {
    const w = await Withdrawal.findByPk(id, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'full_name', 'phone', 'email'] }],
    });
    if (!w) throw Object.assign(new Error('Enregistrement de retrait introuvable'), { status: 404 });
    return w;
  }
}

module.exports = new WithdrawalService();
