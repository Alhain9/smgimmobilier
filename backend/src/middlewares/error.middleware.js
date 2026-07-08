const { logger } = require('../config/logger');
const { error } = require('../utils/response');

const notFound = (req, res) => {
  return error(res, `Route introuvable: ${req.originalUrl}`, 404);
};

const errorHandler = (err, req, res, next) => {
  // Log l'erreur avec Winston
  logger.error(`${err.message}`, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.id || null,
    ip: req.ip,
  });

  // Erreurs Sequelize
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const errors = err.errors.map((e) => ({ field: e.path, message: e.message }));
    return error(res, 'Erreur de validation', 400, errors);
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return error(res, 'Référence invalide (clé étrangère)', 400);
  }

  // Erreurs Joi (au cas où une erreur Joi non gérée remonte)
  if (err.isJoi) {
    const errors = err.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
    return error(res, 'Erreur de validation', 400, errors);
  }

  return error(res, err.message || 'Erreur serveur interne', err.status || 500);
};

module.exports = { notFound, errorHandler };
