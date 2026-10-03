const PageTasks = {
  register() { Router.register('tasks', () => this.render()); },
  _users: [], _maintenances: [], _rows: {},
  async fields() {
    try { this._users = (await API.get('/users')).data; } catch { this._users = []; }
    try { this._maintenances = (await API.get('/maintenance')).data; } catch { this._maintenances = []; }
    return [
      { name: 'priority', label: 'Priorité', type: 'select', half: true, options: [
        { value: 'Urgent', label: '🔴 Urgent' },
        { value: 'Maintenance', label: '🟠 Maintenance' },
        { value: 'Rénovation complète', label: '🟣 Rénovation complète' },
        { value: 'Normal', label: '⚪ Normal' }
      ]},
      { name: 'location_zone', label: 'Appartement / Zone (ex: 408, 517, Immeuble l\'AGAPE)', half: true },
      { name: 'nature_probleme', label: 'Nature du problème (ex: Siphon douche, Toit défectueux...)' },
      { name: 'title', label: 'Titre de la tâche', required: true },
      { name: 'assigned_to', label: 'Assignée à', type: 'select', options: [{ value: '', label: '— Non assignée —' }].concat(this._users.map((u) => ({ value: u.id, label: u.full_name }))) },
      { name: 'maintenance_id', label: 'Chantier lié (optionnel)', type: 'select', options: [{ value: '', label: '— Aucun —' }].concat(this._maintenances.map((m) => ({ value: m.id, label: m.title }))) },
      { name: 'start_date', label: 'Heure planifiée', type: 'datetime-local', half: true },
      { name: 'end_date', label: 'Échéance (fin)', type: 'datetime-local', half: true },
      { name: 'description', label: 'Description (ce qui doit être fait)', type: 'textarea' },
      { name: 'observation', label: 'Observation / État d\'avancement (ex: Lui fixer une date, FAIT...)', type: 'textarea' },
    ];
  },
  async render() {
    const data = await CrudPage.list({
      endpoint: '/tasks', title: 'Tâches',
      canCreate: true, onCreate: 'PageTasks.create',
      columns: [
        { label: 'Priorité', render: (r) => `<span class="badge ${r.priority === 'Urgent' ? 'badge-danger' : r.priority === 'Maintenance' ? 'badge-warning' : r.priority === 'Rénovation complète' ? 'badge-primary' : 'badge-info'}">${r.priority || 'Normal'}</span>` },
        { label: 'Zone / Appt', render: (r) => `<b>${r.location_zone || '—'}</b>` },
        { label: 'Problème / Tâche', render: (r) => `<b>${r.nature_probleme || r.title}</b>${r.description ? `<br><span class="text-muted" style="font-size:12px">${String(r.description).slice(0, 60)}</span>` : ''}` },
        { label: 'Observation', render: (r) => r.observation ? `<span class="text-info">${r.observation}</span>` : '—' },
        { label: 'Assignée à', render: (r) => r.assignee ? r.assignee.full_name : '<span class="text-muted">—</span>' },
        { label: 'Heure planifiée', render: (r) => r.start_date ? Helpers.formatDateTime(r.start_date) : '—' },
        { label: 'Statut', render: (r) => Helpers.taskStatus(r.status) + (r.completion_note ? `<br><span class="text-muted" style="font-size:11px">${String(r.completion_note).slice(0, 50)}</span>` : '') },
      ],
      rowActions: (r) => `
        <button class="btn btn-sm btn-success" title="Déclarer (fait / en cours / pas fait)" onclick="PageTasks.mark(${r.id})">✅</button>
        <button class="btn btn-sm btn-outline" title="Reporter" onclick="PageTasks.reschedule(${r.id})">⏰</button>
        <button class="btn btn-sm btn-outline" title="Historique" onclick="PageTasks.history(${r.id})">🕓</button>
        <button class="btn btn-sm btn-whatsapp" title="Envoyer les photos par WhatsApp" onclick="PageTasks.whatsapp(${r.id})">🟢</button>
        <button class="btn btn-sm btn-outline" onclick="PageTasks.edit(${r.id})">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="PageTasks.remove(${r.id})">🗑</button>`,
    });
    this._rows = {}; (data || []).forEach((r) => { this._rows[r.id] = r; });
  },
  clean(d) { if (!d.assigned_to) delete d.assigned_to; if (!d.maintenance_id) delete d.maintenance_id; return d; },
  async create() { CrudPage.openForm({ title: 'Nouvelle tâche', fields: await this.fields(), onSubmit: async (d) => { await API.post('/tasks', this.clean(d)); Toast.success('Tâche créée'); PageTasks.render(); } }); },
  async edit(id) { const r = (await API.get('/tasks/' + id)).data; CrudPage.openForm({ title: 'Modifier la tâche', fields: await this.fields(), values: r, onSubmit: async (d) => { await API.put('/tasks/' + id, this.clean(d)); Toast.success('Mis à jour'); PageTasks.render(); } }); },

  // ---- L'employé déclare le statut ----
  mark(id) {
    const r = this._rows[id] || {};
    const isLate = r.start_date && (new Date() - new Date(r.start_date)) > 15 * 60 * 1000;
    Modal.open('Déclarer la tâche', `
      <div class="form-group"><label>Statut</label>
        <select class="form-control" id="tkStatus" onchange="PageTasks.toggleMarkFields(${isLate})">
          <option value="in_progress">🔵 En cours</option>
          <option value="completed">✅ Effectuée</option>
          <option value="not_done">❌ Non effectuée</option>
        </select></div>
      <div class="form-group" id="tkNoteWrap"><label>Note / Résumé d'exécution <span class="text-muted">(obligatoire si non effectuée)</span></label>
        <textarea class="form-control" id="tkNote" rows="2" placeholder="Ce qui a été fait, ou pourquoi ça n'a pas pu être fait…"></textarea></div>
      <div class="form-group" id="tkDelayWrap" style="display:none; border-left: 3px solid var(--danger); padding-left: 10px; margin-top: 10px;">
        <label style="color:var(--danger); font-weight: 600;">⚠️ Retard détecté (>15 min) — Justification obligatoire</label>
        <textarea class="form-control" id="tkDelayJustif" rows="2" placeholder="Raison du retard (ex: intempéries, pièce manquante, urgence...)"></textarea>
      </div>`,
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button><button class="btn btn-primary" onclick="PageTasks.submitMark(${id})">Enregistrer</button>`);
    this.toggleMarkFields(isLate);
  },
  toggleMarkFields(isLate) {
    const status = document.getElementById('tkStatus').value;
    const delayWrap = document.getElementById('tkDelayWrap');
    if (delayWrap) {
      delayWrap.style.display = (status === 'completed' && isLate) ? 'block' : 'none';
    }
  },
  async submitMark(id) {
    const status = document.getElementById('tkStatus').value;
    const note = document.getElementById('tkNote').value.trim();
    const delayWrap = document.getElementById('tkDelayWrap');
    const delayJustifEl = document.getElementById('tkDelayJustif');
    const delay_justification = delayJustifEl ? delayJustifEl.value.trim() : '';

    if (status === 'not_done' && !note) { Toast.error('Indiquez pourquoi la tâche n\'a pas été effectuée'); return; }
    if (delayWrap && delayWrap.style.display !== 'none' && !delay_justification) {
      Toast.error('La justification du retard est obligatoire');
      return;
    }

    try {
      await API.patch('/tasks/' + id + '/status', { status, note, delay_justification });
      Modal.close();
      Toast.success('Statut enregistré');
      if (window.location.hash === '#dashboard' || !window.location.hash) {
        PageDashboard.render();
      } else {
        PageTasks.render();
      }
    }
    catch (e) { Toast.error(e.message); }
  },

  // ---- Reporter à une autre heure (motif obligatoire) ----
  reschedule(id) {
    Modal.open('Reporter la tâche', `
      <div class="form-group"><label>Nouvelle date / heure</label><input type="datetime-local" class="form-control" id="tkNewDate"/></div>
      <div class="form-group"><label>Motif du report <span class="text-muted">(obligatoire)</span></label>
        <textarea class="form-control" id="tkReason" rows="2" placeholder="Pourquoi reporter ? (ex: pièce manquante, urgence ailleurs…)"></textarea></div>`,
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button><button class="btn btn-primary" onclick="PageTasks.submitReschedule(${id})">Reporter</button>`);
  },
  async submitReschedule(id) {
    const start_date = document.getElementById('tkNewDate').value;
    const reason = document.getElementById('tkReason').value.trim();
    if (!start_date) { Toast.error('Choisissez la nouvelle date/heure'); return; }
    if (!reason) { Toast.error('Le motif est obligatoire'); return; }
    try { await API.patch('/tasks/' + id + '/reschedule', { start_date, reason }); Modal.close(); Toast.success('Tâche reportée'); PageTasks.render(); }
    catch (e) { Toast.error(e.message); }
  },

  // ---- Journal horodaté (traçabilité) ----
  async history(id) {
    const r = (await API.get('/tasks/' + id)).data;
    const acts = { created: '🆕 Création', status_changed: '🔄 Statut', rescheduled: '⏰ Report', updated: '✏️ Modification', note: '📝 Note' };
    const items = (r.history || []).map((h) => `<div class="list-item">
      <div style="flex:1"><b>${acts[h.action] || h.action}</b> — ${h.description || ''}<br>
        <span class="text-muted" style="font-size:12px">${Helpers.formatDateTime(h.createdAt)}${h.changedBy ? ' · ' + h.changedBy.full_name : ''}</span></div>
    </div>`).join('') || '<div class="text-muted">Aucun historique</div>';
    Modal.open('🕓 Historique — ' + r.title, `
      <div class="list-item"><div style="flex:1">Assignée à</div><b>${r.assignee ? r.assignee.full_name : '—'}</b></div>
      <div class="list-item"><div style="flex:1">Heure planifiée</div><b>${r.start_date ? Helpers.formatDateTime(r.start_date) : '—'}</b></div>
      <div class="list-item"><div style="flex:1">Statut</div>${Helpers.taskStatus(r.status)}</div>
      ${r.done_at ? `<div class="list-item"><div style="flex:1">Réalisée le</div><b>${Helpers.formatDateTime(r.done_at)}</b></div>` : ''}
      ${r.completion_note ? `<p style="margin:10px 0;color:var(--text-secondary)"><b>Résumé / Note :</b> ${r.completion_note}</p>` : ''}
      ${r.delay_justification ? `<p style="margin:10px 0;color:var(--danger);font-weight:600;">⚠️ Retard justifié : ${r.delay_justification}</p>` : ''}
      <h4 class="mt-4">Journal</h4>${items}`,
      '<button class="btn btn-outline" onclick="Modal.close()">Fermer</button>');
  },

  // ---- Photos via WhatsApp (sans stockage) ----
  whatsapp(id) {
    const r = this._rows[id];
    const msg = `📸 Photos — Tâche : ${r ? r.title : ''}${r && r.assignee ? ' (réalisée par ' + r.assignee.full_name + ')' : ''}. Voici les photos avant / pendant / après :`;
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
  },
  remove(id) { CrudPage.confirmDelete('/tasks/' + id, () => PageTasks.render()); },
};
