const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorksiteTask = sequelize.define('WorksiteTask', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  worksite_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  title: { type: DataTypes.STRING(150), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  start_date: { type: DataTypes.DATEONLY, allowNull: true },
  end_date: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'blocked'), defaultValue: 'pending' },
  progress_percent: { type: DataTypes.INTEGER, defaultValue: 0 },
  assigned_to: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
}, {
  tableName: 'worksite_tasks',
  timestamps: true,
  underscored: true,
});

module.exports = WorksiteTask;
