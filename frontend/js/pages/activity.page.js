// ============ Page Activité du jour (productivité : tâches + agenda + plan de travail groupé) ============
const PageActivity = {
  _date: null,
  _team: null,
  _tasks: [],
  _taskPeriod: 'today', // 'today' | 'week' | 'month' | 'all'
  _searchQuery: '',

  register() {
    Router.register('activity', () => this.render());
    this._bindSocket();
  },

  _bindSocket() {
    if (typeof SocketClient !== 'undefined' && SocketClient.socket) {
      SocketClient.socket.off('dashboard:refresh', this._onSocketRefresh);
      SocketClient.socket.off('task:updated', this._onSocketRefresh);
      this._onSocketRefresh = () => {
        if (window.location.hash === '#activity') {
          this.loadMine();
          this.loadTasks();
          if (this.canTeam()) this.loadTeam();
        }
      };
      SocketClient.socket.on('dashboard:refresh', this._onSocketRefresh);
      SocketClient.socket.on('task:updated', this._onSocketRefresh);
    }
  },

  canTeam() {
    const u = Auth.getUser();
    return Auth.hasRole('manager', 'super_admin', 'dir_admin', 'dir_technique', 'gestionnaire') || !!(u && u.can_view_all_calendars);
  },

  async render() {
    Layout.setTitle('Activité du jour & Plan de Travail');
    if (!this._date) this._date = new Date().toISOString().slice(0, 10);
    const team = this.canTeam();

    Layout.content(`
      <div class="page-head no-print" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:18px">
        <div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:24px">📋</span>
            <h2 style="margin:0;font-size:22px">Activité du Jour & Plan de Travail</h2>
          </div>
          <div class="subtitle" style="margin-top:4px">
            Suivi opérationnel en temps réel : tâches prioritaires, interventions groupées et agenda
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input type="date" class="form-control" id="actDate" value="${this._date}" style="max-width:160px;font-size:12.5px" onchange="PageActivity.changeDate(this.value)"/>
          <button class="btn btn-outline" style="border-color:#1a3a5c;color:#1a3a5c;font-weight:600" onclick="PageActivity.printWorkPlan()">
            🖨️ Imprimer la Fiche
          </button>
          <div style="position:relative;display:inline-block">
            <button class="btn btn-outline-success" onclick="PageActivity.togglePdfMenu(event)">
              📥 Exporter PDF ▾
            </button>
            <div id="actPdfMenu" style="display:none;position:absolute;right:0;top:100%;margin-top:4px;background:#fff;box-shadow:0 6px 18px rgba(0,0,0,0.18);border-radius:6px;border:1px solid #cbd5e1;z-index:999;min-width:210px;overflow:hidden">
              <a href="javascript:void(0)" style="display:block;padding:9px 14px;font-size:12.5px;color:#1e293b;text-decoration:none;border-bottom:1px solid #f1f5f9;font-weight:600" onclick="PageActivity.downloadPdf('week')">
                📅 PDF Semaine en cours
              </a>
              <a href="javascript:void(0)" style="display:block;padding:9px 14px;font-size:12.5px;color:#1e293b;text-decoration:none;border-bottom:1px solid #f1f5f9;font-weight:600" onclick="PageActivity.downloadPdf('month')">
                📅 PDF Mois en cours
              </a>
              <a href="javascript:void(0)" style="display:block;padding:9px 14px;font-size:12.5px;color:#1e293b;text-decoration:none;font-weight:600" onclick="PageActivity.downloadPdf('today')">
                📅 PDF Journée sélectionnée
              </a>
            </div>
          </div>
          <button class="btn btn-primary" onclick="PageActivity.openCreateModal()">
            ➕ Ajouter une Tâche
          </button>
        </div>
      </div>

      <!-- Synthèse Productivité & Agenda Personnel -->
      <div id="myDay"><div class="spinner"></div></div>

      <!-- Section Plan de Travail & Suivi des Tâches Groupé (Temps Réel) -->
      <div id="workPlanSection" style="margin-top:24px">
        <div class="card" style="padding:16px;border-radius:10px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:1px solid var(--border);padding-bottom:12px">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:20px">🔧</span>
              <div>
                <h3 style="margin:0;font-size:17px;font-weight:800;color:var(--primary,#1a3a5c)">
                  Plan de Travail & Fiche de Suivi des Interventions
                </h3>
                <div style="font-size:12px;color:var(--text-muted)">
                  Regroupé par typologie (Urgences, Rénovations, Maintenances) — synchronisé en temps réel
                </div>
              </div>
            </div>

            <!-- Filtres Période & Recherche -->
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <div style="display:flex;gap:4px">
                <button class="btn btn-xs ${this._taskPeriod === 'today' ? 'btn-primary' : 'btn-outline'}" onclick="PageActivity.changeTaskPeriod('today')">Aujourd'hui</button>
                <button class="btn btn-xs ${this._taskPeriod === 'week' ? 'btn-primary' : 'btn-outline'}" onclick="PageActivity.changeTaskPeriod('week')">Cette Semaine</button>
                <button class="btn btn-xs ${this._taskPeriod === 'month' ? 'btn-primary' : 'btn-outline'}" onclick="PageActivity.changeTaskPeriod('month')">Ce Mois</button>
                <button class="btn btn-xs ${this._taskPeriod === 'all' ? 'btn-primary' : 'btn-outline'}" onclick="PageActivity.changeTaskPeriod('all')">Toutes les Tâches</button>
              </div>
              <input type="text" class="form-control" style="width:200px;font-size:12px" placeholder="🔎 Filtrer logement, problème..." value="${this._searchQuery}" oninput="PageActivity.onSearch(this.value)"/>
            </div>
          </div>

          <div id="tasksTableWrap" style="margin-top:14px">
            <div class="spinner"></div>
          </div>
        </div>
      </div>

      <!-- Activité de l'Équipe (Encadrement) -->
      ${team ? `<h3 style="margin:26px 0 12px">👥 Activité de l'équipe</h3><div id="teamDay"><div class="spinner"></div></div>` : ''}
    `);

    this.loadMine();
    this.loadTasks();
    if (team) this.loadTeam();
  },

  changeDate(d) {
    this._date = d;
    this.render();
  },

  changeTaskPeriod(p) {
    this._taskPeriod = p;
    this.renderTasksTable();
  },

  onSearch(q) {
    this._searchQuery = q;
    this.renderTasksTable();
  },

  async loadMine() {
    try {
      const { data } = await API.get(`/dashboard/day?scope=me&date=${this._date}`);
      const el = document.getElementById('myDay');
      if (el) el.innerHTML = this.myDayHtml(data);
    } catch (e) {
      const el = document.getElementById('myDay');
      if (el) el.innerHTML = `<div class="text-muted">${e.message}</div>`;
    }
  },

  async loadTasks() {
    try {
      const res = await API.get('/tasks');
      this._tasks = res.data || [];
      this.renderTasksTable();
    } catch (e) {
      const el = document.getElementById('tasksTableWrap');
      if (el) el.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
    }
  },

  // Filtrage selon période sélectionnée
  getFilteredTasks() {
    const q = (this._searchQuery || '').toLowerCase().trim();
    const curr = new Date(this._date || new Date());
    const dateStr = this._date || curr.toISOString().slice(0, 10);

    // Calcul semaine
    const day = curr.getDay();
    const diffToMon = curr.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(curr.getTime());
    mon.setDate(diffToMon);
    const sun = new Date(mon.getTime());
    sun.setDate(mon.getDate() + 6);
    const weekStart = mon.toISOString().slice(0, 10);
    const weekEnd = sun.toISOString().slice(0, 10);

    // Calcul mois
    const monthStart = new Date(curr.getFullYear(), curr.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(curr.getFullYear(), curr.getMonth() + 1, 0).toISOString().slice(0, 10);

    return this._tasks.filter((t) => {
      // Période
      if (this._taskPeriod === 'today') {
        const isUrgent = (t.priority || '').toLowerCase() === 'urgent' && t.status !== 'completed';
        const isTodayStart = t.start_date && String(t.start_date).slice(0, 10) === dateStr;
        const isInPeriod = t.period_start && t.period_end && dateStr >= t.period_start && dateStr <= t.period_end;
        if (!isUrgent && !isTodayStart && !isInPeriod && t.status === 'completed') {
          const doneDay = t.done_at ? String(t.done_at).slice(0, 10) : '';
          if (doneDay !== dateStr) return false;
        }
      } else if (this._taskPeriod === 'week') {
        const s = t.start_date ? String(t.start_date).slice(0, 10) : (t.period_start || '');
        if (s && (s < weekStart || s > weekEnd) && (t.priority || '').toLowerCase() !== 'urgent') return false;
      } else if (this._taskPeriod === 'month') {
        const s = t.start_date ? String(t.start_date).slice(0, 10) : (t.period_start || '');
        if (s && (s < monthStart || s > monthEnd) && (t.priority || '').toLowerCase() !== 'urgent') return false;
      }

      // Recherche
      if (q) {
        const zone = (t.location_zone || '').toLowerCase();
        const nature = (t.nature_probleme || t.title || '').toLowerCase();
        const obs = (t.observation || t.completion_note || '').toLowerCase();
        const assignee = (t.assignee?.full_name || '').toLowerCase();
        if (!zone.includes(q) && !nature.includes(q) && !obs.includes(q) && !assignee.includes(q)) {
          return false;
        }
      }
      return true;
    });
  },

  renderTasksTable() {
    const el = document.getElementById('tasksTableWrap');
    if (!el) return;

    const filtered = this.getFilteredTasks();

    // Définition des 4 Groupes
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
    let bodyRows = '';

    groups.forEach((grp) => {
      const grpTasks = filtered.filter(grp.matcher);
      if (!grpTasks.length) return;

      const grpDone = grpTasks.filter((t) => t.status === 'completed' || (t.observation || '').toUpperCase().includes('FAIT')).length;
      const grpDoing = grpTasks.filter((t) => t.status === 'in_progress').length;
      const grpTodo = grpTasks.filter((t) => t.status === 'pending' || !t.status).length;

      bodyRows += `
        <tr class="group-header-row" style="background:${grp.bg};border-left:5px solid ${grp.border}">
          <td colspan="8" style="padding:10px 14px;font-weight:800;color:${grp.text};font-size:13px">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
              <span>${grp.icon} ${grp.title} — <span style="font-weight:600;font-size:12px">(${grpTasks.length} intervention${grpTasks.length > 1 ? 's' : ''})</span></span>
              <span style="font-size:12px;font-weight:700;display:flex;gap:8px;align-items:center">
                <span class="badge" style="background:#dcfce7;color:#166534">${grpDone} FAIT</span>
                <span class="badge" style="background:#e0f2fe;color:#0369a1">${grpDoing} En cours</span>
                <span class="badge" style="background:#f1f5f9;color:#475569">${grpTodo} À faire</span>
              </span>
            </div>
          </td>
        </tr>
      `;

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

        bodyRows += `
          <tr style="${isUrgent ? 'background:#fffafa;' : ''}">
            <td style="font-size:12px;color:var(--text-muted);text-align:center;font-weight:600">${globalIdx}</td>
            <td><b>${pBadge}</b></td>
            <td style="font-weight:700;font-size:13px;color:var(--primary)">${zone}</td>
            <td style="font-size:13px;color:var(--text);max-width:300px">${nature}</td>
            <td>
              <div style="display:flex;align-items:center;gap:6px">
                <span style="font-weight:${isDone ? '800' : '600'};color:${isDone ? '#166534' : (isUrgent && observation !== '—' ? '#991b1b' : 'var(--text)')};font-size:12.5px">
                  ${observation}
                </span>
                <button class="btn btn-sm btn-outline no-print" style="padding:1px 5px;font-size:10px" title="Modifier l'observation" onclick="PageActivity.openQuickObsModal(${t.id})">✏️</button>
              </div>
            </td>
            <td style="text-align:center">
              <div style="display:flex;align-items:center;justify-content:center;gap:4px">
                ${statusBadge}
                ${!isDone ? `<button class="btn btn-sm btn-success no-print" style="padding:1px 6px;font-size:10px" title="Marquer FAIT" onclick="PageActivity.quickMarkDone(${t.id})">✅</button>` : ''}
              </div>
            </td>
            <td style="font-size:12px">${t.assignee?.full_name || '<span class="text-muted">—</span>'}</td>
            <td class="no-print" style="text-align:center">
              <button class="btn btn-sm btn-outline" title="Éditer" onclick="PageActivity.openEditModal(${t.id})">✏️</button>
            </td>
          </tr>
        `;
      });
    });

    if (!bodyRows) {
      bodyRows = `<tr><td colspan="8" class="text-center text-muted" style="padding:30px">Aucune tâche trouvée pour la période sélectionnée (${this._taskPeriod}).</td></tr>`;
    }

    el.innerHTML = `
      <div class="table-wrap">
        <table class="table" style="font-size:13px;margin:0">
          <thead>
            <tr style="background:#f8fafc">
              <th style="width:36px;text-align:center">N°</th>
              <th style="width:130px">Priorité</th>
              <th style="width:150px">Appartement / Zone</th>
              <th>Nature du problème</th>
              <th style="width:230px">Observation / État d’avancement</th>
              <th style="width:120px;text-align:center">Statut</th>
              <th style="width:130px">Assignée à</th>
              <th class="no-print" style="width:60px;text-align:center">Action</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      </div>
    `;
  },

  async quickMarkDone(id) {
    try {
      await API.patch(`/tasks/${id}/status`, { status: 'completed', note: 'FAIT' });
      Toast.success('Tâche validée comme FAIT !');
      const t = this._tasks.find((x) => x.id === id);
      if (t) {
        t.status = 'completed';
        t.observation = 'FAIT';
      }
      this.renderTasksTable();
      this.loadMine();
    } catch (e) {
      Toast.error(e.message);
    }
  },

  openQuickObsModal(id) {
    const t = this._tasks.find((x) => x.id === id);
    if (!t) return;

    Modal.open(
      `Observation — ${t.location_zone || 'Intervention'}`,
      `
        <div class="form-group mb-3">
          <label style="font-weight:700">Observation / État d'avancement</label>
          <input type="text" id="actQuickObsInput" class="form-control" value="${(t.observation || '').replace(/"/g, '&quot;')}" placeholder="Ex: Lui fixer une date, FAIT, Travail inachevé, En cours..." />
        </div>
        <div class="form-group">
          <label style="font-weight:700">Statut</label>
          <select id="actQuickObsStatus" class="form-control">
            <option value="pending" ${t.status === 'pending' ? 'selected' : ''}>⏳ À faire</option>
            <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>⚡ En cours</option>
            <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>✅ FAIT / Terminé</option>
            <option value="not_done" ${t.status === 'not_done' ? 'selected' : ''}>❌ Non effectué</option>
          </select>
        </div>
      `,
      `
        <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
        <button class="btn btn-primary" onclick="PageActivity.saveQuickObs(${id})">Enregistrer</button>
      `
    );
  },

  async saveQuickObs(id) {
    const obs = document.getElementById('actQuickObsInput')?.value || '';
    const status = document.getElementById('actQuickObsStatus')?.value || 'pending';
    try {
      await API.put(`/tasks/${id}`, { observation: obs, status });
      Modal.close();
      Toast.success('Observation mise à jour !');
      const t = this._tasks.find((x) => x.id === id);
      if (t) {
        t.observation = obs;
        t.status = status;
      }
      this.renderTasksTable();
      this.loadMine();
    } catch (e) {
      Toast.error(e.message);
    }
  },

  async openEditModal(id) {
    if (typeof PageKanban !== 'undefined' && PageKanban.openEditModal) {
      PageKanban.openEditModal(id);
    } else {
      window.location.hash = '#kanban';
    }
  },

  openCreateModal() {
    if (typeof PageKanban !== 'undefined' && PageKanban.openCreateModal) {
      PageKanban.openCreateModal();
    } else {
      window.location.hash = '#kanban';
    }
  },

  printWorkPlan() {
    window.print();
  },

  togglePdfMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('actPdfMenu');
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  },

  async downloadPdf(periodType = 'today') {
    const menu = document.getElementById('actPdfMenu');
    if (menu) menu.style.display = 'none';

    let pStart = '';
    let pEnd = '';
    let title = '';

    const curr = new Date(this._date || new Date());
    const dateStr = this._date || curr.toISOString().slice(0, 10);

    if (periodType === 'today') {
      pStart = dateStr;
      pEnd = dateStr;
      title = `PLAN DE TRAVAIL URGENT – JOURNÉE DU ${Helpers.formatDate(dateStr).toUpperCase()}`;
    } else if (periodType === 'week') {
      const day = curr.getDay();
      const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(curr.getTime());
      mon.setDate(diff);
      const sun = new Date(mon.getTime());
      sun.setDate(mon.getDate() + 6);
      pStart = mon.toISOString().slice(0, 10);
      pEnd = sun.toISOString().slice(0, 10);
      title = `PLAN DE TRAVAIL URGENT – SEMAINE DU ${Helpers.formatDate(pStart).toUpperCase()} AU ${Helpers.formatDate(pEnd).toUpperCase()}`;
    } else if (periodType === 'month') {
      const first = new Date(curr.getFullYear(), curr.getMonth(), 1);
      const last = new Date(curr.getFullYear(), curr.getMonth() + 1, 0);
      pStart = first.toISOString().slice(0, 10);
      pEnd = last.toISOString().slice(0, 10);
      title = `PLAN DE TRAVAIL URGENT – MOIS DU ${Helpers.formatDate(pStart).toUpperCase()} AU ${Helpers.formatDate(pEnd).toUpperCase()}`;
    }

    try {
      Toast.info('Génération du PDF officiel groupé en cours...');
      const token = Auth.getToken();
      const params = new URLSearchParams({
        period_start: pStart,
        period_end: pEnd,
        period_label: title,
        token: token || '',
      });

      const url = `${CONFIG.API_URL}/tasks/work-plan-pdf?${params.toString()}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erreur lors du téléchargement du PDF');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `Plan_de_travail_urgent_${pStart}_${pEnd}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
      Toast.success('Fiche de suivi PDF téléchargée avec succès !');
    } catch (e) {
      Toast.error(e.message || 'Erreur lors de la génération du PDF');
    }
  },

  taskItem(t) {
    return `<div class="list-item"><div style="flex:1">${t.title}${t.maintenance ? ` · <span class="text-muted" style="font-size:12px">🔧 ${t.maintenance.title}</span>` : ''}</div></div>`;
  },
  col(title, items, empty) {
    const body = items.length ? items.map((t) => this.taskItem(t)).join('') : `<p class="text-muted" style="padding:6px 0">${empty}</p>`;
    return `<div class="card"><div class="card-header"><h3>${title} <span class="badge badge-muted">${items.length}</span></h3></div><div class="card-body">${body}</div></div>`;
  },

  myDayHtml(d) {
    const day = d.day; const p = d.productivity || {};
    const events = day.events.length
      ? day.events.map((e) => `<div class="list-item"><span class="list-dot" style="background:var(--primary)"></span><div style="flex:1">${e.is_meeting ? '👥 ' : ''}${e.title}</div><b>${Helpers.formatDateTime(e.start_datetime)}</b></div>`).join('')
      : '<p class="text-muted">Aucun événement aujourd\'hui</p>';
    return `
      <div class="stats-grid">
        ${PageDashboard.statCard('🎯', 'orange', day.counts.todo, 'À faire')}
        ${PageDashboard.statCard('⏳', 'sky', day.counts.doing, 'En cours')}
        ${PageDashboard.statCard('✅', 'green', day.counts.done, 'Fait aujourd\'hui')}
        ${PageDashboard.statCard('📅', 'sky', day.counts.events, 'Événements')}
      </div>
      <div class="activity-cols">
        ${this.col('🎯 Objectifs', day.todo, 'Rien à faire 🎉')}
        ${this.col('⏳ En cours', day.doing, 'Rien en cours')}
        ${this.col('✅ Fait aujourd\'hui', day.doneToday, 'Rien de terminé')}
      </div>
      <div class="grid-2">
        <div class="card"><div class="card-header"><h3>📅 Mon agenda du jour</h3></div><div class="card-body">${events}</div></div>
        ${p.month ? `<div class="card"><div class="card-header"><h3>📈 Ma productivité</h3></div><div class="card-body">
          <div class="list-item"><div style="flex:1">Tâches terminées (7 derniers jours)</div><b>${p.week.tasksCompleted}</b></div>
          <div class="list-item"><div style="flex:1">Tâches terminées (30 derniers jours)</div><b>${p.month.tasksCompleted}</b></div>
          <div class="list-item"><div style="flex:1">Interventions terminées (30 j)</div><b>${p.month.maintenancesCompleted}</b></div>
          <div class="list-item"><div style="flex:1">Taux de complétion</div><b>${p.month.completionRate}%</b></div>
        </div></div>` : ''}
      </div>`;
  },

  async loadTeam() {
    try {
      const { data } = await API.get(`/dashboard/day?scope=team&date=${this._date}`);
      this._team = data;
      const el = document.getElementById('teamDay'); if (el) el.innerHTML = this.teamHtml(data);
    } catch (e) { const el = document.getElementById('teamDay'); if (el) el.innerHTML = `<div class="text-muted">${e.message}</div>`; }
  },

  teamHtml(d) {
    if (!d.members || !d.members.length) return '<div class="card"><div class="card-body text-muted">Aucun collaborateur visible</div></div>';
    const rows = d.members.map((m) => `<tr>
      <td><b>${m.user.full_name}</b></td>
      <td>${(typeof ROLE_LABELS !== 'undefined' && ROLE_LABELS[m.user.role]) || m.user.role || '—'}</td>
      <td><span class="badge badge-warning">${m.counts.todo}</span></td>
      <td><span class="badge badge-info">${m.counts.doing}</span></td>
      <td><span class="badge badge-success">${m.counts.done}</span></td>
      <td>${m.counts.events}</td>
      <td><button class="btn btn-sm btn-outline" onclick="PageActivity.viewMember(${m.user.id})">👁 Détail</button></td>
    </tr>`).join('');
    return `<div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Collaborateur</th><th>Rôle</th><th>À faire</th><th>En cours</th><th>Fait auj.</th><th>Agenda</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>`;
  },

  viewMember(id) {
    const m = (this._team && this._team.members || []).find((x) => x.user.id === id);
    if (!m) return;
    const list = (items, empty) => items.length ? items.map((t) => `<div class="list-item"><div style="flex:1">${t.title}${t.maintenance ? ` · <span class="text-muted" style="font-size:12px">🔧 ${t.maintenance.title}</span>` : ''}</div></div>`).join('') : `<p class="text-muted">${empty}</p>`;
    const events = m.events.length ? m.events.map((e) => `<div class="list-item"><span class="list-dot" style="background:var(--primary)"></span><div style="flex:1">${e.is_meeting ? '👥 ' : ''}${e.title}</div><b>${Helpers.formatDateTime(e.start_datetime)}</b></div>`).join('') : '<p class="text-muted">Aucun événement</p>';
    Modal.open(`Journée de ${m.user.full_name}`, `
      <h4 style="margin:4px 0 8px">🎯 Objectifs (à faire)</h4>${list(m.todo, 'Rien à faire')}
      <h4 style="margin:16px 0 8px">⏳ En cours</h4>${list(m.doing, 'Rien en cours')}
      <h4 style="margin:16px 0 8px">✅ Fait aujourd'hui</h4>${list(m.doneToday, 'Rien de terminé')}
      <h4 style="margin:16px 0 8px">📅 Agenda du jour</h4>${events}`,
      `<button class="btn btn-outline" onclick="Modal.close()">Fermer</button>`);
  },
};

window.PageActivity = PageActivity;
