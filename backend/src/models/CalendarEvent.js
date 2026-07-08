const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CalendarEvent = sequelize.define('CalendarEvent', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  task_id: { type: DataTypes.BIGINT.UNSIGNED },
  title: { type: DataTypes.STRING(150), allowNull: false },
  start_datetime: { type: DataTypes.DATE, allowNull: false },
  end_datetime: { type: DataTypes.DATE },
  created_by: { type: DataTypes.BIGINT.UNSIGNED },
  is_meeting: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { tableName: 'calendar_events', timestamps: true });

module.exports = CalendarEvent;
