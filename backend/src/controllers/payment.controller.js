const paymentService = require('../services/payment.service');
const ledgerService = require('../services/ledger.service');
const { Tenant } = require('../models');
const { createCrudController } = require('./crud.factory');
const { success, error } = require('../utils/response');

const base = createCrudController(paymentService, {
  created: 'Paiement enregistré', updated: 'Paiement mis à jour', deleted: 'Paiement supprimé',
});

module.exports = {
  ...base,
  create: async (req, res, next) => {
    try { return success(res, await paymentService.create(req.body, req.user), 'Paiement enregistré', 201); } catch (err) { next(err); }
  },
  update: async (req, res, next) => {
    try { return success(res, await paymentService.update(req.params.id, req.body, req.user), 'Paiement mis à jour'); } catch (err) { next(err); }
  },
  getById: async (req, res, next) => {
    try { return success(res, await paymentService.getById(req.params.id, req.user)); } catch (err) { next(err); }
  },
  getDebts: async (req, res, next) => { try { return success(res, await paymentService.getDebts()); } catch (e) { next(e); } },
  uploadProof: async (req, res, next) => {
    try {
      if (!req.file) return error(res, 'Aucun fichier reçu', 400);
      const data = await paymentService.addProof(req.params.id, `/uploads/payments/${req.file.filename}`, req.user);
      return success(res, data, 'Justificatif enregistré');
    } catch (err) { next(err); }
  },
  declare: async (req, res, next) => {
    try {
      const result = await paymentService.declare(req.body, req.user, req.file);
      return success(res, result.payment, result.message, 201);
    } catch (err) { next(err); }
  },
  verify: async (req, res, next) => {
    try {
      const data = await paymentService.verify(req.params.id, req.body.decision, req.user);
      return success(res, data, 'Statut du paiement mis à jour');
    } catch (err) { next(err); }
  },
  // Relevé de compte d'un locataire (solde, transactions, historique des modifications)
  getLedger: async (req, res, next) => {
    try { return success(res, await ledgerService.tenantLedger(req.params.tenantId)); } catch (err) { next(err); }
  },
  // Relevé du locataire connecté
  getMyLedger: async (req, res, next) => {
    try {
      const tenant = await Tenant.findOne({ where: { user_id: req.user.id } });
      if (!tenant) throw Object.assign(new Error('Profil locataire introuvable'), { status: 404 });
      return success(res, await ledgerService.tenantLedger(tenant.id));
    } catch (err) { next(err); }
  },
  kangWebhook: async (req, res, next) => {
    try {
      await paymentService.handleKangWebhook(req.body);
      return success(res, null, 'OK');
    } catch (err) { next(err); }
  },
};
