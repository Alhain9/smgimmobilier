const router = require('express').Router();
const ctrl = require('../controllers/apartment.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const { injectOwnerProperties } = require('../middlewares/bailleur.middleware');

router.use(authenticate, injectOwnerProperties);
const managers = authorize('manager', 'dir_admin', 'gestionnaire');

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', managers, ctrl.create);
router.post('/bulk-delete', authorize('manager'), ctrl.bulkRemove);
router.put('/:id', managers, ctrl.update);
router.delete('/:id', authorize('manager'), ctrl.remove);

module.exports = router;
