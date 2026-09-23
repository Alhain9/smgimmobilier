const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Warehouse = sequelize.define('Warehouse', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  city: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'Yaoundé' },
  address: { type: DataTypes.STRING(255), allowNull: true },
  property_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  manager_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  phone: { type: DataTypes.STRING(50), allowNull: true },
  warehouse_type: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'mixed' }, // 'stocks', 'equipment', 'mixed'
  description: { type: DataTypes.TEXT, allowNull: true },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'warehouses',
  timestamps: true,
  underscored: true,
});

module.exports = Warehouse;
