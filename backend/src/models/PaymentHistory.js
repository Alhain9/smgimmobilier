const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Journal des modifications d'un paiement (montant, date, preuve, validation)
const PaymentHistory = sequelize.define('PaymentHistory', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  payment_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  action: { type: DataTypes.STRING(40), allowNull: false }, // created|updated|proof_added|validated|rejected
  description: { type: DataTypes.TEXT },
  amount: { type: DataTypes.DECIMAL(12, 2) },
  status: { type: DataTypes.STRING(40) },
  changed_by: { type: DataTypes.BIGINT.UNSIGNED },
}, { tableName: 'payment_history', timestamps: true, updatedAt: false });

module.exports = PaymentHistory;
