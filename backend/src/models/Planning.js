// ============ Modèle Planning (RH) ============
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Planning = sequelize.define('Planning', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  title: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT },
  start_datetime: { type: DataTypes.DATE, allowNull: false },
  end_datetime: { type: DataTypes.DATE, allowNull: false },
  created_by: { type: DataTypes.BIGINT.UNSIGNED },
}, {
  tableName: 'plannings',
  timestamps: true,
  paranoid: true,
});

module.exports = Planning;
