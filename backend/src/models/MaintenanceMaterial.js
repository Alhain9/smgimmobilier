const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MaintenanceMaterial = sequelize.define('MaintenanceMaterial', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  maintenance_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  stock_item_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  quantity_used: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 1 },
  unit_cost: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  total_cost: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  declared_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  date_used: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'maintenance_materials',
  timestamps: false,
  underscored: true,
});

module.exports = MaintenanceMaterial;
