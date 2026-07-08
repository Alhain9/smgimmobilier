const router = require('express').Router();
const ctrl = require('../controllers/equipment.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

router.use(authenticate);
const tech = authorize('manager', 'dir_technique', 'comptable');

router.get('/', tech, ctrl.getAll);
router.get('/:id', tech, ctrl.getById);
router.post('/', tech, ctrl.create);
router.put('/:id', tech, ctrl.update);
router.delete('/:id', authorize('manager', 'dir_technique'), ctrl.remove);

module.exports = router;
