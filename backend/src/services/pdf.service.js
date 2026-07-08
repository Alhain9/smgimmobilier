// ============ Service d'export PDF — PDFKit ============
const PDFDocument = require('pdfkit');
const { logger } = require('../config/logger');

// Couleurs du thème
const COLORS = {
  primary: '#1E3A5F',
  secondary: '#2E5E8E',
  accent: '#3498DB',
  text: '#333333',
  muted: '#666666',
  light: '#F5F7FA',
  border: '#E0E0E0',
  success: '#27AE60',
  danger: '#E74C3C',
  white: '#FFFFFF',
};

class PdfService {
  /**
   * Crée un document PDF avec en-tête IMSM.
   * @param {object} options - { title, subtitle, landscape }
   * @returns {{ doc: PDFDocument, finalize: () => Promise<Buffer> }}
   */
  createDocument({ title, subtitle, landscape = false } = {}) {
    const doc = new PDFDocument({
      size: 'A4',
      layout: landscape ? 'landscape' : 'portrait',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
      info: {
        Title: title || 'Rapport IMSM',
        Author: 'IMSM - Gestion Immobilière',
        Creator: 'IMSM PDFKit',
      },
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    // En-tête
    this._header(doc, title, subtitle);

    const finalize = () => new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      // Pied de page sur toutes les pages
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        this._footer(doc, i + 1, range.count);
      }
      doc.end();
    });

    return { doc, finalize };
  }

  _header(doc, title, subtitle) {
    // Barre colorée en haut
    doc.rect(0, 0, doc.page.width, 8).fill(COLORS.primary);

    // Logo texte
    doc.fontSize(22).fillColor(COLORS.primary).font('Helvetica-Bold')
      .text('IMSM', 50, 25, { continued: true })
      .fillColor(COLORS.accent).text(' IMMOBILIER');

    if (title) {
      doc.moveDown(0.5);
      doc.fontSize(16).fillColor(COLORS.primary).font('Helvetica-Bold').text(title);
    }
    if (subtitle) {
      doc.fontSize(10).fillColor(COLORS.muted).font('Helvetica').text(subtitle);
    }

    // Date
    doc.fontSize(9).fillColor(COLORS.muted).font('Helvetica')
      .text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, { align: 'right' });

    // Ligne séparatrice
    doc.moveDown(0.5);
    const y = doc.y;
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor(COLORS.border).lineWidth(1).stroke();
    doc.moveDown(0.5);
  }

  _footer(doc, pageNum, totalPages) {
    const bottom = doc.page.height - 35;
    doc.fontSize(8).fillColor(COLORS.muted).font('Helvetica')
      .text(`IMSM — Gestion Immobilière`, 50, bottom, { align: 'left' })
      .text(`Page ${pageNum} / ${totalPages}`, 50, bottom, { align: 'right', width: doc.page.width - 100 });
  }

  /**
   * Dessine un tableau dans le PDF.
   */
  drawTable(doc, { headers, rows, columnWidths, startY }) {
    const startX = 50;
    const rowHeight = 22;
    const headerHeight = 28;
    let y = startY || doc.y;
    const totalWidth = columnWidths.reduce((s, w) => s + w, 0);

    // En-tête du tableau
    doc.rect(startX, y, totalWidth, headerHeight).fill(COLORS.primary);
    let x = startX;
    headers.forEach((h, i) => {
      doc.fontSize(9).fillColor(COLORS.white).font('Helvetica-Bold')
        .text(h, x + 4, y + 8, { width: columnWidths[i] - 8, align: 'left' });
      x += columnWidths[i];
    });
    y += headerHeight;

    // Lignes de données
    rows.forEach((row, idx) => {
      // Nouvelle page si nécessaire
      if (y + rowHeight > doc.page.height - 60) {
        doc.addPage();
        y = 50;
        // Redessiner l'en-tête du tableau
        doc.rect(startX, y, totalWidth, headerHeight).fill(COLORS.primary);
        let hx = startX;
        headers.forEach((h, i) => {
          doc.fontSize(9).fillColor(COLORS.white).font('Helvetica-Bold')
            .text(h, hx + 4, y + 8, { width: columnWidths[i] - 8, align: 'left' });
          hx += columnWidths[i];
        });
        y += headerHeight;
      }

      // Fond alterné
      if (idx % 2 === 1) {
        doc.rect(startX, y, totalWidth, rowHeight).fill(COLORS.light);
      }

      // Bordure basse
      doc.moveTo(startX, y + rowHeight).lineTo(startX + totalWidth, y + rowHeight)
        .strokeColor(COLORS.border).lineWidth(0.5).stroke();

      // Cellules
      x = startX;
      const values = Array.isArray(row) ? row : Object.values(row);
      values.forEach((val, i) => {
        const cellVal = val != null ? String(val) : '—';
        doc.fontSize(8).fillColor(COLORS.text).font('Helvetica')
          .text(cellVal, x + 4, y + 6, { width: columnWidths[i] - 8, align: 'left' });
        x += columnWidths[i];
      });
      y += rowHeight;
    });

    doc.y = y + 10;
    return y;
  }

  /**
   * Envoie le PDF en réponse HTTP.
   */
  async sendResponse(res, buffer, filename) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
    logger.info('📄 Export PDF envoyé', { filename });
  }

  // ===== Rapports prédéfinis =====

  /**
   * Situation d'un immeuble → PDF
   */
  async situationImmeublePdf(data) {
    const { doc, finalize } = this.createDocument({
      title: `Situation — ${data.immeuble}`,
      subtitle: `Rapport de situation de l'immeuble`,
    });

    const headers = ['N°', 'Locataire', 'Tél', 'Loyer', 'Arriéré', 'Dette', 'Anticip.', 'Vers. mois', 'Obs.'];
    const widths = [35, 80, 65, 55, 55, 55, 55, 60, 80];
    const rows = data.lignes.map((l) => [
      l.numero_chambre, l.nom_locataire || '—', l.telephone || '',
      this._fmtMoney(l.montant_loyer), this._fmtMoney(l.arriere_loyer),
      this._fmtMoney(l.dette), this._fmtMoney(l.anticipation),
      this._fmtMoney(l.versement_mois), l.observations || '',
    ]);

    this.drawTable(doc, { headers, rows, columnWidths: widths });

    // Totaux
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold')
      .text(`Total loyers : ${this._fmtMoney(data.total.montant_loyer)} FCFA`)
      .text(`Total dette : ${this._fmtMoney(data.total.dette)} FCFA`)
      .text(`Total versements du mois : ${this._fmtMoney(data.total.versement_mois)} FCFA`);

    return finalize();
  }

  /**
   * Quittance de loyer → PDF
   */
  async quittancePdf(payment, tenant, apartment, property) {
    const { doc, finalize } = this.createDocument({
      title: 'Quittance de Loyer',
      subtitle: `N° ${payment.reference || payment.id}`,
    });

    doc.moveDown(1);

    // Informations
    doc.fontSize(12).fillColor(COLORS.text).font('Helvetica-Bold').text('Bailleur :');
    doc.fontSize(10).font('Helvetica').text(`${property?.property_name || 'IMSM'}`);
    doc.moveDown(0.5);

    doc.fontSize(12).font('Helvetica-Bold').text('Locataire :');
    doc.fontSize(10).font('Helvetica')
      .text(`Nom : ${tenant?.user?.full_name || tenant?.full_name || '—'}`)
      .text(`Logement : ${apartment?.apartment_number || '—'}`)
      .text(`Immeuble : ${property?.property_name || '—'}`);
    doc.moveDown(0.5);

    doc.fontSize(12).font('Helvetica-Bold').text('Détails du paiement :');
    doc.fontSize(10).font('Helvetica')
      .text(`Montant : ${this._fmtMoney(payment.amount)} FCFA`)
      .text(`Date : ${payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('fr-FR') : '—'}`)
      .text(`Mode : ${payment.payment_method || '—'}`)
      .text(`Référence : ${payment.reference || payment.campay_reference || '—'}`)
      .text(`Période : ${payment.period_month || '?'}/${payment.period_year || '?'}`);

    doc.moveDown(1.5);
    doc.fontSize(11).fillColor(COLORS.success).font('Helvetica-Bold')
      .text('Le bailleur reconnaît avoir reçu le montant ci-dessus au titre du loyer.', { align: 'center' });

    doc.moveDown(2);
    doc.fontSize(10).fillColor(COLORS.muted).font('Helvetica')
      .text('Signature du bailleur', 100, doc.y, { width: 200, align: 'center' })
      .text('Signature du locataire', 350, doc.y - 12, { width: 200, align: 'center' });

    return finalize();
  }

  _fmtMoney(val) {
    const n = parseFloat(val) || 0;
    return n.toLocaleString('fr-FR');
  }
}

module.exports = new PdfService();
