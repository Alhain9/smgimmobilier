const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  apartment_id: { type: DataTypes.BIGINT.UNSIGNED },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  payment_method: { type: DataTypes.ENUM('orange_money', 'mtn_mobile_money', 'bank_transfer', 'cash', 'campay', 'kang'), allowNull: false },
  payment_proof: { type: DataTypes.STRING(255) },
  payment_date: { type: DataTypes.DATEONLY, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'awaiting_confirmation', 'completed', 'failed', 'refunded'), defaultValue: 'pending' },
  created_by: { type: DataTypes.BIGINT.UNSIGNED },
  campay_reference: { type: DataTypes.STRING(100) },
}, { tableName: 'payments', timestamps: true });

module.exports = Payment;
