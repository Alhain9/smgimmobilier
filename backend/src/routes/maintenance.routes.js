const router = require('express').Router();
const ctrl = require('../controllers/maintenance.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');

router.use(authenticate);
const tech = authorize('manager', 'dir_technique', 'gestionnaire', 'technicien');

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create); // tout rôle peut signaler (incl. locataire)
router.put('/:id', tech, ctrl.update);
router.patch('/:id/assign', authorize('manager', 'dir_technique'), ctrl.assign);
router.put('/:id/technicians', authorize('manager', 'dir_technique'), ctrl.setTeam);
router.post('/:id/photos', tech, upload.array('photo', 10), ctrl.uploadPhotos);
router.delete('/:id', authorize('manager', 'dir_technique'), ctrl.remove);

module.exports = router;
