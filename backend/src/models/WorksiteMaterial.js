const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorksiteMaterial = sequelize.define('WorksiteMaterial', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  worksite_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  stock_item_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  quantity_used: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 1 },
  unit_cost: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  total_cost: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  declared_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  date_used: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'worksite_materials',
  timestamps: false,
  underscored: true,
});

module.exports = WorksiteMaterial;
