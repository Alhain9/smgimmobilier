const router = require('express').Router();
const ctrl = require('../controllers/expense.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize, authorizePermission } = require('../middlewares/rbac.middleware');
const { injectOwnerProperties } = require('../middlewares/bailleur.middleware');

router.use(authenticate);
router.use(injectOwnerProperties);

// Consultation : Manager, Super Admin, Dir Admin, Comptable, Gestionnaire et Bailleur (ses biens uniquement)
// Le technicien n'a expressément PAS accès à cette ressource sauf délégation explicite
const canView = authorizePermission('can_manage_expenses', 'super_admin', 'manager', 'dir_admin', 'comptable', 'gestionnaire', 'bailleur');

// Gestion (Création / Modification)
const canManage = authorizePermission('can_manage_expenses', 'super_admin', 'manager', 'dir_admin', 'comptable', 'gestionnaire');

// Suppression (individuelle ou groupée)
const canDelete = authorizePermission('can_manage_expenses', 'super_admin', 'manager', 'dir_admin', 'comptable', 'gestionnaire');

router.get('/', canView, ctrl.getAll);
router.get('/stats', canView, ctrl.getStats);
router.post('/bulk-delete', canDelete, ctrl.bulkRemove);
router.get('/:id', canView, ctrl.getById);
router.post('/', canManage, upload.single('receipt'), ctrl.create);
router.put('/:id', canManage, upload.single('receipt'), ctrl.update);
router.delete('/:id', canDelete, ctrl.remove);

module.exports = router;
