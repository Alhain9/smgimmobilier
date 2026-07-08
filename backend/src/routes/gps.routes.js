// ============ Routes GPS Tracking ============
const router = require('express').Router();
const ctrl = require('../controllers/gps.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const { validate, schemas } = require('../validators');

router.use(authenticate);

router.post('/track', validate(schemas.createGPSTracking), ctrl.trackPosition);
router.get('/latest', authorize('super_admin', 'manager', 'dir_technique'), ctrl.getLatestPositions);
router.get('/history/:userId', authorize('super_admin', 'manager', 'dir_technique'), ctrl.getUserHistory);

module.exports = router;
