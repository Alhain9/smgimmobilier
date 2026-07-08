const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/database');
const { initSocket } = require('./config/socket');
const { logger } = require('./config/logger');
require('./models');
require('dotenv').config();
const assistantScheduler = require('./services/assistant/scheduler');
const cronScheduler = require('./jobs/scheduler');

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();

  // Création du serveur HTTP pour Express + Socket.IO
  const server = http.createServer(app);

  // Initialisation Socket.IO sur le même serveur
  initSocket(server);

  // Pas de sync : le schéma MySQL est géré par les migrations SQL
  assistantScheduler.start(); // recalcul périodique des compteurs d'alertes (assistant)
  cronScheduler.start(); // tâches planifiées quotidiennes et mensuelles (IMSM)

  server.listen(PORT, () => {
    logger.info(`🚀 IMSM API sur http://localhost:${PORT}`);
    logger.info(`📡 API: http://localhost:${PORT}/api`);
    logger.info(`🔌 Socket.IO: ws://localhost:${PORT}`);
  });

  // Synchronisation MySQL <-> Firestore (inactive tant que Firebase n'est pas configuré)
  require('./sync').initSync();
};
start().catch((err) => { logger.error('❌ Échec démarrage:', { error: err.message, stack: err.stack }); process.exit(1); });
