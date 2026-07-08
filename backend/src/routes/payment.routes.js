const router = require('express').Router();
const ctrl = require('../controllers/payment.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

const financeRead = [authenticate, authorize('manager', 'comptable', 'dir_admin', 'gestionnaire')];
const financeWrite = [authenticate, authorize('manager', 'comptable')];

router.get('/debts', ...financeRead, ctrl.getDebts);
router.get('/me/ledger', authenticate, ctrl.getMyLedger);          // locataire : son relevé
router.get('/ledger/:tenantId', ...financeRead, ctrl.getLedger);   // staff : relevé d'un locataire
router.get('/', ...financeRead, ctrl.getAll);
router.get('/:id', authenticate, ctrl.getById);

router.post('/', ...financeWrite, ctrl.create);
router.post('/declare', authenticate, authorize('locataire'), upload.single('proof'), ctrl.declare);
router.post('/kang/webhook', ctrl.kangWebhook);       // webhook Kang Open Banking (public)
router.post('/campay/webhook', ctrl.kangWebhook);     // alias rétro-compatible
router.post('/:id/proof', authenticate, upload.single('proof'), ctrl.uploadProof);

router.patch('/:id/verify', ...financeRead, ctrl.verify);
router.put('/:id', ...financeWrite, ctrl.update);
router.delete('/:id', ...financeWrite, ctrl.remove);

module.exports = router;
