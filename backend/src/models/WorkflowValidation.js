// ============ Modèle WorkflowValidation ============
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorkflowValidation = sequelize.define('WorkflowValidation', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  module: { type: DataTypes.STRING(50), allowNull: false },
  description: { type: DataTypes.TEXT },
}, {
  tableName: 'workflow_validations',
  timestamps: true,
});

module.exports = WorkflowValidation;
// 
