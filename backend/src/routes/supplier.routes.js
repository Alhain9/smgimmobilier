// ============ Routes Fournisseurs ============
const router = require('express').Router();
const ctrl = require('../controllers/supplier.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

router.use(authenticate);

// Gestionnaires autorisés pour les fournisseurs
const canAccess = authorize('super_admin', 'manager', 'comptable', 'dir_technique', 'gestionnaire');
const canManage = authorize('super_admin', 'manager', 'comptable');

router.get('/', canAccess, ctrl.list);
router.get('/:id', canAccess, ctrl.getById);
router.post('/', canManage, ctrl.create);
router.put('/:id', canManage, ctrl.update);
router.delete('/:id', canManage, ctrl.remove);

module.exports = router;
