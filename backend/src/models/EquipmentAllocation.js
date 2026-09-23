const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EquipmentAllocation = sequelize.define('EquipmentAllocation', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  equipment_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  assigned_to_user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  worksite_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  maintenance_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  assigned_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  expected_return_at: { type: DataTypes.DATE, allowNull: true },
  returned_at: { type: DataTypes.DATE, allowNull: true },
  condition_on_assignment: { type: DataTypes.STRING(255), allowNull: true },
  condition_on_return: { type: DataTypes.STRING(255), allowNull: true },
  status: { type: DataTypes.ENUM('active', 'returned', 'damaged'), defaultValue: 'active' },
}, {
  tableName: 'equipment_allocations',
  timestamps: false,
  underscored: true,
});

module.exports = EquipmentAllocation;
