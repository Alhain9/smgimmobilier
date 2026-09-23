// ============ Routes Délégation de Rôle ============
const router = require('express').Router();
const ctrl = require('../controllers/delegation.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

router.use(authenticate);

// Seul le Manager ou Super Admin peut gérer les délégations
router.get('/', authorize('super_admin', 'manager'), ctrl.list);
router.post('/', authorize('super_admin', 'manager'), ctrl.grant);
router.patch('/:id/revoke', authorize('super_admin', 'manager'), ctrl.revoke);

module.exports = router;
