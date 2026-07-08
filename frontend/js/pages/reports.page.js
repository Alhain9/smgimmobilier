const PageReports = {
  register() { Router.register('reports', () => this.render()); },
  type: 'finance', period: 'month', from: '', to: '',

  range() {
    const now = new Date();
    let start, end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    if (this.period === 'custom' && this.from && this.to) {
      return { start: new Date(this.from), end: new Date(this.to + 'T23:59:59') };
    }
    switch (this.period) {
      case 'today': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
      case 'week': start = new Date(now); start.setDate(now.getDate() - 7); break;
      case 'quarter': start = new Date(now); start.setMonth(now.getMonth() - 3); break;
      case 'year': start = new Date(now.getFullYear(), 0, 1); break;
      default: start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return { start, end };
  },
  inRange(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr); const { start, end } = this.range();
    return d >= start && d <= end;
  },

  async render() {
    Layout.setTitle('Rapports');
    Layout.content(`
      <div class="page-head"><div><h2>Rapports administratifs</h2><div class="subtitle">Générez et exportez vos rapports par période</div></div></div>
      <div class="card mb-4"><div class="card-body">
        <div class="toolbar">
          <select class="form-control" id="repType" style="max-width:220px" onchange="PageReports.set('type', this.value)">
            <option value="finance">📊 Financier</option>
            <option value="maintenance">🔧 Maintenance</option>
            <option value="realestate">🏢 Immobilier</option>
          </select>
          <select class="form-control" id="repPeriod" style="max-width:200px" onchange="PageReports.set('period', this.value)">
            <option value="today">Aujourd'hui</option><option value="week">7 derniers jours</option>
            <option value="month" selected>Ce mois</option><option value="quarter">Ce trimestre</option>
            <option value="year">Cette année</option><option value="custom">Personnalisée</option>
          </select>
          <span id="customRange" class="hidden" style="gap:8px">
            <input type="date" class="form-control" id="repFrom" onchange="PageReports.from=this.value" />
            <input type="date" class="form-control" id="repTo" onchange="PageReports.to=this.value" />
          </span>
          <button class="btn btn-primary" onclick="PageReports.generate()">Générer</button>
        </div>
      </div></div>
      <div id="reportResult"></div>
      <hr style="margin:30px 0;border:none;border-top:1px solid var(--border)">
      <div id="importSection"></div>
    `);
    this.renderImport();
    this.generate();
  },
  set(k, v) {
    this[k] = v;
    if (k === 'period') {
      const el = document.getElementById('customRange');
      el.classList.toggle('hidden', v !== 'custom');
      el.style.display = v === 'custom' ? 'flex' : 'none';
    }
  },

  async generate() {
    const box = document.getElementById('reportResult');
    box.innerHTML = '<div class="spinner"></div>';
    try {
      if (this.type === 'finance') return this.financeReport(box);
      if (this.type === 'maintenance') return this.maintenanceReport(box);
      return this.realestateReport(box);
    } catch (e) { box.innerHTML = `<div class="empty-state">⚠️ ${e.message}</div>`; }
  },

  _exportBar() {
    return `<div class="flex gap-2">
      <button class="btn btn-sm btn-outline" onclick="PageReports.exportPDF()">📄 PDF</button>
      <button class="btn btn-sm btn-outline" onclick="PageReports.exportExcel()">📊 Excel</button>
      <button class="btn btn-sm btn-outline" onclick="PageReports.exportCSV()">📑 CSV</button>
    </div>`;
  },
  _lastTable: { head: [], rows: [], title: '' },

  async financeReport(box) {
    const [pays, exps] = await Promise.all([API.get('/payments'), API.get('/expenses')]);
    const payments = pays.data.filter((p) => this.inRange(p.payment_date));
    const expenses = exps.data.filter((e) => this.inRange(e.created_at));
    const revenue = payments.filter((p) => p.status === 'completed').reduce((s, p) => s + parseFloat(p.amount), 0);
    const unpaid = payments.filter((p) => ['pending', 'failed'].includes(p.status)).reduce((s, p) => s + parseFloat(p.amount), 0);
    const spent = expenses.reduce((s, e) => s + parseFloat(e.total_price || 0), 0);
    const rows = [
      ['Revenus encaissés', Helpers.formatMoney(revenue)],
      ['Impayés / en attente', Helpers.formatMoney(unpaid)],
      ['Dépenses', Helpers.formatMoney(spent)],
      ['Solde net', Helpers.formatMoney(revenue - spent)],
    ];
    this._lastTable = { head: ['Indicateur', 'Montant'], rows, title: 'Rapport financier' };
    box.innerHTML = `<div class="card"><div class="card-header"><h3>Rapport financier</h3>${this._exportBar()}</div>
      <div class="card-body">
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-icon green">💰</div><div class="stat-info"><div class="stat-value">${Helpers.formatMoney(revenue)}</div><div class="stat-name">Revenus</div></div></div>
          <div class="stat-card"><div class="stat-icon red">🔴</div><div class="stat-info"><div class="stat-value">${Helpers.formatMoney(unpaid)}</div><div class="stat-name">Impayés</div></div></div>
          <div class="stat-card"><div class="stat-icon orange">🧾</div><div class="stat-info"><div class="stat-value">${Helpers.formatMoney(spent)}</div><div class="stat-name">Dépenses</div></div></div>
          <div class="stat-card"><div class="stat-icon sky">📈</div><div class="stat-info"><div class="stat-value">${Helpers.formatMoney(revenue - spent)}</div><div class="stat-name">Solde net</div></div></div>
        </div>
        <p class="text-muted">${payments.length} paiement(s) · ${expenses.length} dépense(s) sur la période.</p>
      </div></div>`;
  },

  async maintenanceReport(box) {
    const [maint, exps] = await Promise.all([API.get('/maintenance'), API.get('/expenses')]);
    const items = maint.data.filter((m) => this.inRange(m.created_at));
    const byStatus = (s) => items.filter((m) => m.status === s).length;
    const cost = exps.data.filter((e) => this.inRange(e.created_at)).reduce((s, e) => s + parseFloat(e.total_price || 0), 0);
    const rows = [
      ['Total interventions', String(items.length)],
      ['Signalées', String(byStatus('reported'))],
      ['En cours', String(byStatus('in_progress'))],
      ['Terminées', String(byStatus('completed'))],
      ['Coût matériaux', Helpers.formatMoney(cost)],
    ];
    this._lastTable = { head: ['Indicateur', 'Valeur'], rows, title: 'Rapport maintenance' };
    box.innerHTML = `<div class="card"><div class="card-header"><h3>Rapport maintenance</h3>${this._exportBar()}</div>
      <div class="card-body"><div class="table-wrap"><table><tbody>
        ${rows.map((r) => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td></tr>`).join('')}
      </tbody></table></div></div></div>`;
  },

  async realestateReport(box) {
    const [apts, tenants] = await Promise.all([API.get('/apartments'), API.get('/tenants')]);
    const total = apts.data.length;
    const occupied = apts.data.filter((a) => a.status === 'occupied').length;
    const free = apts.data.filter((a) => a.status === 'free').length;
    const rate = total ? Math.round((occupied / total) * 100) : 0;
    const newTenants = tenants.data.filter((t) => this.inRange(t.created_at)).length;
    const rows = [
      ['Logements total', String(total)], ['Occupés', String(occupied)], ['Libres', String(free)],
      ["Taux d'occupation", rate + '%'], ['Nouveaux locataires (période)', String(newTenants)],
    ];
    this._lastTable = { head: ['Indicateur', 'Valeur'], rows, title: 'Rapport immobilier' };
    box.innerHTML = `<div class="card"><div class="card-header"><h3>Rapport immobilier</h3>${this._exportBar()}</div>
      <div class="card-body"><div class="table-wrap"><table><tbody>
        ${rows.map((r) => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td></tr>`).join('')}
      </tbody></table></div></div></div>`;
  },

  _periodLabel() {
    const { start, end } = this.range();
    return `${Helpers.formatDate(start)} → ${Helpers.formatDate(end)}`;
  },
  exportPDF() {
    const t = this._lastTable; const { jsPDF } = window.jspdf; const doc = new jsPDF();
    PDF._header(doc, 'RAPPORT', '');
    doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.text(t.title, 14, 40);
    doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.text('Période : ' + this._periodLabel(), 14, 47);
    doc.autoTable({ startY: 52, head: [t.head], body: t.rows, theme: 'grid', headStyles: { fillColor: PDF.SKY } });
    PDF._footer(doc);
    doc.save(t.title.replace(/\s+/g, '_') + '.pdf'); Toast.success('PDF exporté');
  },
  exportExcel() {
    const t = this._lastTable;
    const ws = XLSX.utils.aoa_to_sheet([t.head, ...t.rows]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Rapport');
    XLSX.writeFile(wb, t.title.replace(/\s+/g, '_') + '.xlsx'); Toast.success('Excel exporté');
  },
  exportCSV() {
    const t = this._lastTable;
    const csv = [t.head, ...t.rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = t.title.replace(/\s+/g, '_') + '.csv'; a.click(); Toast.success('CSV exporté');
  },

  // ===================== IMPORT EXCEL / CSV =====================
  importType: 'payments',
  _parsed: [],
  renderImport() {
    document.getElementById('importSection').innerHTML = `
      <div class="page-head"><div><h2>Importation de données</h2><div class="subtitle">Excel (.xlsx) ou CSV — aperçu avant validation</div></div></div>
      <div class="card"><div class="card-body">
        <div class="toolbar">
          <select class="form-control" id="impType" style="max-width:220px" onchange="PageReports.importType=this.value">
            <option value="payments">Paiements</option>
            <option value="expenses">Dépenses (matériaux)</option>
            <option value="tenants">Locataires</option>
          </select>
          <input type="file" class="form-control" id="impFile" accept=".xlsx,.xls,.csv" style="max-width:280px" />
          <button class="btn btn-outline" onclick="PageReports.previewImport()">👁 Prévisualiser</button>
          <button class="btn btn-sm btn-outline" onclick="PageReports.downloadTemplate()">⬇ Modèle</button>
        </div>
        <div id="importPreview" class="mt-4"></div>
      </div></div>`;
  },
  TEMPLATES: {
    payments: ['tenant_id', 'apartment_id', 'amount', 'payment_method', 'payment_date', 'status'],
    expenses: ['maintenance_id', 'item_name', 'category', 'quantity', 'unit_price', 'supplier'],
    tenants: ['full_name', 'email', 'phone', 'cni', 'profession'],
  },
  downloadTemplate() {
    const cols = this.TEMPLATES[this.importType];
    const ws = XLSX.utils.aoa_to_sheet([cols]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Modele');
    XLSX.writeFile(wb, `modele_${this.importType}.xlsx`);
  },
  previewImport() {
    const file = document.getElementById('impFile').files[0];
    if (!file) { Toast.error('Sélectionnez un fichier'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        if (!rows.length) { Toast.error('Fichier vide'); return; }
        const seen = new Set();
        this._parsed = rows.filter((r) => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; });
        const cols = Object.keys(this._parsed[0]);
        const head = cols.map((c) => `<th>${c}</th>`).join('');
        const body = this._parsed.slice(0, 20).map((r) => `<tr>${cols.map((c) => `<td>${r[c]}</td>`).join('')}</tr>`).join('');
        document.getElementById('importPreview').innerHTML = `
          <div class="flex justify-between items-center mb-4">
            <b>${this._parsed.length} ligne(s) détectée(s)</b>
            <button class="btn btn-primary" onclick="PageReports.confirmImport()">✅ Valider l'import</button>
          </div>
          <div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
          ${this._parsed.length > 20 ? '<p class="text-muted">Aperçu des 20 premières lignes.</p>' : ''}`;
      } catch (err) { Toast.error('Erreur de lecture : ' + err.message); }
    };
    reader.readAsBinaryString(file);
  },
  async confirmImport() {
    if (!this._parsed.length) return;
    const endpoint = { payments: '/payments', expenses: '/expenses', tenants: '/tenants' }[this.importType];
    let ok = 0, fail = 0;
    Toast.info('Import en cours...');
    for (const row of this._parsed) {
      try { await API.post(endpoint, row); ok++; } catch (_) { fail++; }
    }
    Toast.success(`Import terminé : ${ok} réussi(s), ${fail} échec(s)`);
    document.getElementById('importPreview').innerHTML = `<div class="empty-state"><div class="icon">✅</div>${ok} enregistrement(s) importé(s)${fail ? `, ${fail} échec(s)` : ''}.</div>`;
    this._parsed = [];
  },
};
