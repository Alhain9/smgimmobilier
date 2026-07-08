const router = require('express').Router();
const ctrl = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

router.use(authenticate);

const management = authorize('super_admin', 'manager', 'dir_admin', 'dir_technique', 'gestionnaire', 'comptable');

router.get('/stats', management, ctrl.getStats);
router.get('/revenue', management, ctrl.getMonthlyRevenue);
router.get('/period', management, ctrl.getPeriod);
router.get('/technician', ctrl.getTechnicianStats);
router.get('/day', ctrl.getDay);
router.get('/worker-period', ctrl.getWorkerPeriod);
router.get('/sector-summary', management, ctrl.getSectorSummary);
router.get('/sectors/:sector', management, ctrl.getSectorDetail);

module.exports = router;
