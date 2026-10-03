const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config(); // fallback to cwd .env

const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/error.middleware');
const { auditMiddleware } = require('./middlewares/audit.middleware');
const { logger } = require('./config/logger');

const app = express();

// Sécurité : masquer la signature Express pour éviter les attaques ciblées
app.disable('x-powered-by');

// Confiance dans le proxy inverse (VPS Nginx/Apache, Render) pour le rate limiter et req.ip réel
app.set('trust proxy', 1);

// Sécurité des en-têtes HTTP & CORS
app.use(cors({ origin: true, credentials: true }));
app.use(helmet({
  contentSecurityPolicy: false, // Permet le bon fonctionnement de la SPA servie en local ou VPS
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
}));

// Limiteur général d'API contre les attaques DoS / Scraping agressif (VPS-friendly)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requêtes par 15 min par adresse IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de requêtes envoyées depuis cette adresse IP. Veuillez patienter quelques instants.',
  },
});
app.use('/api', apiLimiter);
app.use('/api/v1', apiLimiter);
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

// Fichiers uploadés (statique)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Servir l'application Frontend complète & PWA (manifest, sw, assets, pages)
app.use(express.static(path.join(__dirname, '../../frontend')));

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
