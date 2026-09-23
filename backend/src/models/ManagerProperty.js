// ============ Modèle ManagerProperty — Attribution d'immeubles aux gestionnaires ============
// Table pivot : un gestionnaire/comptable peut avoir plusieurs immeubles prioritaires
// Un immeuble peut être attribué à plusieurs gestionnaires
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ManagerProperty = sequelize.define('ManagerProperty', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  property_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
}, {
  tableName: 'manager_properties',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['user_id', 'property_id'] },
  ],
});

module.exports = ManagerProperty;
