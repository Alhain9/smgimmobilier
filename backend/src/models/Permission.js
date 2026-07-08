// ============ Modèle Permission ============
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Permission = sequelize.define('Permission', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(80), allowNull: false, unique: true },
  label: { type: DataTypes.STRING(150), allowNull: false },
  module: { type: DataTypes.STRING(50), defaultValue: 'general' },
}, {
  tableName: 'permissions',
  timestamps: true,
  updatedAt: false,
});

module.exports = Permission;
