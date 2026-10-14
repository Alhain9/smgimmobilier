const router = require('express').Router();
const ctrl = require('../controllers/apartment.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const { injectOwnerProperties } = require('../middlewares/bailleur.middleware');

router.use(authenticate, injectOwnerProperties);
const staffRoles = authorize('manager', 'admin', 'comptable', 'dir_admin', 'gestionnaire', 'dir_technique');

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', staffRoles, ctrl.create);
router.post('/:id/vacate', staffRoles, ctrl.vacate);
router.post('/bulk-delete', staffRoles, ctrl.bulkRemove);
router.put('/:id', staffRoles, ctrl.update);
router.delete('/:id', staffRoles, ctrl.remove);

module.exports = router;
