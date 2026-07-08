// ============ Routes Audit Logs ============
const router = require('express').Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const { AuditLog, User } = require('../models');
const { Op } = require('sequelize');
const { success } = require('../utils/response');
const { auditLogDTO, paginatedDTO } = require('../dto');

// Liste des audit logs (admin seulement) — paginée
router.get('/', authenticate, authorize('super_admin', 'manager'), async (req, res, next) => {
  try {
    const { page = 1, limit = 50, action, entity, user_id, start, end } = req.query;
    const where = {};
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (user_id) where.user_id = user_id;
    if (start && end) where.created_at = { [Op.between]: [`${start} 00:00:00`, `${end} 23:59:59`] };

    const offset = (page - 1) * limit;
    const { rows, count } = await AuditLog.findAndCountAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'full_name'] }],
      order: [['created_at', 'DESC']],
      limit: Number(limit),
      offset,
    });

    return success(res, paginatedDTO({ rows, count, page: Number(page), limit: Number(limit) }, auditLogDTO));
  } catch (err) { next(err); }
});

// Actions disponibles (pour le filtre)
router.get('/actions', authenticate, authorize('super_admin', 'manager'), async (req, res, next) => {
  try {
    const actions = await AuditLog.findAll({
      attributes: [[require('sequelize').fn('DISTINCT', require('sequelize').col('action')), 'action']],
      raw: true,
    });
    return success(res, actions.map((a) => a.action).filter(Boolean));
  } catch (err) { next(err); }
});

module.exports = router;
