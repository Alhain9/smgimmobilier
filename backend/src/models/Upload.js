const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Upload = sequelize.define('Upload', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  uploaded_by: { type: DataTypes.BIGINT.UNSIGNED },
  file_name: { type: DataTypes.STRING(255), allowNull: false },
  file_path: { type: DataTypes.STRING(255), allowNull: false },
  file_type: { type: DataTypes.STRING(100) },
  related_table: { type: DataTypes.STRING(255) },
  related_id: { type: DataTypes.BIGINT.UNSIGNED },
}, { tableName: 'uploads', timestamps: true, updatedAt: false });

module.exports = Upload;
