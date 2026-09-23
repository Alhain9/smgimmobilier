const router = require('express').Router();
const ctrl = require('../controllers/withdrawal.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

const financeAuth = [authenticate, authorize('manager', 'comptable', 'dir_admin')];

router.get('/balance', ...financeAuth, ctrl.getBalance);
router.get('/', ...financeAuth, ctrl.getAll);
router.get('/:id', ...financeAuth, ctrl.getById);
router.post('/', ...financeAuth, ctrl.create);

module.exports = router;
