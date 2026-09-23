const router = require('express').Router();
const ctrl = require('../controllers/utility.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize, authorizePermission } = require('../middlewares/rbac.middleware');

router.use(authenticate);

// Générer/gérer les factures de charges : rôles finance/gestion OU droit délégué `can_manage_utilities`
const manage = authorizePermission('can_manage_utilities', 'super_admin', 'manager', 'comptable', 'dir_admin', 'gestionnaire');

router.get('/mine', ctrl.mine);                                       // locataire : ses factures de charges
router.get('/stats', manage, ctrl.getStats);                          // KPIs statistiques
router.get('/recap/month', manage, ctrl.getRecapMonth);               // récapitulatif par mois
router.get('/recap/apartment/:id', manage, ctrl.getRecapApartment);   // récapitulatif par logement
router.get('/last', manage, ctrl.getLast);                            // report d'index et impayés
router.get('/batch-prepare', manage, ctrl.batchPrepare);
router.get('/', manage, ctrl.getAll);
router.get('/:id/receipt-pdf', ctrl.downloadReceiptPdf);              // reçu PDF officiel
router.get('/:id', manage, ctrl.getById);

router.post('/batch', manage, ctrl.batchCreate);
router.post('/', manage, ctrl.create);
router.post('/:id/proof', upload.single('proof'), ctrl.uploadProof);
router.post('/:id/pay', upload.single('proof'), ctrl.pay);
router.put('/:id', manage, ctrl.update);
router.patch('/:id/paid', manage, ctrl.setPaid);
router.delete('/:id', authorize('super_admin', 'manager', 'comptable'), ctrl.remove);

module.exports = router;
