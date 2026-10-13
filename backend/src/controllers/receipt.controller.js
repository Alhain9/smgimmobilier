// ============ Controller Reçus ============
const receiptService = require('../services/receipt.service');
const receiptPdfService = require('../services/receipt-pdf.service');
const { success, error } = require('../utils/response');

class ReceiptController {
  // Liste des reçus (filtrée par query params, utilisateur ou immeubles assignés)
  async list(req, res, next) {
    try {
      const { Tenant, ManagerProperty } = require('../models');
      const { Op } = require('sequelize');
      const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);

      let tenantId = req.query.tenant_id || null;
      let generatedBy = null;
      let userOrPropertyCondition = null;

      if (req.user && req.user.role === 'locataire') {
        const t = await Tenant.findOne({ where: { user_id: req.user.id } });
        if (!t) return success(res, [], 'Aucun profil locataire');
        tenantId = t.id;
      } else if (req.user && !isAdminOrManager && !req.user.is_bailleur) {
        // Collaborateur (comptable, gestionnaire, directeur administratif...) :
        // Ne voit que ses propres reçus OU les reçus des immeubles auxquels l'admin lui a donné accès
        const assignedLinks = await ManagerProperty.findAll({
          where: { user_id: req.user.id },
          attributes: ['property_id'],
        });
        const assignedPropertyIds = assignedLinks.map((l) => Number(l.property_id)).filter(Boolean);

        if (assignedPropertyIds.length > 0) {
          userOrPropertyCondition = {
            [Op.or]: [
              { generated_by: req.user.id },
              { property_id: { [Op.in]: assignedPropertyIds } },
            ],
          };
        } else {
          // Aucun immeuble attribué : ne voit que ses propres reçus émis
          generatedBy = req.user.id;
        }
      } else if (isAdminOrManager) {
        // L'admin et le manager peuvent voir tous les reçus et filtrer par personne (collaborateur)
        if (req.query.generated_by || req.query.user_id) {
          generatedBy = req.query.generated_by || req.query.user_id;
        }
      }

      const filters = {
        receipt_type: req.query.type || null,
        tenant_id: tenantId,
        property_id: req.query.property_id || null,
        status: req.query.status || null,
        start: req.query.start || null,
        end: req.query.end || null,
        ownerPropertyIds: req.ownerPropertyIds || null,
        generated_by: generatedBy,
        userOrPropertyCondition,
      };
      const receipts = await receiptService.list(filters);
      return success(res, receipts, 'Liste des reçus');
    } catch (err) { next(err); }
  }

  // Détail d'un reçu
  async getById(req, res, next) {
    try {
      const receipt = await receiptService.getById(req.params.id);
      const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);

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

      // Sécurité collaborateurs (comptable, gestionnaire, dir_admin...)
      if (req.user && !isAdminOrManager && !req.user.is_bailleur && req.user.role !== 'locataire') {
        const isOwn = Number(receipt.generated_by) === Number(req.user.id);
        if (!isOwn) {
          const { ManagerProperty } = require('../models');
          const hasAccess = receipt.property_id ? await ManagerProperty.findOne({
            where: { user_id: req.user.id, property_id: receipt.property_id },
          }) : null;
          if (!hasAccess) {
            return error(res, 'Accès refusé : vous n\'avez pas accès à ce reçu', 403);
          }
        }
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
      const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);

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

      // Sécurité collaborateurs
      if (req.user && !isAdminOrManager && !req.user.is_bailleur && req.user.role !== 'locataire') {
        const isOwn = Number(receipt.generated_by) === Number(req.user.id);
        if (!isOwn) {
          const { ManagerProperty } = require('../models');
          const hasAccess = receipt.property_id ? await ManagerProperty.findOne({
            where: { user_id: req.user.id, property_id: receipt.property_id },
          }) : null;
          if (!hasAccess) {
            return error(res, 'Accès refusé', 403);
          }
        }
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

  // Supprimer définitivement un reçu
  async remove(req, res, next) {
    try {
      const result = await receiptService.remove(req.params.id);
      return success(res, result, 'Reçu supprimé avec succès');
    } catch (err) { next(err); }
  }

  // Suppression multiple de reçus
  async bulkRemove(req, res, next) {
    try {
      const { ids } = req.body || {};
      const result = await receiptService.bulkRemove(ids);
      return success(res, result, `${result.deletedCount} reçu(s) supprimé(s) avec succès`);
    } catch (err) { next(err); }
  }
}

module.exports = new ReceiptController();
