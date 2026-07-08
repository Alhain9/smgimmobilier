// ============ Page Activité du jour (productivité : tâches + agenda) ============
const PageActivity = {
  register() { Router.register('activity', () => this.render()); },
  _date: null,
  _team: null,

  canTeam() {
    const u = Auth.getUser();
    return Auth.hasRole('manager', 'super_admin', 'dir_admin', 'dir_technique', 'gestionnaire') || !!(u && u.can_view_all_calendars);
  },

  async render() {
    Layout.setTitle('Activité du jour');
    if (!this._date) this._date = new Date().toISOString().slice(0, 10);
    const team = this.canTeam();
    Layout.content(`
      <div class="page-head">
        <div><h2>📋 Activité du jour</h2><div class="subtitle">Organisez votre journée et suivez la productivité de l'équipe</div></div>
        <input type="date" class="form-control" id="actDate" value="${this._date}" style="max-width:185px" onchange="PageActivity.changeDate(this.value)"/>
      </div>
      <div id="myDay"><div class="spinner"></div></div>
      ${team ? `<h3 style="margin:26px 0 12px">👥 Activité de l'équipe</h3><div id="teamDay"><div class="spinner"></div></div>` : ''}
    `);
    this.loadMine();
    if (team) this.loadTeam();
  },

  changeDate(d) { this._date = d; this.render(); },

  async loadMine() {
    try {
      const { data } = await API.get(`/dashboard/day?scope=me&date=${this._date}`);
      const el = document.getElementById('myDay'); if (el) el.innerHTML = this.myDayHtml(data);
    } catch (e) { const el = document.getElementById('myDay'); if (el) el.innerHTML = `<div class="text-muted">${e.message}</div>`; }
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
