const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Table de jointure : techniciens affectés à un chantier de maintenance
const MaintenanceTechnician = sequelize.define('MaintenanceTechnician', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  maintenance_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
}, { tableName: 'maintenance_technicians', updatedAt: false });

module.exports = MaintenanceTechnician;
