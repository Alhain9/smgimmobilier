// ============ Controller Rapports de Gestion Périodiques ============
const reportService = require('../services/management-report.service');
const pdfService = require('../services/management-report-pdf.service');
const { success, error } = require('../utils/response');

class ManagementReportController {
  _getDates(req) {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    return {
      start: req.query.start || firstDay,
      end: req.query.end || lastDay,
    };
  }

  // Rapport d'un immeuble (JSON)
  async getBuildingReport(req, res, next) {
    try {
      const { start, end } = this._getDates(req);
      const data = await reportService.buildingReport(req.params.propertyId, start, end, req.ownerPropertyIds);
      return success(res, data, 'Rapport de gestion du bien');
    } catch (err) { next(err); }
  }

  // Rapport d'un immeuble (PDF)
  async downloadBuildingReportPdf(req, res, next) {
    try {
      const { start, end } = this._getDates(req);
      const data = await reportService.buildingReport(req.params.propertyId, start, end, req.ownerPropertyIds);
      const buffer = await pdfService.generateBuildingReportPdf(data);
      const safeName = data.property.property_name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Rapport_${safeName}_${start}_${end}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) { next(err); }
  }

  // Rapport global d'un bailleur (JSON)
  async getOwnerReport(req, res, next) {
    try {
      const { start, end } = this._getDates(req);
      // Sécurité bailleur : ne peut consulter que son propre rapport
      let targetUserId = req.params.userId || req.user.id;
      if (req.user.is_bailleur) {
        targetUserId = req.user.id;
      }
      const data = await reportService.ownerReport(targetUserId, start, end);
      return success(res, data, 'Rapport de gestion du patrimoine');
    } catch (err) { next(err); }
  }

  // Rapport global agence (JSON - Manager/Super Admin only)
  async getAgencyReport(req, res, next) {
    try {
      const { start, end } = this._getDates(req);
      const data = await reportService.agencyReport(start, end);
      return success(res, data, 'Rapport global agence SMG IMMOBILIER');
    } catch (err) { next(err); }
  }

  // Récapitulatif des entrées par immeuble (Virement, Cash, Part %, Badges, Analyses)
  async getInflowsRecap(req, res, next) {
    try {
      const { start, end } = this._getDates(req);
      const propertyIds = req.query.property_ids || req.query.property_id || null;
      const data = await reportService.inflowsRecap(start, end, propertyIds, req.ownerPropertyIds);
      return success(res, data, 'Récapitulatif des entrées par immeuble');
    } catch (err) { next(err); }
  }

  // Téléchargement du PDF officiel du Récapitulatif des entrées par immeuble
  async downloadInflowsRecapPdf(req, res, next) {
    try {
      const { start, end } = this._getDates(req);
      const propertyIds = req.query.property_ids || req.query.property_id || null;
      const data = await reportService.inflowsRecap(start, end, propertyIds, req.ownerPropertyIds);
      const buffer = await pdfService.generateInflowsRecapPdf(data);
      const filename = `Recapitulatif_Entrees_${start}_${end}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) { next(err); }
  }
}

module.exports = new ManagementReportController();
