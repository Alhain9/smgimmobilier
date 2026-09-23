const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StockItem = sequelize.define('StockItem', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  warehouse_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  item_code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  category: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'Général' },
  item_type: {
    type: DataTypes.ENUM('consumable', 'tool_equipment'),
    allowNull: false,
    defaultValue: 'consumable',
  },
  unit: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'pièce' },
  quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  quantity_loaned: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  min_alert_threshold: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 5 },
  unit_price_avg: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  last_purchase_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  location: { type: DataTypes.STRING(100), allowNull: true },
  photo: { type: DataTypes.STRING(255), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'stock_items', timestamps: true, underscored: true });

// Catégories standards recommandées
StockItem.CATEGORIES = [
  'Plomberie',
  'Électricité',
  'Peinture & Enduit',
  'Maçonnerie & Gros œuvre',
  'Quincaillerie & Visserie',
  'Menuiserie & Bois',
  'Carrelage & Revêtement',
  'Étanchéité & Toiture',
  'Sanitaire & Robinetterie',
  'Outillage consommable',
  'Autre',
];

module.exports = StockItem;
