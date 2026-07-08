const router = require('express').Router();
const ctrl = require('../controllers/assistant.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { error } = require('../utils/response');

router.use(authenticate);

// Réservé au personnel : tout rôle interne, jamais les locataires (403).
router.use((req, res, next) => {
  if (!req.user || req.user.role === 'locataire') {
    return error(res, 'Assistant réservé au personnel de SMG IMMOBILIER.', 403);
  }
  next();
});

router.get('/status', ctrl.status);
router.post('/chat', ctrl.chat);
router.get('/alertes', ctrl.alertes);

module.exports = router;
