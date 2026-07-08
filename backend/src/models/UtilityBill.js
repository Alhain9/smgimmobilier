const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Facture de charges (électricité / eau) d'un logement pour un mois, par compteur divisionnel.
const UtilityBill = sequelize.define('UtilityBill', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  apartment_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  type: { type: DataTypes.ENUM('electricity', 'water'), allowNull: false, defaultValue: 'electricity' },
  period_month: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
  period_year: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
  previous_index: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 }, // ancien index
  current_index: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },  // nouvel index
  unit_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },     // prix kWh / m3
  garbage_fee: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },    // poubelle
  transport_fee: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  other_fee: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  other_label: { type: DataTypes.STRING(80) },
  total_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },   // calculé au service
  status: { type: DataTypes.ENUM('pending', 'paid'), allowNull: false, defaultValue: 'pending' },
  paid_date: { type: DataTypes.DATEONLY },
  payment_proof: { type: DataTypes.STRING(255) },
  notes: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.BIGINT.UNSIGNED },
}, { tableName: 'utility_bills', timestamps: true });

module.exports = UtilityBill;
