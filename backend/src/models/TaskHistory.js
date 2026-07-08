const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Journal horodaté d'une tâche : qui a fait quoi, et quand (traçabilité)
const TaskHistory = sequelize.define('TaskHistory', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  task_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  action: { type: DataTypes.STRING(40), allowNull: false }, // created|status_changed|rescheduled|note
  description: { type: DataTypes.TEXT },
  old_status: { type: DataTypes.STRING(40) },
  new_status: { type: DataTypes.STRING(40) },
  scheduled_at: { type: DataTypes.DATE },
  changed_by: { type: DataTypes.BIGINT.UNSIGNED },
}, { tableName: 'task_history', timestamps: true, updatedAt: false });

module.exports = TaskHistory;
