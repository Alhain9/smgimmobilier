// ============ Routes Paramètres Entreprise ============
const router = require('express').Router();
const ctrl = require('../controllers/company-settings.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

// Consultation publique ou connectée (nécessaire pour afficher le logo sur login/landing)
router.get('/', ctrl.get);

// Modification réservée à la direction (super_admin, manager, dir_admin)
router.put('/',
  authenticate,
  authorize('super_admin', 'manager', 'dir_admin'),
  upload.single('logo'),
  ctrl.update
);

module.exports = router;
