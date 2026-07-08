// ============ Service de Messagerie Interne ============
const { MessageInterne, User } = require('../models');
const { Op } = require('sequelize');
const { emit } = require('../config/socket');

class MessageService {
  async getConversation(userId, contactId) {
    return MessageInterne.findAll({
      where: {
        [Op.or]: [
          { sender_id: userId, recipient_id: contactId },
          { sender_id: contactId, recipient_id: userId }
        ]
      },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'full_name'] },
        { model: User, as: 'recipient', attributes: ['id', 'full_name'] }
      ],
      order: [['created_at', 'ASC']]
    });
  }

  async listRecentChats(userId) {
    // Liste des utilisateurs avec qui l'utilisateur a des messages
    const messages = await MessageInterne.findAll({
      where: {
        [Op.or]: [{ sender_id: userId }, { recipient_id: userId }]
      },
      order: [['created_at', 'DESC']]
    });

    const userIds = new Set();
    messages.forEach(m => {
      if (m.sender_id !== userId) userIds.add(m.sender_id);
      if (m.recipient_id !== userId) userIds.add(m.recipient_id);
    });

    return User.findAll({
      where: { id: { [Op.in]: Array.from(userIds) } },
      attributes: ['id', 'full_name', 'email', 'profile_image']
    });
  }

  async sendMessage(senderId, recipientId, content) {
    const msg = await MessageInterne.create({
      sender_id: senderId,
      recipient_id: recipientId,
      content
    });

    const fullMsg = await MessageInterne.findByPk(msg.id, {
      include: [
        { model: User, as: 'sender', attributes: ['id', 'full_name'] },
        { model: User, as: 'recipient', attributes: ['id', 'full_name'] }
      ]
    });

    // Émettre en temps réel
    try {
      emit('message:nouveau', fullMsg.toJSON(), { userId: recipientId });
    } catch (_) {}

    return fullMsg;
  }

  async markAsRead(userId, contactId) {
    return MessageInterne.update(
      { is_read: true },
      { where: { sender_id: contactId, recipient_id: userId, is_read: false } }
    );
  }

  async getUnreadCount(userId) {
    return MessageInterne.count({
      where: { recipient_id: userId, is_read: false }
    });
  }
}

module.exports = new MessageService();
