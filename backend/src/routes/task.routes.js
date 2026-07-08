const router = require('express').Router();
const ctrl = require('../controllers/task.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.patch('/:id/status', ctrl.markStatus);       // l'employé déclare (en cours/fait/non fait + raison)
router.patch('/:id/reschedule', ctrl.reschedule);   // reporter (motif obligatoire)
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
