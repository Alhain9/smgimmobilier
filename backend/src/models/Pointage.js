// ============ Modèle Pointage (RH) ============
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Pointage = sequelize.define('Pointage', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  entry_time: { type: DataTypes.DATE, allowNull: false },
  exit_time: { type: DataTypes.DATE, allowNull: true },
  status: {
    type: DataTypes.ENUM('present', 'absent', 'late', 'half_day'),
    allowNull: false,
    defaultValue: 'present',
  },
  notes: { type: DataTypes.TEXT },
}, {
  tableName: 'pointages',
  timestamps: true,
});

module.exports = Pointage;
