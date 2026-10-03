// ============ Service PDF Plan de Travail & Fiche de Suivi — SMG IMMOBILIER ============
const PDFDocument = require('pdfkit');
const { cleanText, fmtDate, drawCompanyHeader } = require('../utils/pdf-helpers');
const companyService = require('./company-settings.service');

const COLORS = {
  primary: '#1a3a5c',
  secondary: '#f0f4f8',
  text: '#212529',
  muted: '#555555',
  border: '#cbd5e1',
  rowAlt: '#f8fafc',
  urgentBg: '#fee2e2',
  urgentText: '#991b1b',
  maintBg: '#fef3c7',
  maintText: '#92400e',
  renovBg: '#f3e8ff',
  renovText: '#6b21a8',
  normalBg: '#e2e8f0',
  normalText: '#334155',
  doneBg: '#dcfce7',
  doneText: '#166534',
  inProgBg: '#e0f2fe',
  inProgText: '#0369a1',
};

class WorkPlanPdfService {
  async generate(tasks = [], options = {}) {
    const settings = companyService.getSettings();
    const primaryColor = settings.primary_color || COLORS.primary;

    const periodTitle = options.period_label
      || (options.period_start && options.period_end
        ? `DU ${fmtDate(options.period_start)} AU ${fmtDate(options.period_end)}`
        : 'PLAN DE TRAVAIL DU MOIS & SUIVI HEBDOMADAIRE');

    let scopeLabel = '';
    if (options.city || options.group) {
      scopeLabel = `SECTEUR / VILLE : ${(options.city || options.group).toUpperCase()}`;
    } else if (options.property_name) {
      scopeLabel = `IMMEUBLE : ${options.property_name.toUpperCase()}`;
    }
    const fullSubtitle = [periodTitle, scopeLabel].filter(Boolean).join('  —  ');

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 20, bottom: 25, left: 30, right: 30 },
      bufferPages: true,
      info: {
        Title: `Plan de Travail Urgent — SMG IMMOBILIER`,
        Author: cleanText(settings.name || 'SMG IMMOBILIER'),
        Creator: 'SMG IMMOBILIER Work Plan Module',
      },
    });

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));

    const pageW = doc.page.width;
    const contentW = pageW - 60;
    const bottomLimit = doc.page.height - 35;

    // Dessin en-tête
    drawCompanyHeader(doc, {
      title: 'PLAN DE TRAVAIL URGENT & FICHE DE SUIVI',
      subtitle: cleanText(fullSubtitle),
    });

    // Titre principal
    doc.moveDown(0.3);
    const startY = doc.y;

    // Titre bandeau
    doc.rect(30, startY, contentW, 28).fill(primaryColor);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#ffffff')
      .text(cleanText(`PLAN DE TRAVAIL URGENT – ${fullSubtitle}`), 35, startY + 8, {
        width: contentW - 10,
        align: 'center',
      });

    doc.y = startY + 34;

    // Synthèse / KPIs
    const total = tasks.length;
    const urgentCount = tasks.filter((t) => (t.priority || '').toLowerCase() === 'urgent').length;
    const maintCount = tasks.filter((t) => (t.priority || '').toLowerCase().includes('maintenance')).length;
    const doneCount = tasks.filter((t) => t.status === 'completed' || (t.observation || '').toUpperCase().includes('FAIT')).length;
    const inProgCount = tasks.filter((t) => t.status === 'in_progress').length;

    const kpiBoxY = doc.y;
    doc.rect(30, kpiBoxY, contentW, 22).fill('#f1f5f9');
    doc.rect(30, kpiBoxY, contentW, 22).strokeColor(COLORS.border).lineWidth(0.5).stroke();

    const kpiText = `Total interventions : ${total}   |   Urgentes : ${urgentCount}   |   Maintenances : ${maintCount}   |   En cours : ${inProgCount}   |   FAIT / Terminé : ${doneCount}`;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryColor)
      .text(cleanText(kpiText), 35, kpiBoxY + 6, { width: contentW - 10, align: 'center' });

    doc.y = kpiBoxY + 28;

    // Tableau des Tâches
    // Colonnes : N° (25) | Priorité (95) | Appartement / Zone (120) | Nature du problème (260) | Observation / État d'avancement (180) | Statut (70)
    const cols = [
      { key: 'num', label: 'N°', w: 25, align: 'center' },
      { key: 'priority', label: 'Priorité', w: 100, align: 'left' },
      { key: 'zone', label: 'Appartement / Zone', w: 120, align: 'left' },
      { key: 'problem', label: 'Nature du problème', w: 260, align: 'left' },
      { key: 'observation', label: 'Observation / État d\'avancement', w: 185, align: 'left' },
      { key: 'status', label: 'Statut', w: 60, align: 'center' },
    ];

    const drawTableHeader = () => {
      const hY = doc.y;
      doc.rect(30, hY, contentW, 20).fill('#2c3e50');
      let currX = 30;
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#ffffff');
      cols.forEach((col) => {
        doc.text(col.label, currX + 4, hY + 5, { width: col.w - 8, align: col.align });
        currX += col.w;
      });
      doc.y = hY + 20;
    };

    drawTableHeader();

    const checkPage = (needed) => {
      if (doc.y + needed > bottomLimit) {
        doc.addPage();
        drawCompanyHeader(doc, {
          title: 'PLAN DE TRAVAIL URGENT & FICHE DE SUIVI (SUITE)',
          subtitle: cleanText(periodTitle),
        });
        doc.y += 6;
        drawTableHeader();
        return true;
      }
      return false;
    };

    // Définition des Groupes d'interventions
    const groupDefinitions = [
      {
        id: 'urgent',
        title: 'GROUPE : TÂCHES URGENTES & CRITIQUES',
        icon: 'URGENT',
        bg: '#fee2e2',
        border: '#f87171',
        text: '#991b1b',
        matcher: (t) => (t.priority || '').toLowerCase() === 'urgent',
      },
      {
        id: 'renovation',
        title: 'GROUPE : RÉNOVATIONS COMPLÈTES',
        icon: 'RÉNOVATION',
        bg: '#f3e8ff',
        border: '#c084fc',
        text: '#6b21a8',
        matcher: (t) => {
          const p = (t.priority || '').toLowerCase();
          return p.includes('rénovation') || p.includes('renovation');
        },
      },
      {
        id: 'maintenance',
        title: 'GROUPE : OPÉRATIONS DE MAINTENANCE COURANTE',
        icon: 'MAINTENANCE',
        bg: '#fef3c7',
        border: '#fbbf24',
        text: '#92400e',
        matcher: (t) => (t.priority || '').toLowerCase().includes('maintenance'),
      },
      {
        id: 'normal',
        title: 'GROUPE : AUTRES INTERVENTIONS & TÂCHES DIVERSES',
        icon: 'NORMAL',
        bg: '#f1f5f9',
        border: '#cbd5e1',
        text: '#334155',
        matcher: (t) => {
          const p = (t.priority || '').toLowerCase();
          return p !== 'urgent' && !p.includes('maintenance') && !p.includes('rénovation') && !p.includes('renovation');
        },
      },
    ];

    let globalIdx = 0;

    // Rendu par groupe
    groupDefinitions.forEach((grp) => {
      const grpTasks = tasks.filter(grp.matcher);
      if (!grpTasks.length) return;

      const grpDone = grpTasks.filter((t) => t.status === 'completed' || (t.observation || '').toUpperCase().includes('FAIT')).length;

      // Vérification saut de page pour l'en-tête de groupe
      checkPage(42);

      // Bandeau d'en-tête du groupe
      const gY = doc.y;
      doc.rect(30, gY, contentW, 19).fill(grp.bg);
      doc.rect(30, gY, contentW, 19).strokeColor(grp.border).lineWidth(0.8).stroke();

      const grpHeaderTitle = `>> ${grp.title}  —  (${grpTasks.length} tâche${grpTasks.length > 1 ? 's' : ''}  |  ${grpDone} FAIT / Terminée${grpDone > 1 ? 's' : ''})`;
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(grp.text)
        .text(cleanText(grpHeaderTitle), 36, gY + 5, { width: contentW - 12, align: 'left' });

      doc.y = gY + 19;

      // Parcourir les tâches de ce groupe
      grpTasks.forEach((t, i) => {
        globalIdx++;
        const priority = t.priority || 'Normal';
        const isUrgent = grp.id === 'urgent';
        const isMaint = grp.id === 'maintenance';
        const isRenov = grp.id === 'renovation';

        const zone = t.location_zone
          || (t.worksite ? `Chantier: ${t.worksite.title}` : '')
          || (t.apartment ? `Logement ${t.apartment.apartment_number}` : '')
          || (t.property ? t.property.property_name : '')
          || '—';

        const problem = t.nature_probleme || t.title || t.description || '—';
        const observation = t.observation || t.completion_note || (t.status === 'completed' ? 'FAIT' : '—');

        let statusLabel = 'À faire';
        if (t.status === 'in_progress') statusLabel = 'En cours';
        else if (t.status === 'completed') statusLabel = 'FAIT';
        else if (t.status === 'not_done') statusLabel = 'Non fait';
        else if (t.status === 'cancelled') statusLabel = 'Annulé';

        // Hauteur dynamique selon contenu texte
        const probHeight = doc.heightOfString(cleanText(problem), { width: 252, font: 'Helvetica', size: 8 });
        const obsHeight = doc.heightOfString(cleanText(observation), { width: 177, font: 'Helvetica', size: 8 });
        const rowH = Math.max(18, Math.max(probHeight, obsHeight) + 8);

        checkPage(rowH);

        const rY = doc.y;
        const isAlt = i % 2 === 1;

        // Fond de ligne
        if (isUrgent) {
          doc.rect(30, rY, contentW, rowH).fill('#fff8f8');
        } else if (isAlt) {
          doc.rect(30, rY, contentW, rowH).fill(COLORS.rowAlt);
        }
        doc.rect(30, rY, contentW, rowH).strokeColor(COLORS.border).lineWidth(0.3).stroke();

        let currX = 30;

        // 1. N°
        doc.fontSize(8).font('Helvetica').fillColor(COLORS.text)
          .text(String(globalIdx), currX, rY + 4, { width: 25, align: 'center' });
        currX += 25;

        // 2. Priorité (Badge visuel)
        let pBg = COLORS.normalBg;
        let pColor = COLORS.normalText;
        if (isUrgent) { pBg = COLORS.urgentBg; pColor = COLORS.urgentText; }
        else if (isMaint) { pBg = COLORS.maintBg; pColor = COLORS.maintText; }
        else if (isRenov) { pBg = COLORS.renovBg; pColor = COLORS.renovText; }

        doc.rect(currX + 4, rY + 3, 90, rowH - 6).fill(pBg);
        doc.fontSize(8).font('Helvetica-Bold').fillColor(pColor)
          .text(cleanText(priority), currX + 6, rY + 5, { width: 86, align: 'center' });
        currX += 100;

        // 3. Appartement / Zone
        doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.text)
          .text(cleanText(zone), currX + 4, rY + 4, { width: 112, align: 'left' });
        currX += 120;

        // 4. Nature du problème
        doc.fontSize(8).font('Helvetica').fillColor(COLORS.text)
          .text(cleanText(problem), currX + 4, rY + 4, { width: 252, align: 'left' });
        currX += 260;

        // 5. Observation / État d'avancement
        const isDone = observation.toUpperCase().includes('FAIT') || t.status === 'completed';
        doc.fontSize(8).font(isDone ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(isDone ? COLORS.doneText : (isUrgent ? COLORS.urgentText : COLORS.text))
          .text(cleanText(observation), currX + 4, rY + 4, { width: 177, align: 'left' });
        currX += 185;

        // 6. Statut
        let sBg = '#e2e8f0';
        let sColor = '#334155';
        if (t.status === 'completed') { sBg = COLORS.doneBg; sColor = COLORS.doneText; }
        else if (t.status === 'in_progress') { sBg = COLORS.inProgBg; sColor = COLORS.inProgText; }
        else if (t.status === 'not_done') { sBg = COLORS.urgentBg; sColor = COLORS.urgentText; }

        doc.rect(currX + 4, rY + 3, 52, rowH - 6).fill(sBg);
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(sColor)
          .text(cleanText(statusLabel), currX + 5, rY + 5, { width: 50, align: 'center' });

        doc.y = rY + rowH;
      });

      doc.y += 4;
    });

    // Bloc de signature en bas de page
    checkPage(55);
    doc.y += 12;
    const signY = doc.y;
    const signBoxW = (contentW - 30) / 3;

    // 1. Gestionnaire
    doc.rect(30, signY, signBoxW, 40).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(primaryColor)
      .text('LE GESTIONNAIRE / SUIVI', 35, signY + 5, { width: signBoxW - 10, align: 'center' });
    doc.fontSize(7).font('Helvetica').fillColor(COLORS.muted)
      .text('Date & Signature :', 35, signY + 26, { width: signBoxW - 10, align: 'left' });

    // 2. Directeur Technique
    doc.rect(30 + signBoxW + 15, signY, signBoxW, 40).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(primaryColor)
      .text('DIRECTION TECHNIQUE & TRAVAUX', 30 + signBoxW + 20, signY + 5, { width: signBoxW - 10, align: 'center' });
    doc.fontSize(7).font('Helvetica').fillColor(COLORS.muted)
      .text('Visa & Validation :', 30 + signBoxW + 20, signY + 26, { width: signBoxW - 10, align: 'left' });

    // 3. Direction Générale
    doc.rect(30 + (signBoxW + 15) * 2, signY, signBoxW, 40).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(primaryColor)
      .text('DIRECTION GÉNÉRALE / MANAGER', 30 + (signBoxW + 15) * 2 + 5, signY + 5, { width: signBoxW - 10, align: 'center' });
    doc.fontSize(7).font('Helvetica').fillColor(COLORS.muted)
      .text('Approbation :', 30 + (signBoxW + 15) * 2 + 5, signY + 26, { width: signBoxW - 10, align: 'left' });

    // Numérotation des pages
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8')
        .text(
          `Document édité le ${fmtDate(new Date())} · SMG IMMOBILIER · Page ${i + 1} sur ${range.count}`,
          30,
          doc.page.height - 18,
          { width: contentW, align: 'center' }
        );
    }

    doc.end();
    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }
}

module.exports = new WorkPlanPdfService();
