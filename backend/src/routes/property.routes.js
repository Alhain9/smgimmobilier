const router = require('express').Router();
const ctrl = require('../controllers/property.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

router.use(authenticate);
const managers = authorize('manager', 'dir_admin', 'gestionnaire');

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', managers, ctrl.create);
router.put('/:id', managers, ctrl.update);
router.delete('/:id', authorize('manager'), ctrl.remove);

module.exports = router;
