// ============ Routes Chantiers ============
const router = require('express').Router();
const ctrl = require('../controllers/worksite.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

router.use(authenticate);

// Autorisations chantiers (staff technique & direction)
const canView = authorize('super_admin', 'manager', 'dir_technique', 'dir_admin', 'gestionnaire', 'comptable', 'technicien');
const canManage = authorize('super_admin', 'manager', 'dir_technique');
const canDeclare = authorize('super_admin', 'manager', 'dir_technique', 'gestionnaire', 'technicien');

router.get('/', canView, ctrl.list);
router.get('/:id', canView, ctrl.getById);
router.get('/:id/pdf', canView, ctrl.downloadPdf);
router.post('/', canManage, ctrl.create);
router.put('/:id', canManage, ctrl.update);
router.delete('/:id', canManage, ctrl.remove);

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
