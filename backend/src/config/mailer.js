// ============ Configuration Nodemailer — emails transactionnels ============
const nodemailer = require('nodemailer');
const { logger } = require('./logger');

let transporter = null;

const initMailer = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user) {
    logger.warn('⚠️ SMTP non configuré — emails désactivés. Définir SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS dans .env');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(port || '587', 10),
    secure: parseInt(port || '587', 10) === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });

  // Vérification de la connexion
  transporter.verify((err) => {
    if (err) logger.error('❌ SMTP connexion échouée', { error: err.message });
    else logger.info('✅ SMTP connecté');
  });

  return transporter;
};

const getTransporter = () => {
  if (!transporter) initMailer();
  return transporter;
};

/**
 * Envoie un email de manière asynchrone (non bloquant).
 * @param {object} options - { to, subject, html, text, attachments }
 */
const sendMail = async (options) => {
  const t = getTransporter();
  if (!t) {
    logger.warn('Email non envoyé (SMTP non configuré)', { to: options.to, subject: options.subject });
    return null;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@imsm.local';

  try {
    const info = await t.sendMail({
      from: `"IMSM" <${from}>`,
      ...options,
    });
    logger.info('📧 Email envoyé', { to: options.to, subject: options.subject, messageId: info.messageId });
    return info;
  } catch (err) {
    logger.error('❌ Erreur envoi email', { to: options.to, error: err.message });
    throw err;
  }
};

module.exports = { initMailer, getTransporter, sendMail };
