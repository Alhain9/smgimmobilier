const router = require('express').Router();
const ctrl = require('../controllers/tenant.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const { injectOwnerProperties } = require('../middlewares/bailleur.middleware');

router.use(authenticate, injectOwnerProperties);
const viewers = authorize('manager', 'dir_admin', 'gestionnaire', 'bailleur', 'comptable');
const adminOrManager = authorize('manager', 'admin');
const staff = authorize('manager', 'admin', 'dir_admin', 'gestionnaire', 'comptable');

// Espace locataire
router.get('/me/profile', ctrl.myProfile);

router.get('/', viewers, ctrl.getAll);
router.get('/:id', viewers, ctrl.getById);
router.get('/:id/docx', viewers, ctrl.downloadDocx);
router.post('/', staff, upload.single('photo'), ctrl.create);
router.post('/:id/vacate', staff, ctrl.vacate);
router.post('/:id/settle-debt', staff, ctrl.settleDebt);
router.post('/bulk-delete', staff, ctrl.bulkRemove);
router.put('/:id', staff, upload.single('photo'), ctrl.update);
router.delete('/:id', staff, ctrl.remove);

module.exports = router;
