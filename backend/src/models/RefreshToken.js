// ============ Modèle RefreshToken ============
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RefreshToken = sequelize.define('RefreshToken', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  token_hash: { type: DataTypes.STRING(255), allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  revoked: { type: DataTypes.BOOLEAN, defaultValue: false },
  replaced_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  ip_address: { type: DataTypes.STRING(45), allowNull: true },
  user_agent: { type: DataTypes.STRING(255), allowNull: true },
}, {
  tableName: 'refresh_tokens',
  timestamps: true,
  updatedAt: false,
});

module.exports = RefreshToken;
