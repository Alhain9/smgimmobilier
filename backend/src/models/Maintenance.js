const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Maintenance = sequelize.define('Maintenance', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  apartment_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  tenant_id: { type: DataTypes.BIGINT.UNSIGNED },
  assigned_technician_id: { type: DataTypes.BIGINT.UNSIGNED },
  title: { type: DataTypes.STRING(150), allowNull: false },
  description: { type: DataTypes.TEXT },
  priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'), defaultValue: 'medium' },
  status: { type: DataTypes.ENUM('reported', 'validated', 'in_progress', 'completed', 'cancelled'), defaultValue: 'reported' },
  completed_at: { type: DataTypes.DATE },
}, { tableName: 'maintenance_requests', timestamps: true });

module.exports = Maintenance;
