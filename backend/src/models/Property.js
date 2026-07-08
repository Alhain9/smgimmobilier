const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Property = sequelize.define('Property', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  property_name: { type: DataTypes.STRING(150), allowNull: false },
  property_type: { type: DataTypes.ENUM('immeuble', 'maison', 'terrain'), defaultValue: 'immeuble' },
  address: { type: DataTypes.STRING(255), allowNull: false },
  city: { type: DataTypes.STRING(100), allowNull: false },
  district: { type: DataTypes.STRING(100) },
  latitude: { type: DataTypes.DECIMAL(10, 7) },
  longitude: { type: DataTypes.DECIMAL(10, 7) },
  // Redistribution des charges (électricité/eau) — activable par immeuble + valeurs par défaut
  utilities_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  electricity_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  water_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  garbage_fee: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  transport_fee: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  description: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
  image: { type: DataTypes.STRING(255) },
}, { tableName: 'properties', timestamps: true, paranoid: true });

module.exports = Property;
