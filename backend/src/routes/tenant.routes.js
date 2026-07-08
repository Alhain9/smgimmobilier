const router = require('express').Router();
const ctrl = require('../controllers/tenant.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

router.use(authenticate);
const managers = authorize('manager', 'dir_admin', 'gestionnaire');

// Espace locataire
router.get('/me/profile', ctrl.myProfile);

router.get('/', managers, ctrl.getAll);
router.get('/:id', managers, ctrl.getById);
router.post('/', managers, upload.single('photo'), ctrl.create);
router.put('/:id', managers, upload.single('photo'), ctrl.update);
router.delete('/:id', authorize('manager', 'dir_admin'), ctrl.remove);

module.exports = router;
