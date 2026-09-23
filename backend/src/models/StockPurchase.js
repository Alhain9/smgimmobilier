const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StockPurchase = sequelize.define('StockPurchase', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  purchase_number: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  supplier_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  purchase_date: { type: DataTypes.DATEONLY, allowNull: false },
  total_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  invoice_number: { type: DataTypes.STRING(100), allowNull: true },
  invoice_file: { type: DataTypes.STRING(255), allowNull: true },
  status: { type: DataTypes.ENUM('ordered', 'received', 'cancelled'), defaultValue: 'received' },
  notes: { type: DataTypes.TEXT, allowNull: true },
  created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
}, { tableName: 'stock_purchases', timestamps: true, underscored: true });

module.exports = StockPurchase;
