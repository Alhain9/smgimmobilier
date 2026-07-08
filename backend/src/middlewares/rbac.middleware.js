const { error } = require('../utils/response');

// authorize('super_admin', 'manager') => seuls ces rôles passent
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return error(res, 'Non authentifié', 401);
    }
    // super_admin a tous les droits
    if (req.user.role === 'super_admin') return next();

    if (!allowedRoles.includes(req.user.role)) {
      return error(res, 'Accès refusé : permissions insuffisantes', 403);
    }
    next();
  };
};

// authorizePermission('can_manage_users', 'manager') => autorisé si super_admin,
// si le rôle figure dans allowedRoles, OU si req.user[permissionField] === true
const authorizePermission = (permissionField, ...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return error(res, 'Non authentifié', 401);
    }
    if (req.user.role === 'super_admin') return next();
    if (allowedRoles.includes(req.user.role)) return next();
    if (req.user[permissionField] === true) return next();
    return error(res, 'Accès refusé : permissions insuffisantes', 403);
  };
};

module.exports = { authorize, authorizePermission };
