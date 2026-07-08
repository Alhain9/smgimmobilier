const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Task = sequelize.define('Task', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  maintenance_id: { type: DataTypes.BIGINT.UNSIGNED },
  assigned_to: { type: DataTypes.BIGINT.UNSIGNED },
  created_by: { type: DataTypes.BIGINT.UNSIGNED },
  title: { type: DataTypes.STRING(150), allowNull: false },
  description: { type: DataTypes.TEXT },
  start_date: { type: DataTypes.DATE }, // heure planifiée
  end_date: { type: DataTypes.DATE },
  status: { type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'not_done', 'cancelled'), defaultValue: 'pending' },
  done_at: { type: DataTypes.DATE },             // horodatage de réalisation
  completion_note: { type: DataTypes.TEXT },     // ce qui a été fait / raison si non fait
  delay_justification: { type: DataTypes.TEXT },
}, { tableName: 'tasks', timestamps: true });

module.exports = Task;
