// ============ Routes Messagerie ============
const router = require('express').Router();
const ctrl = require('../controllers/message.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate, schemas } = require('../validators');

router.use(authenticate);

router.get('/chats', ctrl.listRecentChats);
router.get('/unread', ctrl.getUnreadCount);
router.get('/:contactId', ctrl.getConversation);
router.post('/', validate(schemas.createMessageInterne), ctrl.sendMessage);

module.exports = router;
