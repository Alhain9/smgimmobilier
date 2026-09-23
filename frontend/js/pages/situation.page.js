// ============ Situation des locataires + récapitulatifs par période ============
// Réservé à ceux qui gèrent les locataires (super_admin, manager, dir_admin, gestionnaire).
const PageSituation = {
  register() { Router.register('situation', () => this.render()); },
  _situation: [], _start: null, _end: null,

  async render() {
    Layout.setTitle('Situation & rapports');
    const now = new Date();
    this._end = now.toISOString().slice(0, 10);
    this._start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    Layout.content(`
      <div class="page-head flex justify-between items-center flex-wrap gap-3">
        <div><h2>Situation & rapports locataires</h2><div class="subtitle">Suivi des locataires et récapitulatifs par période</div></div>
        <div class="flex gap-2 items-center flex-wrap no-print">
          <select class="form-control" id="sitHeaderBldSelect" style="max-width:260px" onchange="PageSituation.selectBuildingFilter(this.value)">
            <option value="">🏢 Tous les immeubles</option>
          </select>
          <button class="btn btn-outline" onclick="window.print()">🖨 Imprimer</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header flex justify-between items-center flex-wrap gap-2">
          <h3>👤 Situation des locataires</h3>
          <div class="flex gap-2 no-print" style="max-width:320px; width:100%;">
            <input class="form-control" id="sitSearch" placeholder="🔎 Rechercher un locataire…" oninput="PageSituation.filter()"/>
          </div>
        </div>
        <div class="card-body"><div id="situationBox"><div class="spinner"></div></div></div>
      </div>

      <div class="card no-print">
        <div class="card-header"><h3>📅 Période du récapitulatif</h3></div>
        <div class="card-body">
          <div class="period-bar">
            <div class="period-presets">
              <button class="btn btn-sm btn-primary" onclick="PageSituation.applyPreset('month')">Ce mois</button>
              <button class="btn btn-sm btn-outline" onclick="PageSituation.applyPreset(30)">30 jours</button>
              <button class="btn btn-sm btn-outline" onclick="PageSituation.applyPreset(90)">3 mois</button>
              <button class="btn btn-sm btn-outline" onclick="PageSituation.applyPreset('year')">Cette année</button>
            </div>
            <div class="period-custom">
              <input type="date" class="form-control" id="sitStart" value="${this._start}"/>
              <span>→</span>
              <input type="date" class="form-control" id="sitEnd" value="${this._end}"/>
              <button class="btn btn-sm btn-primary" onclick="PageSituation.applyCustom()">Appliquer</button>
            </div>
          </div>
        </div>
      </div>

      <div id="recapBox"><div class="spinner"></div></div>

      <div class="card" id="buildingCardSection">
        <div class="card-header">
          <h3>🏢 Situation détaillée par immeuble</h3>
          <div class="flex gap-2 no-print flex-wrap">
            <select class="form-control" id="bldSelect" style="max-width:240px" onchange="PageSituation.selectBuildingFilter(this.value)"></select>
            <button class="btn btn-sm btn-outline" id="bldExport" style="display:none" onclick="PageSituation.exportBuildingExcel()">⬇ Exporter Excel</button>
            <button class="btn btn-sm btn-primary" onclick="PageProperties.openImportModal()">📤 Importer Fichier Excel</button>
          </div>
        </div>
        <div class="card-body"><div id="buildingBox" class="text-muted">Choisissez un immeuble pour afficher sa situation détaillée.</div></div>
      </div>
    `);
    this.loadSituation();
    this.loadRecap();
    this.loadBuildingsList();
  },

  // ---------- Situation par immeuble (modèle Excel) ----------
  async loadBuildingsList() {
    try {
      const props = (await API.get('/properties')).data || [];
      const opts = '<option value="">🏢 Tous les immeubles</option>'
        + props.map((p) => `<option value="${p.id}">${p.property_name}</option>`).join('');
      
      const sel = document.getElementById('bldSelect');
      if (sel) sel.innerHTML = '<option value="">— Choisir un immeuble —</option>' + props.map((p) => `<option value="${p.id}">${p.property_name}</option>`).join('');
      
      const headSel = document.getElementById('sitHeaderBldSelect');
      if (headSel) headSel.innerHTML = opts;
    } catch (_) { /* ignore */ }
  },
  _building: null,
  COLS: [
    ['numero_chambre', 'N° chambre', 'text'], ['nom_locataire', 'Nom locataire', 'text'],
    ['telephone', 'Téléphone', 'text'], ['date_occupation', 'Date occupation', 'date'],
    ['montant_loyer', 'Montant loyer', 'money'], ['observations', 'Observations', 'text'],
    ['arriere_loyer', 'Arriéré de loyer', 'money'], ['avance_sur_arriere', 'Avance / arriéré', 'money'],
    ['dette', 'Dette', 'money'], ['anticipation', 'Payé par anticipation', 'money'],
    ['versement_mois', 'Versement du mois', 'money'], ['periode_actuelle', 'Période actuelle', 'date'],
    ['mode_paiement', 'Mode de paiement', 'method'],
  ],
  _cell(l, key, type) {
    const v = l[key];
    if (v == null || v === '') return type === 'text' ? (key === 'nom_locataire' ? '/' : '—') : '—';
    if (type === 'money') return Helpers.formatMoney(v);
    if (type === 'date') return Helpers.formatDate(v);
    if (type === 'method') return Helpers.methodLabel(v);
    return v;
  },
  async loadBuilding(id) {
    const box = document.getElementById('buildingBox');
    const exp = document.getElementById('bldExport');
    if (!id) { box.innerHTML = 'Choisissez un immeuble pour afficher sa situation détaillée.'; exp.style.display = 'none'; this._building = null; return; }
    box.innerHTML = '<div class="spinner"></div>';
    try {
      const { data: d } = await API.get('/reports/building-situation/' + id);
      this._building = d;
      const head = this.COLS.map((c) => `<th>${c[1]}</th>`).join('');
      const rows = d.lignes.map((l) => `<tr>${this.COLS.map((c) => `<td>${this._cell(l, c[0], c[2])}</td>`).join('')}</tr>`).join('')
        || `<tr><td colspan="${this.COLS.length}" class="text-center text-muted">Aucun logement</td></tr>`;
      const t = d.total;
      const totalRow = `<tr style="font-weight:700;background:var(--bg-surface-2)">
        <td>TOTAL</td><td></td><td></td><td></td>
        <td>${Helpers.formatMoney(t.montant_loyer)}</td><td></td>
        <td>${Helpers.formatMoney(t.arriere_loyer)}</td><td>${Helpers.formatMoney(t.avance_sur_arriere)}</td>
        <td>${Helpers.formatMoney(t.dette)}</td><td>${Helpers.formatMoney(t.anticipation)}</td>
        <td>${Helpers.formatMoney(t.versement_mois)}</td><td></td><td></td></tr>`;
      box.innerHTML = `<div class="mb-4" style="font-weight:600">SITUATION IMMEUBLE — ${d.immeuble}</div>
        <div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}${totalRow}</tbody></table></div>`;
      exp.style.display = '';
    } catch (e) { box.innerHTML = `<div class="text-muted">Erreur : ${e.message}</div>`; exp.style.display = 'none'; }
  },
  exportBuildingExcel() {
    const d = this._building;
    if (!d || !window.XLSX) { Toast.error('Rien à exporter'); return; }
    const headers = this.COLS.map((c) => c[1]);
    const aoa = [['SITUATION IMMEUBLE — ' + d.immeuble], headers];
    d.lignes.forEach((l) => aoa.push(this.COLS.map((c) => {
      const v = l[c[0]];
      if (v == null || v === '') return c[2] === 'money' ? 0 : '';
      if (c[2] === 'method') return Helpers.methodLabel(v);
      return v;
    })));
    const t = d.total;
    aoa.push(['TOTAL', '', '', '', t.montant_loyer, '', t.arriere_loyer, t.avance_sur_arriere, t.dette, t.anticipation, t.versement_mois, '', '']);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Situation');
    XLSX.writeFile(wb, 'situation_' + String(d.immeuble).replace(/\s+/g, '_') + '.xlsx');
    Toast.success('Excel exporté');
  },

  // ---------- Situation (état courant) ----------
  async loadSituation() {
    const box = document.getElementById('situationBox');
    try {
      this._situation = (await API.get('/reports/tenant-situation')).data || [];
      this.renderSituation(this._situation);
    } catch (e) { box.innerHTML = `<div class="text-muted">Erreur : ${e.message}</div>`; }
  },
  selectBuildingFilter(id) {
    const headSel = document.getElementById('sitHeaderBldSelect');
    if (headSel && headSel.value !== id) headSel.value = id;

    const bldSel = document.getElementById('bldSelect');
    if (bldSel && bldSel.value !== id) bldSel.value = id;

    this.filter();

    if (id) {
      this.loadBuilding(id);
    } else {
      const box = document.getElementById('buildingBox');
      const exp = document.getElementById('bldExport');
      if (box) box.innerHTML = 'Choisissez un immeuble pour afficher sa situation détaillée.';
      if (exp) exp.style.display = 'none';
      this._building = null;
    }
  },

  filter() {
    const qEl = document.getElementById('sitSearch');
    const bldEl = document.getElementById('sitHeaderBldSelect');
    const s = qEl ? (qEl.value || '').toLowerCase() : '';
    const bldId = bldEl ? bldEl.value : '';

    let list = this._situation;
    if (bldId) {
      list = list.filter((r) => String(r.property_id) === String(bldId));
    }
    if (s) {
      list = list.filter((r) =>
        (r.nom || '').toLowerCase().includes(s) ||
        (r.immeuble || '').toLowerCase().includes(s) ||
        (r.logement || '').toLowerCase().includes(s) ||
        (r.telephone || '').includes(s)
      );
    }
    this.renderSituation(list);
  },
  renderSituation(list) {
    const today = new Date();
    const soon = new Date(today.getTime() + 30 * 86400000);
    const rows = list.map((r) => {
      const doit = r.doit > 0
        ? `<b style="color:var(--danger)">${Helpers.formatMoney(r.doit)}</b>`
        : '<span class="badge badge-success">À jour</span>';
      let echeance = '—';
      if (r.prochaine_echeance) {
        const dateFmt = Helpers.formatDate(r.prochaine_echeance);
        if (r.jours_restants !== undefined && r.jours_restants !== null) {
          let badge = '';
          if (r.jours_restants < 0) {
            badge = `<br><span class="badge badge-danger" style="font-size:10.5px;font-weight:700">En retard de ${Math.abs(r.jours_restants)} j</span>`;
          } else if (r.jours_restants === 0) {
            badge = `<br><span class="badge badge-danger" style="font-size:10.5px;font-weight:700">Aujourd'hui !</span>`;
          } else if (r.jours_restants <= 10) {
            badge = `<br><span class="badge badge-warning" style="font-size:10.5px;font-weight:700">Dans ${r.jours_restants} j</span>`;
          } else {
            badge = `<br><span class="badge badge-muted" style="font-size:10.5px">Dans ${r.jours_restants} j</span>`;
          }
          echeance = `<b>${dateFmt}</b>${badge}`;
        } else {
          echeance = dateFmt;
        }
      }
      let fin = '—';
      if (r.fin_bail) {
        const d = new Date(r.fin_bail);
        const cls = d < today ? 'color:var(--danger)' : (d < soon ? 'color:var(--warning)' : '');
        fin = `<span style="${cls}">${Helpers.formatDate(r.fin_bail)}</span>`;
      }
      return `<tr>
        <td><b>${r.nom}</b></td>
        <td>${r.telephone ? `<a href="tel:${r.telephone}">${r.telephone}</a>` : '—'}</td>
        <td>${doit}</td>
        <td>${this.statutBadge(r.statut_compte)}</td>
        <td>${echeance}</td>
        <td>${fin}</td>
        <td>${r.logement || '<span class="text-muted">Non attribué</span>'}</td>
        <td>${r.immeuble || '—'}</td>
        <td><button class="btn btn-sm btn-outline no-print" onclick="PageSituation.ledger(${r.tenant_id})">📋 Relevé</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="9" class="text-center text-muted">Aucun locataire</td></tr>';
    document.getElementById('situationBox').innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Nom</th><th>Téléphone</th><th>Ce qu'il doit</th><th>Statut</th><th>Prochaine échéance</th><th>Fin de bail</th><th>Logement</th><th>Immeuble</th><th class="no-print"></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  },
  statutBadge(s) {
    const map = { a_jour: ['badge-success', 'À jour'], partiel: ['badge-warning', 'Partiellement à jour'], retard: ['badge-danger', 'En retard'] };
    const [cls, label] = map[s] || ['badge-muted', '—'];
    return `<span class="badge ${cls}">${label}</span>`;
  },

  // ---------- Relevé de compte d'un locataire (grand livre) ----------
  async ledger(tenantId) {
    Modal.open('Relevé de compte', '<div class="spinner"></div>', '<button class="btn btn-outline" onclick="Modal.close()">Fermer</button>');
    try {
      const { data: d } = await API.get('/payments/ledger/' + tenantId);
      const tx = (d.transactions || []).map((t) => `<tr>
        <td>${Helpers.formatDate(t.date)}</td>
        <td>${Helpers.formatMoney(t.montant)}</td>
        <td>${Helpers.methodLabel(t.methode)}</td>
        <td>${Helpers.statusBadge(t.statut)}</td>
        <td>${t.preuve ? `<a href="${Helpers.fileUrl(t.preuve)}" target="_blank">📎</a>` : '—'}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="text-center text-muted">Aucune transaction</td></tr>';

      const mods = (d.modifications || []).map((m) => `<div class="list-item">
        <div style="flex:1"><b>${this.actionLabel(m.action)}</b> — ${m.description || ''}<br>
          <span class="text-muted" style="font-size:12px">${Helpers.formatDateTime(m.date)}${m.par ? ' · ' + m.par : ''}</span></div>
      </div>`).join('') || '<div class="text-muted">Aucune modification enregistrée</div>';

      Modal.open('📋 Relevé — ' + (d.tenant.nom || ''), `
        <div class="text-muted" style="margin-bottom:6px">${d.tenant.logement || '—'}${d.tenant.immeuble ? ' · ' + d.tenant.immeuble : ''} · Loyer ${Helpers.formatMoney(d.loyer_mensuel)}/mois · ${d.mois_dus} mois dus</div>
        <div class="stats-grid">
          ${this._stat('🏠', 'sky', Helpers.formatMoney(d.total_du), 'Total loyers dus')}
          ${this._stat('✅', 'green', Helpers.formatMoney(d.total_valide), 'Paiements validés')}
          ${this._stat('🕓', 'orange', Helpers.formatMoney(d.en_attente_preuve), 'En attente de preuve')}
          ${this._stat('⚖️', d.solde > 0 ? 'red' : 'green', Helpers.formatMoney(Math.max(0, d.solde)), 'Solde restant dû')}
        </div>
        <div class="list-item"><div style="flex:1">Statut du locataire</div>${this.statutBadge(d.statut)}</div>
        <h4 class="mt-4">🧾 Historique des transactions</h4>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th>Montant</th><th>Méthode</th><th>Statut</th><th>Preuve</th></tr></thead><tbody>${tx}</tbody></table></div>
        <h4 class="mt-4">✏️ Historique des modifications</h4>${mods}`,
        '<button class="btn btn-outline" onclick="Modal.close()">Fermer</button>');
    } catch (e) {
      Modal.open('Relevé de compte', `<div class="text-muted">Erreur : ${e.message}</div>`, '<button class="btn btn-outline" onclick="Modal.close()">Fermer</button>');
    }
  },
  actionLabel(a) {
    return { created: 'Création', updated: 'Modification', proof_added: 'Preuve ajoutée', validated: 'Validé', rejected: 'Rejeté' }[a] || a;
  },

  // ---------- Récap par période ----------
  applyPreset(p) {
    const now = new Date();
    if (p === 'month') { this._start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10); this._end = now.toISOString().slice(0, 10); }
    else if (p === 'year') { this._start = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10); this._end = now.toISOString().slice(0, 10); }
    else { this._end = now.toISOString().slice(0, 10); this._start = new Date(now.getTime() - (p - 1) * 86400000).toISOString().slice(0, 10); }
    const a = document.getElementById('sitStart'); if (a) a.value = this._start;
    const b = document.getElementById('sitEnd'); if (b) b.value = this._end;
    this.loadRecap();
  },
  applyCustom() {
    const s = document.getElementById('sitStart').value, e = document.getElementById('sitEnd').value;
    if (!s || !e) { Toast.error('Choisissez les deux dates'); return; }
    if (s > e) { Toast.error('Début après fin'); return; }
    this._start = s; this._end = e; this.loadRecap();
  },
  async loadRecap() {
    const box = document.getElementById('recapBox');
    box.innerHTML = '<div class="spinner"></div>';
    try {
      const { data: d } = await API.get(`/reports/recap?start=${this._start}&end=${this._end}`);
      box.innerHTML = this.recapHtml(d);
    } catch (e) { box.innerHTML = `<div class="text-muted">Erreur : ${e.message}</div>`; }
  },
  recapHtml(d) {
    const range = `${Helpers.formatDate(d.start)} → ${Helpers.formatDate(d.end)}`;
    const tRows = (d.byTenant || []).map((r) => `<tr>
      <td><b>${r.nom}</b></td><td>${r.immeuble}</td><td>${r.logement}</td>
      <td style="color:var(--success)">${Helpers.formatMoney(r.paye)}</td>
      <td style="color:var(--danger)">${Helpers.formatMoney(r.impaye)}</td>
      <td>${r.nb_paiements}</td></tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted">Aucun paiement sur la période</td></tr>';

    const pRows = (d.byProperty || []).map((r) => `<tr>
      <td><b>${r.immeuble}</b></td>
      <td style="color:var(--success)">${Helpers.formatMoney(r.encaisse)}</td>
      <td style="color:var(--danger)">${Helpers.formatMoney(r.impaye)}</td>
      <td>${r.occupes}/${r.logements}</td>
      <td>${r.maintenances}</td>
      <td>${Helpers.formatMoney(r.cout_maintenance)}</td></tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted">Aucun immeuble</td></tr>';

    const m = d.maintenance || {};
    const mByProp = (m.byProperty || []).map((r) => `<div class="list-item"><div style="flex:1">${r.immeuble}</div><b>${r.total}</b></div>`).join('') || '<div class="text-muted">Aucune intervention</div>';

    return `
      <div class="card"><div class="card-header"><h3>💰 Récap par locataire</h3><span class="text-muted">${range}</span></div>
        <div class="card-body"><div class="table-wrap"><table>
          <thead><tr><th>Locataire</th><th>Immeuble</th><th>Logement</th><th>Encaissé</th><th>Impayé</th><th>Nb</th></tr></thead>
          <tbody>${tRows}</tbody></table></div></div></div>

      <div class="card"><div class="card-header"><h3>🏢 Récap par immeuble</h3><span class="text-muted">${range}</span></div>
        <div class="card-body"><div class="table-wrap"><table>
          <thead><tr><th>Immeuble</th><th>Encaissé</th><th>Impayé</th><th>Occupation</th><th>Maintenances</th><th>Coût maint.</th></tr></thead>
          <tbody>${pRows}</tbody></table></div></div></div>

      <div class="card"><div class="card-header"><h3>🔧 Récap maintenance</h3><span class="text-muted">${range}</span></div>
        <div class="card-body">
          <div class="stats-grid">
            ${this._stat('🔧', 'sky', m.total || 0, 'Total interventions')}
            ${this._stat('⏳', 'orange', (m.reported || 0) + (m.validated || 0) + (m.in_progress || 0), 'En cours / ouvertes')}
            ${this._stat('✅', 'green', m.completed || 0, 'Terminées')}
            ${this._stat('🧾', 'orange', Helpers.formatMoney(m.cout || 0), 'Coût matériel')}
          </div>
          <h4 class="mt-4">Par immeuble</h4>${mByProp}
        </div></div>`;
  },
  _stat(icon, color, value, name) {
    return `<div class="stat-card"><div class="stat-icon ${color}">${icon}</div>
      <div class="stat-info"><div class="stat-value">${value}</div><div class="stat-name">${name}</div></div></div>`;
  },
};
