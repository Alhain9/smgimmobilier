// ============ Routes Rapports de Gestion Périodiques ============
const router = require('express').Router();
const ctrl = require('../controllers/management-report.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const { injectOwnerProperties } = require('../middlewares/bailleur.middleware');

// Toutes les routes nécessitent l'authentification
router.use(authenticate, injectOwnerProperties);

// Récapitulatif des entrées par immeuble (JSON & PDF)
router.get('/inflows-recap', ctrl.getInflowsRecap.bind(ctrl));
router.get('/inflows-recap/pdf', ctrl.downloadInflowsRecapPdf.bind(ctrl));

// Rapport d'un immeuble (JSON & PDF) — accessible bailleur (sur ses biens) ou staff
router.get('/building/:propertyId', ctrl.getBuildingReport.bind(ctrl));
router.get('/building/:propertyId/pdf', ctrl.downloadBuildingReportPdf.bind(ctrl));

// Rapport du patrimoine d'un bailleur (JSON) — accessible bailleur ou staff
router.get('/owner/:userId?', ctrl.getOwnerReport.bind(ctrl));

// Rapport global agence — uniquement Manager / Super Admin / Dir Admin
router.get('/agency',
  authorize('super_admin', 'manager', 'dir_admin', 'comptable'),
  ctrl.getAgencyReport.bind(ctrl)
);

module.exports = router;
