const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Expense = sequelize.define('Expense', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  maintenance_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  property_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  expense_type: { type: DataTypes.ENUM('maintenance', 'utility', 'administrative', 'renovation', 'other'), defaultValue: 'maintenance' },
  created_by: { type: DataTypes.BIGINT.UNSIGNED },
  item_name: { type: DataTypes.STRING(150), allowNull: false },
  category: { type: DataTypes.STRING(80) },
  quantity: { type: DataTypes.DECIMAL(10, 2), defaultValue: 1 },
  unit_price: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  supplier: { type: DataTypes.STRING(150) },
  total_price: { type: DataTypes.DECIMAL(14, 2) }, // colonne générée STORED
  invoice_file: { type: DataTypes.STRING(255) },
  photo: { type: DataTypes.STRING(255) },
}, { tableName: 'expenses', timestamps: true });

module.exports = Expense;
