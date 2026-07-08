// ============ Modèle GPSTracking (Mobilité) ============
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GPSTracking = sequelize.define('GPSTracking', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
  longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: false },
  recorded_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'gps_tracking',
  timestamps: false,
});

module.exports = GPSTracking;
