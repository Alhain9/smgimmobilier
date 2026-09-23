const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StockPurchaseItem = sequelize.define('StockPurchaseItem', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  purchase_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  stock_item_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 1 },
  unit_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  total_price: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
}, { tableName: 'stock_purchase_items', timestamps: true, underscored: true });

module.exports = StockPurchaseItem;
