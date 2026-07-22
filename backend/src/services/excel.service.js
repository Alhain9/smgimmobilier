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
   * Situation d'un immeuble → Excel
   */
  situationImmeubleWorkbook(data) {
    return this.createWorkbook({
      title: `Situation — ${data.immeuble}`,
      sheetName: 'Situation Immeuble',
      columns: [
        { header: 'N° Chambre', key: 'numero_chambre', width: 14 },
        { header: 'Locataire', key: 'nom_locataire', width: 25 },
        { header: 'Téléphone', key: 'telephone', width: 16 },
        { header: 'Date occupation', key: 'date_occupation', width: 16 },
        { header: 'Loyer', key: 'montant_loyer', width: 14, style: 'money' },
        { header: 'Arriéré', key: 'arriere_loyer', width: 14, style: 'money' },
        { header: 'Dette', key: 'dette', width: 14, style: 'money' },
        { header: 'Anticipation', key: 'anticipation', width: 14, style: 'money' },
        { header: 'Versement mois', key: 'versement_mois', width: 16, style: 'money' },
        { header: 'Observations', key: 'observations', width: 22 },
      ],
      rows: data.lignes,
      totals: data.total,
    });
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
