const router = require('express').Router();
const ctrl = require('../controllers/notification.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);
router.get('/', ctrl.list);
router.patch('/read-all', ctrl.markAllRead);
router.delete('/clear', ctrl.deleteAll);
router.delete('/all', ctrl.deleteAll);
router.patch('/:id/read', ctrl.markRead);
router.delete('/:id', ctrl.delete);

module.exports = router;
