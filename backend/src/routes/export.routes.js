// ============ Routes d'export Excel/PDF ============
const router = require('express').Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const reportService = require('../services/report.service');
const excelService = require('../services/excel.service');
const pdfService = require('../services/pdf.service');
const { Payment, Tenant, Apartment, Property, User } = require('../models');
const { logger } = require('../config/logger');

// Situation immeuble → Excel
router.get('/situation-immeuble/:id/excel', authenticate, authorize('super_admin', 'manager', 'dir_admin', 'gestionnaire', 'comptable'), async (req, res, next) => {
  try {
    const month = req.query.month ? parseInt(req.query.month, 10) : null;
    const year = req.query.year ? parseInt(req.query.year, 10) : null;
    const data = await reportService.buildingSituation(req.params.id, req.ownerPropertyIds, month, year);
    const wb = excelService.situationImmeubleWorkbook(data);
    await excelService.sendResponse(res, wb, `situation_${data.immeuble.replace(/\s+/g, '_')}_${data.periode || new Date().toISOString().slice(0, 7)}.xlsx`);
  } catch (err) { next(err); }
});

// Situation immeuble → PDF
router.get('/situation-immeuble/:id/pdf', authenticate, authorize('super_admin', 'manager', 'dir_admin', 'gestionnaire', 'comptable'), async (req, res, next) => {
  try {
    const month = req.query.month ? parseInt(req.query.month, 10) : null;
    const year = req.query.year ? parseInt(req.query.year, 10) : null;
    const data = await reportService.buildingSituation(req.params.id, req.ownerPropertyIds, month, year);
    const buffer = await pdfService.situationImmeublePdf(data);
    await pdfService.sendResponse(res, buffer, `situation_${data.immeuble.replace(/\s+/g, '_')}_${data.periode || new Date().toISOString().slice(0, 7)}.pdf`);
  } catch (err) { next(err); }
});

// Situation locataires → Excel
router.get('/situation-locataires/excel', authenticate, authorize('super_admin', 'manager', 'dir_admin', 'gestionnaire', 'comptable'), async (req, res, next) => {
  try {
    const data = await reportService.tenantsSituation();
    const wb = excelService.situationLocatairesWorkbook(data);
    await excelService.sendResponse(res, wb, `situation_locataires_${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (err) { next(err); }
});

// Rapport financier période → Excel
router.get('/rapport-financier/excel', authenticate, authorize('super_admin', 'manager', 'comptable'), async (req, res, next) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ success: false, message: 'Paramètres start et end requis' });
    const data = await reportService.periodRecap(start, end);
    const wb = excelService.rapportFinancierWorkbook(data);
    await excelService.sendResponse(res, wb, `rapport_financier_${start}_${end}.xlsx`);
  } catch (err) { next(err); }
});

// Quittance de loyer → PDF
router.get('/quittance/:paymentId/pdf', authenticate, async (req, res, next) => {
  try {
    const payment = await Payment.findByPk(req.params.paymentId, {
      include: [
        { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['full_name', 'phone'] }] },
        { model: Apartment, as: 'apartment', include: [{ model: Property, as: 'property', attributes: ['property_name'] }] },
      ],
    });
    if (!payment) return res.status(404).json({ success: false, message: 'Paiement introuvable' });

    const buffer = await pdfService.quittancePdf(
      payment.toJSON(),
      payment.tenant ? payment.tenant.toJSON() : null,
      payment.apartment ? payment.apartment.toJSON() : null,
      payment.apartment?.property ? payment.apartment.property.toJSON() : null,
    );
    await pdfService.sendResponse(res, buffer, `quittance_${payment.id}_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (err) { next(err); }
});

module.exports = router;
