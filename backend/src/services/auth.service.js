const { User, Role, RefreshToken } = require('../models');
const { generateToken, generateRefreshToken, generateResetToken, verifyToken } = require('../utils/jwt');
const { shapeUser } = require('../utils/shapeUser');
const { createAuditEntry } = require('../middlewares/audit.middleware');
const { logger } = require('../config/logger');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Durée du refresh token en millisecondes (par défaut 30 jours)
const REFRESH_DAYS = parseInt(process.env.JWT_REFRESH_DAYS || '30', 10);

/**
 * Génère un refresh token aléatoire (pas JWT) et le stocke hashé en base.
 */
const issueRefreshToken = async (userId, req) => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, 10);
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    ip_address: req ? (req.ip || null) : null,
    user_agent: req ? (req.headers?.['user-agent'] || null) : null,
  });

  return rawToken;
};

const issueTokens = async (user, req) => {
  const payload = { id: user.id, role: user.role ? user.role.code() : null };
  const token = generateToken(payload);
  const refreshToken = await issueRefreshToken(user.id, req);
  return { token, refreshToken };
};

class AuthService {
  async login(email, password, req) {
    const user = await User.findOne({ where: { email }, include: [{ model: Role, as: 'role' }] });
    if (!user) throw Object.assign(new Error('Email ou mot de passe incorrect'), { status: 401 });
    if (user.status !== 'active') throw Object.assign(new Error('Compte désactivé'), { status: 403 });
    if (!(await user.comparePassword(password))) throw Object.assign(new Error('Email ou mot de passe incorrect'), { status: 401 });

    const tokens = await issueTokens(user, req);

    // Audit de connexion
    createAuditEntry({ userId: user.id, action: 'LOGIN', entity: 'users', entityId: user.id, req });
    logger.info(`Connexion réussie pour ${email}`, { userId: user.id });

    return { ...tokens, user: shapeUser(user) };
  }

  // Rafraîchit l'access token à partir d'un refresh token valide (rotation)
  async refresh(rawRefreshToken, req) {
    // Cherche tous les tokens non révoqués de tous les utilisateurs
    const allTokens = await RefreshToken.findAll({
      where: { revoked: false },
      order: [['created_at', 'DESC']],
    });

    let matchedToken = null;
    for (const rt of allTokens) {
      if (await bcrypt.compare(rawRefreshToken, rt.token_hash)) {
        matchedToken = rt;
        break;
      }
    }

    if (!matchedToken) throw Object.assign(new Error('Refresh token invalide'), { status: 401 });
    if (new Date(matchedToken.expires_at) < new Date()) {
      await matchedToken.update({ revoked: true });
      throw Object.assign(new Error('Refresh token expiré'), { status: 401 });
    }

    // Rotation : révoquer l'ancien, émettre un nouveau
    const user = await User.findByPk(matchedToken.user_id, { include: [{ model: Role, as: 'role' }] });
    if (!user || user.status !== 'active') throw Object.assign(new Error('Utilisateur invalide'), { status: 401 });

    // Révoquer l'ancien token
    await matchedToken.update({ revoked: true });

    // Émettre de nouveaux tokens
    const payload = { id: user.id, role: user.role ? user.role.code() : null };
    const newAccessToken = generateToken(payload);
    const newRefreshToken = await issueRefreshToken(user.id, req);

    // Mettre à jour replaced_by sur l'ancien
    const newTokenRecord = await RefreshToken.findOne({
      where: { user_id: user.id, revoked: false },
      order: [['created_at', 'DESC']],
    });
    if (newTokenRecord) {
      await matchedToken.update({ replaced_by: newTokenRecord.id });
    }

    logger.info('Refresh token rotaté', { userId: user.id });
    return { token: newAccessToken, refreshToken: newRefreshToken };
  }

  // Révoque tous les refresh tokens d'un utilisateur (déconnexion complète)
  async logout(userId, req) {
    await RefreshToken.update({ revoked: true }, { where: { user_id: userId, revoked: false } });
    createAuditEntry({ userId, action: 'LOGOUT', entity: 'users', entityId: userId, req });
    logger.info('Déconnexion et révocation des tokens', { userId });
    return true;
  }

  // Demande de réinitialisation : génère un token (en dev, renvoyé dans la réponse faute de SMTP)
  async forgotPassword(email) {
    const user = await User.findOne({ where: { email } });
    // On ne révèle pas si l'email existe (sécurité)
    if (!user) return { sent: true };
    const resetToken = generateResetToken({ id: user.id });
    const devReturn = process.env.NODE_ENV !== 'production';
    logger.info('Demande de réinitialisation de mot de passe', { email, userId: user.id });
    return { sent: true, ...(devReturn ? { resetToken } : {}) };
  }

  async resetPassword(token, newPassword) {
    let decoded;
    try { decoded = verifyToken(token); }
    catch { throw Object.assign(new Error('Lien de réinitialisation invalide ou expiré'), { status: 400 }); }
    if (decoded.type !== 'reset') throw Object.assign(new Error('Token invalide'), { status: 400 });
    const user = await User.findByPk(decoded.id);
    if (!user) throw Object.assign(new Error('Utilisateur introuvable'), { status: 404 });
    user.password = newPassword; await user.save();
    logger.info('Mot de passe réinitialisé', { userId: user.id });
    return true;
  }

  async getProfile(userId) {
    const user = await User.findByPk(userId, { include: [{ model: Role, as: 'role' }] });
    if (!user) throw Object.assign(new Error('Utilisateur introuvable'), { status: 404 });
    return shapeUser(user);
  }

  // Mise à jour de son propre profil (nom, téléphone, email, avatar)
  async updateProfile(userId, data) {
    const user = await User.findByPk(userId);
    if (!user) throw Object.assign(new Error('Utilisateur introuvable'), { status: 404 });
    const patch = {};
    if (data.full_name) patch.full_name = data.full_name;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.email) {
      const exists = await User.findOne({ where: { email: data.email } });
      if (exists && exists.id !== user.id) throw Object.assign(new Error('Cet email est déjà utilisé'), { status: 400 });
      patch.email = data.email;
    }
    if (data.profile_image) patch.profile_image = data.profile_image;
    await user.update(patch);
    return this.getProfile(userId);
  }

  async changePassword(userId, oldPassword, newPassword) {
    const user = await User.findByPk(userId);
    if (!user) throw Object.assign(new Error('Utilisateur introuvable'), { status: 404 });
    if (!(await user.comparePassword(oldPassword))) throw Object.assign(new Error('Ancien mot de passe incorrect'), { status: 400 });
    user.password = newPassword; await user.save();
    logger.info('Mot de passe changé', { userId });
    return true;
  }

  // Nettoyage des refresh tokens expirés (appelé par le cron)
  async cleanupExpiredTokens() {
    const count = await RefreshToken.destroy({
      where: {
        [require('sequelize').Op.or]: [
          { expires_at: { [require('sequelize').Op.lt]: new Date() } },
          { revoked: true },
        ],
      },
    });
    if (count > 0) logger.info(`Nettoyage : ${count} refresh tokens supprimés`);
    return count;
  }
}
module.exports = new AuthService();
