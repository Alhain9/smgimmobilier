// ============ Routes Entrepôts & Stocks — SMG IMMOBILIER ============
const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouse.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

router.use(authenticate);

router.get('/', warehouseController.list);
router.get('/:id', warehouseController.getById);
router.post('/', authorize('super_admin', 'manager', 'dir_technique', 'comptable', 'gestionnaire'), warehouseController.create);
router.put('/:id', authorize('super_admin', 'manager', 'dir_technique', 'comptable', 'gestionnaire'), warehouseController.update);
router.delete('/:id', authorize('super_admin', 'manager'), warehouseController.delete);

module.exports = router;
