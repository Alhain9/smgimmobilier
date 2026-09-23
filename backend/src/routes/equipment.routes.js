const router = require('express').Router();
const ctrl = require('../controllers/equipment.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

router.use(authenticate);
const tech = authorize('manager', 'dir_technique', 'comptable');

router.get('/', tech, ctrl.getAll);
router.post('/check-availability', tech, ctrl.checkAvailability);
router.get('/:id', tech, ctrl.getById);
router.post('/', tech, upload.single('photo'), ctrl.create);
router.put('/:id', tech, upload.single('photo'), ctrl.update);
router.post('/:id/allocate', tech, ctrl.allocate);
router.post('/allocations/:allocationId/return', tech, ctrl.returnEquipment);
router.delete('/:id', authorize('manager', 'dir_technique'), ctrl.remove);

module.exports = router;
