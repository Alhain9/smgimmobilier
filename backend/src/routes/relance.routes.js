const router = require('express').Router();
const ctrl = require('../controllers/relance.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

router.use(authenticate);

// Relance d'un locataire : réservé aux rôles de gestion/finance (super_admin via bypass)
router.post('/', authorize('manager', 'comptable', 'dir_admin', 'gestionnaire'), ctrl.create);

module.exports = router;
