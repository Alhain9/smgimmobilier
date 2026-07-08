const { verifyToken } = require('../utils/jwt');
const { error } = require('../utils/response');
const { User, Role, Permission } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return error(res, 'Token manquant', 401);
    const decoded = verifyToken(header.split(' ')[1]);
    const user = await User.findByPk(decoded.id, {
      include: [{
        model: Role,
        as: 'role',
        include: [{
          model: Permission,
          as: 'permissions',
          attributes: ['code']
        }]
      }]
    });
    if (!user || user.status !== 'active') return error(res, 'Utilisateur invalide ou désactivé', 401);
    
    const permissions = user.role?.permissions?.map(p => p.code) || [];

    req.user = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role ? user.role.code() : null,
      role_id: user.role_id,
      permissions,
      can_manage_users: permissions.includes('manage_users') || !!user.can_manage_users,
      can_view_all_calendars: permissions.includes('view_all_calendars') || !!user.can_view_all_calendars,
      can_manage_utilities: permissions.includes('manage_utilities') || !!user.can_manage_utilities,
    };
    next();
  } catch (err) {
    return error(res, 'Token invalide ou expiré', 401);
  }
};
module.exports = { authenticate };
