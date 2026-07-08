const { body } = require('express-validator');

const loginRules = [
  body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
  body('password').notEmpty().withMessage('Mot de passe requis'),
];

const forgotRules = [body('email').isEmail().withMessage('Email invalide').normalizeEmail()];
const resetRules = [
  body('token').notEmpty().withMessage('Token requis'),
  body('newPassword').isLength({ min: 6 }).withMessage('Mot de passe : 6 caractères minimum'),
];
const refreshRules = [body('refreshToken').notEmpty().withMessage('Refresh token requis')];

module.exports = { loginRules, forgotRules, resetRules, refreshRules };
