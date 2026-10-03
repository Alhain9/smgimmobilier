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
   * Génère le rapport de gestion officiel d'un immeuble (Format A4 Paysage pour clarté optimale)
   */
  async generateBuildingReportPdf(reportData) {
    const settings = companyService.getSettings();
    const primaryColor = settings.primary_color || COLORS.primary;

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 20, bottom: 20, left: 30, right: 30 },
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

    const pageW = doc.page.width;       // 841.89 pt
    const pageH = doc.page.height;      // 595.28 pt
    const marginX = 30;
    const contentW = pageW - (marginX * 2); // 781.89 pt (~782 pt)
    const bottomLimit = pageH - 25;     // 570.28 pt

    // Helper sécurisé de saut de page sans création de page vide
    const checkPage = (neededHeight) => {
      if (doc.y + neededHeight > bottomLimit) {
        doc.addPage();
        this._drawSubHeader(doc, reportData.property?.property_name, reportData.period, settings, primaryColor, pageW, marginX);
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
    doc.rect(marginX, curY, contentW, bandH).fill(COLORS.secondary);
    doc.rect(marginX, curY, 4, bandH).fill(primaryColor);

    doc.fontSize(11).fillColor(primaryColor).font('Helvetica-Bold')
      .text('RAPPORT PÉRIODIQUE DE GESTION IMMOBILIÈRE', marginX + 10, curY + 4, { width: contentW - 20, align: 'center' });

    const propName = cleanText(reportData.property?.property_name || 'Immeuble');
    const propAddr = cleanText(reportData.property?.address || reportData.property?.city || 'Cameroun');
    const ownerName = cleanText(reportData.property?.owner?.full_name || 'Bailleur');

    doc.fontSize(7.5).fillColor(COLORS.text).font('Helvetica-Bold')
      .text(`Bien : ${propName} (${propAddr})   |   Propriétaire : ${ownerName}`, marginX + 10, curY + 18, { width: contentW - 20, align: 'center' });

    doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica')
      .text(`Période couverte : du ${fmtDate(reportData.period?.start)} au ${fmtDate(reportData.period?.end)} (${reportData.period?.months || 1} mois)  —  Généré le ${fmtDate(new Date())}`, marginX + 10, curY + 26, { width: contentW - 20, align: 'center' });

    doc.y = curY + bandH + 6;

    // ================================================================
    // PARTIE 1 : RÉSUMÉ FINANCIER (6 KPI PARFAITEMENT DÉTAILLÉS)
    // ================================================================
    this._drawSectionHeader(doc, '1. RÉSUMÉ FINANCIER DE LA PÉRIODE', primaryColor, contentW, marginX);
    const s = reportData.summary || {};

    const kpiW = (contentW - 8) / 3;
    const kpiH = 29;
    const kpiY1 = doc.y;

    this._drawKpiBox(doc, marginX, kpiY1, kpiW, kpiH, 'LOYER THÉORIQUE ATTENDU', fmtMoney(s.theoretical_rent), primaryColor);
    this._drawKpiBox(doc, marginX + kpiW + 4, kpiY1, kpiW, kpiH, 'LOYER RÉELLEMENT ENCAISSÉ', fmtMoney(s.collected_rent), COLORS.success);
    this._drawKpiBox(doc, marginX + (kpiW + 4) * 2, kpiY1, kpiW, kpiH, 'RESTE À ENCAISSER (IMPAYÉS)', fmtMoney(s.remaining_to_collect), s.remaining_to_collect > 0 ? COLORS.danger : COLORS.muted);

    const kpiY2 = kpiY1 + kpiH + 3;
    this._drawKpiBox(doc, marginX, kpiY2, kpiW, kpiH, 'DÉPENSES & MAINTENANCE', fmtMoney(s.total_expenses || s.maintenance_expenses), COLORS.accent);
    this._drawKpiBox(doc, marginX + kpiW + 4, kpiY2, kpiW, kpiH, "TAUX D'ENCAISSEMENT", `${s.collection_rate || 0}%`, (s.collection_rate || 0) >= 80 ? COLORS.success : COLORS.warning);
    this._drawKpiBox(doc, marginX + (kpiW + 4) * 2, kpiY2, kpiW, kpiH, 'RÉSULTAT NET DE GESTION', fmtMoney(s.net_result), (s.net_result || 0) >= 0 ? COLORS.success : COLORS.danger);

    doc.y = kpiY2 + kpiH + 6;

    // ================================================================
    // PARTIE 2 : SITUATION LOCATIVE PAR LOGEMENT (12 COLONNES STANDARDISÉES)
    // ================================================================
    const situation = reportData.building_situation || {};
    const rawLignes = (situation.lignes && situation.lignes.length)
      ? situation.lignes
      : (reportData.rental_situation?.apartments || reportData.apartments || []);
    const totalApts = rawLignes.length;
    const occupiedApts = rawLignes.filter((a) => {
      const st = a.statut || a.status;
      return st === 'occupied' || (a.nom_locataire && a.nom_locataire !== '—');
    }).length;
    const occRate = totalApts > 0 ? Math.round((occupiedApts / totalApts) * 100) : 0;

    checkPage(30);
    this._drawSectionHeader(doc, `2. SITUATION LOCATIVE PAR LOGEMENT (${occupiedApts}/${totalApts} occupés — ${occRate}%)`, primaryColor, contentW, marginX);

    // Les 12 colonnes standardisées demandées :
    // Num du logement, Noms locataires, Numéro de téléphone, Montant loyers, Description du logement,
    // ARRIERE DE LOYER, LOYER PAR ANTICIPATION, VERSEMENT AU COUR DU MOIS, PERIODE CORRESPONDANT AU PAYEMENT,
    // MODE DE PAIEMENT, CAUTION, Observation
    const aptHeaders = [
      'N° Log.',
      'Noms locataires',
      'N° Téléphone',
      'Montant loyer',
      'Description',
      'Arriéré loyer',
      'Loyer anticipé',
      'Versement mois',
      'PÉRIODE CORRESPONDANT AU PAIEMENT',
      'Mode',
      'Caution',
      'Observation',
    ];
    // Total = 38 + 95 + 68 + 60 + 62 + 60 + 58 + 65 + 86 + 54 + 56 + 80 = 782 pt
    const aptWidths = [38, 95, 68, 60, 62, 60, 58, 65, 86, 54, 56, 80];

    const aptRows = rawLignes.map((l) => {
      const isFree = (l.statut || l.status) === 'free' || (!l.nom_locataire && !l.tenant_name);
      const numLog = cleanText(l.numero_chambre || l.apartment_number || '—');
      const nomLoc = cleanText(l.nom_locataire || l.tenant_name || (isFree ? '— (Libre)' : '—'));
      const tel = cleanText(l.telephone || l.tenant_phone || '—');
      const loyer = fmtMoney(l.montant_loyer != null ? l.montant_loyer : l.rent_amount);
      const desc = cleanText(l.description_logement || l.description || l.apartment_type || 'Logement');
      const arriere = Number(l.arriere_loyer || 0) > 0 ? fmtMoney(l.arriere_loyer) : '0 FCFA';
      const anticip = Number(l.anticipation || 0) > 0 ? fmtMoney(l.anticipation) : '0 FCFA';
      const versementVal = Number(l.versement_mois ?? l.total_collected ?? 0);
      const versement = versementVal > 0 ? fmtMoney(versementVal) : '0 FCFA';
      const periode = cleanText(l.periode_paiement || l.date_range || '—');
      const mode = cleanText(l.mode_paiement || l.methods || '—');
      const caution = Number(l.caution || 0) > 0 ? fmtMoney(l.caution) : '0 FCFA';
      const obs = cleanText(l.observations || (isFree ? 'Logement libre / vide' : 'À jour'));

      return [
        numLog,
        nomLoc,
        tel,
        loyer,
        desc,
        arriere,
        anticip,
        versement,
        periode,
        mode,
        caution,
        obs,
      ];
    });

    if (!aptRows.length) {
      doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica-Oblique')
        .text('Aucun logement enregistré pour cet immeuble.', marginX + 4, doc.y);
      doc.y += 8;
    } else {
      // Ligne de total récapitulative
      const totLoyer = situation.total?.montant_loyer ?? rawLignes.reduce((sum, r) => sum + (Number(r.montant_loyer ?? r.rent_amount) || 0), 0);
      const totArriere = situation.total?.arriere_loyer ?? rawLignes.reduce((sum, r) => sum + (Number(r.arriere_loyer) || 0), 0);
      const totAnticip = situation.total?.anticipation ?? rawLignes.reduce((sum, r) => sum + (Number(r.anticipation) || 0), 0);
      const totVersement = situation.total?.versement_mois ?? rawLignes.reduce((sum, r) => sum + (Number(r.versement_mois ?? r.total_collected) || 0), 0);
      const totCaution = situation.total?.caution ?? rawLignes.reduce((sum, r) => sum + (Number(r.caution) || 0), 0);

      const totalsRow = [
        'TOTAL',
        `${rawLignes.length} log.`,
        '—',
        fmtMoney(totLoyer),
        '—',
        fmtMoney(totArriere),
        fmtMoney(totAnticip),
        fmtMoney(totVersement),
        '—',
        '—',
        fmtMoney(totCaution),
        '—',
      ];
      aptRows.push(totalsRow);

      this._renderDenseTable(doc, {
        headers: aptHeaders,
        widths: aptWidths,
        rows: aptRows,
        checkPage,
        primaryColor,
        alignRightCols: [3, 5, 6, 7, 10],
        alignCenterCols: [0, 9],
        dynamicRowHeights: true,
        startX: marginX,
        hasTotalRow: true,
      });
    }

    // ================================================================
    // PARTIE 3 : ENCAISSEMENTS RÉALISÉS (SYNTHÈSE AGRÉGÉE PAR LOCATAIRE)
    // Fait le cumul ("le plus") des transactions multiples d'un même locataire
    // ================================================================
    const aggList = reportData.aggregated_collections || [];
    const txList = reportData.transactions || [];
    checkPage(30);
    this._drawSectionHeader(doc, `3. ENCAISSEMENTS RÉALISÉS (${aggList.length} logement(s) — Total : ${fmtMoney(s.collected_rent)})`, primaryColor, contentW, marginX);

    if (!aggList.length) {
      doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica-Oblique')
        .text('Aucun encaissement enregistré sur cette période.', marginX + 4, doc.y);
      doc.y += 8;
    } else {
      const aggHeaders = ['Logement', 'Locataire', 'PERIODE CORRESPONDANT AU PAYEMENT', 'Mode(s)', 'N° Reçus', 'Total Encaissé'];
      // Total = 55 + 140 + 230 + 80 + 165 + 112 = 782 pt
      const aggWidths = [55, 140, 230, 80, 165, 112];

      const aggRows = aggList.map((c) => [
        cleanText(c.apartment_number),
        cleanText(c.tenant_name),
        cleanText((c.periode_paiement || c.nature || '—') + (c.transaction_count > 1 ? ` (${c.transaction_count} vers.)` : '')),
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
        startX: marginX,
      });
    }

    // ================================================================
    // SOUS-TABLEAU DÉTAILLÉ : HISTORIQUE DE TOUTES LES TRANSACTIONS
    // ================================================================
    if (txList.length > 0) {
      checkPage(24);
      doc.fontSize(7).fillColor(primaryColor).font('Helvetica-Bold')
        .text(`↳ DÉTAIL DES TRANSACTIONS INDIVIDUELLES (${txList.length} opération(s))`, marginX + 2, doc.y);
      doc.y += 2;

      const txHeaders = ['Date', 'Locataire', 'Logement', 'Mode paiement', 'N° Reçu', 'Montant'];
      // Total = 75 + 210 + 65 + 120 + 192 + 120 = 782 pt
      const txWidths = [75, 210, 65, 120, 192, 120];

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
        startX: marginX,
      });
    }

    // ================================================================
    // PARTIE 4 : TRAVAUX ET INTERVENTIONS TECHNIQUES
    // ================================================================
    const worksList = reportData.works_done || [];
    checkPage(24);
    this._drawSectionHeader(doc, `4. TRAVAUX ET INTERVENTIONS TECHNIQUES (${worksList.length})`, primaryColor, contentW, marginX);

    if (!worksList.length) {
      doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica-Oblique')
        .text('Aucun travail ni intervention technique enregistré sur cette période.', marginX + 4, doc.y);
      doc.y += 8;
    } else {
      const wHeaders = ['Date', 'Logement', 'Nature des travaux / Description', 'Technicien / Prestataire', 'Statut', 'Coût (FCFA)'];
      // Total = 70 + 75 + 290 + 145 + 82 + 120 = 782 pt
      const wWidths = [70, 75, 290, 145, 82, 120];

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
        startX: marginX,
      });
    }

    // ================================================================
    // PARTIE 5 : DÉPENSES DÉTAILLÉES
    // ================================================================
    const expList = reportData.expenses_detail || [];
    checkPage(24);
    this._drawSectionHeader(doc, `5. DÉPENSES DÉTAILLÉES (Total : ${fmtMoney(s.total_expenses || 0)})`, primaryColor, contentW, marginX);

    if (!expList.length) {
      doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica-Oblique')
        .text('Aucune dépense imputée sur cette période.', marginX + 4, doc.y);
      doc.y += 8;
    } else {
      const expHeaders = ['Date', 'Désignation / Fourniture', 'Catégorie', 'Affectation', 'Qté', 'P.U. (FCFA)', 'Total (FCFA)'];
      // Total = 70 + 230 + 110 + 125 + 45 + 92 + 110 = 782 pt
      const expWidths = [70, 230, 110, 125, 45, 92, 110];

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
        startX: marginX,
      });
    }

    // ================================================================
    // PARTIE 6 : BILAN ET RÉSULTAT NET DE LA PÉRIODE
    // ================================================================
    checkPage(60);
    this._drawSectionHeader(doc, '6. BILAN ET RÉSULTAT NET DE LA PÉRIODE', primaryColor, contentW, marginX);

    const bilanH = 46;
    const bilanY = doc.y;
    doc.rect(marginX, bilanY, contentW, bilanH).fill(COLORS.secondary);
    doc.rect(marginX, bilanY, 4, bilanH).fill(primaryColor);
    doc.rect(marginX, bilanY, contentW, bilanH).strokeColor(COLORS.border).lineWidth(0.5).stroke();

    // Colonne gauche : Synthèse recettes - dépenses
    doc.fontSize(8).fillColor(COLORS.text).font('Helvetica')
      .text('Total des encaissements perçus (loyers) :', marginX + 12, bilanY + 8)
      .font('Helvetica-Bold').fillColor(COLORS.success)
      .text(`+ ${fmtMoney(s.collected_rent)}`, marginX + 220, bilanY + 8);

    const donTxt = s.caretaker_expenses > 0 ? ` (dont gardien: ${fmtMoney(s.caretaker_expenses)})` : '';
    doc.fontSize(8).fillColor(COLORS.text).font('Helvetica')
      .text('Total des dépenses et travaux imputés :', marginX + 12, bilanY + 20)
      .font('Helvetica-Bold').fillColor(COLORS.accent)
      .text(`- ${fmtMoney(s.total_expenses)}${donTxt}`, marginX + 205, bilanY + 20);

    doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica')
      .text(`Taux d'encaissement période : ${s.collection_rate || 0}%  |  Impayés résiduels : ${fmtMoney(s.remaining_to_collect)}`, marginX + 12, bilanY + 32);

    // Colonne droite : Badge du résultat net
    const resBoxW = 240;
    const resBoxX = pageW - marginX - resBoxW - 8;
    const resNet = s.net_result || 0;
    const isPos = resNet >= 0;

    doc.rect(resBoxX, bilanY + 6, resBoxW, 34).fill(isPos ? '#dcfce7' : '#fee2e2');
    doc.rect(resBoxX, bilanY + 6, resBoxW, 34).strokeColor(isPos ? '#86efac' : '#fca5a5').lineWidth(0.5).stroke();

    doc.fontSize(7).fillColor(isPos ? COLORS.success : COLORS.danger).font('Helvetica-Bold')
      .text('RÉSULTAT NET À REVERSER AU BAILLEUR', resBoxX + 4, bilanY + 10, { width: resBoxW - 8, align: 'center' });
    doc.fontSize(12).fillColor(isPos ? COLORS.success : COLORS.danger).font('Helvetica-Bold')
      .text(fmtMoney(resNet), resBoxX + 4, bilanY + 21, { width: resBoxW - 8, align: 'center' });

    doc.y = bilanY + bilanH + 8;

    // BLOC SIGNATURES & VISAS
    const signY = doc.y;
    const signW = (contentW - 14) / 2;
    doc.rect(marginX, signY, signW, 30).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.rect(marginX + signW + 14, signY, signW, 30).strokeColor(COLORS.border).lineWidth(0.5).stroke();

    doc.fontSize(6.5).fillColor(COLORS.muted).font('Helvetica-Bold')
      .text('POUR LA DIRECTION SMG IMMOBILIER (Visa & Cachet)', marginX + 6, signY + 4, { width: signW - 12 })
      .text('POUR LE PROPRIÉTAIRE / BAILLEUR (Bon pour accord)', marginX + signW + 20, signY + 4, { width: signW - 12 });

    doc.y = signY + 34;

    // ================================================================
    // NUMÉROTATION STRICTE SUR TOUTES LES PAGES (ZÉRO PAGE VIDE)
    // ================================================================
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const footerY = pageH - 18;
      doc.moveTo(marginX, footerY - 3).lineTo(pageW - marginX, footerY - 3).strokeColor(COLORS.border).lineWidth(0.4).stroke();
      doc.fontSize(6.5).fillColor(COLORS.muted).font('Helvetica')
        .text(`${cleanText(settings.name || 'SMG IMMOBILIER')} — Rapport de gestion officiel et confidentiel`, marginX, footerY, { width: contentW / 2 })
        .text(`Page ${i + 1} sur ${totalPages}`, pageW - marginX - 100, footerY, { width: 100, align: 'right' });
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
  _drawSectionHeader(doc, title, primaryColor, contentW, startX = 36) {
    doc.fontSize(8).fillColor(primaryColor).font('Helvetica-Bold')
      .text(title, startX, doc.y);
    const lineY = doc.y + 1;
    doc.moveTo(startX, lineY).lineTo(startX + contentW, lineY).strokeColor(primaryColor).lineWidth(1).stroke();
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
   * Tableau dense, lisible et avec en-têtes récurrents
   */
  _renderDenseTable(doc, {
    headers,
    widths,
    rows,
    checkPage,
    primaryColor,
    alignRightCols = [],
    alignCenterCols = [],
    dynamicRowHeights = false,
    startX = 36,
    hasTotalRow = false,
  }) {
    const totalW = widths.reduce((s, w) => s + w, 0);
    const hHeight = 13;
    const defaultRHeight = 11.5;

    const drawHeader = () => {
      const headerY = doc.y;
      doc.rect(startX, headerY, totalW, hHeight).fill(primaryColor);
      let x = startX;
      headers.forEach((h, i) => {
        const isRight = alignRightCols.includes(i);
        const isCenter = alignCenterCols.includes(i);
        const align = isRight ? 'right' : (isCenter ? 'center' : 'left');
        doc.fontSize(6).fillColor(COLORS.white).font('Helvetica-Bold')
          .text(h, x + 2, headerY + 3.5, { width: widths[i] - 4, align, lineBreak: false });
        x += widths[i];
      });
      doc.y = headerY + hHeight;
    };

    drawHeader();

    const lastIdx = rows.length - 1;
    rows.forEach((row, idx) => {
      const isTotal = hasTotalRow && idx === lastIdx;
      let rHeight = defaultRHeight;
      if (dynamicRowHeights && !isTotal) {
        doc.fontSize(5.8).font('Helvetica');
        let maxTextH = 7;
        row.forEach((val, i) => {
          if (val) {
            const h = doc.heightOfString(String(val), { width: widths[i] - 4 });
            if (h > maxTextH) maxTextH = h;
          }
        });
        rHeight = Math.max(defaultRHeight, maxTextH + 3.5);
      } else if (isTotal) {
        rHeight = 13;
      }

      const pageAdded = checkPage(rHeight + 2);
      if (pageAdded) {
        drawHeader();
      }

      const rowY = doc.y;

      if (isTotal) {
        doc.rect(startX, rowY, totalW, rHeight).fill('#e2e8f0');
        doc.moveTo(startX, rowY).lineTo(startX + totalW, rowY).strokeColor(primaryColor).lineWidth(1).stroke();
      } else if (idx % 2 === 1) {
        doc.rect(startX, rowY, totalW, rHeight).fill(COLORS.rowAlt);
      }
      doc.moveTo(startX, rowY + rHeight).lineTo(startX + totalW, rowY + rHeight).strokeColor(COLORS.border).lineWidth(isTotal ? 1 : 0.3).stroke();

      let x = startX;
      row.forEach((val, i) => {
        const isRight = alignRightCols.includes(i);
        const isCenter = alignCenterCols.includes(i);
        const align = isRight ? 'right' : (isCenter ? 'center' : 'left');
        const font = isTotal ? 'Helvetica-Bold' : 'Helvetica';
        const color = isTotal ? (isRight ? primaryColor : COLORS.text) : COLORS.text;
        doc.fontSize(isTotal ? 6 : 5.8).fillColor(color).font(font)
          .text(String(val || '—'), x + 2, rowY + (isTotal ? 3.5 : 2.5), { width: widths[i] - 4, align, lineBreak: true });
        x += widths[i];
      });
      doc.y = rowY + rHeight;
    });

    doc.y += 4;
  }

  /**
   * Sous-en-tête récurrent sur les pages 2, 3, etc.
   */
  _drawSubHeader(doc, propName, period, settings, primaryColor, pageW, startX = 36) {
    doc.rect(0, 0, pageW, 2.5).fill(primaryColor);
    doc.fontSize(6.5).fillColor(COLORS.muted).font('Helvetica-Bold')
      .text(`${cleanText(settings.name || 'SMG IMMOBILIER')} — Rapport de Gestion : ${cleanText(propName || 'Immeuble')} (du ${fmtDate(period?.start)} au ${fmtDate(period?.end)})`, startX, 10);
    doc.moveTo(startX, 19).lineTo(pageW - startX, 19).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.y = 22;
  }

  /**
   * Génère le rapport PDF officiel du Récapitulatif des entrées par immeuble
   */
  async generateInflowsRecapPdf(recapData) {
    const settings = companyService.getSettings();
    const primaryColor = settings.primary_color || COLORS.primary;

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 20, bottom: 20, left: 36, right: 36 },
      bufferPages: true,
      info: {
        Title: 'Récapitulatif des Entrées par Immeuble — SMG IMMOBILIER',
        Author: cleanText(settings.name || 'SMG IMMOBILIER'),
        Subject: 'Récapitulatif Périodique des Encaissements par Immeuble',
        Creator: 'SMG IMMOBILIER Platform',
      },
    });

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));

    const pageW = doc.page.width;       // 595.28 pt
    const pageH = doc.page.height;      // 841.89 pt
    const contentW = pageW - 72;        // 523.28 pt
    const bottomLimit = pageH - 30;

    const checkPage = (neededHeight) => {
      if (doc.y + neededHeight > bottomLimit) {
        doc.addPage();
        this._drawInflowsSubHeader(doc, recapData.period, settings, primaryColor, pageW);
        return true;
      }
      return false;
    };

    // ================================================================
    // EN-TÊTE PRINCIPAL OFFICIEL AVEC LOGO (PAGE 1)
    // ================================================================
    let curY = drawCompanyHeader(doc);

    // BANDEAU DU RAPPORT
    const bandH = 34;
    doc.rect(36, curY, contentW, bandH).fill(COLORS.secondary);
    doc.rect(36, curY, 4, bandH).fill(primaryColor);

    doc.fontSize(11).fillColor(primaryColor).font('Helvetica-Bold')
      .text('RÉCAPITULATIF DES ENTRÉES PAR IMMEUBLE', 46, curY + 4, { width: contentW - 20, align: 'center' });

    const nbImmeubles = (recapData.items || []).length;
    doc.fontSize(7.5).fillColor(COLORS.text).font('Helvetica-Bold')
      .text(`Période du ${fmtDate(recapData.period?.start)} au ${fmtDate(recapData.period?.end)}   |   ${nbImmeubles} immeuble(s) analysé(s)`, 46, curY + 18, { width: contentW - 20, align: 'center' });

    doc.fontSize(7).fillColor(COLORS.muted).font('Helvetica')
      .text(`Document officiel consolidé — Édité le ${fmtDate(new Date())} par la Direction SMG IMMOBILIER`, 46, curY + 26, { width: contentW - 20, align: 'center' });

    doc.y = curY + bandH + 8;

    // ================================================================
    // 1. KPI STRIP : TOTAL ENTRÉES & RÉPARTITION
    // ================================================================
    this._drawSectionHeader(doc, '1. TOTAL DES RECETTES ET RÉPARTITION GLOBALE', primaryColor, contentW);
    const s = recapData.summary || {};
    const kpiW = (contentW - 9) / 4;
    const kpiH = 30;
    const kpiY = doc.y;

    this._drawKpiBox(doc, 36, kpiY, kpiW, kpiH, 'TOTAL ENTRÉES DU MOIS', fmtMoney(s.total_entrees), COLORS.success);
    this._drawKpiBox(doc, 36 + kpiW + 3, kpiY, kpiW, kpiH, 'VIREMENTS BANCAIRES', `${fmtMoney(s.total_virement)} (${s.percent_virement || 0}%)`, primaryColor);
    this._drawKpiBox(doc, 36 + (kpiW + 3) * 2, kpiY, kpiW, kpiH, 'ESPÈCES / CASH', `${fmtMoney(s.total_cash)} (${s.percent_cash || 0}%)`, COLORS.warning);
    this._drawKpiBox(doc, 36 + (kpiW + 3) * 3, kpiY, kpiW, kpiH, 'IMMEUBLES COUVERTS', `${nbImmeubles} immeuble(s)`, COLORS.text);

    doc.y = kpiY + kpiH + 10;

    // ================================================================
    // 2. TABLEAU RÉCAPITULATIF DES ENTRÉES PAR IMMEUBLE
    // ================================================================
    this._drawSectionHeader(doc, '2. VENTILATION DES ENCAISSEMENTS PAR IMMEUBLE', primaryColor, contentW);

    const widths = [155, 74, 74, 80, 50, 90];
    const headers = ['Immeuble & Ville', 'Virement', 'Cash / Espèces', 'Total Encaissé', 'Part (%)', 'Ventilation des flux'];
    const alignRightCols = [1, 2, 3, 4];

    const rows = (recapData.items || []).map(it => [
      cleanText(`${it.property_name || '—'}${it.city ? ` (${it.city})` : ''}`),
      fmtMoney(it.virement),
      fmtMoney(it.cash),
      fmtMoney(it.total),
      `${it.share || 0}%`,
      cleanText(it.dominance_badge || '—'),
    ]);

    // Ligne Total
    rows.push([
      'TOTAL GÉNÉRAL',
      fmtMoney(s.total_virement),
      fmtMoney(s.total_cash),
      fmtMoney(s.total_entrees),
      '100%',
      'Consolidé',
    ]);

    this._renderDenseTable(doc, {
      headers,
      widths,
      rows,
      checkPage,
      primaryColor,
      alignRightCols,
      dynamicRowHeights: false,
    });

    // ================================================================
    // 3. CONSTATS ET ANALYSES AUTOMATIQUES
    // ================================================================
    const obs = recapData.observations || [];
    if (obs.length > 0) {
      checkPage(50);
      this._drawSectionHeader(doc, '3. CONSTATS ET ANALYSES DE GESTION', primaryColor, contentW);
      doc.fontSize(7).font('Helvetica').fillColor(COLORS.text);
      obs.forEach(o => {
        checkPage(14);
        const bulletY = doc.y;
        doc.fillColor(primaryColor).text('•', 40, bulletY, { lineBreak: false });
        doc.fillColor(COLORS.text).text(cleanText(o), 48, bulletY, { width: contentW - 20, lineBreak: true });
        doc.y += 2;
      });
      doc.y += 6;
    }

    // ================================================================
    // 4. CADRE DE VALIDATION & VISA
    // ================================================================
    checkPage(50);
    const signY = doc.y;
    const signW = (contentW - 16) / 2;
    const signH = 40;

    doc.rect(36, signY, signW, signH).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.rect(36 + signW + 16, signY, signW, signH).strokeColor(COLORS.border).lineWidth(0.5).stroke();

    doc.fontSize(6.5).fillColor(COLORS.muted).font('Helvetica-Bold')
      .text('POUR LA DIRECTION SMG IMMOBILIER (Visa & Cachet)', 42, signY + 4, { width: signW - 12 })
      .text('LE RESPONSABLE ADMINISTRATIF & FINANCIER', 36 + signW + 22, signY + 4, { width: signW - 12 });

    doc.y = signY + signH + 6;

    // ================================================================
    // NUMÉROTATION STRICTE SUR TOUTES LES PAGES
    // ================================================================
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const footerY = pageH - 18;
      doc.moveTo(36, footerY - 3).lineTo(pageW - 36, footerY - 3).strokeColor(COLORS.border).lineWidth(0.4).stroke();
      doc.fontSize(6.5).fillColor(COLORS.muted).font('Helvetica')
        .text(`${cleanText(settings.name || 'SMG IMMOBILIER')} — Récapitulatif officiel des entrées par immeuble`, 36, footerY, { width: contentW / 2 })
        .text(`Page ${i + 1} sur ${totalPages}`, pageW - 136, footerY, { width: 100, align: 'right' });
    }

    return new Promise((resolve) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        logger.info('📄 PDF Récapitulatif des entrées par immeuble généré', {
          count: nbImmeubles,
          pages: totalPages,
          size: buffer.length,
        });
        resolve(buffer);
      });
      doc.end();
    });
  }

  _drawInflowsSubHeader(doc, period, settings, primaryColor, pageW) {
    doc.rect(0, 0, pageW, 2.5).fill(primaryColor);
    doc.fontSize(6.5).fillColor(COLORS.muted).font('Helvetica-Bold')
      .text(`${cleanText(settings.name || 'SMG IMMOBILIER')} — Récapitulatif des Entrées par Immeuble (du ${fmtDate(period?.start)} au ${fmtDate(period?.end)})`, 36, 10);
    doc.moveTo(36, 19).lineTo(pageW - 36, 19).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.y = 22;
  }
}

module.exports = new ManagementReportPdfService();
