const service = require('../services/notification.service');
const { success } = require('../utils/response');

exports.list = async (req, res, next) => {
  try {
    const [items, unread] = await Promise.all([service.getForUser(req.user.id), service.countUnread(req.user.id)]);
    return success(res, { items, unread });
  } catch (err) { next(err); }
};
exports.markRead = async (req, res, next) => {
  try { await service.markRead(req.params.id, req.user.id); return success(res, null, 'Marquée comme lue'); }
  catch (err) { next(err); }
};
exports.markAllRead = async (req, res, next) => {
  try { await service.markAllRead(req.user.id); return success(res, null, 'Toutes marquées comme lues'); }
  catch (err) { next(err); }
};
