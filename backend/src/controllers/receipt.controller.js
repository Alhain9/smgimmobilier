// ============ Controller Reçus ============
const receiptService = require('../services/receipt.service');
const receiptPdfService = require('../services/receipt-pdf.service');
const { success, error } = require('../utils/response');

class ReceiptController {
  // Liste des reçus (filtrée par query params + bailleur si applicable)
  async list(req, res, next) {
    try {
      const { Tenant } = require('../models');
      let tenantId = req.query.tenant_id || null;

      if (req.user && req.user.role === 'locataire') {
        const t = await Tenant.findOne({ where: { user_id: req.user.id } });
        if (!t) return success(res, [], 'Aucun profil locataire');
        tenantId = t.id;
      }

      const filters = {
        receipt_type: req.query.type || null,
        tenant_id: tenantId,
        property_id: req.query.property_id || null,
        status: req.query.status || null,
        start: req.query.start || null,
        end: req.query.end || null,
        ownerPropertyIds: req.ownerPropertyIds || null,
      };
      const receipts = await receiptService.list(filters);
      return success(res, receipts, 'Liste des reçus');
    } catch (err) { next(err); }
  }

  // Détail d'un reçu
  async getById(req, res, next) {
    try {
      const receipt = await receiptService.getById(req.params.id);
      
      // Sécurité locataire : vérifier que le reçu lui appartient
      if (req.user && req.user.role === 'locataire') {
        const { Tenant } = require('../models');
        const t = await Tenant.findOne({ where: { user_id: req.user.id } });
        if (!t || Number(receipt.tenant_id) !== Number(t.id)) {
          return error(res, 'Accès refusé : ce document ne vous appartient pas', 403);
        }
      }

      // Sécurité bailleur : vérifier que le reçu concerne un de ses immeubles
      if (req.ownerPropertyIds && !req.ownerPropertyIds.includes(receipt.property_id)) {
        return error(res, 'Accès refusé : ce reçu ne concerne pas vos biens', 403);
      }
      return success(res, receipt, 'Détail du reçu');
    } catch (err) { next(err); }
  }

  // Générer un reçu à partir d'un paiement
  async generate(req, res, next) {
    try {
      const { payment_id, type } = req.body;
      if (!payment_id) return error(res, 'payment_id requis', 400);

      let receipt;
      switch (type || 'rent') {
        case 'rent':
          receipt = await receiptService.generateRentReceipt(payment_id, req.user.id);
          break;
        case 'deposit':
          receipt = await receiptService.generateDepositReceipt(payment_id, req.user.id);
          break;
        default:
          receipt = await receiptService.generateRentReceipt(payment_id, req.user.id);
      }

      return success(res, receipt, 'Reçu généré avec succès', 201);
    } catch (err) { next(err); }
  }

  // Télécharger le PDF d'un reçu
  async downloadPdf(req, res, next) {
    try {
      const receipt = await receiptService.getById(req.params.id);

      // Sécurité locataire : vérifier que le reçu lui appartient
      if (req.user && req.user.role === 'locataire') {
        const { Tenant } = require('../models');
        const t = await Tenant.findOne({ where: { user_id: req.user.id } });
        if (!t || Number(receipt.tenant_id) !== Number(t.id)) {
          return error(res, 'Accès refusé : ce document ne vous appartient pas', 403);
        }
      }

      // Sécurité bailleur
      if (req.ownerPropertyIds && !req.ownerPropertyIds.includes(receipt.property_id)) {
        return error(res, 'Accès refusé', 403);
      }

      const buffer = await receiptPdfService.generate(receipt);
      const filename = `${receipt.receipt_number}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) { next(err); }
  }

  // Générer les reçus pour les paiements passés (Archives)
  async generateArchives(req, res, next) {
    try {
      const { start, end, property_id } = req.body || {};
      const result = await receiptService.generateArchives({ start, end, property_id }, req.user?.id);
      return success(res, result, `${result.generated_count} reçus générés sur ${result.total_payments} paiements archivés.`);
    } catch (err) { next(err); }
  }

  // Créer un reçu personnalisé / manuel (Générateur)
  async createCustom(req, res, next) {
    try {
      const receipt = await receiptService.createCustom(req.body, req.user?.id);
      return success(res, receipt, 'Reçu créé et archivé avec succès', 201);
    } catch (err) { next(err); }
  }

  // Annuler un reçu
  async cancel(req, res, next) {
    try {
      const receipt = await receiptService.cancel(req.params.id);
      return success(res, receipt, 'Reçu annulé');
    } catch (err) { next(err); }
  }
}

module.exports = new ReceiptController();
