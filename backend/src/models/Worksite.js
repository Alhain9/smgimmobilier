const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Worksite = sequelize.define('Worksite', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(150), allowNull: false },
  worksite_type: { type: DataTypes.ENUM('interne', 'externe'), defaultValue: 'interne' },
  property_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  contractor: { type: DataTypes.STRING(150) },
  client_name: { type: DataTypes.STRING(150), allowNull: true },
  client_phone: { type: DataTypes.STRING(50), allowNull: true },
  client_email: { type: DataTypes.STRING(150), allowNull: true },
  location: { type: DataTypes.STRING(255) },
  budget: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  material_cost: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  labor_cost: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  other_cost: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  contract_amount: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
  spent_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  start_date: { type: DataTypes.DATEONLY },
  end_date_estimated: { type: DataTypes.DATEONLY },
  end_date_actual: { type: DataTypes.DATEONLY },
  progress_percent: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.ENUM('planned', 'in_progress', 'on_hold', 'completed', 'cancelled'), defaultValue: 'planned' },
  manager_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  photo: { type: DataTypes.STRING(255) },
  description: { type: DataTypes.TEXT },
}, { tableName: 'worksites', timestamps: true, paranoid: true });

module.exports = Worksite;
