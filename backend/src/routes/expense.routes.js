const router = require('express').Router();
const ctrl = require('../controllers/expense.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

router.use(authenticate);
const finance = authorize('manager', 'comptable', 'dir_technique');

router.get('/', finance, ctrl.getAll);
router.get('/:id', finance, ctrl.getById);
router.post('/', finance, upload.single('receipt'), ctrl.create);
router.put('/:id', finance, ctrl.update);
router.delete('/:id', authorize('manager', 'comptable'), ctrl.remove);

module.exports = router;
