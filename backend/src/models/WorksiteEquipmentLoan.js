const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorksiteEquipmentLoan = sequelize.define('WorksiteEquipmentLoan', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  worksite_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  stock_item_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  warehouse_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 1 },
  assigned_date: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
  returned_date: { type: DataTypes.DATEONLY, allowNull: true },
  returned_quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  return_warehouse_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  status: {
    type: DataTypes.ENUM('loaned', 'partially_returned', 'returned', 'damaged_lost'),
    defaultValue: 'loaned',
  },
  condition_notes: { type: DataTypes.TEXT, allowNull: true },
  created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
}, {
  tableName: 'worksite_equipment_loans',
  timestamps: true,
  underscored: true,
});

module.exports = WorksiteEquipmentLoan;
