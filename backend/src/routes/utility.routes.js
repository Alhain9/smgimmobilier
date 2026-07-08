const router = require('express').Router();
const ctrl = require('../controllers/utility.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize, authorizePermission } = require('../middlewares/rbac.middleware');

router.use(authenticate);

// Générer/gérer les factures de charges : rôles finance/gestion OU droit délégué `can_manage_utilities`
const manage = authorizePermission('can_manage_utilities', 'manager', 'comptable', 'dir_admin', 'gestionnaire');

router.get('/mine', ctrl.mine);                 // locataire : ses factures de charges
router.get('/last', manage, ctrl.getLast);      // report d'index
router.get('/', manage, ctrl.getAll);
router.get('/:id', manage, ctrl.getById);

router.post('/', manage, ctrl.create);
router.post('/:id/proof', manage, upload.single('proof'), ctrl.uploadProof);
router.put('/:id', manage, ctrl.update);
router.patch('/:id/paid', manage, ctrl.setPaid);
router.delete('/:id', authorize('manager', 'comptable'), ctrl.remove);

module.exports = router;
