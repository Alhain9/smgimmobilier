const router = require('express').Router();
const ctrl = require('../controllers/property.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const upload = require('../middlewares/upload.middleware');
const { uploadExcel } = upload;
const { injectOwnerProperties } = require('../middlewares/bailleur.middleware');

router.use(authenticate, injectOwnerProperties);
const managers = authorize('manager', 'dir_admin', 'gestionnaire', 'comptable');

router.get('/lease-template/sample', ctrl.downloadSampleDocxTemplate);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', managers, ctrl.create);
router.post('/:id/lease-template', managers, upload.single('template'), ctrl.uploadLeaseTemplate);
router.delete('/:id/lease-template', managers, ctrl.deleteLeaseTemplate);
router.post('/import', managers, uploadExcel.single('file'), ctrl.importBuilding);
router.post('/bulk-delete', authorize('manager'), ctrl.bulkRemove);
router.put('/:id', managers, ctrl.update);
router.delete('/:id', authorize('manager'), ctrl.remove);

module.exports = router;
