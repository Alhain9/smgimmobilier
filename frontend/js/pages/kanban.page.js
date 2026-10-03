// ============ Page Kanban & Plan de Travail Urgent (Fiche de Suivi des Tâches) ============
const PageKanban = {
  tasks: [],
  _properties: [],
  _worksites: [],
  _users: [],
  _viewMode: 'table', // 'table' (Plan de travail officiel imprimable) | 'kanban' (Tableau visuel de cartes)

  // Filtres standards
  _filterCity: 'all',     // Ville / Groupe (ex: Yaoundé, Douala, ou global)
  _filterProperty: '',   // Immeuble spécifique unique
  _filterWorksite: '',   // Chantier spécifique unique
  _filterPriority: 'all',
  _filterStatus: 'all',
  _searchQuery: '',
  _periodStart: '2026-09-26',
  _periodEnd: '2026-10-30',

  // Multi-sélection ciblée & Organisation structurée
  _selectedPropertyIds: [], // IDs des immeubles ciblés (ex: 5 immeubles de Douala)
  _selectedWorksiteIds: [], // IDs des chantiers ciblés
  _groupBy: 'site',         // 'site' (Immeuble/Chantier) | 'assignee' (Technicien) | 'category' (Corps d'état) | 'priority' (Urgence)
  _targetSelectorOpen: true, // Affichage du volet de sélection ciblée
  _targetCityTab: 'all',    // Filtre ville interne au sélecteur : 'all', 'Douala', 'Yaoundé'

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

  // Méthodes de gestion de la sélection multi-immeubles et chantiers
  toggleTargetSelector() {
    this._targetSelectorOpen = !this._targetSelectorOpen;
    this.renderContent();
  },

  setGroupBy(mode) {
    this._groupBy = mode;
    this.renderContent();
  },

  setTargetCityTab(city) {
    this._targetCityTab = city;
    this.renderContent();
  },

  togglePropertySelect(id) {
    const numId = Number(id);
    const idx = this._selectedPropertyIds.indexOf(numId);
    if (idx >= 0) {
      this._selectedPropertyIds.splice(idx, 1);
    } else {
      this._selectedPropertyIds.push(numId);
    }
    this.renderContent();
  },

  toggleWorksiteSelect(id) {
    const numId = Number(id);
    const idx = this._selectedWorksiteIds.indexOf(numId);
    if (idx >= 0) {
      this._selectedWorksiteIds.splice(idx, 1);
    } else {
      this._selectedWorksiteIds.push(numId);
    }
    this.renderContent();
  },

  selectCityTargets(cityName) {
    const cLow = cityName.toLowerCase();
    const propsInCity = (this._properties || []).filter((p) => (p.city || '').toLowerCase().includes(cLow));
    const worksInCity = (this._worksites || []).filter((w) =>
      (w.location || '').toLowerCase().includes(cLow) || (w.title || '').toLowerCase().includes(cLow)
    );

    this._selectedPropertyIds = propsInCity.map((p) => p.id);
    this._selectedWorksiteIds = worksInCity.map((w) => w.id);
    this._targetCityTab = cityName;
    Toast.info(`${propsInCity.length} immeuble(s) et ${worksInCity.length} chantier(s) de ${cityName} sélectionnés`);
    this.renderContent();
  },

  selectAllProperties() {
    this._selectedPropertyIds = (this._properties || []).map((p) => p.id);
    Toast.info(`Tous les ${this._properties.length} immeubles ont été sélectionnés`);
    this.renderContent();
  },

  selectAllWorksites() {
    this._selectedWorksiteIds = (this._worksites || []).map((w) => w.id);
    Toast.info(`Tous les ${this._worksites.length} chantiers ont été sélectionnés`);
    this.renderContent();
  },

  clearTargetSelection() {
    this._selectedPropertyIds = [];
    this._selectedWorksiteIds = [];
    Toast.info('Sélection réinitialisée — Mode global rétabli');
    this.renderContent();
  },

  // Détection intelligente du corps d'état / métier
  detectTrade(t) {
    const text = `${t.title || ''} ${t.nature_probleme || ''} ${t.description || ''} ${t.location_zone || ''}`.toLowerCase();
    if (text.includes('plomb') || text.includes('siphon') || text.includes('douche') || text.includes('fuite') || text.includes('lavabo') || text.includes('bidet') || text.includes('eau') || text.includes('robinet') || text.includes('chasse') || text.includes('tuyau') || text.includes('canalisation')) {
      return { id: 'plomberie', name: 'Plomberie & Sanitaire', icon: '🚰', bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8' };
    }
    if (text.includes('electr') || text.includes('électr') || text.includes('prise') || text.includes('compteur') || text.includes('eclair') || text.includes('éclair') || text.includes('reglette') || text.includes('réglette') || text.includes('câble') || text.includes('disjoncteur')) {
      return { id: 'electricite', name: 'Électricité & Éclairage', icon: '⚡', bg: '#fefce8', border: '#eab308', text: '#854d0e' };
    }
    if (text.includes('clim') || text.includes('froid') || text.includes('ventilat')) {
      return { id: 'climatisation', name: 'Climatisation & Froid', icon: '❄️', bg: '#e0f2fe', border: '#0284c7', text: '#0369a1' };
    }
    if (text.includes('peint') || text.includes('ponçage') || text.includes('enduit')) {
      return { id: 'peinture', name: 'Peinture & Finitions', icon: '🎨', bg: '#fdf4ff', border: '#d946ef', text: '#86198f' };
    }
    if (text.includes('revet') || text.includes('revêt') || text.includes('plafond') || text.includes('sol') || text.includes('carrelage') || text.includes('pave') || text.includes('pavé')) {
      return { id: 'revetements', name: 'Revêtements, Sols & Plafonds', icon: '🧱', bg: '#fef3c7', border: '#f59e0b', text: '#92400e' };
    }
    if (text.includes('toit') || text.includes('etanch') || text.includes('étanch') || text.includes('humid') || text.includes('moisiss') || text.includes('infiltration')) {
      return { id: 'etancheite', name: 'Étanchéité, Toitures & Humidité', icon: '🏠', bg: '#f1f5f9', border: '#64748b', text: '#334155' };
    }
    if (text.includes('porte') || text.includes('serrur') || text.includes('fenetr') || text.includes('fenêtr') || text.includes('vitre') || text.includes('cadenas') || text.includes('menuis') || text.includes('rideau')) {
      return { id: 'menuiserie', name: 'Menuiserie, Portes & Serrures', icon: '🚪', bg: '#fef2f2', border: '#f87171', text: '#991b1b' };
    }
    if (text.includes('macon') || text.includes('maçon') || text.includes('mur') || text.includes('fissur') || text.includes('béton') || text.includes('dalle') || text.includes('ferraill')) {
      return { id: 'maconnerie', name: 'Maçonnerie, Carrelage & Gros Œuvre', icon: '🏗️', bg: '#fff7ed', border: '#f97316', text: '#9a3412' };
    }
    if (text.includes('nettoy') || text.includes('debarras') || text.includes('débarras') || text.includes('entretien')) {
      return { id: 'entretien', name: 'Entretien & Nettoyage', icon: '🧹', bg: '#f0fdf4', border: '#22c55e', text: '#15803d' };
    }
    return { id: 'divers', name: 'Interventions Générales & Diverses', icon: '🔧', bg: '#f8fafc', border: '#94a3b8', text: '#475569' };
  },

  // Calcul du libellé de période et de périmètre
  getPeriodTitle() {
    const s = this._periodStart ? Helpers.formatDate(this._periodStart) : '';
    const e = this._periodEnd ? Helpers.formatDate(this._periodEnd) : '';
    let pTxt = 'PÉRIODE GLOBALE';
    if (s && e) pTxt = `DU ${s.toUpperCase()} AU ${e.toUpperCase()}`;
    else if (s) pTxt = `À PARTIR DU ${s.toUpperCase()}`;

    const hasMulti = this._selectedPropertyIds.length > 0 || this._selectedWorksiteIds.length > 0;
    if (hasMulti) {
      const parts = [];
      if (this._selectedPropertyIds.length > 0) {
        const names = this._properties.filter((p) => this._selectedPropertyIds.includes(p.id)).map((p) => p.property_name);
        parts.push(`${names.length} IMMEUBLE(S) [${names.join(', ')}]`);
      }
      if (this._selectedWorksiteIds.length > 0) {
        const names = this._worksites.filter((w) => this._selectedWorksiteIds.includes(w.id)).map((w) => w.title);
        parts.push(`${names.length} CHANTIER(S) [${names.join(', ')}]`);
      }
      pTxt += ` — CIBLE : ${parts.join(' + ')}`;
    } else if (this._filterCity && this._filterCity !== 'all') {
      pTxt += ` — GROUPE / VILLE : ${this._filterCity.toUpperCase()}`;
    }
    return pTxt;
  },

  // Description textuelle du périmètre ciblé actif
  getActiveScopeDescription() {
    const propNames = this._properties.filter((p) => this._selectedPropertyIds.includes(p.id)).map((p) => p.property_name);
    const worksiteNames = this._worksites.filter((w) => this._selectedWorksiteIds.includes(w.id)).map((w) => w.title);

    const parts = [];
    if (propNames.length > 0) {
      parts.push(`<b>${propNames.length} Immeuble${propNames.length > 1 ? 's' : ''}</b> (${propNames.join(', ')})`);
    }
    if (worksiteNames.length > 0) {
      parts.push(`<b>${worksiteNames.length} Chantier${worksiteNames.length > 1 ? 's' : ''}</b> (${worksiteNames.join(', ')})`);
    }
    return parts.join(' et ');
  },

  // Filtrage des tâches (multi-critères : sélection ciblée immeubles/chantiers, ville, statut, priorité, recherche)
  getFilteredTasks() {
    const q = (this._searchQuery || '').toLowerCase().trim();
    const city = (this._filterCity || 'all').toLowerCase();
    const hasMulti = (this._selectedPropertyIds.length > 0 || this._selectedWorksiteIds.length > 0);

    return this.tasks.filter((t) => {
      // 1. Filtrage multi-sélection si actif
      if (hasMulti) {
        const matchProp = this._selectedPropertyIds.length > 0 && t.property_id && this._selectedPropertyIds.map(String).includes(String(t.property_id));
        const matchWork = this._selectedWorksiteIds.length > 0 && t.worksite_id && this._selectedWorksiteIds.map(String).includes(String(t.worksite_id));
        if (!matchProp && !matchWork) return false;
      } else {
        // Chantier spécifique simple
        if (this._filterWorksite) {
          if (String(t.worksite_id) !== String(this._filterWorksite)) return false;
        }
        // Immeuble spécifique simple
        if (this._filterProperty) {
          if (String(t.property_id) !== String(this._filterProperty)) return false;
        }
        // Ville / Groupe simple
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
      }

      // Priorité
      if (this._filterPriority !== 'all') {
        const p = (t.priority || 'Normal').toLowerCase();
        if (p !== this._filterPriority.toLowerCase()) return false;
      }
      // Statut
      if (this._filterStatus !== 'all') {
        if (t.status !== this._filterStatus) return false;
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
    const hasActiveTargets = this._selectedPropertyIds.length > 0 || this._selectedWorksiteIds.length > 0;
    const activeScopeText = this.getActiveScopeDescription();

    // Filtre des propriétés affichées dans le sélecteur selon l'onglet ville
    const targetTab = (this._targetCityTab || 'all').toLowerCase();
    const visibleProps = (this._properties || []).filter((p) => {
      if (targetTab === 'all') return true;
      return (p.city || '').toLowerCase().includes(targetTab);
    });
    const visibleWorksites = (this._worksites || []).filter((w) => {
      if (targetTab === 'all') return true;
      return (w.location || '').toLowerCase().includes(targetTab) || (w.title || '').toLowerCase().includes(targetTab);
    });

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
        .target-item-card {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 7px 10px;
          transition: all 0.15s ease-in-out;
          background: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .target-item-card:hover {
          border-color: #3b82f6;
          background: #f8fafc;
        }
        .target-item-card.selected {
          border-color: #2563eb;
          background: #eff6ff;
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
              Génération ciblée de fiches de travail par immeuble(s), chantier(s), intervenant et corps d'état
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
              <div id="pdfDropdownMenu" style="display:none;position:absolute;right:0;top:100%;margin-top:4px;background:#fff;box-shadow:0 6px 18px rgba(0,0,0,0.18);border-radius:6px;border:1px solid #cbd5e1;z-index:999;min-width:260px;overflow:hidden">
                <a href="javascript:void(0)" style="display:block;padding:9px 14px;font-size:12.5px;color:#1e293b;text-decoration:none;border-bottom:1px solid #f1f5f9;font-weight:700" onclick="PageKanban.downloadPdf('active')">
                  📄 PDF selon le périmètre sélectionné (${this._groupBy === 'site' ? 'par Immeuble/Chantier' : (this._groupBy === 'assignee' ? 'par Intervenant' : (this._groupBy === 'category' ? 'par Corps de métier' : 'par Urgence'))})
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
              <div style="font-size:12px;color:var(--text-muted)">Interventions ciblées</div>
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

        <!-- ============================================================== -->
        <!-- VOLET 1 : SÉLECTEUR MULTI-IMMEUBLES & CHANTIERS CIBLÉS         -->
        <!-- Permet de cocher N immeubles (ex: 5 à Douala) + chantiers      -->
        <!-- ============================================================== -->
        <div class="card" style="margin-bottom:16px;border:1.5px solid ${hasActiveTargets ? '#3b82f6' : '#cbd5e1'};box-shadow:0 2px 10px rgba(0,0,0,0.04)">
          <div style="padding:12px 16px;background:${hasActiveTargets ? '#eff6ff' : '#f8fafc'};display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;border-bottom:${this._targetSelectorOpen ? '1px solid #e2e8f0' : 'none'};cursor:pointer" onclick="PageKanban.toggleTargetSelector()">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:22px">🎯</span>
              <div>
                <strong style="font-size:14px;color:var(--primary)">Sélection Ciblée du Plan de Travail (Immeubles & Chantiers)</strong>
                <div style="font-size:12px;color:var(--text-muted)">
                  Sélectionnez un ou plusieurs immeubles (ex: 5 immeubles de Douala) et/ou des chantiers pour générer un plan exclusivement dédié
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px" onclick="event.stopPropagation()">
              ${hasActiveTargets ? `
                <span class="badge" style="background:#2563eb;color:#fff;font-size:12px;padding:5px 10px;font-weight:700">
                  🎯 ${this._selectedPropertyIds.length} Immeuble(s) + ${this._selectedWorksiteIds.length} Chantier(s) ciblés
                </span>
                <button class="btn btn-xs btn-outline-danger" onclick="PageKanban.clearTargetSelection()">Tout effacer</button>
              ` : `
                <span class="badge" style="background:#64748b;color:#fff;font-size:12px;padding:4px 8px">
                  🌐 Mode Global (Tous les sites)
                </span>
              `}
              <button class="btn btn-xs btn-outline" onclick="PageKanban.toggleTargetSelector()">
                ${this._targetSelectorOpen ? '▲ Masquer' : '▼ Déplier & Choisir'}
              </button>
            </div>
          </div>

          ${this._targetSelectorOpen ? `
            <div style="padding:14px 16px">
              <!-- Raccourcis de sélection rapide (Tout Douala, Tout Yaoundé, etc.) -->
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #f1f5f9">
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                  <span style="font-size:12px;font-weight:700;color:var(--text-muted)">⚡ Raccourcis rapides :</span>
                  <button class="btn btn-xs btn-outline-primary" style="font-weight:700" onclick="PageKanban.selectCityTargets('Douala')">
                    🏙️ Sélectionner tout Douala
                  </button>
                  <button class="btn btn-xs btn-outline-primary" style="font-weight:700" onclick="PageKanban.selectCityTargets('Yaoundé')">
                    🏛️ Sélectionner tout Yaoundé
                  </button>
                  <button class="btn btn-xs btn-outline" onclick="PageKanban.selectAllProperties()">
                    🏢 Tous les immeubles
                  </button>
                  <button class="btn btn-xs btn-outline" onclick="PageKanban.selectAllWorksites()">
                    🚧 Tous les chantiers
                  </button>
                </div>
                <div style="display:flex;gap:4px;align-items:center">
                  <span style="font-size:11.5px;color:var(--text-muted)">Filtrer liste :</span>
                  <button class="btn btn-xs ${this._targetCityTab === 'all' ? 'btn-primary' : 'btn-outline'}" onclick="PageKanban.setTargetCityTab('all')">Tous</button>
                  <button class="btn btn-xs ${this._targetCityTab === 'Douala' ? 'btn-primary' : 'btn-outline'}" onclick="PageKanban.setTargetCityTab('Douala')">Douala</button>
                  <button class="btn btn-xs ${this._targetCityTab === 'Yaoundé' ? 'btn-primary' : 'btn-outline'}" onclick="PageKanban.setTargetCityTab('Yaoundé')">Yaoundé</button>
                </div>
              </div>

              <!-- Grille à deux colonnes : Immeubles vs Chantiers -->
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">
                <!-- Colonne 1 : Immeubles -->
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <strong style="font-size:13px;color:var(--primary)">🏢 Immeubles (${visibleProps.length})</strong>
                    <span style="font-size:11.5px;color:var(--text-muted)">Cochez les immeubles à inclure</span>
                  </div>
                  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px;max-height:220px;overflow-y:auto;padding-right:4px">
                    ${visibleProps.map((p) => {
                      const isChecked = this._selectedPropertyIds.includes(p.id);
                      const propTaskCount = this.tasks.filter((t) => String(t.property_id) === String(p.id)).length;
                      return `
                        <div class="target-item-card ${isChecked ? 'selected' : ''}" onclick="PageKanban.togglePropertySelect(${p.id})">
                          <input type="checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); PageKanban.togglePropertySelect(${p.id})" />
                          <div style="flex:1;min-width:0">
                            <div style="font-weight:700;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.property_name}</div>
                            <div style="font-size:11px;color:var(--text-muted)">${p.city || 'Ville non renseignée'} ${p.address ? '• ' + p.address : ''}</div>
                          </div>
                          <span class="badge ${propTaskCount > 0 ? 'badge-primary' : 'badge-secondary'}" style="font-size:10px" title="${propTaskCount} tâche(s)">
                            ${propTaskCount} tâche${propTaskCount > 1 ? 's' : ''}
                          </span>
                        </div>
                      `;
                    }).join('') || '<div class="text-muted" style="font-size:12px;padding:12px">Aucun immeuble pour ce filtre.</div>'}
                  </div>
                </div>

                <!-- Colonne 2 : Chantiers & Gros Œuvre -->
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <strong style="font-size:13px;color:#6b21a8">🚧 Chantiers & Travaux extérieurs (${visibleWorksites.length})</strong>
                    <span style="font-size:11.5px;color:var(--text-muted)">Cochez les chantiers à inclure</span>
                  </div>
                  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px;max-height:220px;overflow-y:auto;padding-right:4px">
                    ${visibleWorksites.map((w) => {
                      const isChecked = this._selectedWorksiteIds.includes(w.id);
                      const wsTaskCount = this.tasks.filter((t) => String(t.worksite_id) === String(w.id)).length;
                      return `
                        <div class="target-item-card ${isChecked ? 'selected' : ''}" onclick="PageKanban.toggleWorksiteSelect(${w.id})">
                          <input type="checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); PageKanban.toggleWorksiteSelect(${w.id})" />
                          <div style="flex:1;min-width:0">
                            <div style="font-weight:700;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${w.title}</div>
                            <div style="font-size:11px;color:var(--text-muted)">${w.location || 'Localisation générale'}</div>
                          </div>
                          <span class="badge ${wsTaskCount > 0 ? 'badge-warning' : 'badge-secondary'}" style="font-size:10px" title="${wsTaskCount} tâche(s)">
                            ${wsTaskCount} tâche${wsTaskCount > 1 ? 's' : ''}
                          </span>
                        </div>
                      `;
                    }).join('') || '<div class="text-muted" style="font-size:12px;padding:12px">Aucun chantier pour ce filtre.</div>'}
                  </div>
                </div>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Alerte bandeau lorsque le ciblage est actif -->
        ${hasActiveTargets ? `
          <div style="background:#eff6ff;border:1.5px solid #60a5fa;border-radius:8px;padding:10px 16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:22px">🎯</span>
              <div>
                <div style="font-weight:800;font-size:13px;color:#1e40af">
                  PÉRIMÈTRE CIBLÉ ACTIF : ${activeScopeText}
                </div>
                <div style="font-size:11.5px;color:#3b82f6">
                  Le plan de travail, les indicateurs et les exports PDF afficheront <b>exclusivement</b> les travaux de ces sites sélectionnés.
                </div>
              </div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm btn-outline-primary" style="font-size:12px;font-weight:700" onclick="PageKanban.downloadPdf('active')">
                📥 Télécharger ce Plan Ciblé (PDF)
              </button>
              <button class="btn btn-sm btn-outline-danger" style="font-size:12px" onclick="PageKanban.clearTargetSelection()">
                ✖ Réinitialiser (Tout afficher)
              </button>
            </div>
          </div>
        ` : ''}

        <!-- ============================================================== -->
        <!-- VOLET 2 : BARRE D'ORGANISATION EN GROUPES & FILTRES COMPLÉMENTAIRES -->
        <!-- ============================================================== -->
        <div class="card" style="margin-bottom:16px;padding:14px">
          <!-- Sélecteur de regroupement intelligent pour éviter tout mélange -->
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:12px">
            <span style="font-weight:800;font-size:13px;color:var(--primary);display:flex;align-items:center;gap:6px">
              <span>🗂️</span> Regrouper les tâches par :
            </span>
            <div style="display:inline-flex;gap:4px;flex-wrap:wrap">
              <button class="btn btn-sm ${this._groupBy === 'site' ? 'btn-primary' : 'btn-outline'}" onclick="PageKanban.setGroupBy('site')">
                🏢 Immeuble / Chantier
              </button>
              <button class="btn btn-sm ${this._groupBy === 'assignee' ? 'btn-primary' : 'btn-outline'}" onclick="PageKanban.setGroupBy('assignee')">
                👷 Technicien / Intervenant
              </button>
              <button class="btn btn-sm ${this._groupBy === 'category' ? 'btn-primary' : 'btn-outline'}" onclick="PageKanban.setGroupBy('category')">
                🔨 Corps d'État / Métier
              </button>
              <button class="btn btn-sm ${this._groupBy === 'priority' ? 'btn-primary' : 'btn-outline'}" onclick="PageKanban.setGroupBy('priority')">
                🚨 Niveau d'Urgence
              </button>
            </div>
            <div style="margin-left:auto;font-size:11.5px;color:var(--text-muted)">
              ${this._groupBy === 'site' ? '✓ Blocs distincts par immeuble et chantier' : ''}
              ${this._groupBy === 'assignee' ? '✓ Chaque ouvrier/technicien a son bloc dédié' : ''}
              ${this._groupBy === 'category' ? '✓ Séparé par métier (plomberie, électricité, clim...)' : ''}
              ${this._groupBy === 'priority' ? '✓ Trié par gravité (urgent, maintenance, normal)' : ''}
            </div>
          </div>

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
              ${(total > 0 || hasActiveTargets || this._filterCity !== 'all' || this._filterProperty || this._filterWorksite) ? `
                <button class="btn btn-sm btn-outline" style="font-size:12px" title="Réinitialiser tous les filtres" onclick="PageKanban.resetFilters()">🔄 Réinitialiser</button>
              ` : ''}
            </div>
          </div>

          <!-- Filtres secondaires de Statut, Priorité et Dates -->
          <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding-top:10px;border-top:1px solid var(--border);font-size:12.5px">
            ${!hasActiveTargets ? `
              <!-- Ville / Groupe si pas de multi-sélection -->
              <div style="display:flex;align-items:center;gap:6px">
                <span style="font-weight:700;color:var(--primary)">🌍 Ville :</span>
                <select class="form-control" style="width:140px;font-size:12px;font-weight:600" onchange="PageKanban.filterCity(this.value)">
                  <option value="all" ${this._filterCity === 'all' ? 'selected' : ''}>🌍 Tous (Global)</option>
                  ${cityOptions}
                </select>
              </div>
            ` : ''}

            <!-- Filtre Priorité -->
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

            <!-- Filtre Statut -->
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

            <!-- Filtre Période Dates -->
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
    this._selectedPropertyIds = [];
    this._selectedWorksiteIds = [];
    this.renderContent();
  },

  // ============================================================
  // VUE 1 : PLAN DE TRAVAIL OFFICIEL (ORGANISÉ PAR GROUPES DEMANDÉS)
  // ============================================================
  renderTableView(tasks, periodLabel) {
    const groupBy = this._groupBy || 'site';
    let groups = [];

    if (groupBy === 'site') {
      // 1. Regroupement par Immeuble & Chantier
      const groupMap = new Map();
      tasks.forEach((t) => {
        let key = 'general';
        let title = '🏢 Interventions Générales / Hors site spécifique';
        let icon = '🏢';
        let bg = '#f8fafc';
        let border = '#94a3b8';
        let text = '#334155';

        if (t.worksite) {
          key = `ws_${t.worksite.id}`;
          title = `CHANTIER : ${(t.worksite.title || 'Chantier').toUpperCase()} (${t.worksite.location || 'Douala/Yaoundé'})`;
          icon = '🚧';
          bg = '#f3e8ff';
          border = '#a855f7';
          text = '#6b21a8';
        } else if (t.property) {
          key = `prop_${t.property.id}`;
          title = `IMMEUBLE : ${t.property.property_name.toUpperCase()} (${t.property.city || ''}${t.property.address ? ' - ' + t.property.address : ''})`;
          icon = '🏢';
          bg = '#eff6ff';
          border = '#3b82f6';
          text = '#1d4ed8';
        }

        if (!groupMap.has(key)) {
          groupMap.set(key, { id: key, title, icon, bg, border, text, tasks: [] });
        }
        groupMap.get(key).tasks.push(t);
      });
      groups = Array.from(groupMap.values());

    } else if (groupBy === 'assignee') {
      // 2. Regroupement par Technicien / Intervenant
      const groupMap = new Map();
      tasks.forEach((t) => {
        let key = 'unassigned';
        let title = 'TÂCHES NON ASSIGNÉES (À ATTRIBUER)';
        let icon = '👤';
        let bg = '#fee2e2';
        let border = '#ef4444';
        let text = '#991b1b';

        if (t.assignee) {
          key = `user_${t.assignee.id}`;
          title = `TECHNICIEN / INTERVENANT : ${(t.assignee.full_name || 'Agent').toUpperCase()} ${t.assignee.phone ? '(' + t.assignee.phone + ')' : ''}`;
          icon = '👷';
          bg = '#eff6ff';
          border = '#2563eb';
          text = '#1e40af';
        }

        if (!groupMap.has(key)) {
          groupMap.set(key, { id: key, title, icon, bg, border, text, tasks: [] });
        }
        groupMap.get(key).tasks.push(t);
      });
      groups = Array.from(groupMap.values());

    } else if (groupBy === 'category') {
      // 3. Regroupement par Corps d'État / Métier
      const groupMap = new Map();
      tasks.forEach((t) => {
        const tr = this.detectTrade(t);
        if (!groupMap.has(tr.id)) {
          groupMap.set(tr.id, {
            id: tr.id,
            title: `CORPS DE MÉTIER : ${tr.name.toUpperCase()}`,
            icon: tr.icon,
            bg: tr.bg,
            border: tr.border,
            text: tr.text,
            tasks: [],
          });
        }
        groupMap.get(tr.id).tasks.push(t);
      });
      groups = Array.from(groupMap.values());

    } else {
      // 4. Regroupement par Niveau d'Urgence / Priorité
      const pDefs = [
        { id: 'urgent', title: 'TÂCHES URGENTES & CRITIQUES', icon: '🚨', bg: '#fee2e2', border: '#ef4444', text: '#991b1b', matcher: (t) => (t.priority || '').toLowerCase() === 'urgent' },
        { id: 'renov', title: 'RÉNOVATIONS COMPLÈTES', icon: '🏗️', bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8', matcher: (t) => (t.priority || '').toLowerCase().includes('rénovation') || (t.priority || '').toLowerCase().includes('renovation') },
        { id: 'maint', title: 'OPÉRATIONS DE MAINTENANCE COURANTE', icon: '🔧', bg: '#fef3c7', border: '#f59e0b', text: '#92400e', matcher: (t) => (t.priority || '').toLowerCase().includes('maintenance') },
        { id: 'normal', title: 'AUTRES INTERVENTIONS & TÂCHES DIVERSES', icon: 'ℹ️', bg: '#f1f5f9', border: '#94a3b8', text: '#334155', matcher: (t) => {
          const p = (t.priority || '').toLowerCase();
          return p !== 'urgent' && !p.includes('maintenance') && !p.includes('rénovation') && !p.includes('renovation');
        }},
      ];
      groups = pDefs.map((d) => ({
        id: d.id,
        title: d.title,
        icon: d.icon,
        bg: d.bg,
        border: d.border,
        text: d.text,
        tasks: tasks.filter(d.matcher),
      }));
    }

    let globalIdx = 0;
    let tableBodyHtml = '';

    groups.forEach((grp) => {
      const grpTasks = grp.tasks || [];
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
        const isUrgent = priority.toLowerCase() === 'urgent';
        const isMaint = priority.toLowerCase().includes('maintenance');
        const isRenov = priority.toLowerCase().includes('rénovation') || priority.toLowerCase().includes('renovation');

        let pBadge = `<span class="badge" style="background:#f1f5f9;color:#334155;font-weight:700;font-size:11px">Normal</span>`;
        if (isUrgent) pBadge = `<span class="badge badge-danger" style="background:#fee2e2;color:#991b1b;border:1px solid #f87171;font-weight:800;font-size:11px">🚨 Urgent</span>`;
        else if (isMaint) pBadge = `<span class="badge badge-warning" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;font-weight:700;font-size:11px">🔧 Maintenance</span>`;
        else if (isRenov) pBadge = `<span class="badge" style="background:#f3e8ff;color:#6b21a8;border:1px solid #d8b4fe;font-weight:700;font-size:11px">🏗️ Rénovation</span>`;

        let zone = t.location_zone || '';
        if (t.worksite) {
          zone = `🚧 ${t.worksite.title}${zone && !zone.includes(t.worksite.title) ? ' • ' + zone : ''}`;
        } else if (t.property) {
          const aptNum = t.apartment?.apartment_number ? `Logt ${t.apartment.apartment_number}` : '';
          zone = `🏢 ${t.property.property_name}${aptNum ? ' — ' + aptNum : (zone && !zone.includes(t.property.property_name) ? ' — ' + zone : '')}`;
        } else if (!zone) {
          zone = '—';
        }

        const nature = t.nature_probleme || t.title || '—';
        const observation = t.observation || t.completion_note || (t.status === 'completed' ? 'FAIT' : '—');
        const isDone = observation.toUpperCase().includes('FAIT') || t.status === 'completed';

        let statusBadge = `<span class="badge badge-secondary" style="font-size:11px">⏳ À faire</span>`;
        if (t.status === 'in_progress') statusBadge = `<span class="badge badge-warning" style="background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;font-size:11px">⚡ En cours</span>`;
        else if (t.status === 'completed') statusBadge = `<span class="badge badge-success" style="background:#dcfce7;color:#166534;border:1px solid #86efac;font-size:11px">✅ FAIT</span>`;
        else if (t.status === 'not_done') statusBadge = `<span class="badge badge-danger" style="font-size:11px">❌ Non fait</span>`;

        const assigneeHtml = t.assignee
          ? `<span style="font-weight:700;color:#1e293b;font-size:12px">👷 ${t.assignee.full_name}</span>`
          : `<span class="badge" style="background:#fee2e2;color:#991b1b;font-size:10.5px">⚠️ Non assigné</span>`;

        tableBodyHtml += `
          <tr style="${isUrgent ? 'background:#fffafa;' : ''}">
            <td class="no-print" style="text-align:center">
              <input type="checkbox" class="task-row-chk" value="${t.id}" onchange="PageKanban.onRowSelectChange()" />
            </td>
            <td style="font-size:12px;color:var(--text-muted);text-align:center;font-weight:600">${globalIdx}</td>
            <td><b>${pBadge}</b></td>
            <td style="font-weight:700;font-size:12.5px;color:var(--primary)">${zone}</td>
            <td style="font-size:13px;color:var(--text);max-width:300px">${nature}</td>
            <td style="font-size:12px">${assigneeHtml}</td>
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
                Plan de travail officiel, maintenances régulières et suivi des chantiers
              </div>
            </div>
            <div style="text-align:right;font-size:12px;color:var(--text-muted)">
              <div>Édité le : <b>${Helpers.formatDate(new Date())}</b></div>
              <div>Interventions : <b>${tasks.length} tâche(s) ciblée(s)</b></div>
              <div>Organisation : <b>${groupBy === 'site' ? 'Par Immeuble / Chantier' : (groupBy === 'assignee' ? 'Par Intervenant' : (groupBy === 'category' ? 'Par Corps d\'état' : 'Par Urgence'))}</b></div>
            </div>
          </div>

          <!-- Titre Bandeau -->
          <div style="background:#1a3a5c;color:#fff;text-align:center;padding:8px 12px;border-radius:6px;margin-top:10px">
            <h3 style="margin:0;font-size:14.5px;font-weight:800;letter-spacing:1px;color:#fff">
              PLAN DE TRAVAIL OFFICIEL – ${periodLabel}
            </h3>
          </div>
        </div>

        <!-- Tableau principal avec colonne Intervenant -->
        <div class="table-wrap">
          <table class="table" style="font-size:13px;margin:0">
            <thead>
              <tr style="background:#f8fafc">
                <th class="no-print" style="width:36px;text-align:center">
                  <input type="checkbox" id="taskSelectAll" title="Tout sélectionner" onchange="PageKanban.toggleSelectAll(this.checked)" />
                </th>
                <th style="width:36px;text-align:center">N°</th>
                <th style="width:125px">Priorité</th>
                <th style="width:160px">Immeuble / Chantier / Zone</th>
                <th>Nature du problème / Travaux à faire</th>
                <th style="width:140px">👷 Intervenant</th>
                <th style="width:220px">Observation / État d’avancement</th>
                <th style="width:110px;text-align:center">Statut</th>
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

        let zone = t.location_zone || '';
        if (t.worksite) {
          zone = `🚧 ${t.worksite.title}`;
        } else if (t.property) {
          zone = `🏢 ${t.property.property_name}${t.apartment?.apartment_number ? ' #' + t.apartment.apartment_number : ''}`;
        } else if (!zone) {
          zone = '—';
        }

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
              <span style="font-weight:800;font-size:12.5px;color:var(--primary)">${zone}</span>
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
              <span>👤 ${t.assignee?.full_name ? '<b>' + t.assignee.full_name + '</b>' : 'Non assigné'}</span>
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

  // Téléchargement du Plan de Travail en PDF avec prise en compte intégrale de la multi-sélection et du regroupement
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
      Toast.info('Génération du PDF officiel en cours...');
      const token = Auth.getToken();
      const params = new URLSearchParams({
        period_start: pStart,
        period_end: pEnd,
        period_label: title,
        group_by: this._groupBy || 'site',
        token: token || '',
      });

      if (this._filterPriority && this._filterPriority !== 'all') params.append('priority', this._filterPriority);
      if (this._filterStatus && this._filterStatus !== 'all') params.append('status', this._filterStatus);

      // Multi-sélection ciblée
      const hasMulti = this._selectedPropertyIds.length > 0 || this._selectedWorksiteIds.length > 0;
      if (hasMulti) {
        if (this._selectedPropertyIds.length > 0) {
          params.append('property_ids', this._selectedPropertyIds.join(','));
          const pNames = this._properties.filter((p) => this._selectedPropertyIds.includes(p.id)).map((p) => p.property_name);
          params.append('property_names', pNames.join(', '));
        }
        if (this._selectedWorksiteIds.length > 0) {
          params.append('worksite_ids', this._selectedWorksiteIds.join(','));
          const wNames = this._worksites.filter((w) => this._selectedWorksiteIds.includes(w.id)).map((w) => w.title);
          params.append('worksite_names', wNames.join(', '));
        }
        // Libellé de périmètre explicite
        params.append('scope_label', this.getActiveScopeDescription().replace(/<[^>]+>/g, ''));
      } else {
        if (this._filterCity && this._filterCity !== 'all') params.append('city', this._filterCity);
        if (this._filterProperty) params.append('property_id', this._filterProperty);
        if (this._filterWorksite) params.append('worksite_id', this._filterWorksite);
      }

      const url = `${CONFIG.API_URL}/tasks/work-plan-pdf?${params.toString()}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erreur lors du téléchargement du PDF');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const cleanScope = hasMulti
        ? `_CIBLE_${this._selectedPropertyIds.length}Immeubles_${this._selectedWorksiteIds.length}Chantiers`
        : (this._filterCity && this._filterCity !== 'all' ? `_${this._filterCity.replace(/\s+/g, '_')}` : '');
      a.download = `Plan_de_travail${cleanScope}_${pStart || 'GLOBAL'}_${pEnd || 'GLOBAL'}.pdf`;
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
