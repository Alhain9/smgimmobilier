const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Salary = sequelize.define('Salary', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  period_month: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
  period_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
  base_salary: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  bonus: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  deductions: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  net_salary: { type: DataTypes.DECIMAL(14, 2) }, // générée STORED
  payment_type: { type: DataTypes.ENUM('deposit', 'cash'), defaultValue: 'deposit' },
  proof_photo: { type: DataTypes.STRING(255) },
  status: { type: DataTypes.ENUM('pending', 'paid'), defaultValue: 'pending' },
  paid_date: { type: DataTypes.DATEONLY },
  notes: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.BIGINT.UNSIGNED },
}, { tableName: 'salaries', timestamps: true });

module.exports = Salary;
