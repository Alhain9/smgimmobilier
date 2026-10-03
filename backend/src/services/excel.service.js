// ============ Service d'export Excel — ExcelJS ============
const ExcelJS = require('exceljs');
const { logger } = require('../config/logger');

class ExcelService {
  /**
   * Crée un classeur Excel à partir des données.
   * @param {object} config
   * @param {string} config.title - Titre du rapport
   * @param {Array} config.columns - [{ header, key, width, style }]
   * @param {Array} config.rows - Données (objets)
   * @param {string} config.sheetName - Nom de la feuille (défaut : 'Données')
   * @param {object} config.totals - { key: 'SUM' } pour les totaux en bas
   * @returns {ExcelJS.Workbook}
   */
  createWorkbook({ title, columns, rows, sheetName = 'Données', totals = {} }) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SMG IMMOBILIER';
    wb.created = new Date();

    const ws = wb.addWorksheet(sheetName);

    // En-tête du rapport (titre fusionné)
    ws.mergeCells(1, 1, 1, columns.length);
    const titleCell = ws.getCell('A1');
    titleCell.value = title;
    titleCell.font = { size: 16, bold: true, color: { argb: 'FF1E3A5F' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 35;

    // Date du rapport
    ws.mergeCells(2, 1, 2, columns.length);
    const dateCell = ws.getCell('A2');
    dateCell.value = `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`;
    dateCell.font = { size: 10, italic: true, color: { argb: 'FF666666' } };
    dateCell.alignment = { horizontal: 'center' };

    // Colonnes
    ws.columns = columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width || 18,
    }));

    // Réaffecter les en-têtes à la ligne 4
    const headerRow = ws.getRow(4);
    columns.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
    });
    headerRow.height = 28;

    // Données
    rows.forEach((row, idx) => {
      const r = ws.addRow(row);
      r.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        };
        cell.alignment = { vertical: 'middle' };
      });
      // Alternance de couleur
      if (idx % 2 === 1) {
        r.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
        });
      }
    });

    // Ligne de totaux
    if (Object.keys(totals).length > 0) {
      const totalRow = ws.addRow({});
      columns.forEach((c, i) => {
        const cell = totalRow.getCell(i + 1);
        if (i === 0) {
          cell.value = 'TOTAL';
          cell.font = { bold: true, size: 11 };
        } else if (totals[c.key] !== undefined) {
          cell.value = totals[c.key];
          cell.font = { bold: true, size: 11 };
          cell.numFmt = '#,##0';
        }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } };
        cell.border = {
          top: { style: 'medium' }, bottom: { style: 'medium' },
          left: { style: 'thin' }, right: { style: 'thin' },
        };
      });
    }

    // Appliquer le format monétaire aux colonnes marquées
    columns.forEach((c, i) => {
      if (c.style === 'money') {
        ws.getColumn(i + 1).numFmt = '#,##0';
      }
    });

    return wb;
  }

  /**
   * Génère le buffer Excel pour envoi HTTP.
   */
  async toBuffer(workbook) {
    return workbook.xlsx.writeBuffer();
  }

  /**
   * Envoie le fichier Excel en réponse HTTP.
   */
  async sendResponse(res, workbook, filename) {
    const buffer = await this.toBuffer(workbook);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
    logger.info('📊 Export Excel envoyé', { filename });
  }

  // ===== Rapports prédéfinis =====

  /**
   * Situation d'un immeuble → Excel (Modèle officiel 12 colonnes avec en-tête vert et totaux rouges)
   */
  situationImmeubleWorkbook(data) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SMG IMMOBILIER';
    wb.created = new Date();

    const ws = wb.addWorksheet('Situation Immeuble');

    const titleText = `SITUATION IMMEUBLE ${(data.immeuble || '').toUpperCase()} MOIS ${(data.periode_libelle || '').toUpperCase()}`.trim();

    // 1. Titre général fusionné
    ws.mergeCells(1, 1, 1, 12);
    const titleCell = ws.getCell('A1');
    titleCell.value = titleText;
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF000000' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 32;

    // Définition des 12 colonnes standardisées
    const columns = [
      { header: 'N° DU LOGEMENT', key: 'numero_chambre', width: 16, align: 'center' },
      { header: 'NOMS & PRÉNOMS', key: 'nom_locataire', width: 28, align: 'left', bold: true },
      { header: 'CONTACT', key: 'telephone', width: 20, align: 'center' },
      { header: 'MONTANT DU LOYER', key: 'montant_loyer', width: 18, align: 'right', isMoney: true },
      { header: 'DESCRIPTION DU LOGEMENT', key: 'description_logement', width: 25, align: 'center' },
      { header: 'ARRIÉRÉ DU LOYER', key: 'arriere_loyer', width: 20, align: 'right', isMoney: true },
      { header: 'LOYER PAR ANTICIPATION', key: 'anticipation', width: 22, align: 'right', isMoney: true },
      { header: 'VERSEMENT AU COURS DU MOIS', key: 'versement_mois', width: 24, align: 'right', isMoney: true },
      { header: 'PÉRIODE CORRESPONDANT AU PAIEMENT', key: 'periode_paiement', width: 30, align: 'center' },
      { header: 'MODE DE PAIEMENT', key: 'mode_paiement', width: 18, align: 'center' },
      { header: 'CAUTION', key: 'caution', width: 18, align: 'right', isMoney: true },
      { header: 'OBSERVATIONS', key: 'observations', width: 34, align: 'left' },
    ];

    ws.columns = columns.map(c => ({ key: c.key, width: c.width }));

    // 2. Ligne des en-têtes (Ligne 2 avec fond vert pastel #C8E6C9)
    const headerRow = ws.getRow(2);
    headerRow.height = 28;
    columns.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = col.header;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC8E6C9' }, // Vert pastel fidèle au modèle
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    });

    // 3. Lignes de données
    const lignes = data.lignes || [];
    lignes.forEach((item, rIdx) => {
      const row = ws.addRow(columns.map(c => {
        const val = item[c.key];
        if (c.isMoney) return Number(val) || 0;
        return val != null && val !== '' ? val : '—';
      }));
      row.height = 20;

      columns.forEach((col, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.alignment = {
          horizontal: col.align || 'left',
          vertical: 'middle',
        };
        if (col.isMoney) {
          cell.numFmt = '#,##0';
        }
        if (col.bold && item[col.key] && item[col.key] !== '—') {
          cell.font = { name: 'Calibri', size: 10.5, bold: true };
        } else {
          cell.font = { name: 'Calibri', size: 10.5 };
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        };
      });
    });

    // 4. Ligne TOTAL (Rouge en gras fidèle au modèle)
    const tot = data.total || {};
    const totalRow = ws.addRow([
      'TOTAL',
      '',
      '',
      tot.montant_loyer || 0,
      '',
      tot.arriere_loyer || 0,
      tot.anticipation || 0,
      tot.versement_mois || 0,
      '',
      '',
      tot.caution || 0,
      '',
    ]);
    totalRow.height = 24;

    totalRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFD32F2F' } }; // Rouge vif officiel
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'double', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      };
      if ([4, 6, 7, 8, 12].includes(colNumber)) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber === 1) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    return wb;
  }

  /**
   * Situation des locataires → Excel
   */
  situationLocatairesWorkbook(data) {
    return this.createWorkbook({
      title: 'Situation des locataires',
      sheetName: 'Locataires',
      columns: [
        { header: 'Nom', key: 'nom', width: 25 },
        { header: 'Téléphone', key: 'telephone', width: 16 },
        { header: 'Immeuble', key: 'immeuble', width: 20 },
        { header: 'Logement', key: 'logement', width: 14 },
        { header: 'Doit', key: 'doit', width: 14, style: 'money' },
        { header: 'Statut', key: 'statut_compte', width: 14 },
        { header: 'Prochaine échéance', key: 'prochaine_echeance', width: 18 },
        { header: 'Fin bail', key: 'fin_bail', width: 14 },
      ],
      rows: data,
    });
  }

  /**
   * Rapport financier période → Excel
   */
  rapportFinancierWorkbook(data) {
    // Feuille par locataire
    const wbTenant = this.createWorkbook({
      title: `Rapport financier du ${data.start} au ${data.end}`,
      sheetName: 'Par locataire',
      columns: [
        { header: 'Locataire', key: 'nom', width: 25 },
        { header: 'Immeuble', key: 'immeuble', width: 20 },
        { header: 'Logement', key: 'logement', width: 14 },
        { header: 'Payé', key: 'paye', width: 14, style: 'money' },
        { header: 'Impayé', key: 'impaye', width: 14, style: 'money' },
        { header: 'Nb paiements', key: 'nb_paiements', width: 14 },
      ],
      rows: data.byTenant,
    });

    // Ajouter feuille par immeuble
    const ws2 = wbTenant.addWorksheet('Par immeuble');
    const propCols = [
      { header: 'Immeuble', key: 'immeuble', width: 25 },
      { header: 'Encaissé', key: 'encaisse', width: 16 },
      { header: 'Impayé', key: 'impaye', width: 16 },
      { header: 'Logements', key: 'logements', width: 12 },
      { header: 'Occupés', key: 'occupes', width: 12 },
      { header: 'Maintenances', key: 'maintenances', width: 14 },
      { header: 'Coût maintenance', key: 'cout_maintenance', width: 18 },
    ];
    ws2.columns = propCols;
    const headerRow = ws2.getRow(1);
    propCols.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    });
    data.byProperty.forEach((row) => ws2.addRow(row));

    return wbTenant;
  }
}

module.exports = new ExcelService();
