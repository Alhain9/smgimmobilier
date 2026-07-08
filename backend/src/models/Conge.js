// ============ Modèle Conge (RH) ============
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Conge = sequelize.define('Conge', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  type: {
    type: DataTypes.ENUM('annual', 'sick', 'maternity', 'paternity', 'unpaid', 'other'),
    allowNull: false,
    defaultValue: 'annual',
  },
  start_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY, allowNull: false },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
  },
  reason: { type: DataTypes.TEXT },
  approved_by: { type: DataTypes.BIGINT.UNSIGNED },
}, {
  tableName: 'conges',
  timestamps: true,
  paranoid: true,
});

module.exports = Conge;
