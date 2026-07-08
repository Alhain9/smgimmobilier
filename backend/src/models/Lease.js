const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Lease = sequelize.define('Lease', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  apartment_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  contract_file: { type: DataTypes.STRING(255) },
  start_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY },
  monthly_rent: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  deposit_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  status: { type: DataTypes.ENUM('pending', 'active', 'expired', 'terminated'), defaultValue: 'active' },
}, { tableName: 'leases', timestamps: true, paranoid: true });

module.exports = Lease;
