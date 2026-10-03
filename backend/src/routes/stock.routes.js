// ============ Routes Stock & Consommables ============
const router = require('express').Router();
const ctrl = require('../controllers/stock.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize, authorizePermission } = require('../middlewares/rbac.middleware');

router.use(authenticate);

// Autorisations : Le Manager, Comptable, Dir Technique, Gestionnaire ont accès et peuvent gérer le stock
const canViewStock = authorizePermission('can_manage_stock', 'super_admin', 'manager', 'comptable', 'dir_technique', 'gestionnaire');
const canManageStock = authorizePermission('can_manage_stock', 'super_admin', 'manager', 'comptable', 'dir_technique', 'gestionnaire');
const canDeleteStock = authorizePermission('can_delete_stock', 'super_admin', 'manager', 'dir_technique');

// Synthèse & Alertes
router.get('/summary', canViewStock, ctrl.getSummary);
router.get('/alerts', canViewStock, ctrl.getAlerts);

// Mouvements
router.get('/movements', canViewStock, ctrl.listMovements);

// Achats / Réceptions
router.get('/purchases', canViewStock, ctrl.listPurchases);
router.get('/purchases/:id', canViewStock, ctrl.getPurchaseById);
router.post('/purchases', canManageStock, ctrl.recordPurchase);

const upload = require('../middlewares/upload.middleware');

// Articles
router.get('/items', canViewStock, ctrl.listItems);
router.post('/items/bulk-delete', canDeleteStock, ctrl.bulkRemoveItems);
router.get('/items/:id', canViewStock, ctrl.getItemById);
router.post('/items', canManageStock, upload.single('photo'), ctrl.createItem);
router.post('/transfer', canManageStock, ctrl.transfer);
router.put('/items/:id', canManageStock, upload.single('photo'), ctrl.updateItem);
router.delete('/items/:id', canDeleteStock, ctrl.removeItem);

module.exports = router;
