// ============ Tâches planifiées (Cron) ============
const cron = require('node-cron');
const { logger } = require('../config/logger');
const { Lease, Tenant, Payment, User, Apartment, Property, Notification } = require('../models');
const { Op } = require('sequelize');
const emailService = require('../services/email.service');
const { emitNotification } = require('../config/socket');

class JobScheduler {
  start() {
    // ===== Vérification quotidienne des arriérés (tous les jours à 8h) =====
    cron.schedule('0 8 * * *', async () => {
      try {
        logger.info('⏰ Cron: vérification des arriérés');
        await this.checkOverduePayments();
      } catch (err) { logger.error('Cron arriérés échoué', { error: err.message }); }
    });

    // ===== Alertes de fin de bail (tous les jours à 9h) =====
    cron.schedule('0 9 * * *', async () => {
      try {
        logger.info('⏰ Cron: alertes fin de bail');
        await this.checkExpiringLeases();
      } catch (err) { logger.error('Cron fin de bail échoué', { error: err.message }); }
    });

    // ===== Nettoyage des refresh tokens expirés (tous les jours à 3h du matin) =====
    cron.schedule('0 3 * * *', async () => {
      try {
        const authService = require('../services/auth.service');
        await authService.cleanupExpiredTokens();
      } catch (err) { logger.error('Cron nettoyage tokens échoué', { error: err.message }); }
    });

    // ===== Échéances de loyer (J-10, J-7, J-4, J-0) tous les jours à 8h30 =====
    cron.schedule('30 8 * * *', async () => {
      try {
        logger.info('⏰ Cron: vérification des échéances de loyer (J-10, J-7, J-4, J-0)');
        await this.checkUpcomingRentDues();
      } catch (err) { logger.error('Cron échéances échoué', { error: err.message }); }
    });

    // ===== Rappels de paiement (1er et 15 du mois à 10h) =====
    cron.schedule('0 10 1,15 * *', async () => {
      try {
        logger.info('⏰ Cron: rappels de paiement');
        await this.sendPaymentReminders();
      } catch (err) { logger.error('Cron rappels échoué', { error: err.message }); }
    });

    // ===== Synchronisation automatique CamPay Mobile Money (toutes les 5 secondes) =====
    setInterval(async () => {
      try {
        const paymentService = require('../services/payment.service');
        await paymentService.syncPendingPayments();
      } catch (_) {}
    }, 5000);

    logger.info('✅ Tâches planifiées (cron & CamPay Sync) démarrées');
  }

  // Détection des paiements en retard et création de notifications
  async checkOverduePayments() {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    // Trouver les baux actifs sans paiement complété pour le mois en cours
    const activeLeases = await Lease.findAll({
      where: { status: 'active' },
      include: [
        { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email'] }] },
        { model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number', 'property_id'], include: [{ model: Property, as: 'property', attributes: ['property_name'] }] },
      ],
    });

    let overdueCount = 0;
    for (const lease of activeLeases) {
      if (!lease.tenant) continue;
      // Vérifier s'il y a un paiement complété pour ce mois
      const hasPaid = await Payment.count({
        where: {
          tenant_id: lease.tenant_id,
          status: 'completed',
          [Op.and]: [
            { payment_date: { [Op.gte]: new Date(currentYear, currentMonth - 1, 1) } },
            { payment_date: { [Op.lt]: new Date(currentYear, currentMonth, 1) } },
          ],
        },
      });

      if (hasPaid === 0 && today.getDate() > 5) {
        overdueCount++;
        // Créer une notification interne
        try {
          await Notification.create({
            user_id: lease.tenant.user_id,
            title: 'Rappel de paiement',
            message: `Votre loyer de ${lease.monthly_rent} FCFA pour ${currentMonth}/${currentYear} n'est pas encore réglé.`,
            type: 'warning',
          });
          emitNotification(lease.tenant.user_id, {
            title: 'Rappel de paiement',
            type: 'warning',
          });
        } catch (_) { /* notification silencieuse */ }
      }
    }
    logger.info(`Arriérés détectés : ${overdueCount} locataire(s) en retard`);
  }

  // Alertes de fin de bail (30j, 15j, 7j avant)
  async checkExpiringLeases() {
    const thresholds = [30, 15, 7];
    for (const days of thresholds) {
      const target = new Date();
      target.setDate(target.getDate() + days);
      const targetStr = target.toISOString().slice(0, 10);

      const expiring = await Lease.findAll({
        where: { status: 'active', end_date: targetStr },
        include: [
          { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email'] }] },
          { model: Apartment, as: 'apartment', include: [{ model: Property, as: 'property', attributes: ['property_name'] }] },
        ],
      });

      for (const lease of expiring) {
        if (!lease.tenant?.user) continue;
        // Notification interne
        await Notification.create({
          user_id: lease.tenant.user.id,
          title: `Fin de bail dans ${days} jour(s)`,
          message: `Votre contrat de bail pour ${lease.apartment?.apartment_number || '?'} expire le ${lease.end_date}.`,
          type: days <= 7 ? 'error' : 'warning',
        });
        emitNotification(lease.tenant.user.id, { title: `Fin de bail dans ${days}j`, type: 'warning' });

        // Email si configuré
        if (lease.tenant.user.email) {
          emailService.sendLeaseExpiryAlert({
            to: lease.tenant.user.email,
            tenantName: lease.tenant.user.full_name,
            endDate: lease.end_date,
            propertyName: lease.apartment?.property?.property_name || '',
            apartmentNumber: lease.apartment?.apartment_number || '',
            daysLeft: days,
          }).catch(() => {});
        }
      }
      if (expiring.length > 0) {
        logger.info(`Fin de bail dans ${days}j : ${expiring.length} contrat(s)`);
      }
    }
  }

  // Envoi de rappels de paiement par email
  async sendPaymentReminders() {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    const activeLeases = await Lease.findAll({
      where: { status: 'active' },
      include: [
        { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email'] }] },
        { model: Apartment, as: 'apartment', include: [{ model: Property, as: 'property', attributes: ['property_name'] }] },
      ],
    });

    let sentCount = 0;
    for (const lease of activeLeases) {
      if (!lease.tenant?.user?.email) continue;

      const hasPaid = await Payment.count({
        where: {
          tenant_id: lease.tenant_id,
          status: 'completed',
          payment_date: { [Op.gte]: new Date(currentYear, currentMonth - 1, 1) },
        },
      });

      if (hasPaid === 0) {
        emailService.sendPaymentReminder({
          to: lease.tenant.user.email,
          tenantName: lease.tenant.user.full_name,
          amount: lease.monthly_rent,
          dueDate: `01/${String(currentMonth).padStart(2, '0')}/${currentYear}`,
          propertyName: lease.apartment?.property?.property_name || '',
          apartmentNumber: lease.apartment?.apartment_number || '',
        }).catch(() => {});
        sentCount++;
      }
    }
    logger.info(`Rappels de paiement envoyés : ${sentCount}`);
  }

  // Vérifie les échéances imminentes (J-10, J-7, J-4, J-0) et alerte locataires et gestionnaires
  async checkUpcomingRentDues() {
    const dashboardService = require('../services/dashboard.service');
    const dues = await dashboardService.getUpcomingRentDues();
    let notified = 0;

    for (const d of dues) {
      if (![10, 7, 4, 0].includes(d.jours_restants)) continue;

      const title = d.jours_restants === 0
        ? "⚠️ Échéance de loyer aujourd'hui !"
        : `🔔 Échéance de loyer dans ${d.jours_restants} jour(s)`;

      const msg = `Votre loyer de ${d.loyer_mensuel} FCFA arrive à échéance le ${d.prochaine_echeance} (${d.echeance_message}) pour le logement ${d.logement}.`;

      // Trouver l'utilisateur lié au locataire
      const tenant = await Tenant.findByPk(d.tenant_id);
      if (tenant && tenant.user_id) {
        try {
          await Notification.create({
            user_id: tenant.user_id,
            title,
            message: msg,
            type: d.jours_restants <= 4 ? 'warning' : 'info',
          });
          emitNotification(tenant.user_id, { title, message: msg, type: 'warning' });
          notified++;
        } catch (_) {}
      }
    }
    logger.info(`Échéances de loyer vérifiées : ${notified} alerte(s) envoyée(s)`);
  }
}

module.exports = new JobScheduler();
