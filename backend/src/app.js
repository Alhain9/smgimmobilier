const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/error.middleware');
const { auditMiddleware } = require('./middlewares/audit.middleware');
const { logger } = require('./config/logger');

const app = express();

// Confiance dans le proxy inverse (Render) pour le rate limiter et req.ip
app.set('trust proxy', 1);

// Sécurité
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.options('*', cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

// Logs HTTP via Winston (remplace morgan en prod)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // En production : log via Winston
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

// Rate limit sur l'auth
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
app.use('/api/auth/login', authLimiter);
app.use('/api/v1/auth/login', authLimiter);

// Fichiers uploadés (statique)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware d'audit (capture les actions sur toutes les routes)
app.use(auditMiddleware);

// Routes API — versionnée (/api/v1/) + compatibilité (/api/)
app.use('/api/v1', routes);
app.use('/api', routes);

app.get('/health', (req, res) => res.json({ status: 'OK', service: 'SMG IMMOBILIER API', version: '2.0.0' }));

// Erreurs
app.use(notFound);
app.use(errorHandler);

module.exports = app;
