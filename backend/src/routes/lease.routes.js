const router = require('express').Router();
const ctrl = require('../controllers/lease.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

router.use(authenticate);
const managers = authorize('manager', 'dir_admin', 'gestionnaire', 'comptable');

router.get('/tags/available', ctrl.getTags);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.get('/:id/docx', ctrl.downloadDocx);
router.post('/', managers, ctrl.create);
router.post('/bulk-delete', authorize('manager', 'dir_admin'), ctrl.bulkRemove);
router.put('/:id', managers, ctrl.update);
router.post('/:id/renew', managers, ctrl.renew);
router.post('/:id/contract', managers, upload.single('contract'), ctrl.uploadContract);
router.delete('/:id', authorize('manager', 'dir_admin'), ctrl.remove);

module.exports = router;
