const router = require('express').Router();
const ctrl = require('../controllers/apartment.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const { injectOwnerProperties } = require('../middlewares/bailleur.middleware');

router.use(authenticate, injectOwnerProperties);
const managers = authorize('manager', 'dir_admin', 'gestionnaire', 'comptable');

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', managers, ctrl.create);
router.post('/:id/vacate', managers, ctrl.vacate);
router.post('/bulk-delete', authorize('manager', 'dir_admin', 'comptable'), ctrl.bulkRemove);
router.put('/:id', managers, ctrl.update);
router.delete('/:id', authorize('manager', 'dir_admin', 'comptable'), ctrl.remove);

module.exports = router;
