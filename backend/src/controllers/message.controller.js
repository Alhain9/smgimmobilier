// ============ Contrôleur de Messagerie Interne ============
const messageService = require('../services/message.service');
const { success } = require('../utils/response');
const { messageInterneDTO, stripSensitive, listDTO } = require('../dto');

exports.getConversation = async (req, res, next) => {
  try {
    const list = await messageService.getConversation(req.user.id, req.params.contactId);
    // Marquer comme lu à la récupération
    await messageService.markAsRead(req.user.id, req.params.contactId);
    return success(res, listDTO(list, messageInterneDTO));
  } catch (err) { next(err); }
};

exports.listRecentChats = async (req, res, next) => {
  try {
    const list = await messageService.listRecentChats(req.user.id);
    return success(res, list.map(u => stripSensitive(u)));
  } catch (err) { next(err); }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const msg = await messageService.sendMessage(req.user.id, req.body.recipient_id, req.body.content);
    return success(res, messageInterneDTO(msg), 'Message envoyé', 201);
  } catch (err) { next(err); }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await messageService.getUnreadCount(req.user.id);
    return success(res, { count });
  } catch (err) { next(err); }
};
