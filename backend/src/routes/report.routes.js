const router = require('express').Router();
const ctrl = require('../controllers/report.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

router.use(authenticate);

// Réservé à ceux qui gèrent les locataires (super_admin via bypass)
const tenantManagers = authorize('manager', 'dir_admin', 'gestionnaire');

router.get('/tenant-situation', tenantManagers, ctrl.tenantsSituation);
router.get('/building-situation/:propertyId', tenantManagers, ctrl.buildingSituation);
router.get('/recap', tenantManagers, ctrl.periodRecap);

module.exports = router;
