const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RoleDelegation = sequelize.define('RoleDelegation', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  delegated_role: { type: DataTypes.STRING(50), allowNull: false },
  granted_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  start_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY, allowNull: false },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  reason: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'role_delegations',
  timestamps: true,
  underscored: true,
});

module.exports = RoleDelegation;
