const service = require('../services/utility.service');
const { createCrudController } = require('./crud.factory');
const { success, error } = require('../utils/response');

const base = createCrudController(service, {
  created: 'Facture enregistrée', updated: 'Facture mise à jour', deleted: 'Facture supprimée',
});

module.exports = {
  ...base,
  create: async (req, res, next) => {
    try { return success(res, await service.create(req.body, req.user), 'Facture enregistrée', 201); }
    catch (e) { next(e); }
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
