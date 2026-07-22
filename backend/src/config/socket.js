// ============ Configuration Socket.IO — temps réel ============
const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const { logger } = require('./logger');

let io = null;

/**
 * Initialise Socket.IO sur le serveur HTTP.
 * Auth JWT au handshake, rooms par rôle et par immeuble.
 */
const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        callback(null, origin || true);
      },
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
  });

  // Middleware d'authentification JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Token manquant'));
    try {
      const decoded = verifyToken(token);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Token invalide'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const role = socket.user.role;

    // Rejoindre les rooms automatiquement
    socket.join(`user:${userId}`);
    if (role) socket.join(`role:${role}`);
    socket.join('global');

    logger.info('Socket connecté', { userId, role, socketId: socket.id });

    // Le client peut rejoindre des rooms supplémentaires (ex: par immeuble)
    socket.on('join:property', (propertyId) => {
      socket.join(`property:${propertyId}`);
      logger.debug(`Socket ${socket.id} a rejoint property:${propertyId}`);
    });

    socket.on('leave:property', (propertyId) => {
      socket.leave(`property:${propertyId}`);
    });

    socket.on('disconnect', () => {
      logger.info('Socket déconnecté', { userId, socketId: socket.id });
    });
  });

  logger.info('✅ Socket.IO initialisé');
  return io;
};

/**
 * Récupère l'instance Socket.IO (singleton).
 */
const getIO = () => {
  if (!io) throw new Error('Socket.IO non initialisé. Appeler initSocket() d\'abord.');
  return io;
};

// ===== Émetteurs d'événements par domaine =====

/**
 * Émet un événement vers des cibles spécifiques.
 * @param {string} event - Nom de l'événement (ex: 'paiement:nouveau')
 * @param {object} data - Données à envoyer
 * @param {object} targets - { global, role, userId, propertyId }
 */
const emit = (event, data, targets = {}) => {
  if (!io) return;
  if (targets.global) {
    io.to('global').emit(event, data);
  }
  if (targets.role) {
    const roles = Array.isArray(targets.role) ? targets.role : [targets.role];
    roles.forEach((r) => io.to(`role:${r}`).emit(event, data));
  }
  if (targets.userId) {
    const ids = Array.isArray(targets.userId) ? targets.userId : [targets.userId];
    ids.forEach((id) => io.to(`user:${id}`).emit(event, data));
  }
  if (targets.propertyId) {
    io.to(`property:${targets.propertyId}`).emit(event, data);
  }
};

// Raccourcis par domaine
const emitPayment = (action, data, propertyId) => {
  emit(`paiement:${action}`, data, { role: ['super_admin', 'manager', 'comptable'], propertyId });
};

const emitMaintenance = (action, data, propertyId) => {
  emit(`maintenance:${action}`, data, { role: ['super_admin', 'manager', 'dir_technique'], propertyId });
};

const emitContract = (action, data, propertyId) => {
  emit(`contrat:${action}`, data, { role: ['super_admin', 'manager', 'dir_admin', 'gestionnaire'], propertyId });
};

const emitTenant = (action, data) => {
  emit(`locataire:${action}`, data, { role: ['super_admin', 'manager', 'gestionnaire'] });
};

const emitLogement = (action, data, propertyId) => {
  emit(`logement:${action}`, data, { role: ['super_admin', 'manager', 'gestionnaire'], propertyId });
};

const emitNotification = (userId, data) => {
  emit('notification:nouvelle', data, { userId });
};

const emitWorkflow = (action, data, targetUserId) => {
  emit(`workflow:${action}`, data, { userId: targetUserId });
};

const emitDashboard = () => {
  try {
    const dashboardService = require('../services/dashboard.service');
    dashboardService.invalidateCache();
  } catch (err) {
    logger.error('Erreur lors de l\'invalidation du cache du dashboard:', err);
  }
  emit('dashboard:refresh', { timestamp: new Date().toISOString() }, { global: true });
};

module.exports = {
  initSocket,
  getIO,
  emit,
  emitPayment,
  emitMaintenance,
  emitContract,
  emitTenant,
  emitLogement,
  emitNotification,
  emitWorkflow,
  emitDashboard,
};
