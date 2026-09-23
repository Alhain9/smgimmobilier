const { Notification } = require('../models');

class NotificationService {
  getForUser(userId) {
    return Notification.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: 100,
    });
  }

  countUnread(userId) {
    return Notification.count({ where: { user_id: userId, is_read: false } });
  }

  create({ user_id, title, message, link, type = 'system' }) {
    return Notification.create({ user_id, title, message, link, type });
  }

  async markRead(id, userId) {
    const n = await Notification.findOne({ where: { id, user_id: userId } });
    if (!n) throw Object.assign(new Error('Notification introuvable'), { status: 404 });
    n.is_read = true;
    await n.save();
    return n;
  }

  async markAllRead(userId) {
    await Notification.update({ is_read: true }, { where: { user_id: userId, is_read: false } });
    return true;
  }

  async delete(id, userId) {
    const n = await Notification.findOne({ where: { id, user_id: userId } });
    if (!n) throw Object.assign(new Error('Notification introuvable'), { status: 404 });
    await n.destroy();
    return true;
  }

  async deleteAll(userId) {
    await Notification.destroy({ where: { user_id: userId } });
    return true;
  }
}

module.exports = new NotificationService();
