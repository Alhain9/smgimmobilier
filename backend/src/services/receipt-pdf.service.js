// ============ Service PDF de Reçu — SMG IMMOBILIERE ============
// Format Officiel : Paysage 21 x 14,85 cm (A5)
// Zéro charabia : textes et montants parfaitement encodés sans emojis cassés
const PDFDocument = require('pdfkit');
const { logger } = require('../config/logger');
const { cleanText, fmtMoney, fmtDate, calculateRentCoverage, drawCompanyHeader } = require('../utils/pdf-helpers');
const companyService = require('./company-settings.service');

const COLORS = {
  primary: '#1a3a5c',
  secondary: '#f0f4f8',
  accent: '#c0392b',
  text: '#212529',
  muted: '#6c757d',
  success: '#27ae60',
  danger: '#e74c3c',
  warning: '#856404',
  white: '#ffffff',
  border: '#dee2e6',
};

const PAYMENT_LABELS = {
  orange_money: 'Orange Money',
  mtn_mobile_money: 'MTN Mobile Money',
  bank_transfer: 'Virement bancaire',
  cash: 'Espèces',
  campay: 'CamPay',
};

class ReceiptPdfService {
  /**
   * Génère un PDF de reçu au format paysage officiel (21 × 14,85 cm)
   */
  async generate(receipt) {
    const r = receipt.toJSON ? receipt.toJSON() : receipt;
    const settings = companyService.getSettings();

    const tenant = r.tenant || {};
    const user = tenant.user || {};
    const apartment = r.apartment || {};
    const property = r.property || apartment.property || {};

    const typeLabel = {
      rent: 'REÇU DE PAIEMENT DE LOYER',
      deposit: 'REÇU DE PAIEMENT DE CAUTION',
      advance: "REÇU D'AVANCE DE LOYER",
      other_income: 'REÇU DE RECETTE',
      expense_report: 'JUSTIFICATIF DE DÉPENSE',
      utility: 'REÇU DE PAIEMENT DE CHARGES',
    }[r.receipt_type] || 'REÇU DE PAIEMENT';

    const doc = new PDFDocument({
      size: [595.28, 420.94], // 21 × 14,85 cm
      layout: 'landscape',
      margins: { top: 18, bottom: 0, left: 36, right: 36 },
      bufferPages: true,
      info: {
        Title: `${typeLabel} - ${r.receipt_number}`,
        Author: cleanText(settings.name),
        Creator: 'SMG IMMOBILIER',
      },
    });

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));

    const pageW = doc.page.width;
    const contentW = pageW - 72; // 523.28

    // ===== EN-TÊTE OFFICIEL AVEC LOGO =====
    let y = drawCompanyHeader(doc);

    // ===== TITRE DU REÇU =====
    doc.fontSize(13).fillColor(COLORS.primary).font('Helvetica-Bold')
      .text(typeLabel, 36, y, { width: contentW, align: 'center' });
    y += 15;

    doc.fontSize(8.5).fillColor(COLORS.muted).font('Helvetica')
      .text(`N° ${r.receipt_number}  —  Date : ${fmtDate(r.payment_date)}`, 36, y, { width: contentW, align: 'center' });
    y += 13;

    // ===== BANDEAU STATUT / DETTE & PÉRIODE COUVERTE =====
    const rentAmountVal = apartment.rent_amount || r.amount;
    const coverage = calculateRentCoverage({
      amount: r.amount,
      rentAmount: rentAmountVal,
      paymentDate: r.payment_date,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      remainingBalance: r.remaining_balance,
      debtAmount: r.remaining_balance ? (parseFloat(r.remaining_balance) + parseFloat(r.amount)) : 0,
    });

    const remaining = coverage.remaining;
    const hasDebt = coverage.hasDebt;

    if (coverage.isOverdue) {
      doc.rect(36, y, contentW, 16).fill('#f8d7da');
      doc.fontSize(8.5).fillColor('#721c24').font('Helvetica-Bold')
        .text(cleanText(coverage.statusText), 36, y + 4, { width: contentW, align: 'center' });
    } else if (hasDebt) {
      doc.rect(36, y, contentW, 16).fill('#f8d7da');
      doc.fontSize(8.5).fillColor('#721c24').font('Helvetica-Bold')
        .text(cleanText(coverage.statusText || 'Dette restante'), 36, y + 4, { width: contentW, align: 'center' });
    } else {
      doc.rect(36, y, contentW, 16).fill('#d4edda');
      doc.fontSize(8.5).fillColor('#155724').font('Helvetica-Bold')
        .text(cleanText(coverage.statusText || 'Locataire à jour de ses paiements'), 36, y + 4, { width: contentW, align: 'center' });
    }
    y += 19;

    // Période couverte détaillée
    const isWarnPeriod = coverage.isOverdue || hasDebt;
    doc.rect(36, y, contentW, 15).fill(isWarnPeriod ? '#fff3cd' : '#d4edda');
    doc.fontSize(7.5).fillColor(isWarnPeriod ? '#856404' : '#155724').font('Helvetica-Bold')
      .text(cleanText(coverage.label), 36, y + 4, { width: contentW, align: 'center' });
    y += 18;

    // ===== CADRES LOCATAIRE & BIEN LOUÉ (2 COLONNES AVEC HAUTEUR DYNAMIQUE) =====
    const colW = (contentW - 8) / 2;

    const propName = cleanText(property.property_name || 'Immeuble');
    const aptNumber = cleanText(apartment.apartment_number || '');
    const propFullText = `${propName}${aptNumber ? ' — Logement ' + aptNumber : ''}`;

    doc.fontSize(8).font('Helvetica-Bold');
    const propTextH = Math.ceil(doc.heightOfString(propFullText, { width: colW - 16 }));
    const cardH = Math.max(54, 18 + propTextH + 24);

    // Colonne 1 : Locataire
    doc.rect(36, y, colW, cardH).fill(COLORS.secondary);
    doc.fontSize(8).fillColor(COLORS.primary).font('Helvetica-Bold')
      .text('LOCATAIRE', 44, y + 5);

    const clientName = cleanText(user.full_name || tenant.full_name || 'Locataire');
    const clientPhone = cleanText(user.phone || tenant.phone || '—');
    const clientEmail = cleanText(user.email || tenant.email || '');

    doc.fontSize(8.5).fillColor(COLORS.text).font('Helvetica-Bold')
      .text(clientName, 44, y + 16, { width: colW - 16 });
    doc.fontSize(7.5).fillColor(COLORS.muted).font('Helvetica')
      .text(`Tél : ${clientPhone}`, 44, y + 28, { width: colW - 16 });
    if (clientEmail) {
      doc.text(`Email : ${clientEmail}`, 44, y + 38, { width: colW - 16 });
    }

    // Colonne 2 : Bien loué (Séparation absolue entre nom du bien en haut et loyer en bas)
    const col2X = 36 + colW + 8;
    doc.rect(col2X, y, colW, cardH).fill(COLORS.secondary);
    doc.fontSize(8).fillColor(COLORS.primary).font('Helvetica-Bold')
      .text('BIEN LOUÉ', col2X + 8, y + 5);

    // Ligne HAUT : Nom de l'immeuble et logement
    doc.fontSize(8).fillColor(COLORS.text).font('Helvetica-Bold')
      .text(propFullText, col2X + 8, y + 16, { width: colW - 16 });

    // Ligne BAS : Boîte dédiée pour le loyer mensuel, strictement positionnée sous le nom
    const rentY = y + 16 + propTextH + 5;
    const rentVal = rentAmountVal ? fmtMoney(rentAmountVal) : '—';
    doc.rect(col2X + 6, rentY, colW - 12, 15).fill('#ffffff');
    doc.rect(col2X + 6, rentY, colW - 12, 15).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.fontSize(7.5).fillColor(COLORS.muted).font('Helvetica')
      .text('Loyer mensuel :', col2X + 10, rentY + 4)
      .fillColor(COLORS.primary).font('Helvetica-Bold')
      .text(rentVal, col2X + 10, rentY + 4, { width: colW - 24, align: 'right' });

    y += cardH + 6;

    // ===== TABLEAU FINANCIER =====
    const tblHdrH = 15;
    const rowH = 14;

    doc.rect(36, y, contentW, tblHdrH).fill(COLORS.primary);
    doc.fontSize(7.5).fillColor(COLORS.white).font('Helvetica-Bold')
      .text('DÉSIGNATION', 44, y + 4, { width: contentW - 140 })
      .text('MONTANT (FCFA)', pageW - 160, y + 4, { width: 120, align: 'right' });
    y += tblHdrH;

    // Ligne 1 : Paiement effectué
    const methodLabel = PAYMENT_LABELS[r.payment_method] || cleanText(r.payment_method || 'Espèces');
    doc.rect(36, y, contentW, rowH).fill(COLORS.white);
    doc.fontSize(8).fillColor(COLORS.text).font('Helvetica')
      .text(`Paiement effectué (${methodLabel})`, 44, y + 3, { width: contentW - 140 });
    doc.fontSize(8.5).fillColor(COLORS.success).font('Helvetica-Bold')
      .text(fmtMoney(r.amount, false), pageW - 160, y + 3, { width: 120, align: 'right' });
    doc.moveTo(36, y + rowH).lineTo(pageW - 36, y + rowH).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    y += rowH;

    // Ligne 2 : Reste à payer si dette
    if (hasDebt) {
      doc.rect(36, y, contentW, rowH).fill(COLORS.white);
      doc.fontSize(8).fillColor(COLORS.text).font('Helvetica')
        .text('Reste à payer (Arriérés)', 44, y + 3, { width: contentW - 140 });
      doc.fontSize(8.5).fillColor(COLORS.accent).font('Helvetica-Bold')
        .text(fmtMoney(remaining, false), pageW - 160, y + 3, { width: 120, align: 'right' });
      doc.moveTo(36, y + rowH).lineTo(pageW - 36, y + rowH).strokeColor(COLORS.border).lineWidth(0.5).stroke();
      y += rowH;
    }

    // Ligne TOTAL / STATUT
    doc.rect(36, y, contentW, rowH + 2).fill(COLORS.secondary);
    doc.moveTo(36, y).lineTo(pageW - 36, y).strokeColor(COLORS.primary).lineWidth(1.2).stroke();
    doc.fontSize(8).fillColor(COLORS.primary).font('Helvetica-Bold')
      .text('STATUT DU COMPTE', 44, y + 4);

    let statutBadge = 'À jour';
    let statutColor = COLORS.success;
    if (coverage.isOverdue) {
      statutBadge = cleanText(coverage.statusText);
      statutColor = COLORS.accent;
    } else if (hasDebt) {
      statutBadge = cleanText(coverage.statusText || 'Dette restante');
      statutColor = COLORS.accent;
    }

    doc.fontSize(8).fillColor(statutColor).font('Helvetica-Bold')
      .text(statutBadge, pageW - 280, y + 4, { width: 240, align: 'right' });
    y += rowH + 6;

    // ===== INFORMATIONS PAIEMENT & OBSERVATIONS =====
    const payInfoH = 24;
    doc.rect(36, y, contentW, payInfoH).fill('#fff8e7');
    doc.rect(36, y, 3, payInfoH).fill('#f1c40f');

    doc.fontSize(7.5).fillColor('#856404').font('Helvetica')
      .text(`Mode de paiement : ${methodLabel}   |   Date de règlement : ${fmtDate(r.payment_date)}`, 44, y + 4, { width: contentW - 20 });

    if (r.observations) {
      doc.text(`Observations : ${cleanText(r.observations)}`, 44, y + 13, { width: contentW - 20 });
    }
    y += payInfoH + 4;

    // ===== ESPACE SIGNATURE MANUELLE =====
    // La signature et le cachet sont apposés manuellement sur le document imprimé
    const sigBoxW = 200;
    const sigBoxH = 52;
    const sigX = pageW - 36 - sigBoxW;
    const sigY = y;

    // Cadre espace signature vide (pour tampon et signature manuscrite)
    doc.roundedRect(sigX, sigY, sigBoxW, sigBoxH, 4).strokeColor(COLORS.border).lineWidth(1).stroke();
    doc.fontSize(7.5).fillColor(COLORS.muted).font('Helvetica-Bold')
      .text('Signature & Cachet de l\'Agence', sigX + 4, sigY + 5, { width: sigBoxW - 8, align: 'center' });
    // Ligne signature
    doc.moveTo(sigX + 10, sigY + 40).lineTo(sigX + sigBoxW - 10, sigY + 40)
      .strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.fontSize(6.5).fillColor(COLORS.muted).font('Helvetica')
      .text('Le Gestionnaire / Le Comptable', sigX + 4, sigY + 43, { width: sigBoxW - 8, align: 'center' });

    // ===== PIED DE PAGE =====
    const footY = doc.page.height - 30;
    doc.moveTo(36, footY).lineTo(pageW - 36, footY).strokeColor(COLORS.primary).lineWidth(1).stroke();

    doc.fontSize(7).fillColor(COLORS.text).font('Helvetica-Bold')
      .text(cleanText(settings.name), 36, footY + 4, { width: 200 });
    doc.fontSize(6.5).fillColor(COLORS.muted).font('Helvetica')
      .text(cleanText(settings.address), 36, footY + 12, { width: 250 });

    doc.fontSize(6.5).fillColor(COLORS.muted).font('Helvetica')
      .text('Document officiel certifié émis par SMG IMMOBILIER — Signature et cachet valables et opposables', pageW - 360, footY + 6, { width: 324, align: 'right' });

    return new Promise((resolve) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        logger.info('📄 PDF Reçu officiel (21x14.85) généré', { receipt: r.receipt_number, size: buffer.length });
        resolve(buffer);
      });
      doc.end();
    });
  }
}

module.exports = new ReceiptPdfService();
