// ============ Service d'export PDF — SMG IMMOBILIER (PDFKit Optimisé) ============
const PDFDocument = require('pdfkit');
const { logger } = require('../config/logger');
const { cleanText, fmtMoney, fmtDate, drawCompanyHeader } = require('../utils/pdf-helpers');
const companyService = require('./company-settings.service');

// Couleurs du thème officiel SMG
const COLORS = {
  primary: '#1a3a5c',
  secondary: '#2E5E8E',
  accent: '#c0392b',
  text: '#222222',
  muted: '#555555',
  light: '#f8fafc',
  border: '#cbd5e1',
  success: '#166534',
  danger: '#991b1b',
  white: '#FFFFFF',
  rowAlt: '#f8fafc',
};

class PdfService {
  /**
   * Crée un document PDF optimisé avec marges contrôlées pour éliminer toute page vide.
   * @param {object} options - { title, subtitle, landscape }
   * @returns {{ doc: PDFDocument, finalize: () => Promise<Buffer> }}
   */
  createDocument({ title, subtitle, landscape = false } = {}) {
    const settings = companyService.getSettings();
    const primaryColor = settings.primary_color || COLORS.primary;

    const doc = new PDFDocument({
      size: 'A4',
      layout: landscape ? 'landscape' : 'portrait',
      margins: { top: 20, bottom: 0, left: 36, right: 36 },
      bufferPages: true,
      info: {
        Title: title || 'Document Officiel SMG IMMOBILIER',
        Author: cleanText(settings.name || 'SMG IMMOBILIER'),
        Creator: 'SMG IMMOBILIER Platform',
      },
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    // En-tête officiel avec logo
    drawCompanyHeader(doc, {
      title: title || '',
      subtitle: subtitle || '',
    });

    const finalize = () => new Promise((resolve) => {
      const range = doc.bufferedPageRange();
      const totalPages = range.count;

      for (let i = range.start; i < range.start + totalPages; i++) {
        doc.switchToPage(i);
        this._footer(doc, i + 1, totalPages, settings);
      }

      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.end();
    });

    return { doc, finalize };
  }

  _footer(doc, pageNum, totalPages, settings) {
    const pageW = doc.page.width;
    const bottom = doc.page.height - 22;

    doc.moveTo(36, bottom - 4).lineTo(pageW - 36, bottom - 4).strokeColor(COLORS.border).lineWidth(0.4).stroke();

    const companyName = cleanText(settings?.name || 'SMG IMMOBILIER');
    const contacts = cleanText(settings?.phone || '+237 6 699 03 07 71, 670 56 16 12');
    const email = cleanText(settings?.email || 'smgimmobilier.infos@gmail.com');

    doc.fontSize(6.5).fillColor(COLORS.muted).font('Helvetica')
      .text(`${companyName} • ${contacts} • ${email}`, 36, bottom, { width: pageW - 160, lineBreak: false })
      .text(`Page ${pageNum} sur ${totalPages}`, pageW - 120, bottom, { width: 84, align: 'right', lineBreak: false });
  }

  /**
   * Dessine un tableau ultra-dense et protégé contre les sauts de page orphelins.
   */
  drawTable(doc, { headers, rows, columnWidths, startY, alignRightCols = [] }) {
    const startX = 36;
    const pageW = doc.page.width;
    const totalWidth = columnWidths ? columnWidths.reduce((s, w) => s + w, 0) : (pageW - 72);
    const widths = columnWidths || headers.map(() => totalWidth / headers.length);
    const rowHeight = 13.5;
    const headerHeight = 16;
    const bottomLimit = doc.page.height - 30;

    let y = startY || doc.y;

    const checkBreak = (needed) => {
      if (y + needed > bottomLimit) {
        doc.addPage();
        y = 26;
        drawHead();
        return true;
      }
      return false;
    };

    const drawHead = () => {
      doc.rect(startX, y, totalWidth, headerHeight).fill(COLORS.primary);
      let x = startX;
      headers.forEach((h, i) => {
        const isRight = alignRightCols.includes(i);
        doc.fontSize(6.5).fillColor(COLORS.white).font('Helvetica-Bold')
          .text(cleanText(h), x + 3, y + 4.5, { width: widths[i] - 6, align: isRight ? 'right' : 'left', lineBreak: false });
        x += widths[i];
      });
      y += headerHeight;
    };

    drawHead();

    rows.forEach((row, idx) => {
      checkBreak(rowHeight + 2);

      const rowY = y;
      if (idx % 2 === 1) {
        doc.rect(startX, rowY, totalWidth, rowHeight).fill(COLORS.rowAlt);
      }
      doc.moveTo(startX, rowY + rowHeight).lineTo(startX + totalWidth, rowY + rowHeight)
        .strokeColor(COLORS.border).lineWidth(0.3).stroke();

      let x = startX;
      const values = Array.isArray(row) ? row : Object.values(row);
      values.forEach((val, i) => {
        const isRight = alignRightCols.includes(i);
        const cellVal = cleanText(val != null ? String(val) : '—');
        doc.fontSize(6.5).fillColor(COLORS.text).font('Helvetica')
          .text(cellVal, x + 3, rowY + 3.5, { width: widths[i] - 6, align: isRight ? 'right' : 'left', lineBreak: false });
        x += widths[i];
      });
      y = rowY + rowHeight;
    });

    doc.y = y + 6;
    return doc.y;
  }

  /**
   * Envoie le PDF en réponse HTTP.
   */
  async sendResponse(res, buffer, filename) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
    logger.info('📄 Export PDF envoyé', { filename, size: buffer.length });
  }

  // ===== Rapports prédéfinis =====

  /**
   * Situation d'un immeuble → PDF optimisé
   */
  async situationImmeublePdf(data) {
    const { doc, finalize } = this.createDocument({
      title: `Situation — ${data.immeuble || 'Immeuble'}`,
      subtitle: `Rapport d'occupation et financier`,
      landscape: true,
    });

    const headers = ['N°', 'Locataire', 'Tél', 'Loyer', 'Arriéré', 'Dette', 'Anticip.', 'Vers. mois', 'Observations'];
    const widths = [40, 140, 85, 75, 75, 75, 75, 85, 120]; // Total = 770 pt (paysage)
    const rows = (data.lignes || []).map((l) => [
      l.numero_chambre,
      l.nom_locataire || '—',
      l.telephone || '',
      fmtMoney(l.montant_loyer),
      fmtMoney(l.arriere_loyer),
      fmtMoney(l.dette),
      fmtMoney(l.anticipation),
      fmtMoney(l.versement_mois),
      l.observations || '',
    ]);

    this.drawTable(doc, { headers, rows, columnWidths: widths, alignRightCols: [3, 4, 5, 6, 7] });

    // Totaux
    if (data.total) {
      doc.y += 4;
      const totalText = `Total loyers : ${fmtMoney(data.total.montant_loyer)}  |  Total dette : ${fmtMoney(data.total.dette)}  |  Total versements du mois : ${fmtMoney(data.total.versement_mois)}`;
      doc.rect(36, doc.y, doc.page.width - 72, 18).fill('#e0f2fe');
      doc.fontSize(8).fillColor(COLORS.primary).font('Helvetica-Bold')
        .text(totalText, 42, doc.y + 5, { width: doc.page.width - 84, align: 'center', lineBreak: false });
    }

    return finalize();
  }

  /**
   * Quittance de loyer → PDF compact et officiel (1 page stricte)
   */
  async quittancePdf(payment, tenant, apartment, property) {
    const { doc, finalize } = this.createDocument({
      title: 'QUITTANCE DE LOYER',
      subtitle: `Réf : ${cleanText(payment.reference || payment.id)}`,
    });

    const pageW = doc.page.width;
    const contentW = pageW - 72;

    doc.y += 8;

    // Encadré informations Bailleur / Locataire
    const cardY = doc.y;
    const colW = (contentW - 12) / 2;

    doc.rect(36, cardY, colW, 70).fill(COLORS.light).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor(COLORS.primary).font('Helvetica-Bold').text('BAILLEUR / GESTIONNAIRE', 44, cardY + 8);
    doc.fontSize(7.5).fillColor(COLORS.text).font('Helvetica')
      .text(cleanText(property?.property_name || 'SMG IMMOBILIER'), 44, cardY + 22)
      .text(`Adresse : ${cleanText(property?.address || 'Yaoundé & Douala, Cameroun')}`, 44, cardY + 34)
      .text('Tél : +237 6 699 03 07 71', 44, cardY + 46);

    doc.rect(36 + colW + 12, cardY, colW, 70).fill(COLORS.light).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor(COLORS.primary).font('Helvetica-Bold').text('LOCATAIRE', 44 + colW + 12, cardY + 8);
    doc.fontSize(7.5).fillColor(COLORS.text).font('Helvetica')
      .text(`Nom : ${cleanText(tenant?.user?.full_name || tenant?.full_name || '—')}`, 44 + colW + 12, cardY + 22)
      .text(`Logement : ${cleanText(apartment?.apartment_number || '—')} (${cleanText(property?.property_name || '—')})`, 44 + colW + 12, cardY + 34)
      .text(`Contact : ${cleanText(tenant?.user?.phone || tenant?.phone || '—')}`, 44 + colW + 12, cardY + 46);

    doc.y = cardY + 80;

    // Détail du règlement
    const tableHeaders = ['Désignation', 'Date', 'Mode', 'Référence', 'Montant'];
    const tableWidths = [180, 80, 80, 95, 88];
    const tableRows = [[
      `Loyer logement ${cleanText(apartment?.apartment_number)} (Période : ${payment.period_month || '?'}/${payment.period_year || '?'})`,
      fmtDate(payment.payment_date),
      cleanText(payment.payment_method || 'Espèces'),
      cleanText(payment.reference || payment.campay_reference || '—'),
      fmtMoney(payment.amount),
    ]];

    this.drawTable(doc, { headers: tableHeaders, rows: tableRows, columnWidths: tableWidths, alignRightCols: [4] });

    // Mention légale de quittance
    doc.y += 10;
    doc.rect(36, doc.y, contentW, 28).fill('#f0fdf4').strokeColor('#86efac').lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor(COLORS.success).font('Helvetica-Bold')
      .text('Le bailleur soussigné donne quittance au locataire pour la somme ci-dessus indiquée, libérant ce dernier du loyer mentionné.', 44, doc.y + 8, { width: contentW - 16, align: 'center' });

    doc.y += 42;

    // Signatures
    const sigY = doc.y;
    doc.fontSize(8).fillColor(COLORS.muted).font('Helvetica-Bold')
      .text('Pour le Bailleur (Visa & Cachet)', 60, sigY, { width: 180, align: 'center' })
      .text('Pour le Locataire (Signature)', pageW - 240, sigY, { width: 180, align: 'center' });

    doc.moveTo(60, sigY + 45).lineTo(240, sigY + 45).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.moveTo(pageW - 240, sigY + 45).lineTo(pageW - 60, sigY + 45).strokeColor(COLORS.border).lineWidth(0.5).stroke();

    return finalize();
  }
}

module.exports = new PdfService();
