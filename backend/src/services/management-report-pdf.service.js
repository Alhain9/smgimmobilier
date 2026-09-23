// ============ Service PDF Rapports de Gestion Immobilière — SMG IMMOBILIER ============
// Document exécutif haut de gamme, sans pages vides, parfaitement structuré en 6 parties :
// 1. Résumé financier (6 KPI)
// 2. Situation locative par logement (avec type, loyer, statut, locataire, téléphone, fin de bail)
// 3. Encaissements réalisés (date, locataire, logement, mode, reçu n°, montant)
// 4. Travaux et interventions techniques (nature, logement, technicien, statut, coût)
// 5. Dépenses détaillées (date, désignation, catégorie, affectation, qté, PU, total)
// 6. Bilan et résultat net de la période (total encaissé, total dépenses, résultat net + visa)
const PDFDocument = require('pdfkit');
const { logger } = require('../config/logger');
const { cleanText, fmtMoney, fmtDate, drawCompanyHeader } = require('../utils/pdf-helpers');
const companyService = require('./company-settings.service');

const COLORS = {
  primary: '#1a3a5c',
  secondary: '#f0f4f8',
  accent: '#c0392b',
  text: '#1f2937',
  muted: '#6b7280',
  success: '#15803d',
  danger: '#b91c1c',
  warning: '#b45309',
  white: '#ffffff',
  border: '#e5e7eb',
  cardBg: '#f9fafb',
  rowAlt: '#f8fafc',
};

class ManagementReportPdfService {
  /**
   * Génère le rapport de gestion officiel d'un immeuble
   */
  async generateBuildingReportPdf(reportData) {
    const settings = companyService.getSettings();
    const primaryColor = settings.primary_color || COLORS.primary;

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 20, bottom: 0, left: 36, right: 36 },
      bufferPages: true,
      info: {
        Title: `Rapport de Gestion — ${reportData.property?.property_name || 'Immeuble'}`,
        Author: cleanText(settings.name || 'SMG IMMOBILIER'),
        Subject: 'Rapport de Gestion Immobilière Périodique',
        Creator: 'SMG IMMOBILIER Platform',
      },
    });

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));

    const pageW = doc.page.width;       // 595.28 pt
    const pageH = doc.page.height;      // 841.89 pt
    const contentW = pageW - 72;        // 523.28 pt
    const bottomLimit = pageH - 26;     // 815.89 pt

    // Helper sécurisé de saut de page sans création de page vide
    const checkPage = (neededHeight) => {
      if (doc.y + neededHeight > bottomLimit) {
        doc.addPage();
        this._drawSubHeader(doc, reportData.property?.property_name, reportData.period, settings, primaryColor, pageW);
        return true;
      }
      return false;
    };

    // ================================================================
    // EN-TÊTE PRINCIPAL OFFICIEL AVEC LOGO (PAGE 1 UNIQUEMENT)
    // ================================================================
    let curY = drawCompanyHeader(doc);

    // BANDEAU OFFICIEL DU RAPPORT
    const bandH = 34;
    doc.rect(36, curY, contentW, bandH).fill(COLORS.secondary);
    doc.rect(36, curY, 4, bandH).fill(primaryColor);

    doc.fontSize(11).fillColor(primaryColor).font('Helvetica-Bold')
      .text('RAPPORT PÉRIODIQUE DE GESTION IMMOBILIÈRE', 46, curY + 4, { width: contentW - 20, align: 'center' });

    const propName = cleanText(reportData.property?.property_name || 'Immeuble');
    const propAddr = cleanText(reportData.property?.address || reportData.property?.city || 'Cameroun');
    const ownerName = cleanText(reportData.property?.owner?.full_name || 'Bailleur');

    doc.fontSize(7.5).fillColor(COLORS.text).font('Helvetica-Bold')
      .text(`Bien : ${propName} (${propAddr})   |   Propriétaire : ${ownerName}`, 46, curY + 18, { width: contentW - 20, align: 'center' });

    doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica')
      .text(`Période couverte : du ${fmtDate(reportData.period?.start)} au ${fmtDate(reportData.period?.end)} (${reportData.period?.months || 1} mois)  —  Généré le ${fmtDate(new Date())}`, 46, curY + 26, { width: contentW - 20, align: 'center' });

    doc.y = curY + bandH + 6;

    // ================================================================
    // PARTIE 1 : RÉSUMÉ FINANCIER (6 KPI PARFAITEMENT DÉTAILLÉS)
    // ================================================================
    this._drawSectionHeader(doc, '1. RÉSUMÉ FINANCIER DE LA PÉRIODE', primaryColor, contentW);
    const s = reportData.summary || {};

    const kpiW = (contentW - 8) / 3;
    const kpiH = 29;
    const kpiY1 = doc.y;

    this._drawKpiBox(doc, 36, kpiY1, kpiW, kpiH, 'LOYER THÉORIQUE ATTENDU', fmtMoney(s.theoretical_rent), primaryColor);
    this._drawKpiBox(doc, 36 + kpiW + 4, kpiY1, kpiW, kpiH, 'LOYER RÉELLEMENT ENCAISSÉ', fmtMoney(s.collected_rent), COLORS.success);
    this._drawKpiBox(doc, 36 + (kpiW + 4) * 2, kpiY1, kpiW, kpiH, 'RESTE À ENCAISSER (IMPAYÉS)', fmtMoney(s.remaining_to_collect), s.remaining_to_collect > 0 ? COLORS.danger : COLORS.muted);

    const kpiY2 = kpiY1 + kpiH + 3;
    this._drawKpiBox(doc, 36, kpiY2, kpiW, kpiH, 'DÉPENSES & MAINTENANCE', fmtMoney(s.total_expenses || s.maintenance_expenses), COLORS.accent);
    this._drawKpiBox(doc, 36 + kpiW + 4, kpiY2, kpiW, kpiH, "TAUX D'ENCAISSEMENT", `${s.collection_rate || 0}%`, (s.collection_rate || 0) >= 80 ? COLORS.success : COLORS.warning);
    this._drawKpiBox(doc, 36 + (kpiW + 4) * 2, kpiY2, kpiW, kpiH, 'RÉSULTAT NET DE GESTION', fmtMoney(s.net_result), (s.net_result || 0) >= 0 ? COLORS.success : COLORS.danger);

    doc.y = kpiY2 + kpiH + 6;

    // ================================================================
    // PARTIE 2 : SITUATION LOCATIVE PAR LOGEMENT
    // ================================================================
    const aptList = reportData.rental_situation?.apartments || reportData.apartments || [];
    const totalApts = aptList.length;
    const occupiedApts = aptList.filter((a) => a.status === 'occupied').length;
    const occRate = totalApts > 0 ? Math.round((occupiedApts / totalApts) * 100) : 0;

    checkPage(30);
    this._drawSectionHeader(doc, `2. SITUATION LOCATIVE PAR LOGEMENT (${occupiedApts}/${totalApts} occupés — ${occRate}%)`, primaryColor, contentW);

    const aptHeaders = ['Logement', 'Type / Description', 'Loyer/mois', 'Statut', 'Locataire', 'Téléphone', 'Fin de bail'];
    const aptWidths = [46, 82, 65, 48, 142, 75, 65]; // Total = 523 pt

    const aptRows = aptList.map((a) => {
      const isOcc = a.status === 'occupied';
      const statusLabel = isOcc ? 'Occupé' : (a.status === 'free' ? 'Libre' : cleanText(a.status || 'Libre'));
      const desc = cleanText(a.description || a.apartment_type || 'Logement');
      const tName = isOcc ? cleanText(a.tenant_name || 'Locataire') : '—';
      const tPhone = isOcc ? cleanText(a.tenant_phone || '—') : '—';
      const leaseEnd = isOcc ? fmtDate(a.lease_end) : '—';

      return [
        cleanText(a.apartment_number),
        desc,
        fmtMoney(a.rent_amount),
        statusLabel,
        tName,
        tPhone,
        leaseEnd,
      ];
    });

    if (!aptRows.length) {
      doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica-Oblique')
        .text('Aucun logement enregistré pour cet immeuble.', 40, doc.y);
      doc.y += 8;
    } else {
      this._renderDenseTable(doc, {
        headers: aptHeaders,
        widths: aptWidths,
        rows: aptRows,
        checkPage,
        primaryColor,
        alignRightCols: [2],
      });
    }

    // ================================================================
    // PARTIE 3 : ENCAISSEMENTS RÉALISÉS (SYNTHÈSE AGRÉGÉE PAR LOCATAIRE)
    // Fait le cumul ("le plus") des transactions multiples d'un même locataire
    // ================================================================
    const aggList = reportData.aggregated_collections || [];
    const txList = reportData.transactions || [];
    checkPage(30);
    this._drawSectionHeader(doc, `3. ENCAISSEMENTS RÉALISÉS (${aggList.length} logement(s) — Total : ${fmtMoney(s.collected_rent)})`, primaryColor, contentW);

    if (!aggList.length) {
      doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica-Oblique')
        .text('Aucun encaissement enregistré sur cette période.', 40, doc.y);
      doc.y += 8;
    } else {
      const aggHeaders = ['Logement', 'Locataire', 'Période / Nature du règlement', 'Mode(s)', 'N° Reçus', 'Total Encaissé'];
      const aggWidths = [42, 105, 140, 48, 118, 70]; // Total = 523 pt (Reçus élargi à 118pt pour accueillir tous les numéros)

      const aggRows = aggList.map((c) => [
        cleanText(c.apartment_number),
        cleanText(c.tenant_name),
        cleanText(c.nature + (c.transaction_count > 1 ? ` (${c.transaction_count} vers.)` : '')),
        cleanText(c.methods),
        cleanText(c.receipt_numbers),
        fmtMoney(c.total_collected),
      ]);

      this._renderDenseTable(doc, {
        headers: aggHeaders,
        widths: aggWidths,
        rows: aggRows,
        checkPage,
        primaryColor,
        alignRightCols: [5],
        dynamicRowHeights: true,
      });
    }

    // ================================================================
    // SOUS-TABLEAU DÉTAILLÉ : HISTORIQUE DE TOUTES LES TRANSACTIONS
    // ================================================================
    if (txList.length > 0) {
      checkPage(24);
      doc.fontSize(7).fillColor(primaryColor).font('Helvetica-Bold')
        .text(`↳ DÉTAIL DES TRANSACTIONS INDIVIDUELLES (${txList.length} opération(s))`, 38, doc.y);
      doc.y += 2;

      const txHeaders = ['Date', 'Locataire', 'Logement', 'Mode paiement', 'N° Reçu', 'Montant'];
      const txWidths = [55, 130, 48, 80, 130, 80]; // Total = 523 pt

      const txRows = txList.map((t) => [
        fmtDate(t.date),
        cleanText(t.tenant_name),
        cleanText(t.apartment_number),
        cleanText(t.payment_method || 'Espèces'),
        cleanText(t.receipt_number || '—'),
        fmtMoney(t.amount),
      ]);

      this._renderDenseTable(doc, {
        headers: txHeaders,
        widths: txWidths,
        rows: txRows,
        checkPage,
        primaryColor,
        alignRightCols: [5],
      });
    }

    // ================================================================
    // PARTIE 4 : TRAVAUX ET INTERVENTIONS TECHNIQUES
    // ================================================================
    const worksList = reportData.works_done || [];
    checkPage(24);
    this._drawSectionHeader(doc, `4. TRAVAUX ET INTERVENTIONS TECHNIQUES (${worksList.length})`, primaryColor, contentW);

    if (!worksList.length) {
      doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica-Oblique')
        .text('Aucun travail ni intervention technique enregistré sur cette période.', 40, doc.y);
      doc.y += 8;
    } else {
      const wHeaders = ['Date', 'Logement', 'Nature des travaux / Description', 'Technicien / Prestataire', 'Statut', 'Coût (FCFA)'];
      const wWidths = [52, 58, 175, 95, 63, 80]; // Total = 523 pt

      const wRows = worksList.map((w) => [
        fmtDate(w.date),
        cleanText(w.apartment_number || 'Commun'),
        cleanText(w.title + (w.description ? ` (${w.description})` : '')),
        cleanText(w.technician || 'Équipe SMG'),
        cleanText(w.status === 'completed' ? 'Terminé' : (w.status || 'En cours')),
        fmtMoney(w.cost || 0),
      ]);

      this._renderDenseTable(doc, {
        headers: wHeaders,
        widths: wWidths,
        rows: wRows,
        checkPage,
        primaryColor,
        alignRightCols: [5],
      });
    }

    // ================================================================
    // PARTIE 5 : DÉPENSES DÉTAILLÉES
    // ================================================================
    const expList = reportData.expenses_detail || [];
    checkPage(24);
    this._drawSectionHeader(doc, `5. DÉPENSES DÉTAILLÉES (Total : ${fmtMoney(s.total_expenses || 0)})`, primaryColor, contentW);

    if (!expList.length) {
      doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica-Oblique')
        .text('Aucune dépense imputée sur cette période.', 40, doc.y);
      doc.y += 8;
    } else {
      const expHeaders = ['Date', 'Désignation / Fourniture', 'Catégorie', 'Affectation', 'Qté', 'P.U. (FCFA)', 'Total (FCFA)'];
      const expWidths = [52, 150, 75, 86, 30, 60, 70]; // Total = 523 pt

      const expRows = expList.map((e) => [
        fmtDate(e.date),
        cleanText(e.item_name),
        cleanText(e.category || 'Entretien'),
        cleanText(e.apartment_number || 'Immeuble'),
        cleanText(e.quantity || 1),
        fmtMoney(e.unit_price, false),
        fmtMoney(e.total_price, false),
      ]);

      this._renderDenseTable(doc, {
        headers: expHeaders,
        widths: expWidths,
        rows: expRows,
        checkPage,
        primaryColor,
        alignRightCols: [5, 6],
      });
    }

    // ================================================================
    // PARTIE 6 : BILAN ET RÉSULTAT NET DE LA PÉRIODE
    // ================================================================
    checkPage(60);
    this._drawSectionHeader(doc, '6. BILAN ET RÉSULTAT NET DE LA PÉRIODE', primaryColor, contentW);

    const bilanH = 46;
    const bilanY = doc.y;
    doc.rect(36, bilanY, contentW, bilanH).fill(COLORS.secondary);
    doc.rect(36, bilanY, 4, bilanH).fill(primaryColor);
    doc.rect(36, bilanY, contentW, bilanH).strokeColor(COLORS.border).lineWidth(0.5).stroke();

    // Colonne gauche : Synthèse recettes - dépenses
    doc.fontSize(8).fillColor(COLORS.text).font('Helvetica')
      .text('Total des encaissements perçus (loyers) :', 48, bilanY + 8)
      .font('Helvetica-Bold').fillColor(COLORS.success)
      .text(`+ ${fmtMoney(s.collected_rent)}`, 230, bilanY + 8);

    doc.fontSize(8).fillColor(COLORS.text).font('Helvetica')
      .text('Total des dépenses et travaux imputés :', 48, bilanY + 20)
      .font('Helvetica-Bold').fillColor(COLORS.accent)
      .text(`- ${fmtMoney(s.total_expenses)}`, 230, bilanY + 20);

    doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica')
      .text(`Taux d'encaissement période : ${s.collection_rate || 0}%  |  Impayés résiduels : ${fmtMoney(s.remaining_to_collect)}`, 48, bilanY + 32);

    // Colonne droite : Badge du résultat net
    const resBoxW = 180;
    const resBoxX = pageW - 36 - resBoxW - 8;
    const resNet = s.net_result || 0;
    const isPos = resNet >= 0;

    doc.rect(resBoxX, bilanY + 6, resBoxW, 34).fill(isPos ? '#dcfce7' : '#fee2e2');
    doc.rect(resBoxX, bilanY + 6, resBoxW, 34).strokeColor(isPos ? '#86efac' : '#fca5a5').lineWidth(0.5).stroke();

    doc.fontSize(6.5).fillColor(isPos ? COLORS.success : COLORS.danger).font('Helvetica-Bold')
      .text('RÉSULTAT NET À REVERSER AU BAILLEUR', resBoxX + 4, bilanY + 11, { width: resBoxW - 8, align: 'center' });
    doc.fontSize(11).fillColor(isPos ? COLORS.success : COLORS.danger).font('Helvetica-Bold')
      .text(fmtMoney(resNet), resBoxX + 4, bilanY + 22, { width: resBoxW - 8, align: 'center' });

    doc.y = bilanY + bilanH + 8;

    // BLOC SIGNATURES & VISAS
    const signY = doc.y;
    const signW = (contentW - 12) / 2;
    doc.rect(36, signY, signW, 28).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.rect(36 + signW + 12, signY, signW, 28).strokeColor(COLORS.border).lineWidth(0.5).stroke();

    doc.fontSize(6.5).fillColor(COLORS.muted).font('Helvetica-Bold')
      .text('POUR LA DIRECTION SMG IMMOBILIER (Visa & Cachet)', 42, signY + 4, { width: signW - 12 })
      .text('POUR LE PROPRIÉTAIRE / BAILLEUR (Bon pour accord)', 36 + signW + 18, signY + 4, { width: signW - 12 });

    doc.y = signY + 32;

    // ================================================================
    // NUMÉROTATION STRICTE SUR TOUTES LES PAGES (ZÉRO PAGE VIDE)
    // ================================================================
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const footerY = pageH - 18;
      doc.moveTo(36, footerY - 3).lineTo(pageW - 36, footerY - 3).strokeColor(COLORS.border).lineWidth(0.4).stroke();
      doc.fontSize(6.5).fillColor(COLORS.muted).font('Helvetica')
        .text(`${cleanText(settings.name || 'SMG IMMOBILIER')} — Rapport de gestion officiel et confidentiel`, 36, footerY, { width: contentW / 2 })
        .text(`Page ${i + 1} sur ${totalPages}`, pageW - 136, footerY, { width: 100, align: 'right' });
    }

    return new Promise((resolve) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        logger.info('📄 PDF Rapport de gestion optimisé généré', {
          property: reportData.property?.property_name,
          pages: totalPages,
          size: buffer.length,
        });
        resolve(buffer);
      });
      doc.end();
    });
  }

  /**
   * Titre de section propre et compact
   */
  _drawSectionHeader(doc, title, primaryColor, contentW) {
    doc.fontSize(8).fillColor(primaryColor).font('Helvetica-Bold')
      .text(title, 36, doc.y);
    const lineY = doc.y + 1;
    doc.moveTo(36, lineY).lineTo(36 + contentW, lineY).strokeColor(primaryColor).lineWidth(1).stroke();
    doc.y = lineY + 3;
  }

  /**
   * Case indicateur KPI
   */
  _drawKpiBox(doc, x, y, w, h, label, value, valColor) {
    doc.rect(x, y, w, h).fill(COLORS.cardBg);
    doc.rect(x, y, w, h).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.fontSize(5.5).fillColor(COLORS.muted).font('Helvetica-Bold')
      .text(label, x + 4, y + 3, { width: w - 8 });
    doc.fontSize(8.5).fillColor(valColor).font('Helvetica-Bold')
      .text(value, x + 4, y + 14, { width: w - 8 });
  }

  /**
   * Tableau ultra-dense, lisible et avec en-têtes récurrents
   */
  _renderDenseTable(doc, { headers, widths, rows, checkPage, primaryColor, alignRightCols = [], dynamicRowHeights = false }) {
    const startX = 36;
    const totalW = widths.reduce((s, w) => s + w, 0);
    const hHeight = 13;
    const defaultRHeight = 11.5;

    const drawHeader = () => {
      const headerY = doc.y;
      doc.rect(startX, headerY, totalW, hHeight).fill(primaryColor);
      let x = startX;
      headers.forEach((h, i) => {
        const isRight = alignRightCols.includes(i);
        doc.fontSize(6).fillColor(COLORS.white).font('Helvetica-Bold')
          .text(h, x + 2, headerY + 3.5, { width: widths[i] - 4, align: isRight ? 'right' : 'left', lineBreak: false });
        x += widths[i];
      });
      doc.y = headerY + hHeight;
    };

    drawHeader();

    rows.forEach((row, idx) => {
      let rHeight = defaultRHeight;
      if (dynamicRowHeights) {
        doc.fontSize(6).font('Helvetica');
        let maxTextH = 7;
        row.forEach((val, i) => {
          if (val) {
            const h = doc.heightOfString(String(val), { width: widths[i] - 4 });
            if (h > maxTextH) maxTextH = h;
          }
        });
        rHeight = Math.max(defaultRHeight, maxTextH + 4);
      }

      const pageAdded = checkPage(rHeight + 2);
      if (pageAdded) {
        drawHeader();
      }

      const rowY = doc.y;

      if (idx % 2 === 1) {
        doc.rect(startX, rowY, totalW, rHeight).fill(COLORS.rowAlt);
      }
      doc.moveTo(startX, rowY + rHeight).lineTo(startX + totalW, rowY + rHeight).strokeColor(COLORS.border).lineWidth(0.3).stroke();

      let x = startX;
      row.forEach((val, i) => {
        const isRight = alignRightCols.includes(i);
        doc.fontSize(6).fillColor(COLORS.text).font('Helvetica')
          .text(String(val || '—'), x + 2, rowY + 2.5, { width: widths[i] - 4, align: isRight ? 'right' : 'left', lineBreak: true });
        x += widths[i];
      });
      doc.y = rowY + rHeight;
    });

    doc.y += 4;
  }

  /**
   * Sous-en-tête récurrent sur les pages 2, 3, etc.
   */
  _drawSubHeader(doc, propName, period, settings, primaryColor, pageW) {
    doc.rect(0, 0, pageW, 2.5).fill(primaryColor);
    doc.fontSize(6.5).fillColor(COLORS.muted).font('Helvetica-Bold')
      .text(`${cleanText(settings.name || 'SMG IMMOBILIER')} — Rapport de Gestion : ${cleanText(propName || 'Immeuble')} (du ${fmtDate(period?.start)} au ${fmtDate(period?.end)})`, 36, 10);
    doc.moveTo(36, 19).lineTo(pageW - 36, 19).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.y = 22;
  }
}

module.exports = new ManagementReportPdfService();
