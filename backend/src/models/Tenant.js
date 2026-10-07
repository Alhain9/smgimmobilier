const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Tenant = sequelize.define('Tenant', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT.UNSIGNED },
  civility: { type: DataTypes.STRING(20), defaultValue: 'Monsieur' },
  apartment_id: { type: DataTypes.BIGINT.UNSIGNED },
  national_id: { type: DataTypes.STRING(50) },
  cni_delivery_date: { type: DataTypes.DATEONLY },
  cni_delivery_place: { type: DataTypes.STRING(100) },
  profession: { type: DataTypes.STRING(100) },
  emergency_contact: { type: DataTypes.STRING(150) },
  start_date: { type: DataTypes.DATEONLY },
  end_date: { type: DataTypes.DATEONLY },
  observations: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('active', 'inactive', 'terminated'), defaultValue: 'active' },
  departure_reason: { type: DataTypes.STRING(150) },
  debt_acknowledged: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  debt_due_date: { type: DataTypes.DATEONLY },
  is_debt_settled: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'tenants', timestamps: true, paranoid: true });

module.exports = Tenant;
