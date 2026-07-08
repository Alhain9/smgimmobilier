// ============ Modèle RolePermission (table de jonction) ============
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RolePermission = sequelize.define('RolePermission', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  role_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  permission_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
}, {
  tableName: 'roles_permissions',
  timestamps: true,
  updatedAt: false,
});

module.exports = RolePermission;
