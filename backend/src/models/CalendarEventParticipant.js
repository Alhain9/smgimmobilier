const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CalendarEventParticipant = sequelize.define('CalendarEventParticipant', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  event_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
}, { tableName: 'calendar_event_participants', updatedAt: false });

module.exports = CalendarEventParticipant;
