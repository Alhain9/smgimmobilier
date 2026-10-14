const service = require('../services/utility.service');
const { createCrudController } = require('./crud.factory');
const { success, error } = require('../utils/response');

const base = createCrudController(service, {
  created: 'Facture enregistrée', updated: 'Facture mise à jour', deleted: 'Facture supprimée',
});

module.exports = {
  ...base,
  getAll: async (req, res, next) => {
    try {
      const { ManagerProperty } = require('../models');
      const { Op } = require('sequelize');
      const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);

      let createdBy = null;
      let userOrPropertyCondition = null;

      if (req.user && !isAdminOrManager && !req.user.is_bailleur) {
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
          createdBy = req.user.id;
        }
      } else if (isAdminOrManager) {
        if (req.query.created_by || req.query.user_id) {
          createdBy = req.query.created_by || req.query.user_id;
        }
      }

      const filters = {
        ...req.query,
        created_by: createdBy,
        userOrPropertyCondition,
        ownerPropertyIds: req.ownerPropertyIds || null,
      };

      const data = await service.getAll(filters);
      return success(res, data);
    } catch (err) { next(err); }
  },
  create: async (req, res, next) => {
    try { return success(res, await service.create(req.body, req.user), 'Facture enregistrée', 201); }
    catch (e) { next(e); }
  },
  update: async (req, res, next) => {
    try {
      const { UtilityBill, Apartment } = require('../models');
      const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);
      const existing = await UtilityBill.findByPk(req.params.id, {
        include: [{ model: Apartment, as: 'apartment', attributes: ['id', 'property_id'] }],
      });
      if (!existing) return error(res, 'Facture introuvable', 404);
      if (!isAdminOrManager) {
        const isCreator = existing.created_by === req.user.id;
        const isAssigned = req.assignedPropertyIds && existing.apartment && req.assignedPropertyIds.includes(Number(existing.apartment.property_id));
        if (!isCreator && !isAssigned) {
          return error(res, 'Accès refusé : vous ne pouvez modifier que vos propres factures ou celles des immeubles qui vous sont assignés', 403);
        }
      }
      return success(res, await service.update(req.params.id, req.body), 'Facture mise à jour');
    } catch (err) { next(err); }
  },
  remove: async (req, res, next) => {
    try {
      const { UtilityBill, Apartment } = require('../models');
      const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);
      const existing = await UtilityBill.findByPk(req.params.id, {
        include: [{ model: Apartment, as: 'apartment', attributes: ['id', 'property_id'] }],
      });
      if (!existing) return error(res, 'Facture introuvable', 404);
      if (!isAdminOrManager) {
        const isCreator = existing.created_by === req.user.id;
        const isAssigned = req.assignedPropertyIds && existing.apartment && req.assignedPropertyIds.includes(Number(existing.apartment.property_id));
        if (!isCreator && !isAssigned) {
          return error(res, 'Accès refusé : vous ne pouvez supprimer que vos propres factures ou celles des immeubles qui vous sont assignés', 403);
        }
      }
      await service.remove(req.params.id);
      return success(res, null, 'Facture supprimée');
    } catch (err) { next(err); }
  },
  bulkRemove: async (req, res, next) => {
    try {
      const { UtilityBill, Apartment } = require('../models');
      const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);
      const ids = req.body.ids || [];
      let deletedCount = 0;
      for (const id of ids) {
        try {
          const existing = await UtilityBill.findByPk(id, {
            include: [{ model: Apartment, as: 'apartment', attributes: ['id', 'property_id'] }],
          });
          if (existing) {
            const isCreator = existing.created_by === req.user.id;
            const isAssigned = req.assignedPropertyIds && existing.apartment && req.assignedPropertyIds.includes(Number(existing.apartment.property_id));
            if (isAdminOrManager || isCreator || isAssigned) {
              await service.remove(id);
              deletedCount++;
            }
          }
        } catch (_) {}
      }
      return success(res, { count: deletedCount }, `${deletedCount} facture(s) supprimée(s)`);
    } catch (err) { next(err); }
  },
  // Dernière facture d'un logement → pour reporter l'ancien index + prix/frais et impayés
  getLast: async (req, res, next) => {
    try { return success(res, await service.getLast(req.query.apartment_id, req.query.type)); }
    catch (e) { next(e); }
  },
  setPaid: async (req, res, next) => {
    try {
      const paid = req.body.paid !== false;
      const method = req.body.payment_method || 'Espèces';
      const result = await service.setPaid(req.params.id, paid, req.user, method);
      return success(res, result, 'Statut et reçu mis à jour');
    } catch (e) { next(e); }
  },
  uploadProof: async (req, res, next) => {
    try {
      if (!req.file) return error(res, 'Aucun fichier reçu', 400);
      const data = await service.setProof(req.params.id, `/uploads/payments/${req.file.filename}`);
      return success(res, data, 'Justificatif enregistré');
    } catch (e) { next(e); }
  },
  pay: async (req, res, next) => {
    try {
      const proofUrl = req.file ? `/uploads/payments/${req.file.filename}` : null;
      const data = await service.pay(req.params.id, req.body, proofUrl, req.user);
      return success(res, data, 'Paiement de la charge et reçu enregistrés');
    } catch (e) { next(e); }
  },
  mine: async (req, res, next) => {
    try { return success(res, await service.getMine(req.user.id)); }
    catch (e) { next(e); }
  },
  batchPrepare: async (req, res, next) => {
    try { return success(res, await service.batchPrepare(req.query.property_id, req.query.type)); }
    catch (e) { next(e); }
  },
  batchCreate: async (req, res, next) => {
    try {
      const resData = await service.batchCreate(req.body, req.user);
      return success(res, resData, `${resData.count} facture(s) de charges générée(s) avec succès`, 201);
    } catch (e) { next(e); }
  },
  getStats: async (req, res, next) => {
    try { return success(res, await service.getDashboardStats()); }
    catch (e) { next(e); }
  },
  getRecapMonth: async (req, res, next) => {
    try { return success(res, await service.getRecapByMonth()); }
    catch (e) { next(e); }
  },
  getRecapApartment: async (req, res, next) => {
    try { return success(res, await service.getRecapByApartment(req.params.id)); }
    catch (e) { next(e); }
  },
  downloadReceiptPdf: async (req, res, next) => {
    try {
      const receiptService = require('../services/receipt.service');
      const receiptPdfService = require('../services/receipt-pdf.service');
      const { Receipt } = require('../models');

      const bill = await service.getById(req.params.id);
      let receipt = null;

      if (bill.receipt_number) {
        receipt = await Receipt.findOne({ where: { receipt_number: bill.receipt_number } });
      }
      if (!receipt) {
        receipt = await receiptService.generateUtilityReceipt(bill.id, req.user.id, bill.payment_method || 'Espèces');
      }

      const fullReceipt = await receiptService.getById(receipt.id);
      const buffer = await receiptPdfService.generate(fullReceipt);
      const filename = `${receipt.receipt_number || `Recu_Charges_${bill.id}`}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (e) { next(e); }
  },
};
