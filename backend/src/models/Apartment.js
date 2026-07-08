const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Apartment = sequelize.define('Apartment', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  property_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  apartment_number: { type: DataTypes.STRING(20), allowNull: false },
  floor: { type: DataTypes.INTEGER },
  apartment_type: { type: DataTypes.STRING(50) },
  surface: { type: DataTypes.DECIMAL(8, 2) },
  rent_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  status: { type: DataTypes.ENUM('free', 'occupied', 'maintenance', 'reserved'), defaultValue: 'free' },
  description: { type: DataTypes.TEXT },
}, { tableName: 'apartments', timestamps: true, paranoid: true });

module.exports = Apartment;
