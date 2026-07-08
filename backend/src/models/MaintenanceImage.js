const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MaintenanceImage = sequelize.define('MaintenanceImage', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  maintenance_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  image_url: { type: DataTypes.STRING(255), allowNull: false },
  image_type: { type: DataTypes.ENUM('before', 'during', 'after'), allowNull: false },
}, { tableName: 'maintenance_images', timestamps: true, updatedAt: false });

module.exports = MaintenanceImage;
