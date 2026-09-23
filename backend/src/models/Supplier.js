const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Supplier = sequelize.define('Supplier', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  contact_person: { type: DataTypes.STRING(150), allowNull: true },
  phone: { type: DataTypes.STRING(50), allowNull: true },
  email: { type: DataTypes.STRING(150), allowNull: true },
  address: { type: DataTypes.STRING(255), allowNull: true },
  city: { type: DataTypes.STRING(100), defaultValue: 'Yaoundé' },
  category: { type: DataTypes.STRING(100), allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'suppliers', timestamps: true, underscored: true });

module.exports = Supplier;
