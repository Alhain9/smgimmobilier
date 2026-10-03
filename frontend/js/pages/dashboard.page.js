// ============ Page Tableau de bord (adaptatif par rôle) ============
const PageDashboard = {
  register() {
    Router.register('dashboard', () => this.render());
    // Routes espace locataire
    Router.register('my-lease', () => this.renderTenantLease());
    Router.register('my-payments', () => this.renderTenantPayments());
    Router.register('my-invoices', () => this.renderTenantInvoices());
    Router.register('my-maintenance', () => this.renderTenantMaintenance());
  },

  statCard(icon, color, value, name, action) {
    const clickAttr = action ? `onclick="${action}" style="cursor:pointer" title="Cliquer pour voir le détail de ${name}"` : '';
    return `<div class="stat-card" ${clickAttr}>
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
    if (role === 'bailleur') return this.renderBailleur();
    await this.renderAdmin();
    // Rafraîchissement temps réel toutes les 15s (KPI globaux manager/super_admin uniquement)
    if (Auth.hasRole('manager', 'super_admin')) {
      this._timer = setInterval(() => {
        if ((window.location.hash.replace('#', '') || 'dashboard') !== 'dashboard') { this.stopRealtime(); return; }
        this.refreshStats();
      }, 15000);
    }
  },

  async renderBailleur() {
    Layout.setTitle('Tableau de bord — Espace Bailleur');
    const appContent = document.getElementById('appContent');
    appContent.innerHTML = '<div class="card" style="text-align:center;padding:40px"><div class="spinner"></div><p style="margin-top:12px;color:var(--text-muted)">Chargement de votre patrimoine...</p></div>';

    try {
      const res = await API.get('/dashboard/bailleur');
      const d = res.data;
      const fmt = (n) => Number(n || 0).toLocaleString('fr-FR') + ' FCFA';
      const pat = d.patrimoine || {};
      const fin = d.finances || {};
      const mnt = d.maintenances || {};
      const props = d.properties || [];

      const balanceColor = (fin.balance >= 0) ? 'var(--success)' : 'var(--danger)';

      appContent.innerHTML = `
        <!-- BANNIÈRE BIENVENUE -->
        <div class="card" style="margin-bottom:16px;background:linear-gradient(135deg, #142a45, #1e3a5f);color:#fff">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <div>
              <span class="badge" style="background:rgba(255,255,255,0.2);color:#fff">🏢 Espace Propriétaire</span>
              <h2 style="font-size:20px;font-weight:800;margin-top:6px;color:#fff">Gestion de Votre Patrimoine Immobilier</h2>
              <p style="font-size:13px;opacity:0.85;margin-top:4px">Suivez en temps réel la situation de vos immeubles, loyers, dépenses et travaux.</p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-primary" onclick="Router.go('management-reports')"><span class="btn-icon">📈</span> Générer un Rapport</button>
              <button class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,0.4)" onclick="Router.go('receipts')"><span class="btn-icon">🧾</span> Reçus de Loyer</button>
            </div>
          </div>
        </div>

        <!-- KPI SYNTHÈSE GLOBALE -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px">
          <div class="card stat-card" onclick="Router.go('properties')" style="cursor:pointer">
            <div class="stat-icon primary">🏢</div>
            <div class="stat-info">
              <div class="stat-value">${pat.properties || 0}</div>
              <div class="stat-name">Immeubles Gérés</div>
            </div>
          </div>

          <div class="card stat-card" onclick="Router.go('apartments')" style="cursor:pointer">
            <div class="stat-icon info">🚪</div>
            <div class="stat-info">
              <div class="stat-value">${pat.occupied || 0} / ${pat.apartments || 0}</div>
              <div class="stat-name">Logements Occupés (${pat.occupancyRate || 0}%)</div>
            </div>
          </div>

          <div class="card stat-card" onclick="Router.go('receipts')" style="cursor:pointer">
            <div class="stat-icon success">💰</div>
            <div class="stat-info">
              <div class="stat-value">${fmt(fin.revenue)}</div>
              <div class="stat-name">Loyers Encaissés</div>
            </div>
          </div>

          <div class="card stat-card" onclick="PageExpenses.filterType('gardiennage');Router.go('expenses')" style="cursor:pointer;border-left:4px solid var(--success)">
            <div class="stat-icon success">🛡️</div>
            <div class="stat-info">
              <div class="stat-value" style="color:var(--success)">${fmt(fin.caretaker_expenses)}</div>
              <div class="stat-name">Salaires Gardiens Déduits</div>
            </div>
          </div>

          <div class="card stat-card" onclick="PageExpenses.filterType('maintenance');Router.go('expenses')" style="cursor:pointer;border-left:4px solid var(--warning)">
            <div class="stat-icon warning">🔧</div>
            <div class="stat-info">
              <div class="stat-value" style="color:var(--warning)">${fmt(fin.maintenance_expenses + (fin.other_expenses || 0))}</div>
              <div class="stat-name">Travaux & Autres Charges</div>
            </div>
          </div>

          <div class="card stat-card" style="border:2px solid ${balanceColor};background:rgba(39,174,96,0.03)">
            <div class="stat-icon" style="background:rgba(39,174,96,0.1);color:${balanceColor}">📈</div>
            <div class="stat-info">
              <div class="stat-value" style="color:${balanceColor}">${fmt(fin.balance)}</div>
              <div class="stat-name">Solde Net Reversé au Bailleur</div>
            </div>
          </div>
        </div>

        <!-- DÉTAIL PAR IMMEUBLE AVEC TRANSPARENCE COMPLÈTE -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
            <div>
              <h3 style="font-size:16px;font-weight:700;margin:0">🏢 Situation Détaillée de Vos Immeubles (${props.length})</h3>
              <p style="font-size:12px;color:var(--text-muted);margin:3px 0 0">
                Transparence complète : loyers perçus, salaires des gardiens payés, travaux réalisés et solde net reversé.
              </p>
            </div>
            <button class="btn btn-sm btn-outline" onclick="Router.go('expenses')">🧾 Toutes les Dépenses</button>
          </div>

          ${!props.length ? '<p style="color:var(--text-muted);text-align:center;padding:30px">Aucun immeuble assigné à votre compte pour le moment. Contactez SMG IMMOBILIER.</p>' : `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px">
              ${props.map((p) => {
                const propBalanceColor = (p.balance >= 0) ? 'var(--success)' : 'var(--danger)';
                return `
                  <div class="card" style="border:1px solid var(--border);border-radius:10px;padding:16px;background:var(--card-bg)">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start">
                      <div>
                        <h4 style="font-size:15px;font-weight:800;color:var(--primary);margin:0">🏢 ${p.property_name}</h4>
                        <p style="font-size:12px;color:var(--text-muted);margin:2px 0 0">📍 ${p.address || ''}, ${p.city || ''}</p>
                      </div>
                      <span class="badge badge-${p.free > 0 ? 'warning' : 'success'}">
                        ${p.occupied}/${p.apartments} occupés
                      </span>
                    </div>

                    <!-- BLOC GARDIEN DE L'IMMEUBLE -->
                    <div style="margin:12px 0;padding:10px;background:rgba(46,125,50,0.06);border-left:3px solid var(--success);border-radius:6px;font-size:12px">
                      <div style="display:flex;justify-content:space-between;align-items:center">
                        <span style="font-weight:700;color:var(--success)">🛡️ Gardien de l'immeuble :</span>
                        <b>${p.caretaker_name || 'Non renseigné'}</b>
                      </div>
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;color:var(--text-muted)">
                        <span>Salaire mensuel convenu : <b>${fmt(p.caretaker_salary)}</b></span>
                        <span>Déduit au bilan : <b style="color:var(--danger)">${fmt(p.expenses_caretaker)}</b></span>
                      </div>
                    </div>

                    <!-- BILAN FINANCIER DE L'IMMEUBLE -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;padding:10px;background:var(--secondary-bg, #f8f9fa);border-radius:8px;font-size:12px">
                      <div>
                        <span style="color:var(--text-muted);display:block">Loyers perçus</span>
                        <b style="color:var(--success);font-size:13px">${fmt(p.revenue)}</b>
                        <span style="display:block;font-size:10.5px;color:var(--text-muted)">(${p.paying_tenants_count || 0} locataire(s) ont réglé)</span>
                      </div>
                      <div>
                        <span style="color:var(--text-muted);display:block">Impayés & retards</span>
                        <b style="color:var(--danger);font-size:13px">${fmt(p.unpaid)}</b>
                        <span style="display:block;font-size:10.5px;color:var(--text-muted)">(Attendu: ${fmt(p.loyer_attendu)})</span>
                      </div>
                      <div>
                        <span style="color:var(--text-muted);display:block">Dépenses déduites</span>
                        <b style="color:var(--danger);font-size:13px">− ${fmt(p.expenses_total)}</b>
                        <span style="display:block;font-size:10.5px;color:var(--text-muted)">(${fmt(p.expenses_caretaker)} gardien + ${fmt(p.expenses_maintenance)} travaux)</span>
                      </div>
                      <div style="border-left:2px solid var(--border);padding-left:6px">
                        <span style="color:var(--text-muted);display:block;font-weight:700">Solde Net Reversé</span>
                        <b style="color:${propBalanceColor};font-size:13.5px">${fmt(p.balance)}</b>
                      </div>
                    </div>

                    <!-- DERNIÈRES DÉPENSES DE L'IMMEUBLE -->
                    ${p.recent_expenses && p.recent_expenses.length ? `
                      <div style="margin-bottom:12px;font-size:11.5px">
                        <span style="font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px">Dernières dépenses imputées :</span>
                        <div style="display:flex;flex-direction:column;gap:3px">
                          ${p.recent_expenses.map(e => `
                            <div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px dashed var(--border)">
                              <span>${e.expense_type === 'gardiennage' ? '🛡️' : '🔧'} ${e.item_name}</span>
                              <b style="color:var(--danger)">− ${fmt(e.total_price || (e.unit_price * (e.quantity || 1)))}</b>
                            </div>
                          `).join('')}
                        </div>
                      </div>
                    ` : ''}

                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                      <button class="btn btn-sm btn-outline" style="flex:1" onclick="PageExpenses.filterProperty(${p.id}); Router.go('expenses')">
                        🧾 Dépenses (${fmt(p.expenses_total)})
                      </button>
                      <button class="btn btn-sm btn-primary" style="flex:1" onclick="Router.go('management-reports')">
                        📊 Rapport
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      `;
    } catch (err) {
      Toast.error('Erreur lors du chargement du tableau de bord bailleur');
      appContent.innerHTML = '<div class="card" style="text-align:center;padding:30px;color:var(--danger)">Échec de chargement.</div>';
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

    if (Auth.hasRole('super_admin', 'manager', 'dir_admin', 'dir_technique', 'gestionnaire', 'comptable')) {
      body += `<div id="upcomingRentDuesContainer" class="mb-4"></div>`;
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
          ${this.statCard('🏢','sky', s.properties, 'Immeubles', "Router.go('properties')")}
          ${this.statCard('🚪','green', `<span id="st_free">${s.free}</span>`, 'Logements libres', "Router.go('apartments')")}
          ${this.statCard('👤','sky', `<span id="st_tenants">${s.tenants}</span>`, 'Locataires', "Router.go('tenants')")}
          ${this.statCard('📈','orange', `<span id="st_occ">${s.occupancyRate}%</span>`, "Taux d'occupation", "Router.go('situation')")}
        </div>

        <div class="stats-grid">
          ${this.statCard('💰','green', `<span id="st_revenue">${Helpers.formatMoney(s.finance.revenue)}</span>`, 'Revenus encaissés', "PageDashboard.drillDown('revenue')")}
          ${this.statCard('🔴','red', `<span id="st_unpaid">${Helpers.formatMoney(s.finance.unpaid)}</span>`, 'Impayés', "PageDashboard.drillDown('unpaid')")}
          ${this.statCard('🧾','orange', `<span id="st_charges">${Helpers.formatMoney(s.finance.charges)}</span>`, 'Charges (dép.+salaires)', "PageDashboard.drillDown('charges')")}
          ${this.statCard('🔧','red', `<span id="st_maint">${s.maintenances.active}</span>`, 'Maintenances actives', "PageDashboard.drillDown('maintenances')")}
        </div>

        <div class="stats-grid">
          ${this.statCard('💵','orange', `<span id="st_salpend">${Helpers.formatMoney(s.finance.salariesPending)}</span>`, 'Salaires à payer', "Router.go('rh')")}
          ${this.statCard('📂','sky', `<span id="st_docs">${s.documents}</span>`, 'Documents', "Router.go('documents')")}
          ${this.statCard('🛠','sky', `<span id="st_equip">${s.equipment}</span>`, 'Équipements', "Router.go('equipment')")}
          ${this.statCard('✅','green', `<span id="st_tasks">${s.tasksOpen}</span>`, 'Tâches en cours', "Router.go('tasks')")}
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
    if (Auth.hasRole('super_admin', 'manager', 'dir_admin', 'dir_technique', 'gestionnaire', 'comptable')) {
      this.loadUpcomingRentDues();
    }
  },

  async loadCampayBalance() {
    try {
      const { data } = await API.get('/withdrawals/balance');
      const el = document.getElementById('dashCampayBal');
      if (el) el.innerText = Helpers.formatMoney(data.available_balance);
    } catch (_) {
      const el = document.getElementById('dashCampayBal');
      if (el) el.innerText = '—';
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
  _breakdownData: [],
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
      const e = new Date(); const s = new Date(e.getFullYear(), e.getMonth(), 1);
      start = s.toISOString().slice(0, 10); end = e.toISOString().slice(0, 10);
    }
    this._period = { start, end };
    const body = document.getElementById('periodBody');
    if (body) body.innerHTML = '<div class="spinner"></div>';
    try {
      const [resPeriod, resBreakdown] = await Promise.all([
        API.get(`/dashboard/period?start=${start}&end=${end}`),
        API.get(`/dashboard/properties-breakdown?start=${start}&end=${end}`),
      ]);
      const data = resPeriod.data;
      this._breakdownData = resBreakdown.data?.breakdown || [];

      const sEl = document.getElementById('perStart'); if (sEl) sEl.value = start;
      const eEl = document.getElementById('perEnd'); if (eEl) eEl.value = end;
      if (body) body.innerHTML = this.periodHtml(data, this._breakdownData);
    } catch (e) {
      if (body) body.innerHTML = `<div class="text-muted">Erreur de chargement : ${e.message}</div>`;
    }
  },
  periodHtml(d, breakdown = []) {
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

    // Calculs totaux pour la table par immeuble
    let totApts = 0, totOcc = 0, totRev = 0, totUnp = 0, totExp = 0, totBal = 0;
    const breakdownRows = breakdown.map((b) => {
      totApts += b.totalApartments || 0;
      totOcc += b.occupiedApartments || 0;
      totRev += b.revenue || 0;
      totUnp += b.unpaid || 0;
      totExp += b.expenses || 0;
      totBal += b.balance || 0;

      const isHighUnpaid = b.unpaid > 0 && (b.unpaid / ((b.revenue || 0) + b.unpaid)) > 0.2;
      const badgeUnpaid = isHighUnpaid ? '<span class="badge badge-danger" style="margin-left:4px">Alerte</span>' : '';

      return `<tr>
        <td><b>${b.property_name}</b><br><span class="text-muted" style="font-size:12px">${b.city || ''} ${b.district ? '· ' + b.district : ''}</span></td>
        <td>${b.occupiedApartments}/${b.totalApartments} <span class="badge badge-info">${b.occupancyRate}%</span></td>
        <td style="color:var(--success);font-weight:600">${Helpers.formatMoney(b.revenue)}</td>
        <td style="color:var(--danger);font-weight:600">${Helpers.formatMoney(b.unpaid)} ${badgeUnpaid}</td>
        <td style="color:var(--warning)">${Helpers.formatMoney(b.expenses)}</td>
        <td style="font-weight:700;color:${b.balance >= 0 ? 'var(--success)' : 'var(--danger)'}">${Helpers.formatMoney(b.balance)}</td>
        <td style="text-align:center"><button class="btn btn-sm btn-outline" onclick="PageDashboard.openPropertyDetail(${b.id})">👁 Détails</button></td>
      </tr>`;
    }).join('');

    const overallRate = totApts > 0 ? Math.round((totOcc / totApts) * 100) : 0;

    return `
      <div class="period-range text-muted" style="margin-bottom:10px">Période : <b>${fmtRange}</b></div>
      <div class="stats-grid">
        ${this.statCard('💰', 'green', Helpers.formatMoney(d.revenue), 'Revenus encaissés', "PageDashboard.drillDown('revenue')")}
        ${this.statCard('🧾', 'orange', Helpers.formatMoney(d.expenses), 'Dépenses', "PageDashboard.drillDown('charges')")}
        ${this.statCard('💵', 'sky', Helpers.formatMoney(d.salaries), 'Salaires payés', "Router.go('rh')")}
        ${this.statCard('⚖️', d.balance >= 0 ? 'green' : 'red', Helpers.formatMoney(d.balance), 'Solde net')}
      </div>
      <div class="stats-grid">
        ${this.statCard('🧮', 'sky', d.paymentsCount, 'Transactions', "Router.go('payments')")}
        ${this.statCard('👤', 'green', d.newTenants, 'Nouveaux locataires', "Router.go('tenants')")}
        ${this.statCard('📄', 'sky', d.newLeases, 'Baux signés', "Router.go('leases')")}
        ${this.statCard('🔧', 'orange', `${d.maintenanceOpened} / ${d.maintenanceCompleted}`, 'Maintenances ouvertes / terminées', "PageDashboard.drillDown('maintenances')")}
      </div>
      <div class="pchart-legend"><span><i class="dot rev"></i> Revenus</span><span><i class="dot exp"></i> Dépenses</span></div>
      <div class="pchart mb-4">${bars}</div>

      <div class="card mt-4" style="border:1px solid var(--border)">
        <div class="card-header flex items-center justify-between">
          <h3>🏢 Performance & Résumé Détaillé par Immeuble</h3>
          <button class="btn btn-sm btn-outline no-print" onclick="PageDashboard.exportBreakdownExcel()">⬇ Exporter Excel</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Immeuble</th>
                <th>Occupation</th>
                <th>Revenus Encaissés</th>
                <th>Impayés</th>
                <th>Charges & Dépenses</th>
                <th>Solde Net</th>
                <th style="text-align:center">Action</th>
              </tr>
            </thead>
            <tbody>
              ${breakdownRows || '<tr><td colspan="7" class="text-center text-muted" style="padding:20px">Aucun immeuble enregistré</td></tr>'}
            </tbody>
            ${breakdown.length > 0 ? `
            <tfoot>
              <tr style="font-weight:bold; background:var(--bg-surface-2)">
                <td>TOTAL GLOBAL (${breakdown.length} immeuble(s))</td>
                <td>${totOcc}/${totApts} (${overallRate}%)</td>
                <td style="color:var(--success)">${Helpers.formatMoney(totRev)}</td>
                <td style="color:var(--danger)">${Helpers.formatMoney(totUnp)}</td>
                <td style="color:var(--warning)">${Helpers.formatMoney(totExp)}</td>
                <td style="color:${totBal >= 0 ? 'var(--success)' : 'var(--danger)'}">${Helpers.formatMoney(totBal)}</td>
                <td></td>
              </tr>
            </tfoot>` : ''}
          </table>
        </div>
      </div>`;
  },

  async drillDown(type) {
    const titles = {
      revenue: '💰 Synthèse des Revenus Encaissés par Immeuble',
      unpaid: '🔴 Synthèse des Impayés et Retards par Immeuble',
      charges: '🧾 Synthèse des Charges et Dépenses par Immeuble',
      maintenances: '🔧 Synthèse des Maintenances Actives par Immeuble',
    };
    const title = titles[type] || 'Détails par immeuble';

    try {
      const res = await API.get(`/dashboard/properties-breakdown?start=${this._period.start || ''}&end=${this._period.end || ''}`);
      let list = res.data?.breakdown || [];

      if (type === 'revenue') list.sort((a, b) => b.revenue - a.revenue);
      else if (type === 'unpaid') list.sort((a, b) => b.unpaid - a.unpaid);
      else if (type === 'charges') list.sort((a, b) => b.expenses - a.expenses);
      else if (type === 'maintenances') list.sort((a, b) => b.activeMaintenances - a.activeMaintenances);

      const rows = list.map((b) => {
        let valStr = '';
        if (type === 'revenue') valStr = `<b style="color:var(--success)">${Helpers.formatMoney(b.revenue)}</b>`;
        else if (type === 'unpaid') valStr = `<b style="color:var(--danger)">${Helpers.formatMoney(b.unpaid)}</b>`;
        else if (type === 'charges') valStr = `<b style="color:var(--warning)">${Helpers.formatMoney(b.expenses)}</b>`;
        else if (type === 'maintenances') valStr = `<b style="color:var(--primary)">${b.activeMaintenances} maintenance(s)</b>`;

        return `<tr>
          <td><b>${b.property_name}</b> (${b.city || '—'})</td>
          <td>${b.occupiedApartments}/${b.totalApartments} oct. (${b.occupancyRate}%)</td>
          <td>${valStr}</td>
          <td style="text-align:right"><button class="btn btn-sm btn-primary" onclick="PageDashboard.openPropertyDetail(${b.id})">👁 Fiche Immeuble</button></td>
        </tr>`;
      }).join('');

      Modal.open(title, `
        <div class="text-muted" style="margin-bottom:12px;font-size:13px">
          Classement détaillé des immeubles pour la période : <b>${Helpers.formatDate(this._period.start)} → ${Helpers.formatDate(this._period.end)}</b>
        </div>
        <div class="table-wrap" style="max-height:420px;overflow-y:auto">
          <table>
            <thead><tr><th>Immeuble</th><th>Occupation</th><th>Indicateur</th><th style="text-align:right">Action</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4" class="text-center text-muted">Aucun immeuble</td></tr>'}</tbody>
          </table>
        </div>`,
        `<button class="btn btn-outline" onclick="Modal.close()">Fermer</button>`);
    } catch (e) {
      Toast.error(e.message);
    }
  },

  async openPropertyDetail(propertyId) {
    try {
      const start = this._period.start || '';
      const end = this._period.end || '';
      const res = await API.get(`/dashboard/property-detail/${propertyId}?start=${start}&end=${end}`);
      const data = res.data;
      const prop = data.property;
      const stats = data.stats;

      const aptRows = (data.apartments || []).map((a) => {
        const tenant = a.tenants && a.tenants[0] ? a.tenants[0].user : null;
        return `<tr>
          <td><b>${a.apartment_number}</b></td>
          <td>${a.apartment_type || '—'}</td>
          <td>${Helpers.formatMoney(a.rent_amount)}</td>
          <td>${tenant ? `<b>${tenant.full_name}</b><br><span class="text-muted" style="font-size:12px">${tenant.phone || ''}</span>` : '<i>Vacant</i>'}</td>
          <td>${Helpers.statusBadge(a.status)}</td>
        </tr>`;
      }).join('');

      const payRows = (data.payments || []).map((p) => `<tr>
        <td>${Helpers.formatDate(p.payment_date)}</td>
        <td>Appt. ${p.apartment?.apartment_number || '—'}</td>
        <td>${p.tenant?.user?.full_name || '—'}</td>
        <td style="font-weight:600">${Helpers.formatMoney(p.amount)}</td>
        <td>${p.payment_method}</td>
        <td>${Helpers.statusBadge(p.status)}</td>
      </tr>`).join('');

      const expRows = (data.expenses || []).map((e) => `<tr>
        <td>${Helpers.formatDate(e.created_at)}</td>
        <td>Appt. ${e.maintenance?.apartment?.apartment_number || '—'}</td>
        <td>${e.label || e.category || 'Maintenance'}</td>
        <td style="color:var(--danger);font-weight:600">${Helpers.formatMoney(e.total_price)}</td>
      </tr>`).join('');

      Modal.open(`🏢 Fiche Détaillée — ${prop.property_name}`, `
        <div style="font-size:13px; color:var(--text-muted); margin-bottom:14px;">
          📍 <b>${prop.address || ''}, ${prop.city || ''} ${prop.district || ''}</b> &nbsp;|&nbsp; 
          Période d'analyse : <b>${Helpers.formatDate(data.start)} → ${Helpers.formatDate(data.end)}</b>
        </div>
        <div class="stats-grid mb-3">
          <div class="stat-card"><div class="stat-icon green">💰</div><div class="stat-info"><div class="stat-value">${Helpers.formatMoney(stats.revenue)}</div><div class="stat-name">Revenus encaissés</div></div></div>
          <div class="stat-card"><div class="stat-icon red">🔴</div><div class="stat-info"><div class="stat-value">${Helpers.formatMoney(stats.unpaid)}</div><div class="stat-name">Impayés</div></div></div>
          <div class="stat-card"><div class="stat-icon orange">🧾</div><div class="stat-info"><div class="stat-value">${Helpers.formatMoney(stats.expenses)}</div><div class="stat-name">Charges & Dépenses</div></div></div>
          <div class="stat-card"><div class="stat-icon sky">⚖️</div><div class="stat-info"><div class="stat-value" style="color:${stats.balance>=0?'var(--success)':'var(--danger)'}">${Helpers.formatMoney(stats.balance)}</div><div class="stat-name">Solde Net</div></div></div>
        </div>

        <h4 style="margin-top:16px; margin-bottom:8px">🚪 Logements et Locataires (${stats.occupiedApartments}/${stats.totalApartments} occupés)</h4>
        <div class="table-wrap mb-4" style="max-height:200px; overflow-y:auto">
          <table>
            <thead><tr><th>Numéro</th><th>Type</th><th>Loyer</th><th>Locataire actuel</th><th>Statut</th></tr></thead>
            <tbody>${aptRows || '<tr><td colspan="5" class="text-center text-muted">Aucun logement</td></tr>'}</tbody>
          </table>
        </div>

        <h4 style="margin-bottom:8px">💳 Historique des Versements (Période)</h4>
        <div class="table-wrap mb-4" style="max-height:180px; overflow-y:auto">
          <table>
            <thead><tr><th>Date</th><th>Logement</th><th>Locataire</th><th>Montant</th><th>Mode</th><th>Statut</th></tr></thead>
            <tbody>${payRows || '<tr><td colspan="6" class="text-center text-muted">Aucun versement sur la période</td></tr>'}</tbody>
          </table>
        </div>

        <h4 style="margin-bottom:8px">🛠 Dépenses de Maintenance (Période)</h4>
        <div class="table-wrap" style="max-height:160px; overflow-y:auto">
          <table>
            <thead><tr><th>Date</th><th>Logement</th><th>Motif</th><th>Montant</th></tr></thead>
            <tbody>${expRows || '<tr><td colspan="4" class="text-center text-muted">Aucune dépense de maintenance sur la période</td></tr>'}</tbody>
          </table>
        </div>
      `, `<button class="btn btn-outline" onclick="Modal.close()">Fermer</button>`);
    } catch (e) {
      Toast.error(e.message);
    }
  },

  exportBreakdownExcel() {
    if (!this._breakdownData || !this._breakdownData.length) {
      Toast.error('Aucune donnée à exporter.'); return;
    }
    const rows = this._breakdownData.map((b) => ({
      'Immeuble': b.property_name,
      'Ville': b.city || '',
      'Logements Totaux': b.totalApartments,
      'Logements Occupés': b.occupiedApartments,
      "Taux Occupation (%)": b.occupancyRate,
      'Revenus Encaissés (FCFA)': b.revenue,
      'Impayés (FCFA)': b.unpaid,
      'Charges & Dépenses (FCFA)': b.expenses,
      'Solde Net (FCFA)': b.balance,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Synthese Immeubles');
    XLSX.writeFile(wb, `Synthese_Immeubles_${this._period.start}_au_${this._period.end}.xlsx`);
    Toast.success('Exportation Excel générée avec succès');
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
    if (lease) this._tenantRent = lease.monthly_rent;
    const payments = tenant.payments || [];
    const paid = payments.filter((p) => p.status === 'completed').length;
    const unpaid = payments.filter((p) => ['pending','failed','awaiting_confirmation'].includes(p.status)).length;

    let ledgerCard = '';
    try {
      const { data: l } = await API.get('/payments/me/ledger');
      ledgerCard = `
        <div class="card"><div class="card-header"><h3>Synthèse de compte</h3></div><div class="card-body">
          <div class="list-item"><div style="flex:1">Cumul loyers dus</div><b>${Helpers.formatMoney(l.total_du)}</b></div>
          <div class="list-item"><div style="flex:1">Total payé & validé</div><b style="color:var(--success)">${Helpers.formatMoney(l.total_valide)}</b></div>
          <div class="list-item"><div style="flex:1">En cours de validation</div><b style="color:var(--warning)">${Helpers.formatMoney(l.en_attente_preuve)}</b></div>
          <div class="list-item"><div style="flex:1">Reste à payer</div><b style="color:${l.solde > 0 ? 'var(--danger)' : 'var(--success)'}">${Helpers.formatMoney(Math.max(0, l.solde))}</b></div>
        </div></div>`;
    } catch (_) {
      ledgerCard = `
        <div class="card"><div class="card-header"><h3>Actions</h3></div><div class="card-body">
          <button class="btn btn-primary btn-block mb-4" onclick="PageDashboard.declarePayment()">💰 Déclarer un paiement</button>
          <button class="btn btn-outline btn-block mb-4" onclick="PageDashboard.requestMaintenance()">🔧 Demander une maintenance</button>
          <button class="btn btn-outline btn-block" onclick="Router.go('my-payments')">📄 Voir mes paiements</button>
        </div></div>`;
    }

    let utilityChargesCard = '';
    try {
      const { data: uBills } = await API.get('/utility-bills/mine');
      const billsList = (uBills || []).slice(0, 5).map((b) => {
        const typeIcon = b.type === 'water' ? '💧' : '⚡';
        const typeName = b.type === 'water' ? 'Eau' : 'Électricité';
        const isPaid = b.status === 'paid';
        const monthStr = (typeof PageUtilities !== 'undefined' && PageUtilities.monthLabel) ? PageUtilities.monthLabel(b.period_month) : b.period_month;
        const conso = Math.max(0, Number(b.current_index) - Number(b.previous_index));
        return `
          <div class="list-item" style="padding: 10px 0; border-bottom: 1px dashed var(--border-color);">
            <div style="flex:1">
              <b>${typeIcon} ${typeName} — ${monthStr} ${b.period_year}</b>
              <div class="text-muted" style="font-size:12px">Index: ${b.previous_index} → ${b.current_index} (conso: ${conso})</div>
            </div>
            <div style="text-align:right; margin-left: 10px;">
              <b>${Helpers.formatMoney(b.total_amount)}</b>
              <div style="margin-top:4px">
                ${isPaid 
                  ? `<span class="badge badge-success">Payé</span>`
                  : `<button class="btn btn-sm btn-primary" onclick="PageDashboard.payUtilityBill(${b.id}, ${b.total_amount})">💳 Payer</button>`}
              </div>
            </div>
          </div>
        `;
      }).join('') || '<p class="text-muted">Aucune charge attribuée.</p>';

      utilityChargesCard = `
        <div class="card mt-4">
          <div class="card-header flex justify-between items-center">
            <h3>⚡ Mes charges attribuées (Électricité, Eau, etc.)</h3>
            <button class="btn btn-sm btn-outline" onclick="Router.go('my-utilities')">Voir tout</button>
          </div>
          <div class="card-body">
            ${billsList}
          </div>
        </div>
      `;
    } catch (_) {}

    let invoicesCard = '';
    try {
      const { data: receipts } = await API.get('/receipts');
      const recList = (receipts || []).slice(0, 4).map((r) => {
        const typeLabel = {
          rent: 'Loyer',
          deposit: 'Caution',
          advance: 'Avance',
          utility: 'Charges (Eau/Élec)',
        }[r.receipt_type] || 'Paiement';

        const typeIcon = {
          rent: '🏠',
          deposit: '🔒',
          advance: '💰',
          utility: '⚡',
        }[r.receipt_type] || '🧾';

        const periodStr = (r.period_start && r.period_end) 
          ? `Période du ${Helpers.formatDate(r.period_start)} au ${Helpers.formatDate(r.period_end)}`
          : `Date : ${Helpers.formatDate(r.payment_date)}`;

        return `
          <div class="list-item" style="padding: 10px 0; border-bottom: 1px dashed var(--border-color); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div style="flex:1; min-width:200px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:16px;">${typeIcon}</span>
                <b style="color:var(--text);">${typeLabel} — ${r.receipt_number}</b>
                <span class="badge badge-success" style="font-size:10.5px; padding:2px 6px;">✓ Signé & Validé</span>
              </div>
              <div class="text-muted" style="font-size:12px; margin-top:2px;">
                ${periodStr} · ${Helpers.methodLabel(r.payment_method || 'Espèces')}
              </div>
            </div>
            <div style="text-align:right; display:flex; align-items:center; gap:6px;">
              <b style="font-size:14px; color:var(--success); margin-right:6px;">${Helpers.formatMoney(r.amount)}</b>
              <button class="btn btn-sm btn-outline" onclick="ReceiptManager.open(${JSON.stringify(r).replace(/"/g, '&quot;')})" title="Visualiser le document">👁 Voir</button>
              <button class="btn btn-sm btn-primary" onclick="PageDashboard.downloadReceiptPdf(${r.id}, '${r.receipt_number}')" title="Télécharger le PDF officiel signé">⬇️ PDF</button>
            </div>
          </div>
        `;
      }).join('') || '<p class="text-muted" style="padding:10px 0;">Aucune facture ou quittance générée pour le moment.</p>';

      invoicesCard = `
        <div class="card mt-4">
          <div class="card-header flex justify-between items-center flex-wrap gap-2">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:20px;">🧾</span>
              <h3 style="margin:0;">Mes dernières factures & quittances officielles</h3>
            </div>
            <button class="btn btn-sm btn-outline" onclick="Router.go('my-invoices')">Voir toutes mes factures (${(receipts || []).length})</button>
          </div>
          <div class="card-body">
            <div style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">
              💡 Vos quittances officielles avec cachet et signature de l'agence sont émises automatiquement dès validation de vos paiements.
            </div>
            ${recList}
          </div>
        </div>
      `;
    } catch (_) {}

    // Bandeau d'alerte d'échéance de loyer pour le locataire (J-10, J-7, J-4, etc.)
    let dueAlertBanner = '';
    const due = tenant.due_info;
    if (due && due.prochaine_echeance && lease) {
      if (due.statut_echeance === 'imminent') {
        dueAlertBanner = `
          <div class="card mb-4" style="background:linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%); border-left:6px solid #F59E0B; padding:18px 22px; border-radius:10px; box-shadow:0 4px 12px rgba(245,158,11,0.12);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div style="display:flex; align-items:center; gap:14px;">
                <div style="font-size:2.4rem;">🔔</div>
                <div>
                  <h3 style="margin:0 0 4px; color:#B45309; font-size:1.15rem; font-weight:700;">
                    Rappel d'échéance : Votre loyer arrive à terme dans ${due.jours_restants} jour(s) !
                  </h3>
                  <p style="margin:0; font-size:14px; color:#92400E;">
                    Selon votre contrat (entrée le ${Helpers.formatDate(lease.start_date)}), votre loyer mensuel de <b>${Helpers.formatMoney(lease.monthly_rent)}</b> est attendu pour le <b>${Helpers.formatDate(due.prochaine_echeance)}</b>.
                  </p>
                </div>
              </div>
              <button class="btn btn-primary" onclick="PageDashboard.declarePayment()" style="background:#D97706; border-color:#D97706; font-weight:700; white-space:nowrap; padding:10px 18px;">
                💰 Payer / Déclarer mon loyer
              </button>
            </div>
          </div>
        `;
      } else if (due.statut_echeance === 'aujourdhui') {
        dueAlertBanner = `
          <div class="card mb-4" style="background:linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%); border-left:6px solid #EF4444; padding:18px 22px; border-radius:10px; box-shadow:0 4px 12px rgba(239,68,68,0.15);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div style="display:flex; align-items:center; gap:14px;">
                <div style="font-size:2.4rem;">⚠️</div>
                <div>
                  <h3 style="margin:0 0 4px; color:#B91C1C; font-size:1.15rem; font-weight:700;">
                    Échéance aujourd'hui : Votre loyer est dû ce jour !
                  </h3>
                  <p style="margin:0; font-size:14px; color:#991B1B;">
                    Votre loyer de <b>${Helpers.formatMoney(lease.monthly_rent)}</b> pour cette période arrive à échéance aujourd'hui le <b>${Helpers.formatDate(due.prochaine_echeance)}</b>.
                  </p>
                </div>
              </div>
              <button class="btn btn-primary" onclick="PageDashboard.declarePayment()" style="background:#DC2626; border-color:#DC2626; font-weight:700; white-space:nowrap; padding:10px 18px;">
                💳 Régler immédiatement
              </button>
            </div>
          </div>
        `;
      } else if (due.statut_echeance === 'retard') {
        dueAlertBanner = `
          <div class="card mb-4" style="background:linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%); border-left:6px solid #DC2626; padding:18px 22px; border-radius:10px; box-shadow:0 4px 12px rgba(220,38,38,0.18);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div style="display:flex; align-items:center; gap:14px;">
                <div style="font-size:2.4rem;">🚨</div>
                <div>
                  <h3 style="margin:0 0 4px; color:#991B1B; font-size:1.15rem; font-weight:700;">
                    Loyer en retard de ${Math.abs(due.jours_restants)} jour(s)
                  </h3>
                  <p style="margin:0; font-size:14px; color:#7F1D1D;">
                    L'échéance était fixée au <b>${Helpers.formatDate(due.prochaine_echeance)}</b>. Solde restant : <b>${Helpers.formatMoney(due.solde || lease.monthly_rent)}</b>. Merci de régulariser votre situation au plus vite.
                  </p>
                </div>
              </div>
              <button class="btn btn-primary" onclick="PageDashboard.declarePayment()" style="background:#B91C1C; border-color:#B91C1C; font-weight:700; white-space:nowrap; padding:10px 18px;">
                💳 Régulariser mon loyer
              </button>
            </div>
          </div>
        `;
      }
    }

    Layout.content(`
      <div class="page-head">
        <div>
          <h2>Bienvenue, ${tenant.full_name.split(' ')[0]} 👋</h2>
          <div class="subtitle">Votre espace locataire SMG IMMOBILIER</div>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="PageDashboard.declarePayment()">+ Déclarer un paiement</button>
          <button class="btn btn-outline" onclick="PageDashboard.requestMaintenance()">🔧 Demander une maintenance</button>
        </div>
      </div>
      ${dueAlertBanner}
      <div class="stats-grid">
        ${this.statCard('🏠','sky', lease ? (lease.apartment?.apartment_number || '—') : '—', 'Mon logement')}
        ${this.statCard('💰','green', lease ? Helpers.formatMoney(lease.monthly_rent) : '—', 'Loyer mensuel')}
        ${this.statCard('✅','green', paid, 'Paiements effectués')}
        ${this.statCard('🔴','red', unpaid, 'Paiements en attente')}
      </div>
      <div class="grid-2">
        <div class="card"><div class="card-header flex justify-between items-center"><h3>Mon contrat</h3><button class="btn btn-sm btn-outline" onclick="Router.go('my-lease')">Détails</button></div><div class="card-body">
          ${lease ? `
            <div class="list-item"><div style="flex:1">Logement</div><b>${lease.apartment?.apartment_number || '—'}${lease.apartment?.apartment_type ? ' · ' + lease.apartment.apartment_type : ''}</b></div>
            <div class="list-item"><div style="flex:1">Immeuble</div><b>${lease.apartment?.property?.property_name || '—'}${lease.apartment?.property?.city ? ' (' + lease.apartment.property.city + ')' : ''}</b></div>
            <div class="list-item"><div style="flex:1">📅 Date de début</div><b>${Helpers.formatDate(lease.start_date)}</b></div>
            <div class="list-item"><div style="flex:1">🏁 Date de fin</div><b>${lease.end_date ? Helpers.formatDate(lease.end_date) : 'Indéterminée / Renouvelable'}</b></div>
            <div class="list-item"><div style="flex:1">Caution</div><b>${Helpers.formatMoney(lease.deposit_amount)}</b></div>
            <div class="list-item"><div style="flex:1">Statut</div>${Helpers.statusBadge(lease.status)}</div>
            ${lease.contract_file ? `<a class="btn btn-outline btn-block mt-3" href="${Helpers.fileUrl(lease.contract_file)}" target="_blank">📄 Consulter le contrat de bail (PDF)</a>` : ''}
          ` : '<p class="text-muted">Aucun contrat actif.</p>'}
        </div></div>
        ${ledgerCard}
      </div>
      ${utilityChargesCard}
      ${invoicesCard}
    `);
  },

  async renderTenantLease() {
    Layout.setTitle('Mon bail');
    const tenant = (await API.get('/tenants/me/profile')).data;
    const lease = (tenant.leases || [])[0];

    if (!lease) {
      Layout.content(`
        <div class="page-head"><h2>📄 Mon contrat de bail</h2></div>
        <div class="card p-4 text-center text-muted">
          <div style="font-size:3rem; margin-bottom:12px">📄</div>
          <h3>Aucun contrat de bail actif</h3>
          <p>Vous n'avez pas de contrat de bail enregistré actuellement.</p>
        </div>
      `);
      return;
    }

    const startDateStr = Helpers.formatDate(lease.start_date);
    const endDateStr = lease.end_date ? Helpers.formatDate(lease.end_date) : 'Indéterminée (Bail renouvelable)';
    const contractUrl = lease.contract_file ? Helpers.fileUrl(lease.contract_file) : null;

    Layout.content(`
      <div class="page-head flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2>📄 Mon Contrat de Bail</h2>
          <div class="subtitle">Récapitulatif des conditions contractuelles et document du bail</div>
        </div>
        ${contractUrl ? `<a href="${contractUrl}" target="_blank" class="btn btn-primary">📄 Télécharger le contrat (PDF)</a>` : ''}
      </div>

      <div class="stats-grid mb-4">
        ${this.statCard('🏢', 'sky', lease.apartment?.property?.property_name || '—', 'Immeuble / Résidence')}
        ${this.statCard('🚪', 'green', lease.apartment?.apartment_number || '—', 'N° Logement')}
        ${this.statCard('💰', 'green', Helpers.formatMoney(lease.monthly_rent), 'Loyer Mensuel')}
        ${this.statCard('📅', 'orange', `${startDateStr} ➔ ${endDateStr}`, 'Période du bail')}
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h3>📋 Informations Contractuelles</h3>
          </div>
          <div class="card-body">
            <div class="list-item"><div style="flex:1">Nom du locataire</div><b>${tenant.full_name}</b></div>
            <div class="list-item"><div style="flex:1">Immeuble / Résidence</div><b>${lease.apartment?.property?.property_name || '—'}${lease.apartment?.property?.city ? ' (' + lease.apartment.property.city + ')' : ''}</b></div>
            <div class="list-item"><div style="flex:1">Logement attribué</div><b>Logement ${lease.apartment?.apartment_number || '—'} ${lease.apartment?.apartment_type ? ' (' + lease.apartment.apartment_type + ')' : ''}</b></div>
            <div class="list-item"><div style="flex:1">📅 Date de début du bail</div><b>${startDateStr}</b></div>
            <div class="list-item"><div style="flex:1">🏁 Date de fin du bail</div><b>${endDateStr}</b></div>
            <div class="list-item"><div style="flex:1">💵 Loyer mensuel</div><b style="color:var(--success)">${Helpers.formatMoney(lease.monthly_rent)}</b></div>
            <div class="list-item"><div style="flex:1">🔒 Dépôt de garantie / Caution</div><b>${Helpers.formatMoney(lease.deposit_amount)}</b></div>
            <div class="list-item"><div style="flex:1">Statut du bail</div>${Helpers.statusBadge(lease.status)}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>📄 Document du Contrat de Bail</h3>
          </div>
          <div class="card-body text-center" style="padding: 30px 20px;">
            ${contractUrl ? `
              <div style="font-size: 3.5rem; margin-bottom: 12px; color: var(--primary);">📄</div>
              <h4 style="margin-bottom: 8px;">Document Officiel du Contrat Signé</h4>
              <p class="text-muted mb-4" style="font-size: 0.9rem;">
                Le fichier officiel de votre contrat de bail au format PDF est disponible et téléchargeable ci-dessous.
              </p>
              <a href="${contractUrl}" target="_blank" class="btn btn-primary btn-block mb-2" style="font-weight:600;">
                👁 Consulter le contrat de bail (PDF)
              </a>
              <a href="${contractUrl}" download target="_blank" class="btn btn-outline btn-block">
                ⬇️ Télécharger une copie
              </a>
            ` : `
              <div style="font-size: 3.5rem; margin-bottom: 12px; color: var(--text-muted);">📄</div>
              <h4 style="margin-bottom: 8px;">Document PDF en cours d'archivage</h4>
              <p class="text-muted mb-4" style="font-size: 0.9rem;">
                Le document scanné de votre contrat n'a pas encore été téléversé par l'administration. Vos informations de bail ci-contre font foi.
              </p>
            `}
          </div>
        </div>
      </div>
    `);
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
    const rows = (tenant.payments || []).slice().sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)).map((p) => {
      const isCompleted = p.status === 'completed';
      const receiptBtn = isCompleted
        ? `<div style="display:flex;gap:6px;align-items:center;">
             <button class="btn btn-sm btn-primary" onclick="PageDashboard.downloadPaymentReceipt(${p.id})" title="Télécharger la quittance officielle signée (PDF)">📄 Quittance PDF</button>
             <button class="btn btn-sm btn-outline" onclick="ReceiptManager.open(${p.id})" title="Visualiser le reçu interactif">👁</button>
           </div>`
        : `<span class="text-muted" style="font-size:12px;font-style:italic;">En attente de validation</span>`;

      return `<tr>
        <td><b>#${p.id}</b></td>
        <td>${Helpers.formatDate(p.payment_date)}</td>
        <td><b>${Helpers.formatMoney(p.amount)}</b></td>
        <td>${Helpers.methodLabel(p.payment_method)}</td>
        <td>${Helpers.statusBadge(p.status)}</td>
        <td>${receiptBtn}</td>
        <td>${p.payment_proof ? `<a class="btn btn-sm btn-outline" href="${Helpers.fileUrl(p.payment_proof)}" target="_blank">📎 Preuve</a>` : '—'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" class="text-center text-muted" style="padding:24px;">Aucun paiement enregistré</td></tr>';

    Layout.content(`
      <div class="page-head flex justify-between items-center flex-wrap gap-2">
        <div>
          <h2>Mes paiements</h2>
          <div class="subtitle">Historique de vos versements et quittances libératoires officielles</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-outline" onclick="Router.go('my-invoices')">🧾 Mes factures & quittances</button>
          <button class="btn btn-primary" onclick="PageDashboard.declarePayment()">+ Déclarer un paiement</button>
        </div>
      </div>
      ${soldeHtml}
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Réf</th><th>Date</th><th>Montant</th><th>Méthode</th><th>Statut</th><th>Quittance officielle</th><th>Justif. versé</th></tr></thead>
        <tbody>${rows}</tbody></table></div></div>`);
  },

  declarePayment() {
    Modal.open('💳 Payer mon loyer en ligne (Mobile Money)', `
      <div class="form-group"><label>Montant à verser (FCFA)</label><input type="number" class="form-control" id="payAmount" value="${this._tenantRent || ''}" required placeholder="Ex: 50000"/>
      <div class="text-muted" style="font-size:12px;margin-top:4px">Vous pouvez régler le loyer complet ou verser une avance partielle.</div></div>
      
      <div class="form-group mb-3"><label>Méthode de règlement</label>
        <select class="form-control" id="payMethod" onchange="PageDashboard.togglePayMethod(this.value)">
          <option value="orange_money">📱 Mobile Money (MTN ou Orange Money)</option>
          <option value="cash">💵 Espèces avec reçu scanné</option>
        </select>
      </div>

      <div id="payCampayFields">
        <div class="form-group"><label>Numéro Mobile Money (6XXXXXXXX)</label>
          <input class="form-control" id="payPhone" placeholder="Ex: 690000000 ou 670000000"/>
          <div class="text-muted" style="font-size:12px;margin-top:4px">Une pop-up / message USSD apparaîtra sur ce téléphone pour saisir votre code PIN.</div>
        </div>
      </div>

      <div id="payCashFields" style="display:none">
        <div class="form-group"><label>Preuve du versement (Photo du reçu / Bordereau)</label><input type="file" class="form-control" id="payProof" accept="image/*,application/pdf"/></div>
      </div>`,
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button><button class="btn btn-primary" onclick="PageDashboard.submitPayment()">Payer maintenant</button>`);
  },

  togglePayMethod(method) {
    const isMoMo = ['orange_money', 'mtn_mobile_money', 'campay'].includes(method);
    document.getElementById('payCampayFields').style.display = isMoMo ? '' : 'none';
    document.getElementById('payCashFields').style.display = isMoMo ? 'none' : '';
  },

  async submitPayment() {
    const amount = document.getElementById('payAmount').value;
    const method = document.getElementById('payMethod').value;
    if (!amount || Number(amount) <= 0) { Toast.error('Veuillez indiquer un montant valide.'); return; }
    
    const isMoMo = ['orange_money', 'mtn_mobile_money', 'campay'].includes(method);
    const fd = new FormData();
    fd.append('amount', amount);
    fd.append('payment_method', method);

    if (isMoMo) {
      const phone = document.getElementById('payPhone').value;
      if (!phone) { Toast.error('Le numéro de téléphone Mobile Money est requis.'); return; }
      fd.append('phone', phone);
    } else {
      const file = document.getElementById('payProof').files[0];
      if (!file) { Toast.error('Une preuve de paiement est requise pour le règlement en espèces.'); return; }
      fd.append('proof', file);
    }

    try {
      Modal.close();
      Toast.info('Initiation du paiement Mobile Money...');
      const res = await API.upload('/payments/declare', fd);
      const data = res.data;
      
      if (isMoMo && (data.ussd_code || data.operator)) {
        this.startPaymentPoller(data.payment?.id || data.id, amount);
        Modal.open('📲 Confirmation Mobile Money sur votre téléphone', `
          <div style="text-align:center; padding:16px 8px;">
            <div style="font-size:3rem; margin-bottom:12px">📱</div>
            <h4>Demande de paiement envoyée !</h4>
            <p style="font-size:14px; color:var(--text-muted); margin-bottom:16px;">
              Un message de confirmation a été envoyé sur le téléphone.<br>
              Veuillez taper votre <b>code secret Mobile Money</b> sur votre téléphone pour valider les <b>${Helpers.formatMoney(amount)}</b>.
            </p>
            <div class="badge badge-info mb-3" style="font-size:14px; padding:8px 14px">Code USSD : ${data.ussd_code || '*126# / *150#'}</div>
            <div class="text-muted" style="font-size:12px; font-style:italic">⏳ Attente automatique de validation de votre code PIN...</div>
          </div>
        `, `<button class="btn btn-outline" onclick="Modal.close(); Router.go('my-payments');">Fermer</button>`);
      } else {
        Toast.success(res.message || 'Paiement déclaré avec succès.');
        Router.go('my-payments');
      }
    } catch (e) {
      Toast.error(e.message || 'Échec du paiement Mobile Money.');
    }
  },

  _pollerTimer: null,
  startPaymentPoller(paymentId, amount) {
    let attempts = 0;
    if (this._pollerTimer) clearInterval(this._pollerTimer);

    this._pollerTimer = setInterval(async () => {
      attempts++;
      try {
        const { data: p } = await API.get('/payments/' + paymentId);
        if (p.status === 'completed') {
          clearInterval(this._pollerTimer);
          Modal.open('🎉 Paiement Validé Instantanément !', `
            <div style="text-align:center; padding:16px 8px;">
              <div style="font-size:3.5rem; color:var(--success); margin-bottom:12px">✅</div>
              <h3 style="color:var(--success)">Paiement de ${Helpers.formatMoney(amount)} Reçu !</h3>
              <p style="font-size:14px; color:var(--text-muted); margin-bottom:16px;">
                Le versement a été vérifié et crédité sur votre compte locataire.<br>
                Votre reçu d'encaissement est disponible ci-dessous.
              </p>
              <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                <button class="btn btn-primary mb-2" onclick="PageDashboard.downloadPaymentReceipt(${p.id})">📄 Télécharger ma quittance PDF officielle</button>
                <button class="btn btn-outline mb-2" onclick="ReceiptManager.open(${p.id})">👁 Voir le reçu interactif</button>
              </div>
            </div>
          `, `<button class="btn btn-primary" onclick="Modal.close(); if (window.location.hash.includes('payments')) PagePayments.render(); else Router.go('my-payments');">Super, merci !</button>`);
          
          if (typeof PageDashboard !== 'undefined' && Auth.getRole() === 'locataire') {
            PageDashboard.renderTenantHome();
          }
        } else if (p.status === 'failed') {
          clearInterval(this._pollerTimer);
          Modal.open('❌ Paiement non effectué', `
            <div style="text-align:center; padding:16px 8px;">
              <div style="font-size:3.5rem; color:var(--danger); margin-bottom:12px">⚠️</div>
              <h4>Transaction annulée ou non validée</h4>
              <p style="font-size:14px; color:var(--text-muted);">
                Le paiement n'a pas été confirmé sur le téléphone. Veuillez réessayer.
              </p>
            </div>
          `, `<button class="btn btn-outline" onclick="Modal.close()">Fermer</button>`);
        }
      } catch (_) {}

      if (attempts >= 30) {
        clearInterval(this._pollerTimer);
      }
    }, 2000);
  },

  // ===== Espace Locataire : Mes factures et quittances officielles =====
  _tenantReceipts: [],
  _tenantUtilityBills: [],
  _tenantInvoiceFilter: 'all',
  _tenantInvoiceQuery: '',

  async renderTenantInvoices() {
    Layout.setTitle('Mes factures & reçus');
    Layout.setActive('my-invoices');

    const appContent = document.getElementById('appContent');
    appContent.innerHTML = '<div class="card" style="text-align:center;padding:40px"><div class="spinner"></div><p style="margin-top:12px;color:var(--text-muted)">Chargement de vos factures et quittances officielles...</p></div>';

    let receipts = [];
    let utilityBills = [];
    try {
      const [recRes, utilRes] = await Promise.all([
        API.get('/receipts').catch(() => ({ data: [] })),
        API.get('/utility-bills/mine').catch(() => ({ data: [] })),
      ]);
      receipts = recRes.data || [];
      utilityBills = utilRes.data || [];
    } catch (e) {
      console.error('Erreur chargement factures locataire:', e);
    }

    this._tenantReceipts = receipts;
    this._tenantUtilityBills = utilityBills;
    this._tenantInvoiceFilter = 'all';
    this._tenantInvoiceQuery = '';

    const totalPaidReceipts = receipts.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const rentCount = receipts.filter(r => r.receipt_type === 'rent').length;
    const utilPaidCount = utilityBills.filter(u => u.status === 'paid').length;

    Layout.content(`
      <div class="page-head flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2>🧾 Mes Factures & Quittances Officielles</h2>
          <div class="subtitle">Consultez et téléchargez vos quittances de loyer signées et reçus de charges</div>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="PageDashboard.declarePayment()">💰 Payer mon loyer</button>
          <button class="btn btn-outline" onclick="PageDashboard.renderTenantInvoices()">🔄 Actualiser</button>
        </div>
      </div>

      <div class="stats-grid mb-4">
        ${this.statCard('🧾', 'sky', receipts.length, 'Quittances & Reçus émis')}
        ${this.statCard('🏠', 'green', rentCount, 'Quittances de loyer')}
        ${this.statCard('⚡', 'orange', utilPaidCount, 'Factures de charges réglées')}
        ${this.statCard('💰', 'green', Helpers.formatMoney(totalPaidReceipts), 'Total certifié réglé')}
      </div>

      <div class="card mb-4" style="background:#f8fafc; border-left:4px solid var(--primary); padding:16px 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="font-size:2.2rem;">🔒</div>
            <div>
              <h4 style="margin:0 0 4px; color:var(--primary); font-weight:700;">
                Documents officiels certifiés avec cachet & signature de SMG IMMOBILIER
              </h4>
              <p style="margin:0; font-size:13px; color:var(--text-muted);">
                Chaque facture et quittance dispose d'un numéro d'enregistrement unique officiel, opposable juridiquement et valant quittance libératoire de paiement.
              </p>
            </div>
          </div>
          <div class="badge badge-success" style="padding:6px 12px; font-size:12px; font-weight:700;">
            ✓ Signature & Cachet Actifs
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header flex justify-between items-center flex-wrap gap-3" style="border-bottom: 1px solid var(--border-color); padding-bottom: 14px;">
          <div style="display:flex; gap:8px; flex-wrap:wrap;" id="tenantInvoiceFilterTabs">
            <button class="btn btn-sm btn-primary" id="btn_tab_all" onclick="PageDashboard.filterTenantInvoices('all')">Tous les documents</button>
            <button class="btn btn-sm btn-outline" id="btn_tab_rent" onclick="PageDashboard.filterTenantInvoices('rent')">🏠 Loyers</button>
            <button class="btn btn-sm btn-outline" id="btn_tab_utility" onclick="PageDashboard.filterTenantInvoices('utility')">⚡ Charges (Eau & Élec)</button>
            <button class="btn btn-sm btn-outline" id="btn_tab_deposit" onclick="PageDashboard.filterTenantInvoices('deposit')">🔒 Cautions & Avances</button>
          </div>
          <div style="min-width: 240px;">
            <input type="text" id="tenantInvoiceSearch" class="form-control" placeholder="🔍 Rechercher (N°, date, type...)" oninput="PageDashboard.searchTenantInvoices(this.value)" style="font-size: 13px;" />
          </div>
        </div>
        <div class="card-body" style="padding:0;">
          <div class="table-wrap">
            <table class="table" style="margin:0;">
              <thead>
                <tr>
                  <th>N° Pièce</th>
                  <th>Type</th>
                  <th>Désignation / Période</th>
                  <th>Montant</th>
                  <th>Mode de règlement</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody id="tenantInvoicesTableBody">
                ${this._buildTenantInvoicesRows(receipts, utilityBills, 'all', '')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `);
  },

  filterTenantInvoices(tab) {
    this._tenantInvoiceFilter = tab;
    ['all', 'rent', 'utility', 'deposit'].forEach((t) => {
      const el = document.getElementById(`btn_tab_${t}`);
      if (el) {
        if (t === tab) {
          el.className = 'btn btn-sm btn-primary';
        } else {
          el.className = 'btn btn-sm btn-outline';
        }
      }
    });
    const tb = document.getElementById('tenantInvoicesTableBody');
    if (tb) {
      tb.innerHTML = this._buildTenantInvoicesRows(this._tenantReceipts, this._tenantUtilityBills, tab, this._tenantInvoiceQuery);
    }
  },

  searchTenantInvoices(query) {
    this._tenantInvoiceQuery = query || '';
    const tb = document.getElementById('tenantInvoicesTableBody');
    if (tb) {
      tb.innerHTML = this._buildTenantInvoicesRows(this._tenantReceipts, this._tenantUtilityBills, this._tenantInvoiceFilter, query);
    }
  },

  _buildTenantInvoicesRows(receipts = [], utilityBills = [], tab = 'all', query = '') {
    const q = (query || '').toLowerCase().trim();

    // 1. Liste des reçus officiels (Receipts)
    let items = (receipts || []).map((r) => {
      const typeLabel = {
        rent: 'Loyer',
        deposit: 'Caution',
        advance: 'Avance sur loyer',
        other_income: 'Recette',
        utility: 'Charges locatives',
      }[r.receipt_type] || 'Quittance';

      const typeIcon = {
        rent: '🏠',
        deposit: '🔒',
        advance: '💰',
        utility: '⚡',
      }[r.receipt_type] || '🧾';

      const period = (r.period_start && r.period_end)
        ? `Du ${Helpers.formatDate(r.period_start)} au ${Helpers.formatDate(r.period_end)}`
        : (r.observations || `Règlement du ${Helpers.formatDate(r.payment_date)}`);

      return {
        id: r.id,
        receipt_number: r.receipt_number,
        raw_type: r.receipt_type,
        typeLabel,
        typeIcon,
        period,
        amount: r.amount,
        payment_method: r.payment_method || 'Espèces',
        payment_date: r.payment_date || r.created_at,
        is_receipt: true,
        receipt: r,
      };
    });

    // 2. Intégrer les factures de charges payées sans reçu direct en table Receipts
    const existingRecNums = new Set(items.map(i => i.receipt_number));
    (utilityBills || []).forEach((b) => {
      if (b.status === 'paid' && b.receipt_number && existingRecNums.has(b.receipt_number)) {
        return;
      }
      const typeName = b.type === 'water' ? 'Eau' : 'Électricité';
      const typeIcon = b.type === 'water' ? '💧' : '⚡';
      const monthStr = (typeof PageUtilities !== 'undefined' && PageUtilities.monthLabel) ? PageUtilities.monthLabel(b.period_month) : `Mois ${b.period_month}`;
      const conso = Math.max(0, Number(b.current_index) - Number(b.previous_index));
      const period = `Facture ${typeName} — ${monthStr} ${b.period_year} (Conso: ${conso} kWh/m³)`;

      items.push({
        id: b.id,
        receipt_number: b.receipt_number || `FACT-CH-${b.id}`,
        raw_type: 'utility',
        typeLabel: `Charges ${typeName}`,
        typeIcon,
        period,
        amount: b.total_amount,
        payment_method: b.payment_method || 'Espèces',
        payment_date: b.paid_date || b.created_at,
        is_utility_bill: true,
        bill: b,
      });
    });

    // Filtrer par onglet
    if (tab === 'rent') {
      items = items.filter(i => i.raw_type === 'rent');
    } else if (tab === 'utility') {
      items = items.filter(i => i.raw_type === 'utility');
    } else if (tab === 'deposit') {
      items = items.filter(i => ['deposit', 'advance'].includes(i.raw_type));
    }

    // Filtrer par recherche
    if (q) {
      items = items.filter(i => 
        (i.receipt_number || '').toLowerCase().includes(q) ||
        (i.typeLabel || '').toLowerCase().includes(q) ||
        (i.period || '').toLowerCase().includes(q) ||
        String(i.amount || '').includes(q) ||
        (i.payment_method || '').toLowerCase().includes(q)
      );
    }

    // Trier du plus récent au plus ancien
    items.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

    if (!items.length) {
      return `<tr><td colspan="8" class="text-center text-muted" style="padding:40px 20px;">
        <div style="font-size:2.5rem; margin-bottom:8px;">📄</div>
        <h4>Aucun document trouvé</h4>
        <p style="font-size:13px;">Aucune facture ou quittance ne correspond à vos critères actuels.</p>
      </td></tr>`;
    }

    return items.map((it) => {
      let downloadAction = '';
      let viewAction = '';

      if (it.is_utility_bill) {
        downloadAction = `PageDashboard.downloadUtilityReceiptPdf(${it.bill.id})`;
        viewAction = `PageDashboard.downloadUtilityReceiptPdf(${it.bill.id})`;
      } else {
        downloadAction = `PageDashboard.downloadReceiptPdf(${it.id}, '${it.receipt_number}')`;
        viewAction = `ReceiptManager.open(${JSON.stringify(it.receipt).replace(/"/g, '&quot;')})`;
      }

      return `
        <tr>
          <td>
            <span class="badge badge-info" style="font-family:monospace; font-size:12px; padding:3px 8px; font-weight:700;">
              ${Helpers.escapeHtml(it.receipt_number)}
            </span>
          </td>
          <td>
            <b>${it.typeIcon} ${Helpers.escapeHtml(it.typeLabel)}</b>
          </td>
          <td style="max-width:260px;">
            <div style="font-size:13px; font-weight:600; color:var(--text);">${Helpers.escapeHtml(it.period)}</div>
          </td>
          <td>
            <b style="color:var(--success); font-size:14px;">${Helpers.formatMoney(it.amount)}</b>
          </td>
          <td>
            ${Helpers.methodLabel(it.payment_method)}
          </td>
          <td>
            ${Helpers.formatDate(it.payment_date)}
          </td>
          <td>
            <span class="badge badge-success" style="font-size:11px; padding:3px 8px;">
              ✓ Signé & Validé
            </span>
          </td>
          <td style="text-align:right; white-space:nowrap;">
            <button class="btn btn-sm btn-outline" onclick="${viewAction}" title="Consulter et afficher le reçu officiel">
              👁 Voir
            </button>
            <button class="btn btn-sm btn-primary" onclick="${downloadAction}" title="Télécharger le document PDF officiel signé" style="margin-left:4px;">
              ⬇️ PDF
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async downloadReceiptPdf(id, receiptNumber) {
    Toast.info('Téléchargement du document officiel PDF...');
    try {
      const blob = await API.downloadBlob(`/receipts/${id}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${receiptNumber || `Recu_${id}`}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 2000);
      Toast.success('Quittance PDF officielle téléchargée avec succès ✅');
    } catch (e) {
      Toast.error(e.message || 'Erreur lors du téléchargement du reçu');
    }
  },

  async downloadPaymentReceipt(paymentId) {
    Toast.info('Génération et téléchargement de votre quittance officielle...');
    try {
      const blob = await API.downloadBlob(`/payments/${paymentId}/receipt-pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quittance_Paiement_${paymentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 2000);
      Toast.success('Quittance officielle signée téléchargée ✅');
    } catch (e) {
      Toast.error(e.message || 'Erreur lors de la récupération de la quittance');
    }
  },

  async downloadUtilityReceiptPdf(billId) {
    Toast.info('Téléchargement du reçu de charges...');
    try {
      const blob = await API.downloadBlob(`/utility-bills/${billId}/receipt-pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Recu_Charges_${billId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 2000);
      Toast.success('Reçu de charges téléchargé ✅');
    } catch (e) {
      Toast.error(e.message || 'Erreur lors du téléchargement du reçu de charges');
    }
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
        <div class="form-group mb-3"><label>Titre du problème <span style="color:var(--danger)">*</span></label><input class="form-control" id="mTitle" required placeholder="Ex: Fuite robinet"/></div>
        <div class="form-group mb-3"><label>Catégorie</label><select class="form-control" id="mCat">
          <option value="plomberie">Plomberie</option><option value="electricite">Électricité</option>
          <option value="peinture">Peinture</option><option value="menuiserie">Menuiserie</option><option value="autre">Autre</option>
        </select></div>
        <div class="form-group mb-3"><label>Priorité</label><select class="form-control" id="mPrio">
          <option value="normale">Normale</option><option value="haute">Haute</option><option value="urgente">Urgente</option>
        </select></div>
        <div class="form-group mb-3"><label>Photo du problème <span style="color:var(--danger)">*</span></label><input type="file" class="form-control" id="mPhoto" accept="image/*" required/></div>
        <div class="form-group mb-3"><label>Description</label><textarea class="form-control" id="mDesc" rows="3" placeholder="Précisez les détails de la panne..."></textarea></div>
      </form>`,
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
       <button class="btn btn-primary" onclick="PageDashboard.submitMaintenance(${lease.apartment_id})">Envoyer la demande</button>`);
  },

  async submitMaintenance(apartmentId) {
    const title = document.getElementById('mTitle').value.trim();
    const category = document.getElementById('mCat').value;
    const priority = document.getElementById('mPrio').value;
    const description = document.getElementById('mDesc').value.trim();
    const photoFile = document.getElementById('mPhoto').files[0];

    if (!title) { Toast.error('Le titre du problème est requis'); return; }
    if (!photoFile) { Toast.error('Une photo du problème est obligatoire'); return; }

    const fd = new FormData();
    fd.append('apartment_id', apartmentId);
    fd.append('title', title);
    fd.append('category', category);
    fd.append('priority', priority);
    fd.append('description', description);
    fd.append('photo', photoFile);

    try {
      await API.upload('/maintenance', fd);
      Modal.close(); Toast.success('Demande de maintenance envoyée avec succès');
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

  payUtilityBill(billId, amount) {
    Modal.open('💳 Payer ma charge de logement', `
      <div class="form-group mb-3"><label>Montant de la charge (FCFA)</label>
        <input type="number" class="form-control" id="uPayAmount" value="${amount || ''}" readonly style="background:var(--bg-surface-2); font-weight:bold;"/>
      </div>
      
      <div class="form-group mb-3"><label>Méthode de règlement</label>
        <select class="form-control" id="uPayMethod" onchange="PageDashboard.toggleUPayMethod(this.value)">
          <option value="orange_money">📱 Mobile Money (MTN ou Orange Money)</option>
          <option value="cash">💵 Espèces avec reçu scanné</option>
        </select>
      </div>

      <div id="uPayMoMoFields">
        <div class="form-group mb-3"><label>Numéro Mobile Money (6XXXXXXXX)</label>
          <input class="form-control" id="uPayPhone" placeholder="Ex: 690000000 ou 670000000"/>
          <div class="text-muted" style="font-size:12px;margin-top:4px">Un message USSD apparaîtra sur ce téléphone pour saisir votre code PIN.</div>
        </div>
      </div>

      <div id="uPayCashFields" style="display:none">
        <div class="form-group mb-3"><label>Preuve du versement (Photo du reçu / Bordereau)</label>
          <input type="file" class="form-control" id="uPayProof" accept="image/*,application/pdf"/>
        </div>
      </div>
    `, `
      <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
      <button class="btn btn-primary" onclick="PageDashboard.submitUtilityPayment(${billId})">Valider le paiement</button>
    `);
  },

  toggleUPayMethod(method) {
    const isMoMo = ['orange_money', 'mtn_mobile_money', 'campay'].includes(method);
    const mEl = document.getElementById('uPayMoMoFields'); if (mEl) mEl.style.display = isMoMo ? '' : 'none';
    const cEl = document.getElementById('uPayCashFields'); if (cEl) cEl.style.display = isMoMo ? 'none' : '';
  },

  async submitUtilityPayment(billId) {
    const method = document.getElementById('uPayMethod').value;
    const isMoMo = ['orange_money', 'mtn_mobile_money', 'campay'].includes(method);
    const fd = new FormData();
    fd.append('payment_method', method);

    if (isMoMo) {
      const phone = document.getElementById('uPayPhone').value;
      if (!phone) { Toast.error('Numéro Mobile Money requis.'); return; }
      fd.append('phone', phone);
    } else {
      const file = document.getElementById('uPayProof').files[0];
      if (!file) { Toast.error('Fichier justificatif requis.'); return; }
      fd.append('proof', file);
    }

    try {
      Modal.close();
      Toast.info('Enregistrement du paiement de la charge...');
      await API.upload('/utility-bills/' + billId + '/pay', fd);
      Toast.success('Paiement de la charge validé avec succès.');
      if (window.location.hash.includes('my-utilities')) {
        if (typeof PageUtilities !== 'undefined') PageUtilities.renderMine();
      } else {
        this.renderTenantHome();
      }
    } catch (e) {
      Toast.error(e.message || 'Échec du paiement.');
    }
  },

  async loadUpcomingRentDues() {
    const container = document.getElementById('upcomingRentDuesContainer');
    if (!container) return;

    try {
      const res = await API.get('/dashboard/upcoming-dues');
      const dues = res.data || [];
      if (!dues.length) {
        container.innerHTML = '';
        return;
      }

      const rows = dues.map((d) => {
        let badge = '';
        if (d.jours_restants < 0) {
          badge = `<span class="badge badge-danger" style="font-weight:700">🔴 En retard de ${Math.abs(d.jours_restants)} jour(s)</span>`;
        } else if (d.jours_restants === 0) {
          badge = `<span class="badge badge-danger" style="font-weight:700">⚠️ Échéance aujourd'hui !</span>`;
        } else if (d.jours_restants <= 4) {
          badge = `<span class="badge badge-warning" style="font-weight:700; background:#fef3c7; color:#92400e; border:1px solid #f59e0b">⏳ Dans ${d.jours_restants} jour(s)</span>`;
        } else if (d.jours_restants <= 7) {
          badge = `<span class="badge badge-warning" style="font-weight:700">⏳ Dans ${d.jours_restants} jour(s)</span>`;
        } else {
          badge = `<span class="badge badge-info" style="font-weight:700">📅 Dans ${d.jours_restants} jour(s)</span>`;
        }

        const phoneClean = d.telephone ? d.telephone.replace(/\D/g, '') : '';
        const waMsg = encodeURIComponent(`Bonjour M./Mme ${d.nom},\nNous vous rappelons que votre loyer de ${Helpers.formatMoney(d.loyer_mensuel)} pour le logement ${d.logement} (${d.immeuble}) arrive à échéance le ${Helpers.formatDate(d.prochaine_echeance)} (${d.echeance_message}).\nMerci de procéder à votre règlement.\nL'équipe SMG IMMOBILIER.`);
        const waBtn = phoneClean
          ? `<a class="btn btn-sm btn-whatsapp" href="https://wa.me/${phoneClean.startsWith('237') ? phoneClean : '237' + phoneClean}?text=${waMsg}" target="_blank" title="Envoyer rappel WhatsApp">🟢 WhatsApp</a>`
          : '';

        return `
          <tr>
            <td><b>${d.nom}</b>${d.telephone ? `<br><small class="text-muted">📞 <a href="tel:${d.telephone}">${d.telephone}</a></small>` : ''}</td>
            <td><b>${d.logement}</b><br><small class="text-muted">🏢 ${d.immeuble}</small></td>
            <td><b style="color:var(--primary)">${Helpers.formatMoney(d.loyer_mensuel)}</b></td>
            <td><b>${Helpers.formatDate(d.prochaine_echeance)}</b></td>
            <td>${badge}</td>
            <td style="text-align:right; white-space:nowrap; gap:6px;">
              ${waBtn}
              <button class="btn btn-sm btn-outline" onclick="PageSituation.ledger(${d.tenant_id})" title="Consulter le relevé financier">📋 Relevé</button>
            </td>
          </tr>
        `;
      }).join('');

      const isHidden = localStorage.getItem('smg_hide_upcoming_dues') === 'true';

      container.innerHTML = `
        <div class="card" style="border:1px solid rgba(245,158,11,0.4); box-shadow:0 4px 14px rgba(245,158,11,0.08); margin-bottom:20px;">
          <div class="card-header flex justify-between items-center" style="background:linear-gradient(90deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.02) 100%); padding:12px 18px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.4rem;">🔔</span>
              <h3 style="margin:0; font-size:1.05rem; color:#b45309; font-weight:700;">
                Échéances de Loyer Imminentes & Rappels (J-10 à J-1 & Retards)
              </h3>
              <span class="badge badge-warning" id="upcomingDuesCountBadge" style="font-weight:700; margin-left:6px;">${dues.length}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <button class="btn btn-sm btn-outline" id="btnToggleUpcomingDues" onclick="PageDashboard.toggleUpcomingDues()" title="Masquer ou afficher cette section">
                ${isHidden ? `👁️ Afficher (${dues.length})` : '👁️ Masquer'}
              </button>
              <button class="btn btn-sm btn-outline" onclick="Router.go('situation')">Voir toute la situation</button>
            </div>
          </div>
          <div id="upcomingRentDuesBody" style="display:${isHidden ? 'none' : 'block'};">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Locataire</th>
                    <th>Logement & Immeuble</th>
                    <th>Loyer Mensuel</th>
                    <th>Date d'Échéance</th>
                    <th>Délai Restant</th>
                    <th style="text-align:right">Rappels & Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (_) {}
  },

  toggleUpcomingDues() {
    const body = document.getElementById('upcomingRentDuesBody');
    const btn = document.getElementById('btnToggleUpcomingDues');
    if (!body) return;
    const willHide = body.style.display !== 'none';
    body.style.display = willHide ? 'none' : 'block';
    localStorage.setItem('smg_hide_upcoming_dues', willHide ? 'true' : 'false');
    if (btn) {
      const cnt = document.getElementById('upcomingDuesCountBadge')?.textContent || '';
      btn.innerHTML = willHide ? `👁️ Afficher (${cnt.trim() || 'échéances'})` : '👁️ Masquer';
    }
  },
};
