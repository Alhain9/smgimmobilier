const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const { validate, schemas } = require('../validators');

// Protection anti-brute-force : max 5 tentatives de connexion par 15 min par IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de tentatives de connexion échouées. Par mesure de sécurité, veuillez patienter 15 minutes avant de réessayer.',
  },
});

// Limite sur demande de réinitialisation : max 3 par 15 min
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Trop de demandes de réinitialisation. Veuillez patienter 15 minutes avant de réessayer.',
  },
});

router.get('/login', (req, res) => {
  res.status(405).json({
    success: false,
    message: 'L\'endpoint /api/auth/login nécessite une requête HTTP POST avec un body JSON { email, password }.',
  });
});
router.post('/login', authLimiter, validate(schemas.login), ctrl.login);
router.post('/register', authLimiter, ctrl.register);
router.post('/refresh', validate(schemas.refreshToken), ctrl.refresh);
router.post('/logout', authenticate, ctrl.logout);
router.post('/forgot-password', forgotLimiter, validate(schemas.forgotPassword), ctrl.forgotPassword);
router.post('/reset-password', authLimiter, validate(schemas.resetPassword), ctrl.resetPassword);
router.get('/me', authenticate, ctrl.me);
router.put('/profile', authenticate, upload.single('avatar'), ctrl.updateProfile);
router.put('/change-password', authenticate, validate(schemas.changePassword), ctrl.changePassword);

module.exports = router;
