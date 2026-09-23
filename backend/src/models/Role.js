const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Libellé (role_name en base) -> code interne RBAC
const ROLE_CODES = {
  'Super Admin': 'super_admin',
  'Manager': 'manager',
  'Directeur Administratif': 'dir_admin',
  'Directeur Technique': 'dir_technique',
  'Gestionnaire': 'gestionnaire',
  'Comptable': 'comptable',
  'Technicien': 'technicien',
  'Locataire': 'locataire',
  'Bailleur': 'bailleur',
};

const Role = sequelize.define('Role', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  role_name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
}, { tableName: 'roles', timestamps: true });

Role.prototype.code = function () {
  return ROLE_CODES[this.role_name] || this.role_name.toLowerCase().replace(/\s+/g, '_');
};
Role.CODES = ROLE_CODES;
Role.codeToName = (code) => Object.keys(ROLE_CODES).find((k) => ROLE_CODES[k] === code);

module.exports = Role;
