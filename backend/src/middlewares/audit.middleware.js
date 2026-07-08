// ============ Middleware d'audit — traçabilité des actions critiques ============
const { AuditLog } = require('../models');
const { logAudit } = require('../config/logger');

/**
 * Crée une entrée d'audit en base de données ET dans les logs Winston.
 * À appeler depuis les services/controllers après une action critique.
 */
const createAuditEntry = async ({ userId, action, entity, entityId, oldValues, newValues, req }) => {
  try {
    const ip = req ? (req.ip || req.connection?.remoteAddress || null) : null;
    const userAgent = req ? (req.headers?.['user-agent'] || null) : null;

    // Écriture en base
    await AuditLog.create({
      user_id: userId,
      action,
      entity,
      entity_id: entityId,
      old_values: oldValues || null,
      new_values: newValues || null,
      ip_address: ip,
      user_agent: userAgent,
    });

    // Écriture dans le fichier de log d'audit
    logAudit(action, { userId, entity, entityId, oldValues, newValues, ip });
  } catch (err) {
    // On ne bloque pas la requête si l'audit échoue
    const { logger } = require('../config/logger');
    logger.error('Erreur lors de la création de l\'entrée d\'audit', { error: err.message, action, entity, entityId });
  }
};

/**
 * Middleware Express d'audit automatique sur les mutations (POST, PUT, PATCH, DELETE).
 * Se place APRÈS le handler : lit res.locals.audit pour tracer l'action.
 *
 * Usage dans le controller :
 *   res.locals.audit = { action: 'CREATE', entity: 'payments', entityId: newPayment.id };
 *   return success(res, data);
 */
const auditMiddleware = (req, res, next) => {
  // Intercepte la fin de la réponse
  const originalEnd = res.end;
  res.end = function (...args) {
    if (res.locals.audit && res.statusCode < 400) {
      const { action, entity, entityId, oldValues, newValues } = res.locals.audit;
      createAuditEntry({
        userId: req.user?.id || null,
        action,
        entity,
        entityId,
        oldValues,
        newValues,
        req,
      });
    }
    originalEnd.apply(res, args);
  };
  next();
};

module.exports = { auditMiddleware, createAuditEntry };
