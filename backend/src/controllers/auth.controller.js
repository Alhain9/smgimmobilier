const authService = require('../services/auth.service');
const { success } = require('../utils/response');

exports.login = async (req, res, next) => {
  try { return success(res, await authService.login(req.body.email, req.body.password, req), 'Connexion réussie'); }
  catch (err) { next(err); }
};
exports.refresh = async (req, res, next) => {
  try { return success(res, await authService.refresh(req.body.refreshToken, req), 'Token rafraîchi'); }
  catch (err) { next(err); }
};
exports.logout = async (req, res, next) => {
  try { await authService.logout(req.user.id, req); return success(res, null, 'Déconnexion réussie'); }
  catch (err) { next(err); }
};
exports.forgotPassword = async (req, res, next) => {
  try { return success(res, await authService.forgotPassword(req.body.email), 'Si le compte existe, un lien a été généré'); }
  catch (err) { next(err); }
};
exports.resetPassword = async (req, res, next) => {
  try { await authService.resetPassword(req.body.token, req.body.newPassword); return success(res, null, 'Mot de passe réinitialisé'); }
  catch (err) { next(err); }
};
exports.me = async (req, res, next) => {
  try { return success(res, await authService.getProfile(req.user.id)); }
  catch (err) { next(err); }
};
exports.updateProfile = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) data.profile_image = `/uploads/photos/${req.file.filename}`;
    return success(res, await authService.updateProfile(req.user.id, data), 'Profil mis à jour');
  } catch (err) { next(err); }
};
exports.changePassword = async (req, res, next) => {
  try { await authService.changePassword(req.user.id, req.body.oldPassword, req.body.newPassword); return success(res, null, 'Mot de passe modifié'); }
  catch (err) { next(err); }
};
