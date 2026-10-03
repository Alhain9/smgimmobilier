const router = require('express').Router();
const ctrl = require('../controllers/document.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate } = require('../middlewares/auth.middleware');

const { authorize, authorizePermission } = require('../middlewares/rbac.middleware');

router.use(authenticate);

// Gestion & suppression des documents
const canManageDocs = authorizePermission('can_manage_documents', 'super_admin', 'manager', 'dir_admin', 'comptable', 'gestionnaire');

router.get('/', ctrl.getAll);
router.post('/bulk-delete', canManageDocs, ctrl.bulkRemove);
router.post('/', canManageDocs, upload.single('file'), ctrl.upload);
router.delete('/:id', canManageDocs, ctrl.remove);

module.exports = router;
