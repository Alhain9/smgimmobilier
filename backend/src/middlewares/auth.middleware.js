const { verifyToken } = require('../utils/jwt');
const { error } = require('../utils/response');
const { User, Role, Permission } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    // Supporte aussi ?token=... pour les liens PDF directs (<a href=...>)
    const queryToken = req.query.token;
    let rawToken = null;
    if (header && header.startsWith('Bearer ')) {
      rawToken = header.split(' ')[1];
    } else if (queryToken) {
      rawToken = queryToken;
    }
    if (!rawToken) return error(res, 'Token manquant', 401);
    const decoded = verifyToken(rawToken);
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

    let delegatedRoles = [];
    try {
      const delegationService = require('../services/delegation.service');
      const delegations = await delegationService.getActiveDelegationsForUser(user.id);
      delegatedRoles = delegations.map((d) => d.delegated_role);
    } catch (_) {}

    req.user = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role ? user.role.code() : null,
      role_id: user.role_id,
      delegated_roles: delegatedRoles,
      permissions,
      is_bailleur: user.role ? user.role.code() === 'bailleur' : false,
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
