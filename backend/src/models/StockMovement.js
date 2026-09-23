const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StockMovement = sequelize.define('StockMovement', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  stock_item_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  movement_type: {
    type: DataTypes.ENUM(
      'in_purchase',
      'out_maintenance',
      'out_worksite',
      'return_maintenance',
      'return_worksite',
      'adjustment_in',
      'adjustment_out'
    ),
    allowNull: false,
  },
  quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  stock_before: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  stock_after: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  unit_cost: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total_cost: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
  reference_type: {
    type: DataTypes.ENUM('purchase', 'maintenance', 'worksite', 'inventory', 'other'),
    defaultValue: 'other',
  },
  reference_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
}, {
  tableName: 'stock_movements',
  timestamps: true,
  updatedAt: false, // Journal immuable (créé une seule fois, jamais modifié)
  underscored: true,
});

// Libellés pour l'interface
StockMovement.TYPE_LABELS = {
  in_purchase: '📦 Entrée (Achat / Réception)',
  out_maintenance: '🔧 Sortie (Intervention Maintenance)',
  out_worksite: '🏗️ Sortie (Chantier)',
  return_maintenance: '↩️ Retour (Surplus Maintenance)',
  return_worksite: '↩️ Retour (Surplus Chantier)',
  adjustment_in: '➕ Ajustement positif (Inventaire)',
  adjustment_out: '➖ Ajustement négatif (Perte / Casse)',
};

module.exports = StockMovement;
