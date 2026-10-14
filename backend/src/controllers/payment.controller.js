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
  getAll: async (req, res, next) => {
    try {
      const { Tenant, ManagerProperty } = require('../models');
      const { Op } = require('sequelize');
      const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);

      let tenantId = req.query.tenant_id || null;
      let createdBy = null;
      let userOrPropertyCondition = null;

      if (req.user && req.user.role === 'locataire') {
        const t = await Tenant.findOne({ where: { user_id: req.user.id } });
        if (!t) return success(res, [], 'Aucun profil locataire');
        tenantId = t.id;
      } else if (req.user && !isAdminOrManager && !req.user.is_bailleur) {
        // Collaborateur (comptable, gestionnaire, directeur administratif...) :
        // Ne voit que ses propres paiements créés OU les paiements des immeubles auxquels l'admin lui a donné accès
        const assignedLinks = await ManagerProperty.findAll({
          where: { user_id: req.user.id },
          attributes: ['property_id'],
        });
        const assignedPropertyIds = assignedLinks.map((l) => Number(l.property_id)).filter(Boolean);

        if (assignedPropertyIds.length > 0) {
          userOrPropertyCondition = {
            [Op.or]: [
              { created_by: req.user.id },
              { '$apartment.property_id$': { [Op.in]: assignedPropertyIds } },
            ],
          };
        } else {
          // Aucun immeuble attribué : ne voit que ses propres paiements
          createdBy = req.user.id;
        }
      } else if (isAdminOrManager) {
        // L'admin et le manager peuvent voir tous les paiements et filtrer par personne
        if (req.query.created_by || req.query.user_id) {
          createdBy = req.query.created_by || req.query.user_id;
        }
      }

      const filters = {
        status: req.query.status || null,
        tenant_id: tenantId,
        created_by: createdBy,
        userOrPropertyCondition,
        ownerPropertyIds: req.ownerPropertyIds || null,
      };

      const data = await paymentService.getAll(filters);
      return success(res, data);
    } catch (err) { next(err); }
  },
  create: async (req, res, next) => {
    try { return success(res, await paymentService.create(req.body, req.user), 'Paiement enregistré', 201); } catch (err) { next(err); }
  },
  update: async (req, res, next) => {
    try {
      const { Payment, Apartment } = require('../models');
      const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);
      const existing = await Payment.findByPk(req.params.id, {
        include: [{ model: Apartment, as: 'apartment', attributes: ['id', 'property_id'] }],
      });
      if (!existing) return error(res, 'Paiement introuvable', 404);
      if (!isAdminOrManager) {
        const isCreator = existing.created_by === req.user.id;
        const isAssigned = req.assignedPropertyIds && existing.apartment && req.assignedPropertyIds.includes(Number(existing.apartment.property_id));
        if (!isCreator && !isAssigned) {
          return error(res, 'Accès refusé : vous ne pouvez modifier que vos propres paiements ou ceux des immeubles qui vous sont assignés', 403);
        }
      }
      return success(res, await paymentService.update(req.params.id, req.body, req.user), 'Paiement mis à jour');
    } catch (err) { next(err); }
  },
  remove: async (req, res, next) => {
    try {
      const { Payment, Apartment } = require('../models');
      const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);
      const existing = await Payment.findByPk(req.params.id, {
        include: [{ model: Apartment, as: 'apartment', attributes: ['id', 'property_id'] }],
      });
      if (!existing) return error(res, 'Paiement introuvable', 404);
      if (!isAdminOrManager) {
        const isCreator = existing.created_by === req.user.id;
        const isAssigned = req.assignedPropertyIds && existing.apartment && req.assignedPropertyIds.includes(Number(existing.apartment.property_id));
        if (!isCreator && !isAssigned) {
          return error(res, 'Accès refusé : vous ne pouvez supprimer que vos propres paiements ou ceux des immeubles qui vous sont assignés', 403);
        }
      }
      await paymentService.remove(req.params.id);
      return success(res, null, 'Paiement supprimé');
    } catch (err) { next(err); }
  },
  bulkRemove: async (req, res, next) => {
    try {
      const { Payment, Apartment } = require('../models');
      const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);
      const ids = req.body.ids || [];
      let deletedCount = 0;
      for (const id of ids) {
        try {
          const existing = await Payment.findByPk(id, {
            include: [{ model: Apartment, as: 'apartment', attributes: ['id', 'property_id'] }],
          });
          if (existing) {
            const isCreator = existing.created_by === req.user.id;
            const isAssigned = req.assignedPropertyIds && existing.apartment && req.assignedPropertyIds.includes(Number(existing.apartment.property_id));
            if (isAdminOrManager || isCreator || isAssigned) {
              await paymentService.remove(id);
              deletedCount++;
            }
          }
        } catch (_) {}
      }
      return success(res, { count: deletedCount }, `${deletedCount} paiement(s) supprimé(s)`);
    } catch (err) { next(err); }
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
  campayWebhook: async (req, res, next) => {
    try {
      await paymentService.handleCampayWebhook(req.body);
      return success(res, null, 'OK');
    } catch (err) { next(err); }
  },
  getReceiptPdf: async (req, res, next) => {
    try {
      const receiptService = require('../services/receipt.service');
      const receiptPdfService = require('../services/receipt-pdf.service');

      const { Payment } = require('../models');
      const payment = await Payment.findByPk(req.params.id);
      if (!payment) {
        return error(res, 'Paiement introuvable', 404);
      }

      if (req.user && req.user.role === 'locataire') {
        const tenant = await Tenant.findOne({ where: { user_id: req.user.id } });
        if (!tenant || payment.tenant_id !== tenant.id) {
          return error(res, 'Accès refusé : ce reçu ne vous appartient pas', 403);
        }
      }

      let receipt = await receiptService.generateRentReceipt(req.params.id, req.user?.id);
      if (!receipt) {
        return error(res, 'Reçu introuvable pour ce paiement', 404);
      }

      if (req.ownerPropertyIds && receipt.property_id && !req.ownerPropertyIds.includes(receipt.property_id)) {
        return error(res, 'Accès refusé', 403);
      }

      receipt = await receiptService.getById(receipt.id);
      const buffer = await receiptPdfService.generate(receipt);
      const filename = `${receipt.receipt_number || 'recu'}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) { next(err); }
  },
};
