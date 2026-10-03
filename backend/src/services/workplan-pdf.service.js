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

function detectTrade(t) {
  const text = `${t.title || ''} ${t.nature_probleme || ''} ${t.description || ''} ${t.location_zone || ''}`.toLowerCase();
  if (text.includes('plomb') || text.includes('siphon') || text.includes('douche') || text.includes('fuite') || text.includes('lavabo') || text.includes('bidet') || text.includes('eau') || text.includes('robinet') || text.includes('chasse') || text.includes('tuyau') || text.includes('canalisation')) {
    return 'Plomberie & Sanitaire';
  }
  if (text.includes('electr') || text.includes('électr') || text.includes('prise') || text.includes('compteur') || text.includes('eclair') || text.includes('éclair') || text.includes('reglette') || text.includes('réglette') || text.includes('câble') || text.includes('disjoncteur')) {
    return 'Électricité & Éclairage';
  }
  if (text.includes('clim') || text.includes('froid') || text.includes('ventilat')) {
    return 'Climatisation & Froid';
  }
  if (text.includes('peint') || text.includes('ponçage') || text.includes('enduit')) {
    return 'Peinture & Finitions';
  }
  if (text.includes('revet') || text.includes('revêt') || text.includes('plafond') || text.includes('sol') || text.includes('carrelage') || text.includes('pave') || text.includes('pavé')) {
    return 'Revêtements, Sols & Plafonds';
  }
  if (text.includes('toit') || text.includes('etanch') || text.includes('étanch') || text.includes('humid') || text.includes('moisiss') || text.includes('infiltration')) {
    return 'Étanchéité, Toiture & Humidité';
  }
  if (text.includes('porte') || text.includes('serrur') || text.includes('fenetr') || text.includes('fenêtr') || text.includes('vitre') || text.includes('cadenas') || text.includes('menuis') || text.includes('rideau')) {
    return 'Menuiserie & Serrurerie';
  }
  if (text.includes('macon') || text.includes('maçon') || text.includes('mur') || text.includes('fissur') || text.includes('béton') || text.includes('dalle') || text.includes('ferraill')) {
    return 'Maçonnerie & Gros Œuvre';
  }
  if (text.includes('nettoy') || text.includes('debarras') || text.includes('débarras') || text.includes('entretien')) {
    return 'Entretien & Nettoyage';
  }
  return 'Interventions Diverses';
}

class WorkPlanPdfService {
  async generate(tasks = [], options = {}) {
    const settings = companyService.getSettings();
    const primaryColor = settings.primary_color || COLORS.primary;

    const periodTitle = options.period_label
      || (options.period_start && options.period_end
        ? `DU ${fmtDate(options.period_start)} AU ${fmtDate(options.period_end)}`
        : 'PLAN DE TRAVAIL & FICHE DE SUIVI');

    let scopeLabel = '';
    if (options.scope_label) {
      scopeLabel = options.scope_label.toUpperCase();
    } else {
      const parts = [];
      if (options.city || options.group) parts.push(`VILLE : ${(options.city || options.group).toUpperCase()}`);
      if (options.property_names) parts.push(`IMMEUBLE(S) : ${options.property_names.toUpperCase()}`);
      else if (options.property_name) parts.push(`IMMEUBLE : ${options.property_name.toUpperCase()}`);
      if (options.worksite_names) parts.push(`CHANTIER(S) : ${options.worksite_names.toUpperCase()}`);
      else if (options.worksite_name) parts.push(`CHANTIER : ${options.worksite_name.toUpperCase()}`);
      scopeLabel = parts.join('  |  ');
    }
    const fullSubtitle = [periodTitle, scopeLabel].filter(Boolean).join('  —  ');

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 20, bottom: 25, left: 30, right: 30 },
      bufferPages: true,
      info: {
        Title: `Plan de Travail — SMG IMMOBILIER`,
        Author: cleanText(settings.name || 'SMG IMMOBILIER'),
        Creator: 'SMG IMMOBILIER Work Plan Module',
      },
    });

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));

    const pageW = doc.page.width;
    const contentW = pageW - 60;
    const bottomLimit = doc.page.height - 35;

    // Dessin en-tête d'entreprise
    drawCompanyHeader(doc, {
      title: 'PLAN DE TRAVAIL OFFICIEL & FICHE DE SUIVI',
      subtitle: cleanText(fullSubtitle),
    });

    // Titre principal bandeau
    doc.moveDown(0.3);
    const startY = doc.y;

    doc.rect(30, startY, contentW, 28).fill(primaryColor);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff')
      .text(cleanText(`PLAN DE TRAVAIL – ${fullSubtitle}`), 35, startY + 8, {
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

    // Tableau des Tâches : 7 colonnes adaptées au format paysage
    // Total = 25 + 90 + 120 + 220 + 90 + 177 + 60 = 782 pt
    const cols = [
      { key: 'num', label: 'N°', w: 25, align: 'center' },
      { key: 'priority', label: 'Priorité / Métier', w: 90, align: 'center' },
      { key: 'zone', label: 'Immeuble / Chantier / Zone', w: 120, align: 'left' },
      { key: 'problem', label: 'Nature du problème / Travaux à faire', w: 220, align: 'left' },
      { key: 'assignee', label: 'Intervenant assigné', w: 90, align: 'left' },
      { key: 'observation', label: 'Observation / État d\'avancement', w: 177, align: 'left' },
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
          title: 'PLAN DE TRAVAIL OFFICIEL & FICHE DE SUIVI (SUITE)',
          subtitle: cleanText(periodTitle),
        });
        doc.y += 6;
        drawTableHeader();
        return true;
      }
      return false;
    };

    // Mode de regroupement sélectionné (site, assignee, category, priority)
    const groupBy = options.group_by || 'site';

    // Construction des groupes dynamiques
    let groupMap = new Map();

    if (groupBy === 'site') {
      // Regroupement par Immeuble ou Chantier
      tasks.forEach((t) => {
        let key = 'general';
        let title = '🏢 Interventions Générales / Hors site';
        let bg = '#f1f5f9';
        let border = '#94a3b8';
        let text = '#334155';

        if (t.worksite) {
          key = `ws_${t.worksite.id}`;
          title = `🚧 CHANTIER : ${(t.worksite.title || 'Chantier').toUpperCase()} (${t.worksite.location || 'Douala/Yaoundé'})`;
          bg = '#f3e8ff';
          border = '#a855f7';
          text = '#6b21a8';
        } else if (t.property) {
          key = `prop_${t.property.id}`;
          title = `🏢 IMMEUBLE : ${t.property.property_name.toUpperCase()} (${t.property.city || 'Douala'})`;
          bg = '#e0f2fe';
          border = '#0284c7';
          text = '#0369a1';
        }

        if (!groupMap.has(key)) {
          groupMap.set(key, { id: key, title, bg, border, text, tasks: [] });
        }
        groupMap.get(key).tasks.push(t);
      });
    } else if (groupBy === 'assignee') {
      // Regroupement par Technicien / Intervenant assigné
      tasks.forEach((t) => {
        let key = t.assignee ? `u_${t.assignee.id}` : 'unassigned';
        let title = t.assignee
          ? `👷 INTERVENANT : ${t.assignee.full_name.toUpperCase()}${t.assignee.phone ? ` (Tél: ${t.assignee.phone})` : ''}`
          : '👥 NON ASSIGNÉ / ÉQUIPE TECHNIQUE GÉNÉRALE';
        let bg = t.assignee ? '#ecfdf5' : '#f8fafc';
        let border = t.assignee ? '#10b981' : '#cbd5e1';
        let text = t.assignee ? '#065f46' : '#475569';

        if (!groupMap.has(key)) {
          groupMap.set(key, { id: key, title, bg, border, text, tasks: [] });
        }
        groupMap.get(key).tasks.push(t);
      });
    } else if (groupBy === 'category') {
      // Regroupement par Corps d'état / Métier
      tasks.forEach((t) => {
        const trade = detectTrade(t);
        let key = trade;
        let title = `🔧 MÉTIER : ${trade.toUpperCase()}`;
        let bg = '#fef3c7';
        let border = '#f59e0b';
        let text = '#92400e';

        if (!groupMap.has(key)) {
          groupMap.set(key, { id: key, title, bg, border, text, tasks: [] });
        }
        groupMap.get(key).tasks.push(t);
      });
    } else {
      // Regroupement par Niveau de Priorité (par défaut)
      const defs = [
        { id: 'urgent', title: '🚨 GROUPE : TÂCHES URGENTES & CRITIQUES', bg: '#fee2e2', border: '#ef4444', text: '#991b1b', m: (t) => (t.priority || '').toLowerCase() === 'urgent' },
        { id: 'renov', title: '🏗️ GROUPE : RÉNOVATIONS COMPLÈTES', bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8', m: (t) => (t.priority || '').toLowerCase().includes('rénovation') },
        { id: 'maint', title: '🔧 GROUPE : OPÉRATIONS DE MAINTENANCE COURANTE', bg: '#fef3c7', border: '#f59e0b', text: '#92400e', m: (t) => (t.priority || '').toLowerCase().includes('maintenance') },
        { id: 'normal', title: 'ℹ️ GROUPE : AUTRES INTERVENTIONS & TÂCHES DIVERSES', bg: '#f1f5f9', border: '#94a3b8', text: '#334155', m: (t) => (t.priority || '').toLowerCase() !== 'urgent' && !(t.priority || '').toLowerCase().includes('maintenance') && !(t.priority || '').toLowerCase().includes('rénovation') },
      ];
      defs.forEach((d) => {
        const matching = tasks.filter(d.m);
        if (matching.length) {
          groupMap.set(d.id, { id: d.id, title: d.title, bg: d.bg, border: d.border, text: d.text, tasks: matching });
        }
      });
    }

    let globalIdx = 0;

    // Rendu séquentiel par groupe
    groupMap.forEach((grp) => {
      const grpTasks = grp.tasks;
      if (!grpTasks.length) return;

      const grpDone = grpTasks.filter((t) => t.status === 'completed' || (t.observation || '').toUpperCase().includes('FAIT')).length;
      const grpDoing = grpTasks.filter((t) => t.status === 'in_progress').length;
      const grpTodo = grpTasks.filter((t) => t.status === 'pending' || !t.status).length;

      // Vérification saut de page pour l'en-tête de groupe
      checkPage(42);

      // Bandeau d'en-tête du groupe
      const gY = doc.y;
      doc.rect(30, gY, contentW, 20).fill(grp.bg);
      doc.rect(30, gY, contentW, 20).strokeColor(grp.border).lineWidth(0.8).stroke();

      const grpHeaderTitle = `${grp.title}  —  (${grpTasks.length} tâche${grpTasks.length > 1 ? 's' : ''}  |  ${grpDone} FAIT  |  ${grpDoing} En cours  |  ${grpTodo} À faire)`;
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor(grp.text)
        .text(cleanText(grpHeaderTitle), 36, gY + 5.5, { width: contentW - 12, align: 'left' });

      doc.y = gY + 20;

      // Parcourir les tâches de ce groupe
      grpTasks.forEach((t, i) => {
        globalIdx++;
        const priority = t.priority || 'Normal';
        const trade = detectTrade(t);
        const isUrgent = (t.priority || '').toLowerCase() === 'urgent';
        const isMaint = (t.priority || '').toLowerCase().includes('maintenance');
        const isRenov = (t.priority || '').toLowerCase().includes('rénovation');

        const zone = t.location_zone
          || (t.apartment ? `Log. ${t.apartment.apartment_number} (${t.property?.property_name || ''})` : '')
          || (t.worksite ? `Chantier: ${t.worksite.title}` : '')
          || (t.property ? t.property.property_name : '')
          || '—';

        const problem = t.nature_probleme || t.title || t.description || '—';
        const assignee = t.assignee ? t.assignee.full_name : 'Non assigné';
        const observation = t.observation || t.completion_note || (t.status === 'completed' ? 'FAIT' : '—');

        let statusLabel = 'À faire';
        if (t.status === 'in_progress') statusLabel = 'En cours';
        else if (t.status === 'completed') statusLabel = 'FAIT';
        else if (t.status === 'not_done') statusLabel = 'Non fait';
        else if (t.status === 'cancelled') statusLabel = 'Annulé';

        // Hauteur dynamique selon contenu texte
        const probHeight = doc.heightOfString(cleanText(problem), { width: 212, font: 'Helvetica', size: 8 });
        const obsHeight = doc.heightOfString(cleanText(observation), { width: 169, font: 'Helvetica', size: 8 });
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

        // 1. N° (25)
        doc.fontSize(8).font('Helvetica').fillColor(COLORS.text)
          .text(String(globalIdx), currX, rY + 4, { width: 25, align: 'center' });
        currX += 25;

        // 2. Priorité / Métier (90)
        let pBg = COLORS.normalBg;
        let pColor = COLORS.normalText;
        if (isUrgent) { pBg = COLORS.urgentBg; pColor = COLORS.urgentText; }
        else if (isMaint) { pBg = COLORS.maintBg; pColor = COLORS.maintText; }
        else if (isRenov) { pBg = COLORS.renovBg; pColor = COLORS.renovText; }

        doc.rect(currX + 3, rY + 3, 84, rowH - 6).fill(pBg);
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(pColor)
          .text(cleanText(priority), currX + 4, rY + 5, { width: 82, align: 'center' });
        currX += 90;

        // 3. Immeuble / Chantier / Zone (120)
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(COLORS.text)
          .text(cleanText(zone), currX + 4, rY + 4, { width: 112, align: 'left' });
        currX += 120;

        // 4. Nature du problème / Travaux (220)
        doc.fontSize(7.5).font('Helvetica').fillColor(COLORS.text)
          .text(cleanText(problem), currX + 4, rY + 4, { width: 212, align: 'left' });
        currX += 220;

        // 5. Intervenant assigné (90)
        doc.fontSize(7.5).font(t.assignee ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(t.assignee ? '#1e293b' : COLORS.muted)
          .text(cleanText(assignee), currX + 4, rY + 4, { width: 82, align: 'left' });
        currX += 90;

        // 6. Observation / État d'avancement (177)
        const isDone = observation.toUpperCase().includes('FAIT') || t.status === 'completed';
        doc.fontSize(7.5).font(isDone ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(isDone ? COLORS.doneText : (isUrgent ? COLORS.urgentText : COLORS.text))
          .text(cleanText(observation), currX + 4, rY + 4, { width: 169, align: 'left' });
        currX += 177;

        // 7. Statut (60)
        let sBg = '#e2e8f0';
        let sColor = '#334155';
        if (t.status === 'completed') { sBg = COLORS.doneBg; sColor = COLORS.doneText; }
        else if (t.status === 'in_progress') { sBg = COLORS.inProgBg; sColor = COLORS.inProgText; }
        else if (t.status === 'not_done') { sBg = COLORS.urgentBg; sColor = COLORS.urgentText; }

        doc.rect(currX + 3, rY + 3, 54, rowH - 6).fill(sBg);
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(sColor)
          .text(cleanText(statusLabel), currX + 4, rY + 5, { width: 52, align: 'center' });

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
