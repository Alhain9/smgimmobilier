// ============ Winston Logger — journalisation applicative ============
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');

// Format commun : timestamp + niveau + message + métadonnées
const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Format lisible pour la console (dev)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${extra}`;
  })
);

// Transport : fichier rotatif d'info (7j de rétention)
const infoTransport = new DailyRotateFile({
  dirname: LOG_DIR,
  filename: 'app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  level: 'info',
  format: baseFormat,
});

// Transport : fichier rotatif d'erreurs (30j de rétention)
const errorTransport = new DailyRotateFile({
  dirname: LOG_DIR,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: baseFormat,
});

// Transport : fichier d'audit (actions critiques)
const auditTransport = new DailyRotateFile({
  dirname: LOG_DIR,
  filename: 'audit-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '90d',
  level: 'info',
  format: baseFormat,
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  transports: [infoTransport, errorTransport],
  exceptionHandlers: [errorTransport],
  rejectionHandlers: [errorTransport],
});

// Console transport (toujours actif pour capter les logs sur Render/Cloud)
logger.add(new winston.transports.Console({ format: consoleFormat }));

// Logger d'audit séparé (pour les logs d'actions métier)
const auditLogger = winston.createLogger({
  level: 'info',
  transports: [auditTransport],
});

/**
 * Log une action d'audit
 * @param {string} action - Type d'action (CREATE, UPDATE, DELETE, LOGIN, etc.)
 * @param {object} meta - { userId, entity, entityId, oldValues, newValues, ip }
 */
const logAudit = (action, meta = {}) => {
  auditLogger.info(action, {
    userId: meta.userId || null,
    entity: meta.entity || null,
    entityId: meta.entityId || null,
    oldValues: meta.oldValues || null,
    newValues: meta.newValues || null,
    ip: meta.ip || null,
    timestamp: new Date().toISOString(),
  });
};

module.exports = { logger, logAudit };
