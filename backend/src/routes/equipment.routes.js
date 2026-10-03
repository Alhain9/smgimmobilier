const router = require('express').Router();
const ctrl = require('../controllers/equipment.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize, authorizePermission } = require('../middlewares/rbac.middleware');

router.use(authenticate);
const tech = authorizePermission('can_manage_stock', 'super_admin', 'manager', 'dir_technique', 'comptable', 'gestionnaire');
const canDeleteEquip = authorizePermission('can_delete_stock', 'super_admin', 'manager', 'dir_technique');

router.get('/', tech, ctrl.getAll);
router.post('/bulk-delete', canDeleteEquip, ctrl.bulkRemove);
router.post('/check-availability', tech, ctrl.checkAvailability);
router.get('/:id', tech, ctrl.getById);
router.post('/', tech, upload.single('photo'), ctrl.create);
router.put('/:id', tech, upload.single('photo'), ctrl.update);
router.post('/:id/allocate', tech, ctrl.allocate);
router.post('/allocations/:allocationId/return', tech, ctrl.returnEquipment);
router.delete('/:id', canDeleteEquip, ctrl.remove);

module.exports = router;
