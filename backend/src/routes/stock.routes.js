// ============ Routes Stock & Consommables ============
const router = require('express').Router();
const ctrl = require('../controllers/stock.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

router.use(authenticate);

// Autorisations : Le Manager, Comptable, Dir Technique, Gestionnaire ont accès et peuvent gérer le stock
const canViewStock = authorize('super_admin', 'manager', 'comptable', 'dir_technique', 'gestionnaire');
const canManageStock = authorize('super_admin', 'manager', 'comptable', 'dir_technique', 'gestionnaire');
const canDeleteStock = authorize('super_admin', 'manager');

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
router.get('/items/:id', canViewStock, ctrl.getItemById);
router.post('/items', canManageStock, upload.single('photo'), ctrl.createItem);
router.post('/transfer', canManageStock, ctrl.transfer);
router.put('/items/:id', canManageStock, upload.single('photo'), ctrl.updateItem);
router.delete('/items/:id', canDeleteStock, ctrl.removeItem);

module.exports = router;
