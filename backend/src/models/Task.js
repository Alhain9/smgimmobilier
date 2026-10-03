const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Task = sequelize.define('Task', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  maintenance_id: { type: DataTypes.BIGINT.UNSIGNED },
  property_id: { type: DataTypes.BIGINT.UNSIGNED },
  apartment_id: { type: DataTypes.BIGINT.UNSIGNED },
  worksite_id: { type: DataTypes.BIGINT.UNSIGNED },
  location_zone: { type: DataTypes.STRING(150) },
  assigned_to: { type: DataTypes.BIGINT.UNSIGNED },
  created_by: { type: DataTypes.BIGINT.UNSIGNED },
  title: { type: DataTypes.STRING(150), allowNull: false },
  nature_probleme: { type: DataTypes.STRING(255) },
  description: { type: DataTypes.TEXT },
  priority: { type: DataTypes.STRING(50), defaultValue: 'Normal' },
  start_date: { type: DataTypes.DATE }, // heure planifiée
  end_date: { type: DataTypes.DATE },
  period_start: { type: DataTypes.DATEONLY },
  period_end: { type: DataTypes.DATEONLY },
  status: { type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'not_done', 'cancelled'), defaultValue: 'pending' },
  done_at: { type: DataTypes.DATE },             // horodatage de réalisation
  completion_note: { type: DataTypes.TEXT },     // ce qui a été fait / raison si non fait
  observation: { type: DataTypes.TEXT },         // observation spécifique ou état d'avancement
  delay_justification: { type: DataTypes.TEXT },
}, { tableName: 'tasks', timestamps: true });

module.exports = Task;
