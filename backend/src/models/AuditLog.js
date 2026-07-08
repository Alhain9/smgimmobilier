// ============ Modèle AuditLog ============
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  action: { type: DataTypes.STRING(50), allowNull: false },
  entity: { type: DataTypes.STRING(80), allowNull: true },
  entity_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  old_values: { type: DataTypes.JSON, allowNull: true },
  new_values: { type: DataTypes.JSON, allowNull: true },
  ip_address: { type: DataTypes.STRING(45), allowNull: true },
  user_agent: { type: DataTypes.STRING(255), allowNull: true },
}, {
  tableName: 'audit_logs',
  timestamps: true,
  updatedAt: false,
});

module.exports = AuditLog;
