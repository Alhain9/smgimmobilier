// ============ Modèle WorkflowEtape ============
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorkflowEtape = sequelize.define('WorkflowEtape', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  workflow_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  step_order: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
  role_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  description: { type: DataTypes.STRING(255) },
}, {
  tableName: 'workflow_etapes',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['workflow_id', 'step_order']
    }
  ]
});

module.exports = WorkflowEtape;
