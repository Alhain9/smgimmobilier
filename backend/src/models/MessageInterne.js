// ============ Modèle MessageInterne (Messagerie) ============
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MessageInterne = sequelize.define('MessageInterne', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  sender_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  recipient_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'messages_internes',
  timestamps: true,
});

module.exports = MessageInterne;
