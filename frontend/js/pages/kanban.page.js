// ============ Page Kanban & Plan de Travail Urgent (Fiche de Suivi des Tâches) ============
const PageKanban = {
  tasks: [],
  _properties: [],
  _worksites: [],
  _users: [],
  _viewMode: 'table', // 'table' (Plan de travail officiel imprimable) | 'kanban' (Tableau visuel de cartes)

  // Filtres
  _filterCity: 'all',     // Ville / Groupe (ex: Yaoundé, Douala, ou global)
  _filterProperty: '',   // Immeuble spécifique
  _filterWorksite: '',   // Chantier spécifique
  _filterPriority: 'all',
  _filterStatus: 'all',
  _searchQuery: '',
  _periodStart: '2026-09-26',
  _periodEnd: '2026-10-30',

  register() {
    Router.register('kanban', () => this.render());
    this._bindSocket();
  },

  _bindSocket() {
    if (typeof SocketClient !== 'undefined' && SocketClient.socket) {
      SocketClient.socket.off('dashboard:refresh', this._onSocketRefresh);
      SocketClient.socket.off('task:updated', this._onSocketRefresh);
      this._onSocketRefresh = () => {
        if (window.location.hash === '#kanban' || !window.location.hash) {
          this.refreshData();
        }
      };
      SocketClient.socket.on('dashboard:refresh', this._onSocketRefresh);
      SocketClient.socket.on('task:updated', this._onSocketRefresh);
    }
  },

  async refreshData() {
    try {
      const res = await API.get('/tasks');
      this.tasks = res.data || [];
      this.renderContent();
    } catch (_) {}
  },

  async render() {
    Layout.setTitle('Plan de Travail & Suivi des Tâches');
    const container = document.getElementById('appContent');
    if (container) {
      container.innerHTML = '<div class="card text-center" style="padding:40px"><div class="spinner"></div><p class="mt-2 text-muted">Chargement du plan de travail...</p></div>';
    }

    try {
      const [resTasks, resProps, resWorksites, resUsers] = await Promise.all([
        API.get('/tasks'),
        API.get('/properties').catch(() => ({ data: [] })),
        API.get('/worksites').catch(() => ({ data: [] })),
        API.get('/users').catch(() => ({ data: [] })),
      ]);

      this.tasks = resTasks.data || [];
      this._properties = resProps.data || [];
      this._worksites = resWorksites.data || [];
      this._users = resUsers.data || [];

      this.renderContent();
    } catch (err) {
      Layout.content(`<div class="alert alert-danger">${err.message}</div>`);
    }
  },

  // Extraction de la liste des villes/groupes disponibles
  getCitiesList() {
    const set = new Set();
    set.add('Yaoundé');
    set.add('Douala');
    (this._properties || []).forEach((p) => { if (p.city && p.city.trim()) set.add(p.city.trim()); });
    (this._worksites || []).forEach((w) => {
      if (w.location && w.location.trim()) {
        const loc = w.location.trim();
        if (loc.toLowerCase().includes('yaoundé') || loc.toLowerCase().includes('yaounde')) set.add('Yaoundé');
        else if (loc.toLowerCase().includes('douala')) set.add('Douala');
        else set.add(loc);
      }
    });
    (this.tasks || []).forEach((t) => {
      if (t.location_zone) {
        const lz = t.location_zone.toLowerCase();
        if (lz.includes('yaoundé') || lz.includes('yaounde')) set.add('Yaoundé');
        if (lz.includes('douala')) set.add('Douala');
      }
    });
    return Array.from(set).sort();
  },

  // Calcul du libellé de période et de périmètre
  getPeriodTitle() {
    const s = this._periodStart ? Helpers.formatDate(this._periodStart) : '';
    const e = this._periodEnd ? Helpers.formatDate(this._periodEnd) : '';
    let pTxt = 'PÉRIODE GLOBALE (TOUTES DATES)';
    if (s && e) pTxt = `DU ${s.toUpperCase()} AU ${e.toUpperCase()}`;
    else if (s) pTxt = `À PARTIR DU ${s.toUpperCase()}`;

    if (this._filterCity && this._filterCity !== 'all') {
      pTxt += ` — GROUPE / VILLE : ${this._filterCity.toUpperCase()}`;
    }
    return pTxt;
  },

  // Filtrage des tâches (multi-critères : ville, immeuble, chantier, statut, priorité, date, recherche)
  getFilteredTasks() {
    const q = (this._searchQuery || '').toLowerCase().trim();
    const city = (this._filterCity || 'all').toLowerCase();

    return this.tasks.filter((t) => {
      // Priorité
      if (this._filterPriority !== 'all') {
        const p = (t.priority || 'Normal').toLowerCase();
        if (p !== this._filterPriority.toLowerCase()) return false;
      }
      // Statut
      if (this._filterStatus !== 'all') {
        if (t.status !== this._filterStatus) return false;
      }
      // Chantier spécifique
      if (this._filterWorksite) {
        if (String(t.worksite_id) !== String(this._filterWorksite)) return false;
      }
      // Immeuble spécifique
      if (this._filterProperty) {
        if (String(t.property_id) !== String(this._filterProperty)) return false;
      }
      // Ville / Groupe (ex: Yaoundé regroupe tous les chantiers et immeubles de Yaoundé)
      if (city !== 'all' && city !== 'global' && city !== 'tous') {
        const propCity = (t.property?.city || '').toLowerCase();
        const propName = (t.property?.property_name || '').toLowerCase();
        const propAddr = (t.property?.address || '').toLowerCase();
        const wsLoc = (t.worksite?.location || '').toLowerCase();
        const wsTitle = (t.worksite?.title || '').toLowerCase();
        const zone = (t.location_zone || '').toLowerCase();
        const nature = (t.nature_probleme || t.title || '').toLowerCase();

        const match = propCity.includes(city) ||
          propName.includes(city) ||
          propAddr.includes(city) ||
          wsLoc.includes(city) ||
          wsTitle.includes(city) ||
          zone.includes(city) ||
          nature.includes(city);

        if (!match) return false;
      }
      // Recherche libre
      if (q) {
        const zone = (t.location_zone || '').toLowerCase();
        const nature = (t.nature_probleme || t.title || '').toLowerCase();
        const obs = (t.observation || t.completion_note || '').toLowerCase();
        const assignee = (t.assignee?.full_name || '').toLowerCase();
        const prop = (t.property?.property_name || '').toLowerCase();
        const ws = (t.worksite?.title || '').toLowerCase();
        if (!zone.includes(q) && !nature.includes(q) && !obs.includes(q) && !assignee.includes(q) && !prop.includes(q) && !ws.includes(q)) {
          return false;
        }
      }
      return true;
    });
  },

  renderContent() {
    const filtered = this.getFilteredTasks();
    const total = this.tasks.length;
    const filteredCount = filtered.length;
    const urgentCount = filtered.filter((t) => (t.priority || '').toLowerCase() === 'urgent').length;
    const maintCount = filtered.filter((t) => (t.priority || '').toLowerCase().includes('maintenance')).length;
    const renovCount = filtered.filter((t) => (t.priority || '').toLowerCase().includes('rénovation') || (t.priority || '').toLowerCase().includes('renovation')).length;
    const doneCount = filtered.filter((t) => t.status === 'completed' || (t.observation || '').toUpperCase().includes('FAIT')).length;
    const inProgCount = filtered.filter((t) => t.status === 'in_progress').length;

    // Villes / Groupes
    const cities = this.getCitiesList();
    const cityOptions = cities.map((c) =>
      `<option value="${c}" ${this._filterCity === c ? 'selected' : ''}>🏛️ ${c}</option>`
    ).join('');

    // Immeubles
    const propOptions = this._properties.map((p) =>
      `<option value="${p.id}" ${String(this._filterProperty) === String(p.id) ? 'selected' : ''}>${p.property_name}${p.city ? ` (${p.city})` : ''}</option>`
    ).join('');

    // Chantiers
    const worksiteOptions = (this._worksites || []).map((w) =>
      `<option value="${w.id}" ${String(this._filterWorksite) === String(w.id) ? 'selected' : ''}>🚧 ${w.title}${w.location ? ` (${w.location})` : ''}</option>`
    ).join('');

    const periodLabel = this.getPeriodTitle();

    Layout.content(`
      <style>
        @media print {
          @page { size: landscape; margin: 8mm 10mm; }
          body * { visibility: hidden !important; }
          #printableWorkPlan, #printableWorkPlan * { visibility: visible !important; }
          #printableWorkPlan {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #fff !important;
          }
          .no-print, .actions-bar, .page-head, .header-filters, .sidebar, .topbar { display: none !important; }
          .table-wrap { overflow: visible !important; }
          table { width: 100% !important; border-collapse: collapse !important; font-size: 11px !important; }
          table th, table td { border: 1px solid #cbd5e1 !important; padding: 4px 6px !important; }
          .group-header-row td { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .badge { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-header, .print-signatures { display: block !important; }
        }
      </style>

      <div class="no-print">
        <!-- En-tête de la page -->
        <div class="page-head" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:18px">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:24px">📋</span>
              <h2 style="margin:0;font-size:22px">Plan de Travail & Suivi des Tâches</h2>
            </div>
            <div class="subtitle" style="margin-top:4px">
              Suivi en temps réel des interventions, urgences et chantiers par groupe/ville, immeuble et logement
            </div>
          </div>
          <div class="actions-bar" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button class="btn btn-primary" onclick="PageKanban.openCreateModal()">
              ➕ Ajouter une Tâche / Problème
            </button>
            <button class="btn btn-outline" style="border-color:#1a3a5c;color:#1a3a5c;font-weight:700" onclick="PageKanban.printWorkPlan()">
              🖨️ Imprimer la Fiche
            </button>
            <div style="position:relative;display:inline-block">
              <button class="btn btn-outline-success" style="font-weight:700" onclick="PageKanban.togglePdfMenu(event)">
                📥 Télécharger PDF ▾
              </button>
              <div id="pdfDropdownMenu" style="display:none;position:absolute;right:0;top:100%;margin-top:4px;background:#fff;box-shadow:0 6px 18px rgba(0,0,0,0.18);border-radius:6px;border:1px solid #cbd5e1;z-index:999;min-width:230px;overflow:hidden">
                <a href="javascript:void(0)" style="display:block;padding:9px 14px;font-size:12.5px;color:#1e293b;text-decoration:none;border-bottom:1px solid #f1f5f9;font-weight:600" onclick="PageKanban.downloadPdf('active')">
                  📄 PDF selon les filtres actifs
                </a>
                <a href="javascript:void(0)" style="display:block;padding:9px 14px;font-size:12.5px;color:#1e293b;text-decoration:none;border-bottom:1px solid #f1f5f9;font-weight:600" onclick="PageKanban.downloadPdf('week')">
                  📅 PDF Semaine en cours
                </a>
                <a href="javascript:void(0)" style="display:block;padding:9px 14px;font-size:12.5px;color:#1e293b;text-decoration:none;border-bottom:1px solid #f1f5f9;font-weight:600" onclick="PageKanban.downloadPdf('month')">
                  📅 PDF Mois en cours
                </a>
                <a href="javascript:void(0)" style="display:block;padding:9px 14px;font-size:12.5px;color:#1e293b;text-decoration:none;font-weight:600" onclick="PageKanban.downloadPdf('custom')">
                  🔍 PDF Période personnalisée
                </a>
              </div>
            </div>
            ${total === 0 ? `
              <button class="btn btn-warning" onclick="PageKanban.seedSample()">
                ⚡ Charger l'exemple (40 tâches)
              </button>
            ` : ''}
          </div>
        </div>

        <!-- KPIs Synthétiques -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:18px">
          <div class="card p-3" style="border-left:4px solid var(--primary);display:flex;align-items:center;gap:12px">
            <div style="font-size:28px">📋</div>
            <div>
              <div style="font-size:20px;font-weight:800;color:var(--text)">${filteredCount} <span style="font-size:12px;color:var(--text-muted);font-weight:normal">/ ${total}</span></div>
              <div style="font-size:12px;color:var(--text-muted)">Interventions affichées</div>
            </div>
          </div>
          <div class="card p-3" style="border-left:4px solid #dc2626;display:flex;align-items:center;gap:12px">
            <div style="font-size:28px">🚨</div>
            <div>
              <div style="font-size:20px;font-weight:800;color:#dc2626">${urgentCount}</div>
              <div style="font-size:12px;color:var(--text-muted)">Urgences Signalées</div>
            </div>
          </div>
          <div class="card p-3" style="border-left:4px solid #d97706;display:flex;align-items:center;gap:12px">
            <div style="font-size:28px">🔧</div>
            <div>
              <div style="font-size:20px;font-weight:800;color:#d97706">${maintCount}</div>
              <div style="font-size:12px;color:var(--text-muted)">Maintenances</div>
            </div>
          </div>
          <div class="card p-3" style="border-left:4px solid #0284c7;display:flex;align-items:center;gap:12px">
            <div style="font-size:28px">⚡</div>
            <div>
              <div style="font-size:20px;font-weight:800;color:#0284c7">${inProgCount}</div>
              <div style="font-size:12px;color:var(--text-muted)">En cours d'exécution</div>
            </div>
          </div>
          <div class="card p-3" style="border-left:4px solid #16a34a;display:flex;align-items:center;gap:12px">
            <div style="font-size:28px">✅</div>
            <div>
              <div style="font-size:20px;font-weight:800;color:#16a34a">${doneCount}</div>
              <div style="font-size:12px;color:var(--text-muted)">Tâches Réalisées (FAIT)</div>
            </div>
          </div>
        </div>

        <!-- Onglets de Vue & Barre de Filtres Avancée (Ville/Groupe, Immeuble, Chantier, Période) -->
        <div class="card" style="margin-bottom:16px;padding:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px">
            <div style="display:flex;gap:8px">
              <button class="btn btn-sm ${this._viewMode === 'table' ? 'btn-primary' : 'btn-outline'}" onclick="PageKanban.switchView('table')">
                📋 Fiche de suivi & Plan de travail (Tableau)
              </button>
              <button class="btn btn-sm ${this._viewMode === 'kanban' ? 'btn-primary' : 'btn-outline'}" onclick="PageKanban.switchView('kanban')">
                📊 Tableau Kanban (Colonnes)
              </button>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="text" id="taskSearchInput" class="form-control" style="width:260px;font-size:13px" placeholder="🔎 Rechercher appartement, problème, intervenant..." value="${this._searchQuery}" oninput="PageKanban.onSearch(this.value)">
              ${(total > 0 || this._filterCity !== 'all' || this._filterProperty || this._filterWorksite) ? `
                <button class="btn btn-sm btn-outline" style="font-size:12px" title="Réinitialiser tous les filtres" onclick="PageKanban.resetFilters()">🔄 Réinitialiser</button>
              ` : ''}
            </div>
          </div>

          <!-- Filtres de Périmètre & Métier -->
          <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding-top:10px;border-top:1px solid var(--border);font-size:12.5px">
            <!-- 1. Filtre Groupe / Secteur / Ville -->
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-weight:700;color:var(--primary)">🌍 Ville / Groupe :</span>
              <select class="form-control" style="width:160px;font-size:12px;font-weight:600" onchange="PageKanban.filterCity(this.value)">
                <option value="all" ${this._filterCity === 'all' ? 'selected' : ''}>🌍 Tous (Global)</option>
                ${cityOptions}
              </select>
            </div>

            <!-- 2. Filtre Immeuble -->
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-weight:600;color:var(--text-muted)">🏢 Immeuble :</span>
              <select class="form-control" style="width:160px;font-size:12px" onchange="PageKanban.filterProperty(this.value)">
                <option value="">Tous les immeubles</option>
                ${propOptions}
              </select>
            </div>

            <!-- 3. Filtre Chantier -->
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-weight:600;color:var(--text-muted)">🚧 Chantier :</span>
              <select class="form-control" style="width:160px;font-size:12px" onchange="PageKanban.filterWorksite(this.value)">
                <option value="">Tous les chantiers</option>
                ${worksiteOptions}
              </select>
            </div>

            <!-- 4. Filtre Priorité -->
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-weight:600;color:var(--text-muted)">Priorité :</span>
              <select class="form-control" style="width:130px;font-size:12px" onchange="PageKanban.filterPriority(this.value)">
                <option value="all" ${this._filterPriority === 'all' ? 'selected' : ''}>Toutes</option>
                <option value="Urgent" ${this._filterPriority === 'Urgent' ? 'selected' : ''}>🚨 Urgent</option>
                <option value="Maintenance" ${this._filterPriority === 'Maintenance' ? 'selected' : ''}>🔧 Maintenance</option>
                <option value="Rénovation complète" ${this._filterPriority === 'Rénovation complète' ? 'selected' : ''}>🏗️ Rénovation</option>
                <option value="Normal" ${this._filterPriority === 'Normal' ? 'selected' : ''}>ℹ️ Normal</option>
              </select>
            </div>

            <!-- 5. Filtre Statut -->
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-weight:600;color:var(--text-muted)">Statut :</span>
              <select class="form-control" style="width:130px;font-size:12px" onchange="PageKanban.filterStatus(this.value)">
                <option value="all" ${this._filterStatus === 'all' ? 'selected' : ''}>Tous statuts</option>
                <option value="pending" ${this._filterStatus === 'pending' ? 'selected' : ''}>⏳ À faire</option>
                <option value="in_progress" ${this._filterStatus === 'in_progress' ? 'selected' : ''}>⚡ En cours</option>
                <option value="completed" ${this._filterStatus === 'completed' ? 'selected' : ''}>✅ FAIT / Terminé</option>
                <option value="not_done" ${this._filterStatus === 'not_done' ? 'selected' : ''}>❌ Non fait</option>
              </select>
            </div>

            <!-- 6. Filtre Période Dates -->
            <div style="display:flex;align-items:center;gap:6px;margin-left:auto;flex-wrap:wrap">
              <div style="display:flex;gap:4px">
                <button class="btn btn-xs btn-outline" title="Aujourd'hui" onclick="PageKanban.quickPeriod('today')">Auj.</button>
                <button class="btn btn-xs btn-outline" title="Cette semaine" onclick="PageKanban.quickPeriod('week')">Semaine</button>
                <button class="btn btn-xs btn-outline" title="Ce mois" onclick="PageKanban.quickPeriod('month')">Mois</button>
                <button class="btn btn-xs btn-outline" title="Période type" onclick="PageKanban.quickPeriod('sample')">26 Sept-30 Oct</button>
              </div>
              <input type="date" class="form-control" style="width:125px;font-size:12px" value="${this._periodStart}" onchange="PageKanban.setPeriod(this.value, PageKanban._periodEnd)" />
              <span>au</span>
              <input type="date" class="form-control" style="width:125px;font-size:12px" value="${this._periodEnd}" onchange="PageKanban.setPeriod(PageKanban._periodStart, this.value)" />
            </div>
          </div>
        </div>

        <!-- Barre d'action groupée pour suppression des tâches -->
        <div id="taskBulkBar" style="display:none;background:#fee2e2;border:1px solid #fca5a5;padding:10px 16px;border-radius:8px;margin-bottom:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div style="font-size:13px;color:#991b1b;font-weight:600">
            <span id="taskSelectedCount">0</span> tâche(s) sélectionnée(s)
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm btn-outline" style="border-color:#f87171;color:#991b1b" onclick="PageKanban.clearSelection()">Annuler</button>
            <button class="btn btn-sm btn-danger" onclick="PageKanban.bulkDelete()">🗑️ Tout supprimer la sélection</button>
          </div>
        </div>
      </div>

      <!-- Contenu de la Vue Sélectionnée -->
      <div id="taskViewContent">
        ${this._viewMode === 'table' ? this.renderTableView(filtered, periodLabel) : this.renderKanbanView(filtered)}
      </div>
    `);
  },

  switchView(mode) {
    this._viewMode = mode;
    this.renderContent();
  },

  filterCity(val) { this._filterCity = val; this.renderContent(); },
  filterWorksite(val) { this._filterWorksite = val; this.renderContent(); },
  filterPriority(val) { this._filterPriority = val; this.renderContent(); },
  filterStatus(val) { this._filterStatus = val; this.renderContent(); },
  filterProperty(val) { this._filterProperty = val; this.renderContent(); },
  setPeriod(start, end) { this._periodStart = start; this._periodEnd = end; this.renderContent(); },
  onSearch(query) { this._searchQuery = query; this.renderContent(); },
  resetFilters() {
    this._filterCity = 'all';
    this._filterWorksite = '';
    this._filterProperty = '';
    this._filterPriority = 'all';
    this._filterStatus = 'all';
    this._searchQuery = '';
    this.renderContent();
  },

  // ============================================================
  // VUE 1 : PLAN DE TRAVAIL OFFICIEL (FORMAT DEMANDÉ PAR L'UTILISATEUR)
  // ============================================================
  renderTableView(tasks, periodLabel) {
    const groups = [
      {
        id: 'urgent',
        title: 'GROUPE : TÂCHES URGENTES & CRITIQUES',
        icon: '🚨',
        bg: '#fee2e2',
        border: '#ef4444',
        text: '#991b1b',
        matcher: (t) => (t.priority || '').toLowerCase() === 'urgent',
      },
      {
        id: 'renovation',
        title: 'GROUPE : RÉNOVATIONS COMPLÈTES',
        icon: '🏗️',
        bg: '#f3e8ff',
        border: '#a855f7',
        text: '#6b21a8',
        matcher: (t) => {
          const p = (t.priority || '').toLowerCase();
          return p.includes('rénovation') || p.includes('renovation');
        },
      },
      {
        id: 'maintenance',
        title: 'GROUPE : OPÉRATIONS DE MAINTENANCE COURANTE',
        icon: '🔧',
        bg: '#fef3c7',
        border: '#f59e0b',
        text: '#92400e',
        matcher: (t) => (t.priority || '').toLowerCase().includes('maintenance'),
      },
      {
        id: 'normal',
        title: 'GROUPE : AUTRES INTERVENTIONS & TÂCHES DIVERSES',
        icon: 'ℹ️',
        bg: '#f1f5f9',
        border: '#94a3b8',
        text: '#334155',
        matcher: (t) => {
          const p = (t.priority || '').toLowerCase();
          return p !== 'urgent' && !p.includes('maintenance') && !p.includes('rénovation') && !p.includes('renovation');
        },
      },
    ];

    let globalIdx = 0;
    let tableBodyHtml = '';

    groups.forEach((grp) => {
      const grpTasks = tasks.filter(grp.matcher);
      if (!grpTasks.length) return;

      const grpDone = grpTasks.filter((t) => t.status === 'completed' || (t.observation || '').toUpperCase().includes('FAIT')).length;
      const grpDoing = grpTasks.filter((t) => t.status === 'in_progress').length;
      const grpTodo = grpTasks.filter((t) => t.status === 'pending' || !t.status).length;

      // Ligne d'en-tête de Groupe
      tableBodyHtml += `
        <tr class="group-header-row" style="background:${grp.bg};border-left:5px solid ${grp.border}">
          <td colspan="9" style="padding:10px 14px;font-weight:800;color:${grp.text};font-size:13px">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
              <span>${grp.icon} ${grp.title} — <span style="font-weight:600;font-size:12px">(${grpTasks.length} tâche${grpTasks.length > 1 ? 's' : ''})</span></span>
              <span style="font-size:12px;font-weight:700;display:flex;gap:10px;align-items:center">
                <span class="badge" style="background:#dcfce7;color:#166534">${grpDone} FAIT</span>
                <span class="badge" style="background:#e0f2fe;color:#0369a1">${grpDoing} En cours</span>
                <span class="badge" style="background:#f1f5f9;color:#475569">${grpTodo} À faire</span>
              </span>
            </div>
          </td>
        </tr>
      `;

      // Lignes de tâches pour ce groupe
      grpTasks.forEach((t) => {
        globalIdx++;
        const priority = t.priority || 'Normal';
        const isUrgent = grp.id === 'urgent';
        const isMaint = grp.id === 'maintenance';
        const isRenov = grp.id === 'renovation';

        let pBadge = `<span class="badge" style="background:#f1f5f9;color:#334155;font-weight:700;font-size:11px">Normal</span>`;
        if (isUrgent) pBadge = `<span class="badge badge-danger" style="background:#fee2e2;color:#991b1b;border:1px solid #f87171;font-weight:800;font-size:11px">🚨 Urgent</span>`;
        else if (isMaint) pBadge = `<span class="badge badge-warning" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;font-weight:700;font-size:11px">🔧 Maintenance</span>`;
        else if (isRenov) pBadge = `<span class="badge" style="background:#f3e8ff;color:#6b21a8;border:1px solid #d8b4fe;font-weight:700;font-size:11px">🏗️ Rénovation</span>`;

        const zone = t.location_zone
          || (t.apartment ? `Logement ${t.apartment.apartment_number}` : '')
          || (t.property ? t.property.property_name : '')
          || '—';

        const nature = t.nature_probleme || t.title || '—';
        const observation = t.observation || t.completion_note || (t.status === 'completed' ? 'FAIT' : '—');
        const isDone = observation.toUpperCase().includes('FAIT') || t.status === 'completed';

        let statusBadge = `<span class="badge badge-secondary" style="font-size:11px">⏳ À faire</span>`;
        if (t.status === 'in_progress') statusBadge = `<span class="badge badge-warning" style="background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;font-size:11px">⚡ En cours</span>`;
        else if (t.status === 'completed') statusBadge = `<span class="badge badge-success" style="background:#dcfce7;color:#166534;border:1px solid #86efac;font-size:11px">✅ FAIT</span>`;
        else if (t.status === 'not_done') statusBadge = `<span class="badge badge-danger" style="font-size:11px">❌ Non fait</span>`;

        tableBodyHtml += `
          <tr style="${isUrgent ? 'background:#fffafa;' : ''}">
            <td class="no-print" style="text-align:center">
              <input type="checkbox" class="task-row-chk" value="${t.id}" onchange="PageKanban.onRowSelectChange()" />
            </td>
            <td style="font-size:12px;color:var(--text-muted);text-align:center;font-weight:600">${globalIdx}</td>
            <td><b>${pBadge}</b></td>
            <td style="font-weight:700;font-size:13px;color:var(--primary)">${zone}</td>
            <td style="font-size:13px;color:var(--text);max-width:320px">${nature}</td>
            <td>
              <div style="display:flex;align-items:center;gap:6px">
                <span style="font-weight:${isDone ? '800' : '600'};color:${isDone ? '#166534' : (isUrgent && observation !== '—' ? '#991b1b' : 'var(--text)')};font-size:12.5px">
                  ${observation}
                </span>
                <button class="btn btn-sm btn-outline no-print" style="padding:1px 5px;font-size:10px" title="Modifier l'observation" onclick="PageKanban.openQuickObsModal(${t.id})">✏️</button>
              </div>
            </td>
            <td style="text-align:center">
              <div style="display:flex;align-items:center;justify-content:center;gap:4px">
                ${statusBadge}
                ${!isDone ? `<button class="btn btn-sm btn-success no-print" style="padding:1px 6px;font-size:10px" title="Marquer FAIT" onclick="PageKanban.quickMarkDone(${t.id})">✅</button>` : ''}
              </div>
            </td>
            <td style="font-size:12px">${t.assignee?.full_name || '<span class="text-muted">—</span>'}</td>
            <td class="no-print" style="text-align:center">
              <div style="display:inline-flex;gap:4px">
                <button class="btn btn-sm btn-outline" title="Modifier" onclick="PageKanban.openEditModal(${t.id})">✏️</button>
                <button class="btn btn-sm btn-danger" title="Supprimer" onclick="PageKanban.removeTask(${t.id})">🗑</button>
              </div>
            </td>
          </tr>
        `;
      });
    });

    if (!tableBodyHtml) {
      tableBodyHtml = `<tr><td colspan="9" class="text-center text-muted" style="padding:40px">Aucune tâche ne correspond aux critères sélectionnés.</td></tr>`;
    }

    return `
      <!-- Feuille officielle de suivi et plan de travail -->
      <div class="card" id="printableWorkPlan" style="padding:20px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.05)">
        <!-- En-tête visible à l'impression / export -->
        <div class="print-header" style="border-bottom:2px solid var(--primary,#1a3a5c);padding-bottom:12px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
            <div>
              <h2 style="margin:0;font-size:18px;color:var(--primary,#1a3a5c);font-weight:800;letter-spacing:0.5px">
                SMG IMMOBILIER — DIRECTION TECHNIQUE & SUIVI
              </h2>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
                Gestion immobilière, maintenances régulières et suivi des chantiers
              </div>
            </div>
            <div style="text-align:right;font-size:12px;color:var(--text-muted)">
              <div>Édité le : <b>${Helpers.formatDate(new Date())}</b></div>
              <div>Interventions : <b>${tasks.length} tâche(s) au total</b></div>
            </div>
          </div>

          <!-- Titre Bandeau -->
          <div style="background:#1a3a5c;color:#fff;text-align:center;padding:8px 12px;border-radius:6px;margin-top:10px">
            <h3 style="margin:0;font-size:14.5px;font-weight:800;letter-spacing:1px;color:#fff">
              PLAN DE TRAVAIL URGENT – ${periodLabel}
            </h3>
          </div>
        </div>

        <!-- Tableau principal -->
        <div class="table-wrap">
          <table class="table" style="font-size:13px;margin:0">
            <thead>
              <tr style="background:#f8fafc">
                <th class="no-print" style="width:36px;text-align:center">
                  <input type="checkbox" id="taskSelectAll" title="Tout sélectionner" onchange="PageKanban.toggleSelectAll(this.checked)" />
                </th>
                <th style="width:36px;text-align:center">N°</th>
                <th style="width:130px">Priorité</th>
                <th style="width:150px">Appartement / Zone</th>
                <th>Nature du problème</th>
                <th style="width:230px">Observation / État d’avancement</th>
                <th style="width:110px;text-align:center">Statut</th>
                <th style="width:120px">Intervenant</th>
                <th class="no-print" style="width:90px;text-align:center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${tableBodyHtml}
            </tbody>
          </table>
        </div>

        <!-- Blocs de Signatures Officielles (visibles à l'impression) -->
        <div class="print-signatures" style="margin-top:36px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding-top:16px;border-top:1px solid #e2e8f0">
          <div style="border:1px solid #cbd5e1;border-radius:6px;padding:10px;min-height:90px">
            <div style="font-weight:700;font-size:11.5px;color:#1a3a5c;text-align:center;margin-bottom:6px">LE GESTIONNAIRE / SUIVI</div>
            <div style="font-size:10.5px;color:#64748b">Date :</div>
            <div style="font-size:10.5px;color:#64748b;margin-top:4px">Signature :</div>
          </div>
          <div style="border:1px solid #cbd5e1;border-radius:6px;padding:10px;min-height:90px">
            <div style="font-weight:700;font-size:11.5px;color:#1a3a5c;text-align:center;margin-bottom:6px">DIRECTION TECHNIQUE & TRAVAUX</div>
            <div style="font-size:10.5px;color:#64748b">Visa & Validation :</div>
          </div>
          <div style="border:1px solid #cbd5e1;border-radius:6px;padding:10px;min-height:90px">
            <div style="font-weight:700;font-size:11.5px;color:#1a3a5c;text-align:center;margin-bottom:6px">DIRECTION GÉNÉRALE / MANAGER</div>
            <div style="font-size:10.5px;color:#64748b">Approbation :</div>
          </div>
        </div>
      </div>
    `;
  },

  // ============================================================
  // VUE 2 : TABLEAU KANBAN (COLONNES DYNAMIQUES)
  // ============================================================
  renderKanbanView(tasks) {
    const columns = [
      { id: 'pending', label: '⏳ À faire', color: '#3b82f6', bg: '#eff6ff' },
      { id: 'in_progress', label: '⚡ En cours', color: '#f59e0b', bg: '#fefce8' },
      { id: 'completed', label: '✅ FAIT / Terminé', color: '#10b981', bg: '#ecfdf5' },
      { id: 'not_done', label: '❌ Non effectué', color: '#ef4444', bg: '#fef2f2' },
      { id: 'cancelled', label: '🚫 Annulé', color: '#6b7280', bg: '#f3f4f6' },
    ];

    const colsHtml = columns.map((col) => {
      const colTasks = tasks.filter((t) => t.status === col.id);

      const cardsHtml = colTasks.map((t) => {
        const priority = t.priority || 'Normal';
        const isUrgent = priority.toLowerCase() === 'urgent';
        const isMaint = priority.toLowerCase().includes('maintenance');
        const isRenov = priority.toLowerCase().includes('rénovation') || priority.toLowerCase().includes('renovation');

        let pBadge = `<span class="badge" style="background:#f1f5f9;color:#334155;font-size:10.5px">Normal</span>`;
        if (isUrgent) pBadge = `<span class="badge badge-danger" style="background:#fee2e2;color:#991b1b;font-size:10.5px;font-weight:800">🚨 URGENT</span>`;
        else if (isMaint) pBadge = `<span class="badge badge-warning" style="background:#fef3c7;color:#92400e;font-size:10.5px">🔧 Maintenance</span>`;
        else if (isRenov) pBadge = `<span class="badge" style="background:#f3e8ff;color:#6b21a8;font-size:10.5px">🏗️ Rénovation</span>`;

        const zone = t.location_zone
          || (t.apartment ? `Logement ${t.apartment.apartment_number}` : '')
          || (t.property ? t.property.property_name : '')
          || '—';

        const nature = t.nature_probleme || t.title || '—';
        const obs = t.observation || t.completion_note;

        let actions = '';
        if (col.id === 'pending') {
          actions = `<button class="btn btn-sm btn-outline-warning" style="width:100%;margin-top:8px;font-size:11.5px" onclick="event.stopPropagation(); PageKanban.moveTask(${t.id}, 'in_progress')">⚡ Démarrer ➔</button>`;
        } else if (col.id === 'in_progress') {
          actions = `
            <div style="display:flex;gap:4px;margin-top:8px">
              <button class="btn btn-sm btn-success" style="flex:1;font-size:11.5px" onclick="event.stopPropagation(); PageKanban.moveTask(${t.id}, 'completed')">✅ Fait</button>
              <button class="btn btn-sm btn-danger" style="flex:1;font-size:11.5px" onclick="event.stopPropagation(); PageKanban.moveTask(${t.id}, 'not_done')">❌ Rater</button>
            </div>
          `;
        }

        return `
          <div class="card" style="padding:12px;margin-bottom:10px;border-left:4px solid ${col.color};cursor:pointer;background:#fff;transition:transform 0.15s,box-shadow 0.15s" onclick="PageKanban.openEditModal(${t.id})" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:4px">
              <span style="font-weight:800;font-size:12.5px;color:var(--primary)">🏢 ${zone}</span>
              ${pBadge}
            </div>

            <div style="font-weight:700;font-size:13px;color:var(--text);margin-bottom:6px;line-height:1.3">
              ${nature}
            </div>

            ${obs ? `
              <div style="background:#f8fafc;border-radius:4px;padding:4px 8px;font-size:11.5px;margin-bottom:6px;color:#334155;border-left:2px solid ${col.color}">
                <b>Obs :</b> ${obs}
              </div>
            ` : ''}

            <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#64748b">
              <span>👤 ${t.assignee?.full_name || 'Non assigné'}</span>
              <span>📅 ${t.end_date ? Helpers.formatDate(t.end_date) : '—'}</span>
            </div>

            ${actions}
          </div>
        `;
      }).join('');

      return `
        <div style="flex:1;min-width:260px;background:${col.bg};border-radius:8px;padding:12px;display:flex;flex-direction:column;border:1px solid #e2e8f0">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:2px solid ${col.color};padding-bottom:8px">
            <strong style="font-size:14.5px;color:#1e293b">${col.label}</strong>
            <span class="badge" style="background:#fff;border:1px solid #cbd5e1;color:#1e293b;font-weight:700">${colTasks.length}</span>
          </div>
          <div style="flex:1;overflow-y:auto;max-height:calc(100vh - 280px);min-height:200px">
            ${cardsHtml || '<div style="text-align:center;padding:25px;color:#94a3b8;font-size:12.5px">Aucune tâche</div>'}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div style="display:flex;gap:14px;overflow-x:auto;padding-bottom:14px">
        ${colsHtml}
      </div>
    `;
  },

  // ============================================================
  // ACTIONS ET INTERACTIONS
  // ============================================================

  // Changement de statut avec note
  async moveTask(id, newStatus) {
    let note = '';
    if (newStatus === 'completed') {
      note = prompt('Observation / État d\'avancement :', 'FAIT') || 'FAIT';
    } else if (newStatus === 'not_done') {
      note = prompt('Indiquez la raison ou justification de non-réalisation :') || '';
      if (!note.trim()) {
        Toast.warning('La justification est obligatoire pour une tâche non effectuée.');
        return;
      }
    }

    try {
      await API.patch(`/tasks/${id}/status`, { status: newStatus, note });
      Toast.success('Statut de la tâche mis à jour !');
      this.render();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  // Modal d'observation rapide
  openQuickObsModal(id) {
    const t = this.tasks.find((x) => x.id === id);
    if (!t) return;

    Modal.open(
      `Observation — ${t.location_zone || 'Intervention'}`,
      `
        <div class="form-group mb-3">
          <label style="font-weight:700">Observation / État d'avancement</label>
          <input type="text" id="quickObsInput" class="form-control" value="${(t.observation || '').replace(/"/g, '&quot;')}" placeholder="Ex: Lui fixer une date, FAIT, Travail inachevé, En cours..." />
        </div>
        <div class="form-group">
          <label style="font-weight:700">Statut</label>
          <select id="quickObsStatus" class="form-control">
            <option value="pending" ${t.status === 'pending' ? 'selected' : ''}>⏳ À faire</option>
            <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>⚡ En cours</option>
            <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>✅ FAIT / Terminé</option>
            <option value="not_done" ${t.status === 'not_done' ? 'selected' : ''}>❌ Non effectué</option>
          </select>
        </div>
      `,
      `
        <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
        <button class="btn btn-primary" onclick="PageKanban.saveQuickObs(${id})">Enregistrer</button>
      `
    );
  },

  async saveQuickObs(id) {
    const obs = document.getElementById('quickObsInput')?.value || '';
    const status = document.getElementById('quickObsStatus')?.value || 'pending';
    try {
      await API.put(`/tasks/${id}`, { observation: obs, status });
      Modal.close();
      Toast.success('Observation mise à jour !');
      this.render();
    } catch (e) {
      Toast.error(e.message);
    }
  },

  async quickMarkDone(id) {
    try {
      await API.patch(`/tasks/${id}/status`, { status: 'completed', note: 'FAIT' });
      Toast.success('Tâche validée comme FAIT !');
      const t = this.tasks.find((x) => x.id === id);
      if (t) {
        t.status = 'completed';
        t.observation = 'FAIT';
      }
      this.renderContent();
    } catch (e) {
      Toast.error(e.message);
    }
  },

  togglePdfMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('pdfDropdownMenu');
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  },

  printWorkPlan() {
    window.print();
  },

  quickPeriod(type) {
    const curr = new Date();
    if (type === 'today') {
      const t = curr.toISOString().slice(0, 10);
      this.setPeriod(t, t);
    } else if (type === 'week') {
      const day = curr.getDay();
      const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(curr.setDate(diff));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      this.setPeriod(mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10));
    } else if (type === 'month') {
      const first = new Date(curr.getFullYear(), curr.getMonth(), 1);
      const last = new Date(curr.getFullYear(), curr.getMonth() + 1, 0);
      this.setPeriod(first.toISOString().slice(0, 10), last.toISOString().slice(0, 10));
    } else if (type === 'sample') {
      this.setPeriod('2026-09-26', '2026-10-30');
    }
  },

  async downloadPdf(periodType = 'active') {
    const menu = document.getElementById('pdfDropdownMenu');
    if (menu) menu.style.display = 'none';

    let pStart = this._periodStart;
    let pEnd = this._periodEnd;
    let title = '';

    const todayStr = new Date().toISOString().slice(0, 10);

    if (periodType === 'today') {
      pStart = todayStr;
      pEnd = todayStr;
      title = `JOURNÉE DU ${Helpers.formatDate(todayStr).toUpperCase()}`;
    } else if (periodType === 'week') {
      const curr = new Date();
      const day = curr.getDay();
      const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(curr.setDate(diff));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      pStart = mon.toISOString().slice(0, 10);
      pEnd = sun.toISOString().slice(0, 10);
      title = `SEMAINE DU ${Helpers.formatDate(pStart).toUpperCase()} AU ${Helpers.formatDate(pEnd).toUpperCase()}`;
    } else if (periodType === 'month') {
      const curr = new Date();
      const first = new Date(curr.getFullYear(), curr.getMonth(), 1);
      const last = new Date(curr.getFullYear(), curr.getMonth() + 1, 0);
      pStart = first.toISOString().slice(0, 10);
      pEnd = last.toISOString().slice(0, 10);
      title = `MOIS DE ${new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(curr).toUpperCase()}`;
    } else {
      title = this.getPeriodTitle();
    }

    try {
      Toast.info('Génération du PDF officiel en temps réel...');
      const token = Auth.getToken();
      const params = new URLSearchParams({
        period_start: pStart,
        period_end: pEnd,
        period_label: title,
        token: token || '',
      });
      if (this._filterPriority && this._filterPriority !== 'all') params.append('priority', this._filterPriority);
      if (this._filterStatus && this._filterStatus !== 'all') params.append('status', this._filterStatus);
      if (this._filterCity && this._filterCity !== 'all') params.append('city', this._filterCity);
      if (this._filterProperty) params.append('property_id', this._filterProperty);
      if (this._filterWorksite) params.append('worksite_id', this._filterWorksite);

      const url = `${CONFIG.API_URL}/tasks/work-plan-pdf?${params.toString()}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erreur lors du téléchargement du PDF');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const cleanCity = this._filterCity && this._filterCity !== 'all' ? `_${this._filterCity.replace(/\s+/g, '_')}` : '';
      a.download = `Plan_de_travail_urgent${cleanCity}_${pStart || 'GLOBAL'}_${pEnd || 'GLOBAL'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 3000);
      Toast.success('Fiche de suivi PDF téléchargée avec succès !');
    } catch (e) {
      Toast.error(e.message || 'Erreur lors de la génération du PDF');
    }
  },

  // Modal de Création de Tâche
  openCreateModal() {
    const propOpts = this._properties.map((p) => `<option value="${p.id}">${p.property_name}${p.city ? ` (${p.city})` : ''}</option>`).join('');
    const worksiteOpts = (this._worksites || []).map((w) => `<option value="${w.id}">🚧 ${w.title}${w.location ? ` (${w.location})` : ''}</option>`).join('');
    const userOpts = this._users.map((u) => `<option value="${u.id}">${u.full_name} (${u.role?.label || 'Staff'})</option>`).join('');

    Modal.open(
      '➕ Nouvelle Tâche / Problème Constaté',
      `
        <form id="createTaskForm" onsubmit="PageKanban.submitCreate(event)">
          <div class="form-row" style="display:flex;gap:12px;margin-bottom:12px">
            <div class="form-group" style="flex:1">
              <label style="font-weight:700">Priorité *</label>
              <select id="tPriority" class="form-control" required>
                <option value="Urgent">🚨 Urgent</option>
                <option value="Maintenance">🔧 Maintenance</option>
                <option value="Rénovation complète">🏗️ Rénovation complète</option>
                <option value="Normal" selected>ℹ️ Normal</option>
              </select>
            </div>
            <div class="form-group" style="flex:1">
              <label style="font-weight:700">Appartement / Zone / Chantier *</label>
              <input type="text" id="tLocationZone" class="form-control" required placeholder="Ex: 408, 517, Chantier Yaoundé, Immeuble l'AGAPE..." />
            </div>
          </div>

          <div class="form-group mb-3">
            <label style="font-weight:700">Nature du problème / Intervention *</label>
            <input type="text" id="tNature" class="form-control" required placeholder="Ex: Siphon douche, Climatisation, Électricité, Pose de pavés..." />
          </div>

          <div class="form-group mb-3">
            <label style="font-weight:700">Observation / État d'avancement</label>
            <input type="text" id="tObservation" class="form-control" placeholder="Ex: Lui fixer une date, En attente main d'œuvre, FAIT..." />
          </div>

          <div class="form-row" style="display:flex;gap:12px;margin-bottom:12px">
            <div class="form-group" style="flex:1">
              <label style="font-weight:700">Immeuble lié (optionnel)</label>
              <select id="tPropertyId" class="form-control">
                <option value="">— Aucun immeuble spécifique —</option>
                ${propOpts}
              </select>
            </div>
            <div class="form-group" style="flex:1">
              <label style="font-weight:700">Chantier lié (optionnel)</label>
              <select id="tWorksiteId" class="form-control">
                <option value="">— Aucun chantier spécifique —</option>
                ${worksiteOpts}
              </select>
            </div>
          </div>

          <div class="form-row" style="display:flex;gap:12px;margin-bottom:12px">
            <div class="form-group" style="flex:1">
              <label style="font-weight:700">Intervenant assigné</label>
              <select id="tAssignedTo" class="form-control">
                <option value="">— Non assigné —</option>
                ${userOpts}
              </select>
            </div>
            <div class="form-group" style="flex:1">
              <label style="font-weight:700">Date début planifiée</label>
              <input type="date" id="tStartDate" class="form-control" value="${this._periodStart || ''}" />
            </div>
            <div class="form-group" style="flex:1">
              <label style="font-weight:700">Échéance limite</label>
              <input type="date" id="tEndDate" class="form-control" value="${this._periodEnd || ''}" />
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
            <button type="button" class="btn btn-outline" onclick="Modal.close()">Annuler</button>
            <button type="submit" class="btn btn-primary">Enregistrer la Tâche</button>
          </div>
        </form>
      `,
      null,
      'medium'
    );
  },

  async submitCreate(e) {
    e.preventDefault();
    const data = {
      priority: document.getElementById('tPriority')?.value || 'Normal',
      location_zone: document.getElementById('tLocationZone')?.value.trim(),
      nature_probleme: document.getElementById('tNature')?.value.trim(),
      title: document.getElementById('tNature')?.value.trim(),
      observation: document.getElementById('tObservation')?.value.trim() || null,
      property_id: document.getElementById('tPropertyId')?.value || null,
      worksite_id: document.getElementById('tWorksiteId')?.value || null,
      assigned_to: document.getElementById('tAssignedTo')?.value || null,
      period_start: document.getElementById('tStartDate')?.value || null,
      period_end: document.getElementById('tEndDate')?.value || null,
      status: 'pending',
    };

    if (data.period_start) data.start_date = new Date(`${data.period_start}T08:00:00`);
    if (data.period_end) data.end_date = new Date(`${data.period_end}T18:00:00`);

    try {
      await API.post('/tasks', data);
      Modal.close();
      Toast.success('Tâche ajoutée au plan de travail !');
      this.refreshData();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de la création');
    }
  },

  // Modal d'Édition Complète
  openEditModal(id) {
    const t = this.tasks.find((x) => x.id === id);
    if (!t) return;

    const propOpts = this._properties.map((p) =>
      `<option value="${p.id}" ${String(t.property_id) === String(p.id) ? 'selected' : ''}>${p.property_name}${p.city ? ` (${p.city})` : ''}</option>`
    ).join('');

    const worksiteOpts = (this._worksites || []).map((w) =>
      `<option value="${w.id}" ${String(t.worksite_id) === String(w.id) ? 'selected' : ''}>🚧 ${w.title}${w.location ? ` (${w.location})` : ''}</option>`
    ).join('');

    const userOpts = this._users.map((u) =>
      `<option value="${u.id}" ${String(t.assigned_to) === String(u.id) ? 'selected' : ''}>${u.full_name} (${u.role?.label || 'Staff'})</option>`
    ).join('');

    const startVal = t.start_date ? t.start_date.slice(0, 10) : (t.period_start || '');
    const endVal = t.end_date ? t.end_date.slice(0, 10) : (t.period_end || '');

    Modal.open(
      `✏️ Modifier la Tâche #${t.id}`,
      `
        <form id="editTaskForm" onsubmit="PageKanban.submitEdit(event, ${t.id})">
          <div class="form-row" style="display:flex;gap:12px;margin-bottom:12px">
            <div class="form-group" style="flex:1">
              <label style="font-weight:700">Priorité *</label>
              <select id="editPriority" class="form-control" required>
                <option value="Urgent" ${t.priority === 'Urgent' ? 'selected' : ''}>🚨 Urgent</option>
                <option value="Maintenance" ${t.priority === 'Maintenance' ? 'selected' : ''}>🔧 Maintenance</option>
                <option value="Rénovation complète" ${t.priority === 'Rénovation complète' ? 'selected' : ''}>🏗️ Rénovation complète</option>
                <option value="Normal" ${t.priority === 'Normal' ? 'selected' : ''}>ℹ️ Normal</option>
              </select>
            </div>
            <div class="form-group" style="flex:1">
              <label style="font-weight:700">Appartement / Zone / Chantier *</label>
              <input type="text" id="editLocationZone" class="form-control" required value="${(t.location_zone || '').replace(/"/g, '&quot;')}" />
            </div>
          </div>

          <div class="form-group mb-3">
            <label style="font-weight:700">Nature du problème / Intervention *</label>
            <input type="text" id="editNature" class="form-control" required value="${(t.nature_probleme || t.title || '').replace(/"/g, '&quot;')}" />
          </div>

          <div class="form-row" style="display:flex;gap:12px;margin-bottom:12px">
            <div class="form-group" style="flex:1">
              <label style="font-weight:700">Statut</label>
              <select id="editStatus" class="form-control">
                <option value="pending" ${t.status === 'pending' ? 'selected' : ''}>⏳ À faire</option>
                <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>⚡ En cours</option>
                <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>✅ FAIT / Terminé</option>
                <option value="not_done" ${t.status === 'not_done' ? 'selected' : ''}>❌ Non effectué</option>
                <option value="cancelled" ${t.status === 'cancelled' ? 'selected' : ''}>🚫 Annulé</option>
              </select>
            </div>
            <div class="form-group" style="flex:1">
              <label style="font-weight:700">Observation / État d'avancement</label>
              <input type="text" id="editObservation" class="form-control" value="${(t.observation || '').replace(/"/g, '&quot;')}" placeholder="Ex: Lui fixer une date, FAIT..." />
            </div>
          </div>

          <div class="form-row" style="display:flex;gap:12px;margin-bottom:12px">
            <div class="form-group" style="flex:1">
              <label style="font-weight:700">Immeuble lié</label>
              <select id="editPropertyId" class="form-control">
                <option value="">— Aucun immeuble spécifique —</option>
                ${propOpts}
              </select>
            </div>
            <div class="form-group" style="flex:1">
              <label style="font-weight:700">Chantier lié</label>
              <select id="editWorksiteId" class="form-control">
                <option value="">— Aucun chantier spécifique —</option>
                ${worksiteOpts}
              </select>
            </div>
          </div>

          <div class="form-row" style="display:flex;gap:12px;margin-bottom:14px">
            <div class="form-group" style="flex:1">
              <label style="font-weight:700">Intervenant assigné</label>
              <select id="editAssignedTo" class="form-control">
                <option value="">— Non assigné —</option>
                ${userOpts}
              </select>
            </div>
            <div class="form-group" style="flex:1">
              <label style="font-weight:700">Date début</label>
              <input type="date" id="editStartDate" class="form-control" value="${startVal}" />
            </div>
            <div class="form-group" style="flex:1">
              <label style="font-weight:700">Échéance fin</label>
              <input type="date" id="editEndDate" class="form-control" value="${endVal}" />
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">
            <button type="button" class="btn btn-danger" onclick="PageKanban.removeTask(${t.id})">🗑️ Supprimer</button>
            <div style="display:flex;gap:8px">
              <button type="button" class="btn btn-outline" onclick="Modal.close()">Annuler</button>
              <button type="submit" class="btn btn-primary">Mettre à jour</button>
            </div>
          </div>
        </form>
      `,
      null,
      'medium'
    );
  },

  async submitEdit(e, id) {
    e.preventDefault();
    const data = {
      priority: document.getElementById('editPriority')?.value || 'Normal',
      location_zone: document.getElementById('editLocationZone')?.value.trim(),
      nature_probleme: document.getElementById('editNature')?.value.trim(),
      title: document.getElementById('editNature')?.value.trim(),
      status: document.getElementById('editStatus')?.value || 'pending',
      observation: document.getElementById('editObservation')?.value.trim() || null,
      property_id: document.getElementById('editPropertyId')?.value || null,
      worksite_id: document.getElementById('editWorksiteId')?.value || null,
      assigned_to: document.getElementById('editAssignedTo')?.value || null,
      period_start: document.getElementById('editStartDate')?.value || null,
      period_end: document.getElementById('editEndDate')?.value || null,
    };

    if (data.period_start) data.start_date = new Date(`${data.period_start}T08:00:00`);
    if (data.period_end) data.end_date = new Date(`${data.period_end}T18:00:00`);

    try {
      await API.put(`/tasks/${id}`, data);
      Modal.close();
      Toast.success('Tâche mise à jour !');
      this.refreshData();
    } catch (err) {
      Toast.error(err.message || 'Erreur mise à jour');
    }
  },

  // Suppression simple
  async removeTask(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) return;
    try {
      await API.delete(`/tasks/${id}`);
      Modal.close();
      Toast.success('Tâche supprimée');
      this.refreshData();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  // Impression de la Fiche de Suivi
  printWorkPlan() {
    window.print();
  },

  // Injection de l'exemple client
  async seedSample() {
    if (!confirm('Voulez-vous charger l\'exemple officiel du Plan de Travail Urgent (40 interventions) ?')) return;
    try {
      Toast.info('Chargement des données d\'exemple en cours...');
      const res = await API.post('/tasks/seed-sample');
      Toast.success(res.message || 'Plan de travail chargé avec succès !');
      this.render();
    } catch (e) {
      Toast.error(e.message || 'Erreur lors de l\'injection');
    }
  },

  // Sélection multiple & Suppression groupée
  toggleSelectAll(checked) {
    document.querySelectorAll('.task-row-chk').forEach((chk) => { chk.checked = checked; });
    this.onRowSelectChange();
  },

  onRowSelectChange() {
    const checked = document.querySelectorAll('.task-row-chk:checked');
    const bar = document.getElementById('taskBulkBar');
    const cnt = document.getElementById('taskSelectedCount');
    const allChk = document.getElementById('taskSelectAll');
    const total = document.querySelectorAll('.task-row-chk').length;
    if (cnt) cnt.textContent = checked.length;
    if (bar) bar.style.display = checked.length > 0 ? 'flex' : 'none';
    if (allChk) allChk.checked = total > 0 && checked.length === total;
  },

  clearSelection() {
    document.querySelectorAll('.task-row-chk').forEach((chk) => { chk.checked = false; });
    const allChk = document.getElementById('taskSelectAll');
    if (allChk) allChk.checked = false;
    this.onRowSelectChange();
  },

  async bulkDelete() {
    const checked = Array.from(document.querySelectorAll('.task-row-chk:checked')).map((c) => Number(c.value));
    if (!checked.length) {
      Toast.warning('Aucune tâche sélectionnée');
      return;
    }
    if (!confirm(`Confirmez-vous la suppression de ces ${checked.length} tâche(s) ? Cette action est irréversible.`)) {
      return;
    }
    try {
      const res = await API.post('/tasks/bulk-delete', { ids: checked });
      Toast.success(res.message || `${checked.length} tâche(s) supprimée(s) avec succès`);
      this.clearSelection();
      this.render();
    } catch (e) {
      Toast.error(e.message || 'Erreur lors de la suppression');
    }
  },
};

window.PageKanban = PageKanban;
