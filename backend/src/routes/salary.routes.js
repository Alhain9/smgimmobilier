const router = require('express').Router();
const ctrl = require('../controllers/salary.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

router.use(authenticate);
const finance = authorize('manager', 'comptable');

// Espace employé : ses propres salaires (tous rôles)
router.get('/mine', ctrl.mine);

router.get('/', finance, ctrl.getAll);
router.get('/:id', finance, ctrl.getById);
router.post('/', finance, ctrl.create);
router.put('/:id', finance, ctrl.update);
router.post('/:id/proof', finance, upload.single('proof'), ctrl.uploadProof);
router.delete('/:id', authorize('manager'), ctrl.remove);

module.exports = router;
