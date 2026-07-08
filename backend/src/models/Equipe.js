// ============ Modèle Equipe (RH) ============
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Equipe = sequelize.define('Equipe', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  service_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
}, {
  tableName: 'equipes',
  timestamps: true,
});

module.exports = Equipe;
