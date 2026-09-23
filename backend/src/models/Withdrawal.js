const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Withdrawal = sequelize.define('Withdrawal', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING(30),
    allowNull: false,
  },
  recipient_name: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  withdrawal_type: {
    type: DataTypes.ENUM('mobile_money', 'cash_code', 'bank_transfer'),
    defaultValue: 'mobile_money',
  },
  reference: {
    type: DataTypes.STRING(100),
    unique: true,
  },
  campay_reference: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('completed', 'pending', 'failed', 'cancelled'),
    defaultValue: 'pending',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
  },
}, {
  tableName: 'withdrawals',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Withdrawal;
