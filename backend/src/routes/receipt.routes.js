// ============ Routes Reçus ============
const router = require('express').Router();
const ctrl = require('../controllers/receipt.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const { injectOwnerProperties } = require('../middlewares/bailleur.middleware');

// Toutes les routes nécessitent l'authentification + injection bailleur
router.use(authenticate, injectOwnerProperties);

// Liste des reçus (bailleur voit seulement les siens)
router.get('/', ctrl.list);

// Détail d'un reçu
router.get('/:id', ctrl.getById);

// Générer un reçu à partir d'un paiement (gestionnaire+)
router.post('/generate',
  authorize('super_admin', 'manager', 'dir_admin', 'gestionnaire', 'comptable'),
  ctrl.generate
);

// Générer les reçus pour les paiements passés (Archives)
router.post('/generate-archives',
  authorize('super_admin', 'manager', 'dir_admin', 'gestionnaire', 'comptable'),
  ctrl.generateArchives
);

// Créer un reçu personnalisé / manuel (Générateur interactif)
router.post('/custom',
  authorize('super_admin', 'manager', 'dir_admin', 'gestionnaire', 'comptable'),
  ctrl.createCustom
);

// Télécharger le PDF d'un reçu
router.get('/:id/pdf', ctrl.downloadPdf);

// Annuler un reçu (gestionnaire+)
router.delete('/:id',
  authorize('super_admin', 'manager', 'dir_admin', 'gestionnaire'),
  ctrl.cancel
);

module.exports = router;
