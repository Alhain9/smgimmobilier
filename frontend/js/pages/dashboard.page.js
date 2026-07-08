// ============ Page Tableau de bord (adaptatif par rôle) ============
const PageDashboard = {
  register() {
    Router.register('dashboard', () => this.render());
    // Routes espace locataire
    Router.register('my-lease', () => this.renderTenantLease());
    Router.register('my-payments', () => this.renderTenantPayments());
    Router.register('my-maintenance', () => this.renderTenantMaintenance());
  },

  statCard(icon, color, value, name) {
    return `<div class="stat-card">
      <div class="stat-icon ${color}">${icon}</div>
      <div class="stat-info"><div class="stat-value">${value}</div><div class="stat-name">${name}</div></div>
    </div>`;
  },

  _timer: null,
  stopRealtime() { if (this._timer) { clearInterval(this._timer); this._timer = null; } },

  async render() {
    this.stopRealtime();
    const role = Auth.getRole();
    if (role === 'locataire') return this.renderTenantHome();
    if (role === 'technicien') return this.renderTechnician();
    await this.renderAdmin();
    // Rafraîchissement temps réel toutes les 15s (KPI globaux manager/super_admin uniquement)
    if (Auth.hasRole('manager', 'super_admin')) {
      this._timer = setInterval(() => {
        if ((window.location.hash.replace('#', '') || 'dashboard') !== 'dashboard') { this.stopRealtime(); return; }
        this.refreshStats();
      }, 15000);
    }
  },

  async refreshStats() {
    try {
      const { data: s } = await API.get('/dashboard/stats');
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('st_free', s.free); set('st_tenants', s.tenants); set('st_occ', s.occupancyRate + '%');
      set('st_revenue', Helpers.formatMoney(s.finance.revenue));
      set('st_unpaid', Helpers.formatMoney(s.finance.unpaid));
      set('st_charges', Helpers.formatMoney(s.finance.charges));
      set('st_maint', s.maintenances.active);
      set('st_docs', s.documents); set('st_equip', s.equipment); set('st_tasks', s.tasksOpen);
      set('st_salpend', Helpers.formatMoney(s.finance.salariesPending));
      set('st_balance', Helpers.formatMoney(s.finance.balance));
      set('st_occupied', `${s.occupied}/${s.apartments}`);
      set('st_leases', s.activeLeases); set('st_users', s.users);
      const t = document.getElementById('rt_time'); if (t) t.textContent = new Date().toLocaleTimeString('fr-FR');
    } catch (_) { /* silencieux */ }
  },

  async renderAdmin() {
    Layout.setTitle('Tableau de bord');
    const isGlobal = Auth.hasRole('manager', 'super_admin');
    let sectors = [];
    try { sectors = (await API.get('/dashboard/sector-summary')).data; } catch { sectors = []; }

    let body = `<div class="page-head"><div>
        <h2>Bonjour, ${Auth.getUser().full_name.split(' ')[0]} 👋</h2>
        <div class="subtitle">${isGlobal ? "Vue d'ensemble en temps réel · 🟢 maj <span id=\"rt_time\">" + new Date().toLocaleTimeString('fr-FR') + '</span>' : 'Vue d\'ensemble de votre périmètre'}</div>
      </div></div>
      <div id="myDayMini" class="mb-4"></div>`;

    if (Auth.hasRole('super_admin', 'manager', 'dir_admin', 'dir_technique')) {
      body += `<div id="globalActivityTrackerContainer" class="mb-4"></div>`;
    }

    if (isGlobal) {
      const { data: s } = await API.get('/dashboard/stats');
      const { data: revenue } = await API.get('/dashboard/revenue');

      const months = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
      const max = Math.max(...revenue, 1);
      const bars = revenue.map((v, i) =>
        `<div class="chart-bar" style="height:${(v / max) * 100}%" title="${months[i]}: ${Helpers.formatMoney(v)}"></div>`).join('');
      const labels = months.map((m) => `<span>${m}</span>`).join('');

      body += `
        <div class="stats-grid">
          ${this.statCard('🏢','sky', s.properties, 'Immeubles')}
          ${this.statCard('🚪','green', `<span id="st_free">${s.free}</span>`, 'Logements libres')}
          ${this.statCard('👤','sky', `<span id="st_tenants">${s.tenants}</span>`, 'Locataires')}
          ${this.statCard('📈','orange', `<span id="st_occ">${s.occupancyRate}%</span>`, "Taux d'occupation")}
        </div>

        <div class="stats-grid">
          ${this.statCard('💰','green', `<span id="st_revenue">${Helpers.formatMoney(s.finance.revenue)}</span>`, 'Revenus encaissés')}
          ${this.statCard('🔴','red', `<span id="st_unpaid">${Helpers.formatMoney(s.finance.unpaid)}</span>`, 'Impayés')}
          ${this.statCard('🧾','orange', `<span id="st_charges">${Helpers.formatMoney(s.finance.charges)}</span>`, 'Charges (dép.+salaires)')}
          ${this.statCard('🔧','red', `<span id="st_maint">${s.maintenances.active}</span>`, 'Maintenances actives')}
        </div>

        <div class="stats-grid">
          ${this.statCard('💵','orange', `<span id="st_salpend">${Helpers.formatMoney(s.finance.salariesPending)}</span>`, 'Salaires à payer')}
          ${this.statCard('📂','sky', `<span id="st_docs">${s.documents}</span>`, 'Documents')}
          ${this.statCard('🛠','sky', `<span id="st_equip">${s.equipment}</span>`, 'Équipements')}
          ${this.statCard('✅','green', `<span id="st_tasks">${s.tasksOpen}</span>`, 'Tâches en cours')}
        </div>

        <div class="grid-2">
          <div class="card">
            <div class="card-header"><h3>Revenus mensuels ${new Date().getFullYear()}</h3></div>
            <div class="card-body">
              <div class="chart-bars">${bars}</div>
              <div class="chart-labels">${labels}</div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h3>Synthèse temps réel</h3></div>
            <div class="card-body">
              <div class="list-item"><span class="list-dot" style="background:var(--success)"></span><div style="flex:1">Logements occupés</div><b id="st_occupied">${s.occupied}/${s.apartments}</b></div>
              <div class="list-item"><span class="list-dot" style="background:var(--info)"></span><div style="flex:1">Baux actifs</div><b id="st_leases">${s.activeLeases}</b></div>
              <div class="list-item"><span class="list-dot" style="background:var(--warning)"></span><div style="flex:1">Logements en maintenance / réservés</div><b>${s.maintenanceApts} / ${s.reservedApts}</b></div>
              <div class="list-item"><span class="list-dot" style="background:var(--primary)"></span><div style="flex:1">Utilisateurs</div><b id="st_users">${s.users}</b></div>
              <div class="list-item"><span class="list-dot" style="background:${s.finance.balance>=0?'var(--success)':'var(--danger)'}"></span><div style="flex:1">Solde net (revenus - charges)</div><b id="st_balance">${Helpers.formatMoney(s.finance.balance)}</b></div>
            </div>
          </div>
        </div>
      `;
    }

    // Carte « Performance sur la période » — visible par les rôles finance (cohérent avec le secteur Finances)
    const canFinance = Auth.hasRole('manager', 'super_admin', 'dir_admin', 'comptable');
    if (canFinance) body += this.periodCardHtml();

    if (sectors.length) {
      this._sectors = sectors;
      body += `
        <div class="card">
          <div class="card-header"><h3>Vue par secteur</h3></div>
          <div class="card-body">
            <div class="stats-grid">
              ${sectors.map((sec) => this.sectorCard(sec)).join('')}
            </div>
          </div>
        </div>
      `;
    }

    Layout.content(body);
    this.loadMyDayMini();
    if (canFinance) this.loadPeriod();
    if (Auth.hasRole('super_admin', 'manager', 'dir_admin', 'dir_technique')) {
      this.loadGlobalActivityTracker();
    }
  },

  periodCardHtml() {
    return `
      <div class="card" id="periodCard">
        <div class="card-header">
          <h3>📊 Performance sur la période</h3>
          <button class="btn btn-sm btn-outline no-print" onclick="window.print()">🖨 Imprimer</button>
        </div>
        <div class="card-body">
          <div class="period-bar no-print">
            <div class="period-presets">
              <button class="btn btn-sm btn-outline" onclick="PageDashboard.applyPreset(7)">7 jours</button>
              <button class="btn btn-sm btn-primary" onclick="PageDashboard.applyPreset(30)">30 jours</button>
              <button class="btn btn-sm btn-outline" onclick="PageDashboard.applyPreset(90)">3 mois</button>
              <button class="btn btn-sm btn-outline" onclick="PageDashboard.applyPreset(180)">6 mois</button>
              <button class="btn btn-sm btn-outline" onclick="PageDashboard.applyPreset(365)">12 mois</button>
            </div>
            <div class="period-custom">
              <input type="date" class="form-control" id="perStart"/>
              <span>→</span>
              <input type="date" class="form-control" id="perEnd"/>
              <button class="btn btn-sm btn-primary" onclick="PageDashboard.applyCustom()">Appliquer</button>
            </div>
          </div>
          <div id="periodBody" class="text-center text-muted" style="padding:24px">Chargement…</div>
        </div>
      </div>`;
  },

  // Carte compacte « Ma journée » (résumé tâches + lien vers la page Activité)
  async loadMyDayMini() {
    const el = document.getElementById('myDayMini');
    if (!el) return;
    try {
      const { data } = await API.get('/dashboard/day?scope=me');
      const c = data.day.counts;
      el.innerHTML = `<div class="card"><div class="card-body flex items-center justify-between" style="gap:14px;flex-wrap:wrap">
        <div class="flex items-center gap-3"><span style="font-size:1.9rem">📋</span>
          <div><b>Ma journée</b><div class="text-muted" style="font-size:13px">${c.todo} à faire · ${c.doing} en cours · ${c.done} fait aujourd'hui · ${c.events} événement(s)</div></div></div>
        <button class="btn btn-primary" onclick="Router.go('activity')">Voir ma journée →</button>
      </div></div>`;
    } catch (_) { el.innerHTML = ''; }
  },

  // ===== Statistiques par période =====
  _period: { start: null, end: null },
  applyPreset(days) {
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 86400000);
    this.loadPeriod(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
  },
  applyCustom() {
    const start = document.getElementById('perStart').value;
    const end = document.getElementById('perEnd').value;
    if (!start || !end) { Toast.error('Choisissez les deux dates'); return; }
    if (start > end) { Toast.error('La date de début doit précéder la date de fin'); return; }
    this.loadPeriod(start, end);
  },
  async loadPeriod(start, end) {
    if (!start || !end) {
      const e = new Date(); const s = new Date(e.getTime() - 29 * 86400000);
      start = s.toISOString().slice(0, 10); end = e.toISOString().slice(0, 10);
    }
    this._period = { start, end };
    const body = document.getElementById('periodBody');
    if (body) body.innerHTML = '<div class="spinner"></div>';
    try {
      const { data } = await API.get(`/dashboard/period?start=${start}&end=${end}`);
      const sEl = document.getElementById('perStart'); if (sEl) sEl.value = start;
      const eEl = document.getElementById('perEnd'); if (eEl) eEl.value = end;
      if (body) body.innerHTML = this.periodHtml(data);
    } catch (e) {
      if (body) body.innerHTML = `<div class="text-muted">Erreur de chargement : ${e.message}</div>`;
    }
  },
  periodHtml(d) {
    const s = d.series || { labels: [], revenue: [], expenses: [] };
    const max = Math.max(1, ...s.revenue, ...s.expenses);
    const bars = s.labels.map((lab, i) => `
      <div class="pchart-col">
        <div class="pchart-bars">
          <div class="pchart-bar rev" style="height:${(s.revenue[i] / max) * 100}%" title="Revenus ${lab} : ${Helpers.formatMoney(s.revenue[i])}"></div>
          <div class="pchart-bar exp" style="height:${(s.expenses[i] / max) * 100}%" title="Dépenses ${lab} : ${Helpers.formatMoney(s.expenses[i])}"></div>
        </div>
        <span class="pchart-label">${lab}</span>
      </div>`).join('') || '<div class="text-muted" style="padding:20px">Aucune donnée sur la période</div>';
    const fmtRange = `${Helpers.formatDate(d.start)} → ${Helpers.formatDate(d.end)}`;
    return `
      <div class="period-range text-muted" style="margin-bottom:10px">Période : <b>${fmtRange}</b></div>
      <div class="stats-grid">
        ${this.statCard('💰', 'green', Helpers.formatMoney(d.revenue), 'Revenus encaissés')}
        ${this.statCard('🧾', 'orange', Helpers.formatMoney(d.expenses), 'Dépenses')}
        ${this.statCard('💵', 'sky', Helpers.formatMoney(d.salaries), 'Salaires payés')}
        ${this.statCard('⚖️', d.balance >= 0 ? 'green' : 'red', Helpers.formatMoney(d.balance), 'Solde net')}
      </div>
      <div class="stats-grid">
        ${this.statCard('🧮', 'sky', d.paymentsCount, 'Transactions')}
        ${this.statCard('👤', 'green', d.newTenants, 'Nouveaux locataires')}
        ${this.statCard('📄', 'sky', d.newLeases, 'Baux signés')}
        ${this.statCard('🔧', 'orange', `${d.maintenanceOpened} / ${d.maintenanceCompleted}`, 'Maintenances ouvertes / terminées')}
      </div>
      <div class="pchart-legend"><span><i class="dot rev"></i> Revenus</span><span><i class="dot exp"></i> Dépenses</span></div>
      <div class="pchart">${bars}</div>`;
  },

  sectorCard(sec) {
    const rows = sec.headline.map((h) =>
      `<div class="list-item"><div style="flex:1">${h.label}</div><b>${h.money ? Helpers.formatMoney(h.value) : h.value}</b></div>`).join('');
    return `<div class="card sector-card" style="cursor:pointer" onclick="PageDashboard.openSector('${sec.key}')">
      <div class="card-body">
        <div class="flex items-center gap-2" style="margin-bottom:8px"><span style="font-size:1.6rem">${sec.icon}</span><h4 style="margin:0">${sec.label}</h4></div>
        ${rows}
      </div>
    </div>`;
  },

  async openSector(key) {
    const sec = (this._sectors || []).find((x) => x.key === key);
    try {
      const { data } = await API.get('/dashboard/sectors/' + key);
      Modal.open((sec ? sec.icon + ' ' : '') + (sec ? sec.label : key), this.sectorDetailHtml(key, data),
        `<button class="btn btn-outline" onclick="Modal.close()">Fermer</button>`);
    } catch (e) { Toast.error(e.message); }
  },

  sectorDetailHtml(key, d) {
    switch (key) {
      case 'patrimoine':
        return `
          <div class="list-item"><div style="flex:1">Immeubles</div><b>${d.properties}</b></div>
          <div class="list-item"><div style="flex:1">Logements totaux</div><b>${d.apartments}</b></div>
          <div class="list-item"><div style="flex:1">Logements libres</div><b>${d.free}</b></div>
          <div class="list-item"><div style="flex:1">Logements occupés</div><b>${d.occupied}</b></div>
          <div class="list-item"><div style="flex:1">En maintenance</div><b>${d.maintenanceApts}</b></div>
          <div class="list-item"><div style="flex:1">Réservés</div><b>${d.reservedApts}</b></div>
          <div class="list-item"><div style="flex:1">Taux d'occupation</div><b>${d.occupancyRate}%</b></div>
          <div class="list-item"><div style="flex:1">Locataires</div><b>${d.tenants}</b></div>
          <div class="list-item"><div style="flex:1">Baux actifs</div><b>${d.activeLeases}</b></div>`;
      case 'finances': {
        const methods = (d.byMethod || []).map((m) =>
          `<div class="list-item"><div style="flex:1">${Helpers.methodLabel(m.method)}</div><b>${Helpers.formatMoney(m.total)} (${m.count})</b></div>`).join('')
          || '<div class="text-muted">Aucun paiement complété</div>';
        return `
          <div class="list-item"><div style="flex:1">Revenus encaissés</div><b>${Helpers.formatMoney(d.revenue)}</b></div>
          <div class="list-item"><div style="flex:1">Impayés</div><b>${Helpers.formatMoney(d.unpaid)}</b></div>
          <div class="list-item"><div style="flex:1">En attente de vérification</div><b>${Helpers.formatMoney(d.awaiting)} (${d.awaitingCount})</b></div>
          <div class="list-item"><div style="flex:1">Dépenses</div><b>${Helpers.formatMoney(d.expenses)}</b></div>
          <h4 class="mt-4">Paiements complétés par méthode</h4>
          ${methods}`;
      }
      case 'technique': {
        const cats = (d.byCategory || []).map((c) =>
          `<div class="list-item"><div style="flex:1">${c.category}</div><b>${Helpers.formatMoney(c.total)}</b></div>`).join('')
          || '<div class="text-muted">Aucune dépense</div>';
        return `
          <div class="list-item"><div style="flex:1">Maintenances signalées</div><b>${d.maintenances.reported}</b></div>
          <div class="list-item"><div style="flex:1">Validées</div><b>${d.maintenances.validated}</b></div>
          <div class="list-item"><div style="flex:1">En cours</div><b>${d.maintenances.ongoing}</b></div>
          <div class="list-item"><div style="flex:1">Terminées</div><b>${d.maintenances.completed}</b></div>
          <div class="list-item"><div style="flex:1">Annulées</div><b>${d.maintenances.cancelled}</b></div>
          <div class="list-item"><div style="flex:1">Équipements</div><b>${d.equipment}</b></div>
          <div class="list-item"><div style="flex:1">Total dépenses</div><b>${Helpers.formatMoney(d.expensesTotal)}</b></div>
          <h4 class="mt-4">Dépenses par catégorie</h4>
          ${cats}`;
      }
      case 'rh': {
        const rows = (d.byEmployee || []).map((e) =>
          `<div class="list-item"><div style="flex:1">${e.full_name}</div>
            <div class="flex items-center gap-2"><b>${Helpers.formatMoney(e.paid)} payé / ${Helpers.formatMoney(e.pending)} à payer</b>
            ${e.proof ? `<a class="btn btn-sm btn-outline" href="${Helpers.fileUrl(e.proof)}" target="_blank" title="Preuve du dernier paiement">📎</a>` : ''}</div></div>`).join('')
          || '<div class="text-muted">Aucun salaire enregistré</div>';
        return `
          <div class="list-item"><div style="flex:1">Total salaires payés</div><b>${Helpers.formatMoney(d.salariesPaid)}</b></div>
          <div class="list-item"><div style="flex:1">Total salaires à payer</div><b>${Helpers.formatMoney(d.salariesPending)}</b></div>
          <h4 class="mt-4">Par employé</h4>
          ${rows}`;
      }
      case 'taches': {
        const events = (d.upcomingEvents || []).map((e) =>
          `<div class="list-item"><span class="list-dot" style="background:var(--primary)"></span><div style="flex:1">${e.is_meeting ? '👥 ' : ''}${e.title}${e.creator ? ' · ' + e.creator : ''}</div><b>${Helpers.formatDateTime(e.start_datetime)}</b></div>`).join('')
          || '<div class="text-muted">Aucun événement à venir</div>';
        return `
          <div class="list-item"><div style="flex:1">Tâches en attente</div><b>${d.tasks.pending}</b></div>
          <div class="list-item"><div style="flex:1">En cours</div><b>${d.tasks.inProgress}</b></div>
          <div class="list-item"><div style="flex:1">Terminées</div><b>${d.tasks.completed}</b></div>
          <div class="list-item"><div style="flex:1">Annulées</div><b>${d.tasks.cancelled}</b></div>
          <h4 class="mt-4">7 prochains jours</h4>
          ${events}`;
      }
      default: return '<div class="text-muted">Aucune donnée</div>';
    }
  },

  async renderTechnician() {
    Layout.setTitle('Mon espace technicien');
    const { data: s } = await API.get('/dashboard/technician');
    const { data: maint } = await API.get('/maintenance?technician_id=' + Auth.getUser().id);
    const rows = maint.slice(0, 8).map((m) => `<tr>
      <td>#${m.id}</td><td>${m.title}</td>
      <td>${m.apartment ? m.apartment.apartment_number : '—'}</td>
      <td>${Helpers.priorityBadge(m.priority)}</td>
      <td>${Helpers.maintStatus(m.status)}</td>
    </tr>`).join('') || '<tr><td colspan="5" class="text-center text-muted">Aucune intervention</td></tr>';

    Layout.content(`
      <div class="page-head"><div><h2>Bonjour, ${Auth.getUser().full_name.split(' ')[0]} 👋</h2>
      <div class="subtitle">Vos interventions techniques</div></div></div>
      <div id="myDayMini" class="mb-4"></div>
      <div class="stats-grid">
        ${this.statCard('🔧','sky', s.assigned, 'Interventions assignées')}
        ${this.statCard('⏳','orange', s.ongoing, 'En cours')}
        ${this.statCard('✅','green', s.completed, 'Terminées')}
        ${this.statCard('📋','red', s.pendingTasks, 'Tâches en attente')}
      </div>

      <div id="techAgendaContainer" class="mb-4"></div>

      <div class="card">
        <div class="card-header"><h3>📊 Ma productivité sur la période</h3>
          <button class="btn btn-sm btn-outline no-print" onclick="window.print()">🖨 Imprimer</button></div>
        <div class="card-body">
          <div class="period-bar no-print"><div class="period-presets">
            <button class="btn btn-sm btn-outline" onclick="PageDashboard.techPreset(7)">7 jours</button>
            <button class="btn btn-sm btn-primary" onclick="PageDashboard.techPreset(30)">30 jours</button>
            <button class="btn btn-sm btn-outline" onclick="PageDashboard.techPreset(90)">3 mois</button>
            <button class="btn btn-sm btn-outline" onclick="PageDashboard.techPreset(180)">6 mois</button>
          </div>
          <div class="period-custom">
            <input type="date" class="form-control" id="tperStart"/><span>→</span>
            <input type="date" class="form-control" id="tperEnd"/>
            <button class="btn btn-sm btn-primary" onclick="PageDashboard.techCustom()">Appliquer</button>
          </div></div>
          <div id="techPeriodBody" class="text-center text-muted" style="padding:20px">Chargement…</div>
        </div>
      </div>

      <div class="card"><div class="card-header"><h3>Mes interventions récentes</h3>
        <button class="btn btn-sm btn-outline" onclick="Router.go('maintenance')">Voir tout</button></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Réf</th><th>Titre</th><th>Apt</th><th>Priorité</th><th>Statut</th></tr></thead>
          <tbody>${rows}</tbody></table></div></div>
    `);
    this.loadMyDayMini();
    this.loadTechPeriod();
    this.loadTechnicianAgenda();
  },

  techPreset(days) {
    const end = new Date(); const start = new Date(end.getTime() - (days - 1) * 86400000);
    this.loadTechPeriod(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
  },
  techCustom() {
    const s = document.getElementById('tperStart').value, e = document.getElementById('tperEnd').value;
    if (!s || !e) { Toast.error('Choisissez les deux dates'); return; }
    if (s > e) { Toast.error('Dates invalides'); return; }
    this.loadTechPeriod(s, e);
  },
  async loadTechPeriod(start, end) {
    const body = document.getElementById('techPeriodBody');
    if (body) body.innerHTML = '<div class="spinner"></div>';
    try {
      const q = start && end ? `?start=${start}&end=${end}` : '';
      const { data } = await API.get('/dashboard/worker-period' + q);
      const sEl = document.getElementById('tperStart'); if (sEl) sEl.value = data.start;
      const eEl = document.getElementById('tperEnd'); if (eEl) eEl.value = data.end;
      if (body) body.innerHTML = `<div class="stats-grid">
        ${this.statCard('✅', 'green', data.tasksCompleted, 'Tâches terminées (période)')}
        ${this.statCard('🔧', 'sky', data.maintenancesCompleted, 'Interventions terminées (période)')}
        ${this.statCard('📈', 'orange', data.completionRate + '%', 'Taux de complétion')}
        ${this.statCard('📋', 'sky', data.tasksAssigned, 'Tâches assignées (total)')}
      </div>`;
    } catch (e) { if (body) body.innerHTML = `<div class="text-muted">${e.message}</div>`; }
  },

  // ===== Espace locataire =====
  async renderTenantHome() {
    Layout.setTitle('Mon espace');
    let tenant;
    try { tenant = (await API.get('/tenants/me/profile')).data; }
    catch { Layout.content('<div class="empty-state"><div class="icon">👤</div><h3>Profil locataire non configuré</h3><p>Contactez votre gestionnaire.</p></div>'); return; }

    const lease = (tenant.leases || [])[0];
    const payments = tenant.payments || [];
    const paid = payments.filter((p) => p.status === 'completed').length;
    const unpaid = payments.filter((p) => ['pending','failed','awaiting_confirmation'].includes(p.status)).length;

    Layout.content(`
      <div class="page-head"><div><h2>Bienvenue, ${tenant.full_name.split(' ')[0]} 👋</h2>
        <div class="subtitle">Votre espace locataire SMG IMMOBILIER</div></div></div>
      <div class="stats-grid">
        ${this.statCard('🏠','sky', lease ? (lease.apartment?.apartment_number || '—') : '—', 'Mon logement')}
        ${this.statCard('💰','green', lease ? Helpers.formatMoney(lease.monthly_rent) : '—', 'Loyer mensuel')}
        ${this.statCard('✅','green', paid, 'Paiements effectués')}
        ${this.statCard('🔴','red', unpaid, 'Paiements en attente')}
      </div>
      <div class="grid-2">
        <div class="card"><div class="card-header"><h3>Mon contrat</h3></div><div class="card-body">
          ${lease ? `
            <div class="list-item"><div style="flex:1">Logement</div><b>${lease.apartment?.apartment_number || '—'}${lease.apartment?.apartment_type ? ' · ' + lease.apartment.apartment_type : ''}</b></div>
            <div class="list-item"><div style="flex:1">Immeuble</div><b>${lease.apartment?.property?.property_name || '—'}${lease.apartment?.property?.city ? ' (' + lease.apartment.property.city + ')' : ''}</b></div>
            <div class="list-item"><div style="flex:1">Début</div><b>${Helpers.formatDate(lease.start_date)}</b></div>
            <div class="list-item"><div style="flex:1">Caution</div><b>${Helpers.formatMoney(lease.deposit_amount)}</b></div>
            <div class="list-item"><div style="flex:1">Statut</div>${Helpers.statusBadge(lease.status)}</div>
            ${lease.contract_file ? `<a class="btn btn-outline btn-block mt-4" href="${Helpers.fileUrl(lease.contract_file)}" target="_blank">📄 Voir le contrat PDF</a>` : ''}
          ` : '<p class="text-muted">Aucun contrat actif.</p>'}
        </div></div>
        <div class="card"><div class="card-header"><h3>Actions</h3></div><div class="card-body">
          <button class="btn btn-primary btn-block mb-4" onclick="PageDashboard.requestMaintenance()">🔧 Demander une maintenance</button>
          <button class="btn btn-outline btn-block" onclick="Router.go('my-payments')">💰 Voir mes paiements</button>
        </div></div>
      </div>
    `);
  },

  async renderTenantLease() {
    Layout.setTitle('Mon bail'); await this.renderTenantHome();
  },

  async renderTenantPayments() {
    Layout.setTitle('Mes paiements');
    const tenant = (await API.get('/tenants/me/profile')).data;
    const lease = (tenant.leases || [])[0];
    this._tenantRent = lease ? lease.monthly_rent : 0;
    let soldeHtml = '';
    try {
      const { data: l } = await API.get('/payments/me/ledger');
      soldeHtml = `<div class="stats-grid">
        ${this.statCard('🏠', 'sky', Helpers.formatMoney(l.total_du), 'Total loyers dus')}
        ${this.statCard('✅', 'green', Helpers.formatMoney(l.total_valide), 'Paiements validés')}
        ${this.statCard('🕓', 'orange', Helpers.formatMoney(l.en_attente_preuve), 'En attente de preuve')}
        ${this.statCard('⚖️', l.solde > 0 ? 'red' : 'green', Helpers.formatMoney(Math.max(0, l.solde)), 'Solde restant dû')}
      </div>`;
    } catch (_) { /* pas de bail / solde indisponible */ }
    const rows = (tenant.payments || []).slice().sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)).map((p) => `<tr>
      <td>#${p.id}</td><td>${Helpers.formatDate(p.payment_date)}</td>
      <td>${Helpers.formatMoney(p.amount)}</td><td>${Helpers.methodLabel(p.payment_method)}</td>
      <td>${Helpers.statusBadge(p.status)}</td>
      <td>${p.payment_proof ? `<a class="btn btn-sm btn-outline" href="${Helpers.fileUrl(p.payment_proof)}" target="_blank">Reçu</a>` : '—'}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted">Aucun paiement</td></tr>';
    Layout.content(`<div class="page-head"><h2>Mes paiements</h2>
        <button class="btn btn-primary" onclick="PageDashboard.declarePayment()">+ Déclarer un paiement</button></div>
      ${soldeHtml}
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Réf</th><th>Date</th><th>Montant</th><th>Méthode</th><th>Statut</th><th>Justif.</th></tr></thead>
        <tbody>${rows}</tbody></table></div></div>`);
  },

  declarePayment() {
    Modal.open('Déclarer un paiement', `
      <div class="form-group"><label>Montant (FCFA)</label><input type="number" class="form-control" id="payAmount" value="${this._tenantRent || ''}" required/></div>
      <div class="form-group"><label>Méthode de paiement</label>
        <select class="form-control" id="payMethod" onchange="PageDashboard.togglePayMethod(this.value)">
          <option value="kang">Mobile Money (Kang)</option>
          <option value="cash">Espèces</option>
        </select>
      </div>
      <div id="payCampayFields">
        <div class="form-group"><label>Numéro Mobile Money</label><input class="form-control" id="payPhone" placeholder="6XXXXXXXX"/></div>
      </div>
      <div id="payCashFields" style="display:none">
        <div class="form-group"><label>Preuve de paiement (photo, reçu...)</label><input type="file" class="form-control" id="payProof" accept="image/*,application/pdf"/></div>
      </div>`,
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button><button class="btn btn-primary" onclick="PageDashboard.submitPayment()">Envoyer</button>`);
  },

  togglePayMethod(method) {
    document.getElementById('payCampayFields').style.display = method === 'kang' ? '' : 'none';
    document.getElementById('payCashFields').style.display = method === 'cash' ? '' : 'none';
  },

  async submitPayment() {
    const amount = document.getElementById('payAmount').value;
    const method = document.getElementById('payMethod').value;
    if (!amount || Number(amount) <= 0) { Toast.error('Montant invalide'); return; }
    const fd = new FormData();
    fd.append('amount', amount);
    fd.append('payment_method', method);
    if (method === 'kang') {
      const phone = document.getElementById('payPhone').value;
      if (!phone) { Toast.error('Numéro de téléphone requis'); return; }
      fd.append('phone', phone);
    } else {
      const file = document.getElementById('payProof').files[0];
      if (!file) { Toast.error('Une preuve de paiement est requise'); return; }
      fd.append('proof', file);
    }
    try {
      const res = await API.upload('/payments/declare', fd);
      Modal.close();
      Toast.success(res.message || 'Paiement déclaré');
      Router.go('my-payments');
    } catch (e) { Toast.error(e.message); }
  },

  async renderTenantMaintenance() {
    Layout.setTitle('Mes demandes');
    const { data: list } = await API.get('/maintenance');
    const rows = list.map((m) => `<tr>
      <td>#${m.id}</td><td>${m.title}</td>
      <td>${m.apartment ? m.apartment.apartment_number : '—'}</td>
      <td>${Helpers.priorityBadge(m.priority)}</td><td>${Helpers.maintStatus(m.status)}</td>
      <td>${Helpers.formatDate(m.createdAt)}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted">Aucune demande</td></tr>';
    Layout.content(`<div class="page-head"><h2>Mes demandes de maintenance</h2>
      <button class="btn btn-primary" onclick="PageDashboard.requestMaintenance()">+ Nouvelle demande</button></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Réf</th><th>Titre</th><th>Logement</th><th>Priorité</th><th>Statut</th><th>Date</th></tr></thead>
        <tbody>${rows}</tbody></table></div></div>`);
  },

  async requestMaintenance() {
    const tenant = (await API.get('/tenants/me/profile')).data;
    const lease = (tenant.leases || [])[0];
    if (!lease) { Toast.error('Aucun appartement associé'); return; }
    Modal.open('Demander une maintenance', `
      <form id="maintReqForm">
        <div class="form-group"><label>Titre du problème</label><input class="form-control" id="mTitle" required placeholder="Ex: Fuite robinet"/></div>
        <div class="form-group"><label>Catégorie</label><select class="form-control" id="mCat">
          <option value="plomberie">Plomberie</option><option value="electricite">Électricité</option>
          <option value="peinture">Peinture</option><option value="menuiserie">Menuiserie</option><option value="autre">Autre</option>
        </select></div>
        <div class="form-group"><label>Priorité</label><select class="form-control" id="mPrio">
          <option value="normale">Normale</option><option value="haute">Haute</option><option value="urgente">Urgente</option>
        </select></div>
        <div class="form-group"><label>Description</label><textarea class="form-control" id="mDesc" rows="3"></textarea></div>
      </form>`,
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
       <button class="btn btn-primary" onclick="PageDashboard.submitMaintenance(${lease.apartment_id})">Envoyer</button>`);
  },

  async submitMaintenance(apartmentId) {
    try {
      await API.post('/maintenance', {
        apartment_id: apartmentId,
        title: document.getElementById('mTitle').value,
        category: document.getElementById('mCat').value,
        priority: document.getElementById('mPrio').value,
        description: document.getElementById('mDesc').value,
      });
      Modal.close(); Toast.success('Demande envoyée');
      Router.go('my-maintenance');
    } catch (e) { Toast.error(e.message); }
  },

  async loadTechnicianAgenda() {
    const el = document.getElementById('techAgendaContainer');
    if (!el) return;
    try {
      const { data } = await API.get('/dashboard/day?scope=me');
      const day = data.day;
      const agendaItems = [];

      (day.events || []).forEach(e => {
        agendaItems.push({
          type: 'event',
          time: e.start_datetime,
          title: e.title,
          isMeeting: e.is_meeting,
        });
      });

      const addTasks = (tasksList) => {
        (tasksList || []).forEach(t => {
          agendaItems.push({
            type: 'task',
            time: t.start_date || t.createdAt,
            title: t.title,
            id: t.id,
            status: t.status,
            maintenance: t.maintenance,
            taskObject: t,
          });
        });
      };
      addTasks(day.todo);
      addTasks(day.doing);
      addTasks(day.doneToday);

      agendaItems.sort((a, b) => new Date(a.time) - new Date(b.time));

      if (!agendaItems.length) {
        el.innerHTML = `
          <div class="card">
            <div class="card-header"><h3>📅 Mon agenda de la journée</h3></div>
            <div class="card-body text-center text-muted" style="padding:22px;">Aucune activité planifiée pour aujourd'hui.</div>
          </div>`;
        return;
      }

      PageTasks._rows = PageTasks._rows || {};

      const listHtml = agendaItems.map(item => {
        const timeStr = item.time ? new Date(item.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
        if (item.type === 'event') {
          return `
            <div class="list-item" style="border-left: 3px solid var(--primary); padding-left: 10px; margin-bottom: 8px;">
              <div style="flex:1">
                <span class="badge badge-primary" style="margin-right: 8px;">Événement</span>
                <b>${item.isMeeting ? '👥 ' : ''}${item.title}</b>
              </div>
              <span class="text-muted" style="font-weight:500;">${timeStr}</span>
            </div>`;
        } else {
          PageTasks._rows[item.id] = item.taskObject;
          let actionBtn = '';
          if (item.status !== 'completed' && item.status !== 'cancelled') {
            actionBtn = `<button class="btn btn-sm btn-success" onclick="PageTasks.mark(${item.id})">✅ Déclarer</button>`;
          }
          const statusBadge = Helpers.taskStatus ? Helpers.taskStatus(item.status) : `<span class="badge">${item.status}</span>`;
          return `
            <div class="list-item" style="border-left: 3px solid ${item.status === 'completed' ? 'var(--success)' : 'var(--warning)'}; padding-left: 10px; margin-bottom: 8px;">
              <div style="flex:1">
                <span class="badge badge-warning" style="margin-right: 8px;">Tâche</span>
                <b>${item.title}</b>
                ${item.maintenance ? `<span class="text-muted" style="font-size:12px"> (Chantier: ${item.maintenance.title})</span>` : ''}
                <div class="mt-1">${statusBadge}</div>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-muted" style="font-weight:500;">${timeStr}</span>
                ${actionBtn}
              </div>
            </div>`;
        }
      }).join('');

      el.innerHTML = `
        <div class="card">
          <div class="card-header"><h3>📅 Mon agenda de la journée</h3></div>
          <div class="card-body" style="padding: 18px 22px;">
            ${listHtml}
          </div>
        </div>`;
      if (typeof Icons !== 'undefined') Icons.enhance(el);
    } catch (e) {
      el.innerHTML = `<div class="card"><div class="card-body text-danger">Erreur agenda: ${e.message}</div></div>`;
    }
  },

  async loadGlobalActivityTracker() {
    const el = document.getElementById('globalActivityTrackerContainer');
    if (!el) return;
    try {
      const { data: tasks } = await API.get('/tasks');
      const recentTasks = (tasks || [])
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 5);

      if (!recentTasks.length) {
        el.innerHTML = `
          <div class="card">
            <div class="card-header"><h3>📋 Suivi d'activité en temps réel</h3></div>
            <div class="card-body text-center text-muted" style="padding:22px;">Aucune activité récente.</div>
          </div>`;
        return;
      }

      const itemsHtml = recentTasks.map(t => {
        const technician = t.assignee ? t.assignee.full_name : '—';
        const plannedTime = t.start_date ? Helpers.formatDateTime(t.start_date) : '—';
        const actualTime = t.done_at ? Helpers.formatDateTime(t.done_at) : '—';
        const statusBadge = Helpers.taskStatus ? Helpers.taskStatus(t.status) : t.status;

        let delayHtml = '';
        if (t.delay_justification) {
          delayHtml = `
            <div class="mt-2" style="background: rgba(239, 68, 68, 0.1); color: var(--danger); padding: 8px 12px; border-radius: 4px; font-size: 13px; font-weight: 500; border-left: 3px solid var(--danger); text-align: left;">
              ⚠️ <b>Justification de retard :</b> ${t.delay_justification}
            </div>`;
        }

        return `
          <div class="list-item" style="flex-direction: column; align-items: stretch; padding: 14px 0; border-bottom: 1px solid var(--border);">
            <div class="flex items-center justify-between" style="gap: 10px; flex-wrap: wrap;">
              <div style="text-align: left;">
                <b style="font-size: 15px; color: var(--text-primary);">${t.title}</b>
                <div class="text-muted" style="font-size:12.5px; margin-top: 2px;">
                  Technicien : <b>${technician}</b>
                </div>
              </div>
              <div>${statusBadge}</div>
            </div>
            <div class="grid-2 mt-2" style="font-size:12.5px; color: var(--text-secondary); gap: 10px; text-align: left;">
              <div>Heure planifiée : <b>${plannedTime}</b></div>
              <div>Heure de réalisation : <b>${actualTime}</b></div>
            </div>
            ${t.completion_note ? `<div class="text-muted mt-1" style="font-size: 13px; text-align: left;">📝 <b>Notes :</b> ${t.completion_note}</div>` : ''}
            ${delayHtml}
          </div>`;
      }).join('');

      el.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3>📋 Suivi d'activité (Cockpit Managers)</h3>
            <span class="badge badge-success" style="font-size:11px;">temps réel</span>
          </div>
          <div class="card-body" style="padding: 0 22px 14px;">
            ${itemsHtml}
          </div>
        </div>`;
      if (typeof Icons !== 'undefined') Icons.enhance(el);
    } catch (e) {
      el.innerHTML = `<div class="card"><div class="card-body text-danger">Erreur tracker: ${e.message}</div></div>`;
    }
  },
};
