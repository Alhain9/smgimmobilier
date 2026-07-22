// ============ Service Email — templates et envoi ============
const { sendMail } = require('../config/mailer');
const { logger } = require('../config/logger');

class EmailService {
  // Template HTML de base
  _wrap(title, body) {
    return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"></head>
    <body style="font-family:Arial,sans-serif;background:#f5f7fa;margin:0;padding:20px;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);overflow:hidden;">
        <div style="background:#1E3A5F;color:#fff;padding:20px 30px;">
          <h1 style="margin:0;font-size:20px;">SMG <span style="color:#3498DB;">IMMOBILIER</span></h1>
          <p style="margin:5px 0 0;font-size:13px;opacity:0.8;">${title}</p>
        </div>
        <div style="padding:30px;">
          ${body}
        </div>
        <div style="background:#f5f7fa;padding:15px 30px;font-size:11px;color:#999;text-align:center;">
          SMG IMMOBILIER — Plateforme de Gestion Immobilière<br>
          Cet email a été envoyé automatiquement, merci de ne pas y répondre.
        </div>
      </div>
    </body></html>`;
  }

  // ===== Rappel de paiement =====
  async sendPaymentReminder({ to, tenantName, amount, dueDate, propertyName, apartmentNumber }) {
    const html = this._wrap('Rappel de paiement', `
      <p>Bonjour <strong>${tenantName}</strong>,</p>
      <p>Nous vous rappelons que votre paiement de loyer est en attente :</p>
      <table style="width:100%;border-collapse:collapse;margin:15px 0;">
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Montant</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${amount} FCFA</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Échéance</td><td style="padding:8px;border-bottom:1px solid #eee;">${dueDate}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Immeuble</td><td style="padding:8px;border-bottom:1px solid #eee;">${propertyName}</td></tr>
        <tr><td style="padding:8px;color:#666;">Logement</td><td style="padding:8px;">${apartmentNumber}</td></tr>
      </table>
      <p>Merci de régulariser votre situation dans les meilleurs délais.</p>
      <p style="color:#666;font-size:13px;">Cordialement,<br>L'équipe SMG IMMOBILIER</p>
    `);

    return sendMail({ to, subject: `Rappel de paiement — ${amount} FCFA`, html });
  }

  // ===== Confirmation de paiement =====
  async sendPaymentConfirmation({ to, tenantName, amount, paymentDate, reference, method }) {
    const html = this._wrap('Confirmation de paiement', `
      <p>Bonjour <strong>${tenantName}</strong>,</p>
      <p>Nous confirmons la réception de votre paiement :</p>
      <table style="width:100%;border-collapse:collapse;margin:15px 0;">
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Montant</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#27AE60;">${amount} FCFA</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Date</td><td style="padding:8px;border-bottom:1px solid #eee;">${paymentDate}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Référence</td><td style="padding:8px;border-bottom:1px solid #eee;">${reference || '—'}</td></tr>
        <tr><td style="padding:8px;color:#666;">Mode</td><td style="padding:8px;">${method}</td></tr>
      </table>
      <p style="color:#27AE60;font-weight:bold;">✅ Paiement enregistré avec succès</p>
      <p style="color:#666;font-size:13px;">Cordialement,<br>L'équipe SMG IMMOBILIER</p>
    `);

    return sendMail({ to, subject: `Paiement confirmé — ${amount} FCFA`, html });
  }

  // ===== Alerte fin de contrat =====
  async sendLeaseExpiryAlert({ to, tenantName, endDate, propertyName, apartmentNumber, daysLeft }) {
    const urgency = daysLeft <= 7 ? '#E74C3C' : daysLeft <= 15 ? '#F39C12' : '#3498DB';
    const html = this._wrap('Alerte — Fin de contrat', `
      <p>Bonjour <strong>${tenantName}</strong>,</p>
      <p>Votre contrat de bail arrive à échéance :</p>
      <div style="background:#FFF3CD;border:1px solid #F39C12;border-radius:6px;padding:15px;margin:15px 0;">
        <p style="margin:0;font-weight:bold;color:${urgency};">⚠️ ${daysLeft} jour(s) restant(s)</p>
        <p style="margin:5px 0 0;color:#666;">Date de fin : ${endDate}</p>
        <p style="margin:5px 0 0;color:#666;">Logement : ${apartmentNumber} — ${propertyName}</p>
      </div>
      <p>Veuillez contacter votre gestionnaire pour discuter du renouvellement.</p>
      <p style="color:#666;font-size:13px;">Cordialement,<br>L'équipe SMG IMMOBILIER</p>
    `);

    return sendMail({ to, subject: `Fin de bail dans ${daysLeft} jour(s)`, html });
  }

  // ===== Notification de maintenance =====
  async sendMaintenanceNotification({ to, recipientName, title, status, description, propertyName, apartmentNumber }) {
    const statusLabels = { reported: 'Signalée', validated: 'Validée', in_progress: 'En cours', completed: 'Terminée', cancelled: 'Annulée' };
    const html = this._wrap('Maintenance — Mise à jour', `
      <p>Bonjour <strong>${recipientName}</strong>,</p>
      <p>Une demande de maintenance a été mise à jour :</p>
      <table style="width:100%;border-collapse:collapse;margin:15px 0;">
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Titre</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${title}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Statut</td><td style="padding:8px;border-bottom:1px solid #eee;">${statusLabels[status] || status}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Logement</td><td style="padding:8px;border-bottom:1px solid #eee;">${apartmentNumber} — ${propertyName}</td></tr>
        <tr><td style="padding:8px;color:#666;">Description</td><td style="padding:8px;">${description || '—'}</td></tr>
      </table>
      <p style="color:#666;font-size:13px;">Cordialement,<br>L'équipe SMG IMMOBILIER</p>
    `);

    return sendMail({ to, subject: `Maintenance : ${title} — ${statusLabels[status] || status}`, html });
  }
}

module.exports = new EmailService();
