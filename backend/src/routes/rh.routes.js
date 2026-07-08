// ============ Routes RH ============
const router = require('express').Router();
const ctrl = require('../controllers/rh.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const { validate, schemas } = require('../validators');

// Tous les endpoints RH nécessitent une authentification
router.use(authenticate);

// --- SERVICES ---
router.get('/services', ctrl.listServices);
router.get('/services/:id', ctrl.getService);
router.post('/services', authorize('super_admin', 'manager', 'dir_admin'), validate(schemas.createService), ctrl.createService);
router.put('/services/:id', authorize('super_admin', 'manager', 'dir_admin'), validate(schemas.updateService), ctrl.updateService);
router.delete('/services/:id', authorize('super_admin', 'manager', 'dir_admin'), ctrl.deleteService);

// --- EQUIPES ---
router.get('/equipes', ctrl.listEquipes);
router.get('/equipes/:id', ctrl.getEquipe);
router.post('/equipes', authorize('super_admin', 'manager', 'dir_admin'), validate(schemas.createEquipe), ctrl.createEquipe);
router.put('/equipes/:id', authorize('super_admin', 'manager', 'dir_admin'), validate(schemas.updateEquipe), ctrl.updateEquipe);
router.delete('/equipes/:id', authorize('super_admin', 'manager', 'dir_admin'), ctrl.deleteEquipe);

// --- PLANNINGS ---
router.get('/plannings', ctrl.listPlannings);
router.post('/plannings', authorize('super_admin', 'manager', 'dir_admin'), validate(schemas.createPlanning), ctrl.createPlanning);
router.put('/plannings/:id', authorize('super_admin', 'manager', 'dir_admin'), validate(schemas.updatePlanning), ctrl.updatePlanning);
router.delete('/plannings/:id', authorize('super_admin', 'manager', 'dir_admin'), ctrl.deletePlanning);

// --- POINTAGES ---
router.get('/pointages', ctrl.listPointages);
router.post('/pointages/entree', ctrl.pointageEntree);
router.post('/pointages/sortie', ctrl.pointageSortie);

// --- CONGES ---
router.get('/conges', ctrl.listConges);
router.post('/conges', validate(schemas.createConge), ctrl.createConge);
router.put('/conges/:id', authorize('super_admin', 'manager', 'comptable'), validate(schemas.updateConge), ctrl.updateConge);
router.delete('/conges/:id', ctrl.deleteConge);

module.exports = router;
