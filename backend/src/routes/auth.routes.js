const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const { validate, schemas } = require('../validators');

router.get('/login', (req, res) => {
  res.status(405).json({
    success: false,
    message: 'L\'endpoint /api/auth/login nécessite une requête HTTP POST avec un body JSON { email, password }.',
  });
});
router.post('/login', validate(schemas.login), ctrl.login);
router.post('/refresh', validate(schemas.refreshToken), ctrl.refresh);
router.post('/logout', authenticate, ctrl.logout);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);
router.get('/me', authenticate, ctrl.me);
router.put('/profile', authenticate, upload.single('avatar'), ctrl.updateProfile);
router.put('/change-password', authenticate, validate(schemas.changePassword), ctrl.changePassword);

module.exports = router;
