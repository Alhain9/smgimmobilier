const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorksitePhoto = sequelize.define('WorksitePhoto', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  worksite_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  photo_url: { type: DataTypes.STRING(255), allowNull: false },
  phase: { type: DataTypes.ENUM('before', 'during', 'after'), defaultValue: 'during' },
  caption: { type: DataTypes.STRING(255), allowNull: true },
  uploaded_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
}, {
  tableName: 'worksite_photos',
  timestamps: true,
  updatedAt: false,
  underscored: true,
});

module.exports = WorksitePhoto;
