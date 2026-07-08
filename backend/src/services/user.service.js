const { User, Role } = require('../models');
const { shapeUser } = require('../utils/shapeUser');

// Champs réservés au manager / super_admin (délégation de permissions)
const PRIVILEGED_FIELDS = ['can_manage_users', 'can_view_all_calendars', 'can_manage_utilities'];
const stripPrivilegedFields = (data, requesterRole) => {
  const payload = { ...data };
  if (!['manager', 'super_admin'].includes(requesterRole)) {
    PRIVILEGED_FIELDS.forEach((f) => delete payload[f]);
  }
  return payload;
};

class UserService {
  async getAll() {
    const users = await User.findAll({ include: [{ model: Role, as: 'role' }], order: [['created_at', 'DESC']] });
    return users.map(shapeUser);
  }
  async getById(id) {
    const u = await User.findByPk(id, { include: [{ model: Role, as: 'role' }] });
    if (!u) throw Object.assign(new Error('Utilisateur introuvable'), { status: 404 });
    return shapeUser(u);
  }
  async create(data, requesterRole) {
    if (await User.findOne({ where: { email: data.email } })) throw Object.assign(new Error('Cet email est déjà utilisé'), { status: 400 });
    const payload = stripPrivilegedFields(data, requesterRole);
    const u = await User.create(payload);
    return this.getById(u.id);
  }
  async update(id, data, requesterRole) {
    const u = await User.findByPk(id);
    if (!u) throw Object.assign(new Error('Utilisateur introuvable'), { status: 404 });
    const payload = stripPrivilegedFields(data, requesterRole);
    if (!payload.password) delete payload.password;
    await u.update(payload);
    return this.getById(id);
  }
  async remove(id) {
    const u = await User.findByPk(id);
    if (!u) throw Object.assign(new Error('Utilisateur introuvable'), { status: 404 });
    await u.destroy();
    return true;
  }
  async toggleActive(id) {
    const u = await User.findByPk(id);
    if (!u) throw Object.assign(new Error('Utilisateur introuvable'), { status: 404 });
    u.status = u.status === 'active' ? 'inactive' : 'active';
    await u.save();
    return this.getById(id);
  }
  async toggleAttendance(id, isPresent) {
    const u = await User.findByPk(id);
    if (!u) throw Object.assign(new Error('Utilisateur introuvable'), { status: 404 });
    u.is_present = isPresent !== undefined ? isPresent : !u.is_present;
    u.last_attendance_at = new Date();
    await u.save();
    return this.getById(id);
  }
  async getRoles() {
    const roles = await Role.findAll({ order: [['id', 'ASC']] });
    return roles.map((r) => ({ id: r.id, name: r.code(), label: r.role_name }));
  }
  // Liste minimale des techniciens (pour composer une équipe de chantier)
  async getTechnicians() {
    const role = await Role.findOne({ where: { role_name: Role.codeToName('technicien') } });
    if (!role) return [];
    const users = await User.findAll({
      where: { role_id: role.id, status: 'active' },
      attributes: ['id', 'full_name'], order: [['full_name', 'ASC']],
    });
    return users.map((u) => ({ id: u.id, full_name: u.full_name }));
  }
}
module.exports = new UserService();
