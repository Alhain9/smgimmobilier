const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Expense = sequelize.define('Expense', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  maintenance_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  property_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  expense_type: { type: DataTypes.ENUM('maintenance', 'utility', 'administrative', 'renovation', 'gardiennage', 'other'), defaultValue: 'maintenance' },
  created_by: { type: DataTypes.BIGINT.UNSIGNED },
  item_name: { type: DataTypes.STRING(150), allowNull: false },
  caretaker_name: { type: DataTypes.STRING(150), allowNull: true },
  period_month: { type: DataTypes.STRING(50), allowNull: true },
  payment_date: { type: DataTypes.DATEONLY, allowNull: true },
  payment_method: { type: DataTypes.STRING(50), defaultValue: 'Espèces' },
  category: { type: DataTypes.STRING(80) },
  quantity: { type: DataTypes.DECIMAL(10, 2), defaultValue: 1 },
  unit_price: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  supplier: { type: DataTypes.STRING(150) },
  total_price: { type: DataTypes.DECIMAL(14, 2) }, // colonne générée STORED
  invoice_file: { type: DataTypes.STRING(255) },
  photo: { type: DataTypes.STRING(255) },
  is_landlord_expense: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'expenses', timestamps: true });

module.exports = Expense;
