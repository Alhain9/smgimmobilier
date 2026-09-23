// ============ PDF Helpers — Formatage propre sans caractères bizarres ============
const fs = require('fs');
const companyService = require('../services/company-settings.service');

/**
 * Nettoie le texte pour éviter tout charabia / mojibake dans PDFKit
 * Supprime les emojis Unicode non supportés par Helvetica/WinAnsi
 * Remplace les espaces insécables et étroits (\u202f, \u00a0) par un espace ASCII classique (code 32)
 */
function cleanText(val) {
  if (val == null) return '';
  return String(val)
    // Remplacer les emojis fréquents par des libellés propres
    .replace(/📞/g, 'Tél : ')
    .replace(/✉️|📧/g, 'Email : ')
    .replace(/📅/g, 'Date : ')
    .replace(/📍/g, 'Locataire : ')
    .replace(/🏠|🏢/g, 'Bien : ')
    .replace(/💳/g, 'Mode : ')
    .replace(/💵/g, 'Espèces')
    .replace(/⚠️/g, 'Dette : ')
    .replace(/✅/g, 'Payé')
    .replace(/🔧/g, 'Travaux : ')
    .replace(/📱/g, '')
    // Supprimer tous les autres emojis Unicode
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
    // Remplacer impérativement les espaces insécables / étroits
    .replace(/[\u202f\u00a0\u2000-\u200b]/g, ' ')
    .trim();
}

/**
 * Formate un montant en FCFA — séparateur de milliers par espace simple ASCII
 * Garantit l'absence de caractères bizarres dans les PDFs (pas de \u202f, pas de virgule, pas de tiret)
 */
function fmtMoney(amount, withCurrency = true) {
  // Convertir en nombre entier arrondi (élimine les décimales type "2000.00")
  const raw = String(amount || '0').replace(/[^0-9.\-]/g, '');
  const n = Math.round(parseFloat(raw) || 0);
  // Groupes de 3 chiffres séparés par espace ASCII standard (code 32)
  const parts = String(Math.abs(n)).split('');
  const groups = [];
  for (let i = parts.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) groups.unshift(' ');
    groups.unshift(parts[i]);
  }
  const formatted = (n < 0 ? '-' : '') + groups.join('');
  return withCurrency ? `${formatted} FCFA` : formatted;
}

/**
 * Formate une date au format français DD/MM/YYYY
 */
function fmtDate(d) {
  if (!d) return '—';
  try {
    const parts = String(d).split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const date = new Date(d);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${day}/${month}/${date.getFullYear()}`;
    }
  } catch (_) {}
  return String(d);
}

/**
 * Calcule avec exactitude la période de loyer couverte par un montant payé
 * Ex : 100 000 FCFA avec un loyer de 25 000 FCFA => 4 mois (du 03/09/2026 au 03/01/2027)
 */
function calculateRentCoverage({ amount, rentAmount, paymentDate, periodStart, periodEnd, remainingBalance, debtAmount }) {
  const paid = parseFloat(amount) || 0;
  const rent = parseFloat(rentAmount) || 0;
  const remaining = Math.round(parseFloat(remainingBalance) || 0);
  const debt = Math.round(parseFloat(debtAmount) || 0);

  let months = rent > 0 ? Math.floor(paid / rent) : 1;
  if (months <= 0) months = 1;

  let start = periodStart ? new Date(periodStart) : (paymentDate ? new Date(paymentDate) : new Date());
  if (isNaN(start.getTime())) start = new Date();

  let end;
  if (periodEnd) {
    end = new Date(periodEnd);
  } else {
    end = new Date(start);
    end.setMonth(end.getMonth() + months);
  }

  const startFormatted = fmtDate(start);
  const endFormatted = fmtDate(end);

  let label = '';
  const monthText = `${months} mois`;

  if (debt > 0 && remaining > 0) {
    label = `Paiement couvrant ${monthText} d'arriérés (du ${startFormatted} au ${endFormatted}) — Reste dû : ${fmtMoney(remaining)}`;
  } else if (debt > 0 && remaining === 0) {
    label = `Paiement couvrant ${monthText} (du ${startFormatted} au ${endFormatted}) — Dette totalement soldée`;
  } else if (remaining > 0) {
    label = `Paiement partiel couvrant ${monthText} (du ${startFormatted} au ${endFormatted}) — Reste dû : ${fmtMoney(remaining)}`;
  } else {
    label = `Paiement couvrant ${monthText} de loyer (du ${startFormatted} au ${endFormatted})`;
  }

  return {
    months,
    startDate: start,
    endDate: end,
    startDateFormatted: startFormatted,
    endDateFormatted: endFormatted,
    label,
    remaining,
  };
}

/**
 * Dessine l'en-tête officiel avec le logo de l'entreprise
 */
function drawCompanyHeader(doc, { title = '', subtitle = '', rightLines = [] } = {}) {
  const settings = companyService.getSettings();
  const pageW = doc.page.width;
  const primaryColor = settings.primary_color || '#1a3a5c';

  // Bandeau supérieur coloré
  doc.rect(0, 0, pageW, 5).fill(primaryColor);

  const startY = 16;
  let logoDrawn = false;

  // Dessiner le logo s'il existe
  if (settings.logo_path && fs.existsSync(settings.logo_path)) {
    try {
      doc.image(settings.logo_path, 36, startY, { fit: [90, 44] });
      logoDrawn = true;
    } catch (e) {
      // Fallback
    }
  }

  if (!logoDrawn) {
    doc.rect(36, startY, 80, 40).fill('#f0f4f8');
    doc.rect(36, startY, 80, 40).strokeColor(primaryColor).lineWidth(1.5).stroke();
    doc.fontSize(14).fillColor(primaryColor).font('Helvetica-Bold')
      .text('SMG', 36, startY + 12, { width: 80, align: 'center' });
  }

  // Coordonnées entreprise à droite
  const rightX = pageW - 250;
  doc.fontSize(11).fillColor(primaryColor).font('Helvetica-Bold')
    .text(cleanText(settings.name || 'SMG IMMOBILIERE'), rightX, startY, { width: 214, align: 'right' });

  doc.fontSize(8).fillColor('#495057').font('Helvetica')
    .text(cleanText(settings.address || 'Yaoundé et Douala, Cameroun'), rightX, startY + 15, { width: 214, align: 'right' })
    .text(`Tél : ${cleanText(settings.phone || '+237 6 699 03 07 71')}`, rightX, startY + 25, { width: 214, align: 'right' })
    .text(`Email : ${cleanText(settings.email || 'smgimmobilier.infos@gmail.com')}`, rightX, startY + 35, { width: 214, align: 'right' });

  const lineY = startY + 48;
  doc.moveTo(36, lineY).lineTo(pageW - 36, lineY)
    .strokeColor(primaryColor).lineWidth(2).stroke();

  doc.y = lineY + 8;
  return lineY + 8;
}

module.exports = {
  cleanText,
  fmtMoney,
  fmtDate,
  calculateRentCoverage,
  drawCompanyHeader,
};
