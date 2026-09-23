// ============ Service PDF Rapport de Chantier — SMG IMMOBILIER (Optimisé) ============
const PDFDocument = require('pdfkit');
const { logger } = require('../config/logger');
const { cleanText, fmtMoney, fmtDate, drawCompanyHeader } = require('../utils/pdf-helpers');
const companyService = require('./company-settings.service');

const COLORS = {
  primary: '#1a3a5c',
  secondary: '#f0f4f8',
  accent: '#c0392b',
  text: '#212529',
  muted: '#555555',
  success: '#166534',
  danger: '#991b1b',
  warning: '#b45309',
  white: '#ffffff',
  border: '#cbd5e1',
  cardBg: '#f8fafc',
  rowAlt: '#f8fafc',
};

class WorksitePdfService {
  async generate(worksite) {
    const ws = worksite.toJSON ? worksite.toJSON() : worksite;
    const settings = companyService.getSettings();
    const primaryColor = settings.primary_color || COLORS.primary;

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 20, bottom: 0, left: 36, right: 36 },
      bufferPages: true,
      info: {
        Title: `Rapport de Chantier — ${cleanText(ws.title)}`,
        Author: cleanText(settings.name || 'SMG IMMOBILIER'),
        Creator: 'SMG IMMOBILIER Worksite Management',
      },
    });

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));

    const pageW = doc.page.width;
    const contentW = pageW - 72;
    const bottomLimit = doc.page.height - 28;

    const checkPage = (needed) => {
      if (doc.y + needed > bottomLimit) {
        doc.addPage();
        this._subHeader(doc, ws.title, primaryColor);
        return true;
      }
      return false;
    };

    // En-tête officiel avec logo
    drawCompanyHeader(doc, {
      title: 'RAPPORT DE CHANTIER & TRAVAUX',
      subtitle: cleanText(ws.title),
    });

    // Bandeau contextuel projet
    const typeLabel = ws.worksite_type === 'interne' ? 'Chantier Interne (Patrimoine géré)' : 'Chantier Externe (Client tiers)';
    const contextText = ws.worksite_type === 'interne'
      ? `Immeuble : ${cleanText(ws.property ? ws.property.property_name : '—')} (${cleanText(ws.location || '—')})`
      : `Client : ${cleanText(ws.client_name || '—')} (Tél: ${cleanText(ws.client_phone || '—')}) | Lieu : ${cleanText(ws.location || '—')}`;

    doc.rect(36, doc.y, contentW, 28).fill(COLORS.secondary).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.fontSize(7.5).fillColor(primaryColor).font('Helvetica-Bold')
      .text(`Projet : ${cleanText(ws.title)} [${typeLabel}]`, 42, doc.y + 6, { width: contentW - 12, lineBreak: false });
    doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica')
      .text(contextText, 42, doc.y + 16, { width: contentW - 12, lineBreak: false });
    doc.y += 32;

    // 1. Synthèse & Avancement
    this._sectionTitle(doc, '1. ÉTAT D\'AVANCEMENT ET PLANNING', primaryColor);

    const kpiW = (contentW - 12) / 3;
    const kpiH = 34;
    const row1Y = doc.y;

    const statusLabels = { planned: 'Planifié', in_progress: 'En cours', on_hold: 'En pause', completed: 'Terminé', cancelled: 'Annulé' };
    this._kpiBox(doc, 36, row1Y, kpiW, kpiH, 'STATUT DU PROJET', statusLabels[ws.status] || ws.status, primaryColor);
    this._kpiBox(doc, 36 + kpiW + 6, row1Y, kpiW, kpiH, 'AVANCEMENT GLOBAL', `${ws.progress_percent || 0}%`, ws.progress_percent >= 100 ? COLORS.success : COLORS.warning);
    this._kpiBox(doc, 36 + (kpiW + 6) * 2, row1Y, kpiW, kpiH, 'RESPONSABLE DU SUIVI', cleanText(ws.manager ? ws.manager.full_name : '—'), COLORS.text);

    doc.y = row1Y + kpiH + 6;
    doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica')
      .text(`Dates projet : Début = ${fmtDate(ws.start_date)}  |  Fin estimée = ${fmtDate(ws.end_date_estimated)}  |  Fin réelle = ${fmtDate(ws.end_date_actual)}`, 36, doc.y, { lineBreak: false });
    doc.y += 12;

    // 2. Synthèse Financière
    checkPage(24);
    this._sectionTitle(doc, '2. BILAN FINANCIER DU CHANTIER', primaryColor);

    const budget = parseFloat(ws.budget) || 0;
    const spent = parseFloat(ws.spent_amount) || 0;
    const variance = budget - spent;

    const row2Y = doc.y;
    this._kpiBox(doc, 36, row2Y, kpiW, kpiH, 'BUDGET TOTAL ALLOUÉ', fmtMoney(budget), primaryColor);
    this._kpiBox(doc, 36 + kpiW + 6, row2Y, kpiW, kpiH, 'TOTAL DÉPENSÉ RÉEL', fmtMoney(spent), spent > budget ? COLORS.danger : primaryColor);
    this._kpiBox(doc, 36 + (kpiW + 6) * 2, row2Y, kpiW, kpiH, 'SOLDE DU BUDGET', fmtMoney(variance), variance >= 0 ? COLORS.success : COLORS.danger);

    doc.y = row2Y + kpiH + 6;
    doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica')
      .text(`Ventilation des coûts : Matériaux = ${fmtMoney(ws.material_cost)}  |  Main d'œuvre = ${fmtMoney(ws.labor_cost)}  |  Autres = ${fmtMoney(ws.other_cost)}`, 36, doc.y, { lineBreak: false });
    doc.y += 12;

    // 3. Jalons & Tâches
    checkPage(24);
    this._sectionTitle(doc, `3. JALONS ET TÂCHES TECHNIQUES (${(ws.tasks || []).length})`, primaryColor);

    if (!ws.tasks || !ws.tasks.length) {
      doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica-Oblique').text('Aucune tâche enregistrée.', 36, doc.y);
      doc.y += 10;
    } else {
      const taskHeaders = ['Tâche / Jalon', 'Assigné à', 'Début', 'Échéance', 'Progression', 'Statut'];
      const taskWidths = [190, 110, 60, 60, 55, 48]; // Total = 523 pt
      const taskRows = ws.tasks.map((t) => [
        cleanText(t.title),
        cleanText(t.assignee ? t.assignee.full_name : '—'),
        fmtDate(t.start_date),
        fmtDate(t.end_date),
        `${t.progress_percent || 0}%`,
        cleanText(t.status),
      ]);
      this._table(doc, { headers: taskHeaders, widths: taskWidths, rows: taskRows, checkPage, primaryColor });
    }

    // 4. Matériaux consommés
    checkPage(24);
    this._sectionTitle(doc, `4. MATÉRIAUX ET CONSOMMABLES UTILISÉS (Total : ${fmtMoney(ws.material_cost)})`, primaryColor);

    if (!ws.materialsUsed || !ws.materialsUsed.length) {
      doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica-Oblique').text('Aucun matériau enregistré depuis le stock.', 36, doc.y);
      doc.y += 10;
    } else {
      const matHeaders = ['Code', 'Désignation', 'Catégorie', 'Qté', 'Coût Unitaire', 'Coût Total', 'Date'];
      const matWidths = [50, 150, 85, 50, 68, 70, 50]; // Total = 523 pt
      const matRows = ws.materialsUsed.map((m) => [
        cleanText(m.stockItem ? m.stockItem.item_code : '—'),
        cleanText(m.stockItem ? m.stockItem.name : '—'),
        cleanText(m.stockItem ? m.stockItem.category : '—'),
        `${m.quantity_used} ${cleanText(m.stockItem ? m.stockItem.unit : '')}`,
        fmtMoney(m.unit_cost),
        fmtMoney(m.total_cost),
        fmtDate(m.date_used),
      ]);
      this._table(doc, { headers: matHeaders, widths: matWidths, rows: matRows, checkPage, primaryColor, alignRightCols: [4, 5] });
    }

    // Footers sur toutes les pages
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const b = doc.page.height - 22;
      doc.moveTo(36, b - 4).lineTo(pageW - 36, b - 4).strokeColor(COLORS.border).lineWidth(0.4).stroke();
      doc.fontSize(6.5).fillColor(COLORS.muted).font('Helvetica')
        .text(`SMG IMMOBILIER — Document Officiel de Suivi de Chantier`, 36, b, { width: contentW / 2, lineBreak: false })
        .text(`Page ${i + 1} sur ${totalPages}`, pageW - 120, b, { width: 84, align: 'right', lineBreak: false });
    }

    return new Promise((resolve) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        logger.info('📄 PDF Rapport de chantier généré', { title: ws.title, pages: totalPages, size: buffer.length });
        resolve(buffer);
      });
      doc.end();
    });
  }

  _sectionTitle(doc, title, primaryColor) {
    doc.fontSize(8.5).fillColor(primaryColor).font('Helvetica-Bold').text(title, 36, doc.y);
    doc.moveDown(0.2);
    const y = doc.y;
    doc.moveTo(36, y).lineTo(doc.page.width - 36, y).strokeColor(primaryColor).lineWidth(0.8).stroke();
    doc.y = y + 5;
  }

  _kpiBox(doc, x, y, w, h, label, value, valColor) {
    doc.rect(x, y, w, h).fill(COLORS.cardBg);
    doc.rect(x, y, w, h).strokeColor(COLORS.border).lineWidth(0.4).stroke();
    doc.fontSize(5.5).fillColor(COLORS.muted).font('Helvetica-Bold')
      .text(label, x + 5, y + 4, { width: w - 10, lineBreak: false });
    doc.fontSize(9).fillColor(valColor).font('Helvetica-Bold')
      .text(cleanText(value), x + 5, y + 15, { width: w - 10, lineBreak: false });
  }

  _table(doc, { headers, widths, rows, checkPage, primaryColor, alignRightCols = [] }) {
    const startX = 36;
    const totalW = widths.reduce((s, w) => s + w, 0);
    const hHeight = 15;
    const rHeight = 12.5;

    const drawHeader = () => {
      const headerY = doc.y;
      doc.rect(startX, headerY, totalW, hHeight).fill(primaryColor);
      let x = startX;
      headers.forEach((h, i) => {
        const isRight = alignRightCols.includes(i);
        doc.fontSize(6).fillColor(COLORS.white).font('Helvetica-Bold')
          .text(cleanText(h), x + 3, headerY + 4, { width: widths[i] - 6, align: isRight ? 'right' : 'left', lineBreak: false });
        x += widths[i];
      });
      doc.y = headerY + hHeight;
    };

    drawHeader();

    rows.forEach((row, idx) => {
      const pageAdded = checkPage(rHeight + 2);
      if (pageAdded) drawHeader();

      const rowY = doc.y;
      if (idx % 2 === 1) doc.rect(startX, rowY, totalW, rHeight).fill(COLORS.rowAlt);
      doc.moveTo(startX, rowY + rHeight).lineTo(startX + totalW, rowY + rHeight)
        .strokeColor(COLORS.border).lineWidth(0.3).stroke();

      let x = startX;
      row.forEach((val, i) => {
        const isRight = alignRightCols.includes(i);
        doc.fontSize(6).fillColor(COLORS.text).font('Helvetica')
          .text(cleanText(String(val || '—')), x + 3, rowY + 3, { width: widths[i] - 6, align: isRight ? 'right' : 'left', lineBreak: false });
        x += widths[i];
      });
      doc.y = rowY + rHeight;
    });
    doc.y += 6;
  }

  _subHeader(doc, title, primaryColor) {
    doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica')
      .text(`SMG IMMOBILIER — Chantier : ${cleanText(title)}`, 36, 18, { lineBreak: false });
    doc.moveTo(36, 27).lineTo(doc.page.width - 36, 27).strokeColor(COLORS.border).lineWidth(0.4).stroke();
    doc.y = 32;
  }
}

module.exports = new WorksitePdfService();
