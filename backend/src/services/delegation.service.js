// ============ Service Délégation de Rôle Temporaire — SMG IMMOBILIER ============
const { RoleDelegation, User } = require('../models');
const { Op } = require('sequelize');
const { logger } = require('../config/logger');

class DelegationService {
  async getAll() {
    return RoleDelegation.findAll({
      include: [
        { model: User, as: 'user', attributes: ['id', 'full_name', 'email'] },
        { model: User, as: 'granter', attributes: ['id', 'full_name'] },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  async grant(data, grantedByUserId) {
    const today = new Date().toISOString().slice(0, 10);
    const delegation = await RoleDelegation.create({
      user_id: data.user_id,
      delegated_role: data.delegated_role,
      granted_by: grantedByUserId,
      start_date: data.start_date || today,
      end_date: data.end_date,
      reason: data.reason || null,
      is_active: true,
    });

    logger.info('👥 Délégation de rôle temporaire accordée', {
      user_id: data.user_id,
      role: data.delegated_role,
      granted_by: grantedByUserId,
    });

    return delegation;
  }

  async revoke(id) {
    const delegation = await RoleDelegation.findByPk(id);
    if (!delegation) throw Object.assign(new Error('Délégation introuvable'), { status: 404 });
    await delegation.update({ is_active: false });
    logger.info('👥 Délégation de rôle révoquée', { id });
    return delegation;
  }

  async getActiveDelegationsForUser(userId) {
    const today = new Date().toISOString().slice(0, 10);
    return RoleDelegation.findAll({
      where: {
        user_id: userId,
        is_active: true,
        start_date: { [Op.lte]: today },
        end_date: { [Op.gte]: today },
      },
    });
  }
}

module.exports = new DelegationService();
