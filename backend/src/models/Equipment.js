const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Equipment = sequelize.define('Equipment', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  equipment_name: { type: DataTypes.STRING(150), allowNull: false },
  quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
  price: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  photo: { type: DataTypes.STRING(255) },
  status: { type: DataTypes.ENUM('available', 'in_use', 'out_of_stock', 'maintenance'), defaultValue: 'available' },
}, { tableName: 'equipment', timestamps: true });

module.exports = Equipment;
