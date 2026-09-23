const router = require('express').Router();
const ctrl = require('../controllers/report.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const { injectOwnerProperties } = require('../middlewares/bailleur.middleware');

router.use(authenticate, injectOwnerProperties);

const viewers = authorize('manager', 'dir_admin', 'gestionnaire', 'bailleur', 'comptable');
const companyFinancialViewers = authorize('manager', 'dir_admin', 'dir_technique', 'comptable');

router.get('/tenant-situation', viewers, ctrl.tenantsSituation);
router.get('/building-situation/:propertyId', viewers, ctrl.buildingSituation);
router.get('/recap', viewers, ctrl.periodRecap);
router.get('/company-balance', companyFinancialViewers, ctrl.companyBalance);

module.exports = router;
