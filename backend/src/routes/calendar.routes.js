const router = require('express').Router();
const ctrl = require('../controllers/calendar.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

router.get('/calendars', ctrl.getCalendars);
router.get('/participant-options', ctrl.getParticipantOptions);
router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
