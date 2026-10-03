// ============ Routes Chantiers ============
const router = require('express').Router();
const ctrl = require('../controllers/worksite.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize, authorizePermission } = require('../middlewares/rbac.middleware');

router.use(authenticate);

// Autorisations chantiers (staff technique & direction)
const canView = authorizePermission('can_manage_worksites', 'super_admin', 'manager', 'dir_technique', 'dir_admin', 'gestionnaire', 'comptable', 'technicien');
const canManage = authorizePermission('can_manage_worksites', 'super_admin', 'manager', 'dir_technique');
const canDelete = authorizePermission('can_delete_worksites', 'super_admin', 'manager', 'dir_technique');
const canDeclare = authorizePermission('can_manage_worksites', 'super_admin', 'manager', 'dir_technique', 'gestionnaire', 'technicien');

router.get('/', canView, ctrl.list);
router.post('/bulk-delete', canDelete, ctrl.bulkRemove);
router.get('/:id', canView, ctrl.getById);
router.get('/:id/pdf', canView, ctrl.downloadPdf);
router.post('/', canManage, ctrl.create);
router.put('/:id', canManage, ctrl.update);
router.delete('/:id', canDelete, ctrl.remove);

// Tâches de chantier
router.post('/:id/tasks', canManage, ctrl.addTask);
router.put('/:id/tasks/:taskId', canDeclare, ctrl.updateTask);

// Consommation de matériel (sortie de stock définitive)
router.post('/:id/materials', canDeclare, ctrl.declareMaterials);

// Prêt d'équipements & restitution à l'entrepôt
router.get('/:id/equipment-loans', canView, ctrl.listEquipmentLoans);
router.post('/:id/equipment-loan', canDeclare, ctrl.loanEquipment);
router.post('/:id/equipment-loans/:loanId/return', canDeclare, ctrl.returnEquipment);

// Photos de chantier
router.post('/:id/photos', canDeclare, upload.single('photo'), ctrl.addPhoto);

module.exports = router;
