const router = require('express').Router();
const ctrl = require('../controllers/lease.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const { injectOwnerProperties } = require('../middlewares/bailleur.middleware');

router.use(authenticate, injectOwnerProperties);
const managers = authorize('super_admin', 'admin', 'manager', 'dir_admin', 'gestionnaire', 'comptable');

router.get('/tags/available', ctrl.getTags);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.get('/:id/docx', ctrl.downloadDocx);
router.post('/', managers, ctrl.create);
router.post('/bulk-delete', managers, ctrl.bulkRemove);
router.put('/:id', managers, ctrl.update);
router.post('/:id/renew', managers, ctrl.renew);
router.post('/:id/contract', managers, upload.single('contract'), ctrl.uploadContract);
router.delete('/:id', managers, ctrl.remove);

module.exports = router;
