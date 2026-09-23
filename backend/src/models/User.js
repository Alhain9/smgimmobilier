const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  full_name: { type: DataTypes.STRING(150), allowNull: false },
  email: { type: DataTypes.STRING(190), allowNull: false, unique: true, validate: { isEmail: true } },
  phone: { type: DataTypes.STRING(30) },
  password: { type: DataTypes.STRING(255), allowNull: false },
  role_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  requested_role: { type: DataTypes.STRING(50), allowNull: true },
  registration_note: { type: DataTypes.TEXT, allowNull: true },
  city: { type: DataTypes.STRING(100), allowNull: true },
  service_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  equipe_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  profile_image: { type: DataTypes.STRING(255) },
  status: { type: DataTypes.ENUM('active', 'inactive', 'suspended', 'pending_approval'), defaultValue: 'active' },
  can_manage_users: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  can_view_all_calendars: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  can_manage_utilities: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  is_present: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  last_attendance_at: { type: DataTypes.DATE },
}, {
  tableName: 'users',
  timestamps: true,
  paranoid: true,
  hooks: {
    beforeCreate: async (u) => { if (u.password) u.password = await bcrypt.hash(u.password, 12); },
    beforeUpdate: async (u) => { if (u.changed('password')) u.password = await bcrypt.hash(u.password, 12); },
  },
});

User.prototype.comparePassword = function (plain) { return bcrypt.compare(plain, this.password); };
User.prototype.toJSON = function () { const v = { ...this.get() }; delete v.password; return v; };

module.exports = User;
