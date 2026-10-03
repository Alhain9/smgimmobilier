// ============ Page Ressources Humaines (RH) ============
const PageRh = {
  activeTab: 'leaves', // leaves | shifts | teams

  register() {
    Router.register('rh', () => this.render());
  },

  async render() {
    Layout.setTitle('Ressources Humaines');
    
    Layout.content(`
      <div class="page-head">
        <div>
          <h2>Ressources Humaines</h2>
          <div class="subtitle">Gestion des plannings, congés et équipes</div>
        </div>
      </div>

      <div class="tab-container" style="margin-bottom:20px; display:flex; gap:10px; border-bottom:1px solid var(--border); padding-bottom:10px;">
        <button class="btn ${this.activeTab === 'leaves' ? 'btn-primary' : 'btn-outline'}" onclick="PageRh.switchTab('leaves')">✈️ Congés</button>
        <button class="btn ${this.activeTab === 'shifts' ? 'btn-primary' : 'btn-outline'}" onclick="PageRh.switchTab('shifts')">📅 Plannings</button>
        <button class="btn ${this.activeTab === 'teams' ? 'btn-primary' : 'btn-outline'}" onclick="PageRh.switchTab('teams')">👥 Équipes & Services</button>
      </div>

      <div id="rhTabContent"><div class="spinner"></div></div>
    `);

    await this.loadTabContent();
  },

  async switchTab(tab) {
    this.activeTab = tab;
    this.render();
  },

  async loadTabContent() {
    const container = document.getElementById('rhTabContent');
    if (!container) return;

    try {
      if (this.activeTab === 'leaves') {
        await this.renderLeaves(container);
      } else if (this.activeTab === 'shifts') {
        await this.renderShifts(container);
      } else if (this.activeTab === 'teams') {
        await this.renderTeams(container);
      }
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  // --- CONGES ---
  async renderLeaves(container) {
    const res = await API.get('/rh/conges');
    const leaves = res.data || [];
    const canManage = Auth.hasRole('super_admin', 'manager', 'comptable', 'dir_admin');

    const rows = leaves.map(c => {
      const isPending = c.status === 'pending';
      const actions = `
        <div style="display:inline-flex;gap:4px">
          ${isPending && canManage
            ? `<button class="btn btn-sm btn-success" onclick="PageRh.verifyLeave(${c.id}, 'approved')">Approuver</button>
               <button class="btn btn-sm btn-danger" onclick="PageRh.verifyLeave(${c.id}, 'rejected')">Rejeter</button>`
            : ''}
          ${canManage ? `<button class="btn btn-sm btn-outline-danger" title="Supprimer" onclick="PageRh.deleteLeave(${c.id})">🗑️</button>` : ''}
        </div>
      `;

      return `
        <tr>
          ${canManage ? `<td style="text-align:center"><input type="checkbox" class="leave-row-chk" value="${c.id}" onchange="PageRh.onLeaveRowSelectChange()" /></td>` : ''}
          <td><strong>${c.employee?.full_name || '—'}</strong></td>
          <td>${c.type}</td>
          <td>${c.start_date}</td>
          <td>${c.end_date}</td>
          <td><span class="badge ${c.status === 'approved' ? 'badge-success' : c.status === 'rejected' ? 'badge-danger' : 'badge-warning'}">${c.status}</span></td>
          <td>${c.reason || '—'}</td>
          <td>${c.approver?.full_name || '—'}</td>
          <td>${actions || '—'}</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div class="page-head" style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
        <h3>Demandes de congés (${leaves.length})</h3>
        <button class="btn btn-primary" onclick="PageRh.requestLeave()">+ Demander un congé</button>
      </div>

      <!-- Barre d'action groupée pour congés -->
      ${canManage ? `
        <div id="leaveBulkBar" style="display:none;background:#fee2e2;border:1px solid #fca5a5;padding:10px 16px;border-radius:8px;margin-bottom:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div style="font-size:13px;color:#991b1b;font-weight:600">
            <span id="leaveSelectedCount">0</span> congé(s) sélectionné(s)
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm btn-outline" style="border-color:#f87171;color:#991b1b" onclick="PageRh.clearLeaveSelection()">Annuler</button>
            <button class="btn btn-sm btn-danger" onclick="PageRh.bulkDeleteLeaves()">🗑️ Tout supprimer la sélection</button>
          </div>
        </div>
      ` : ''}

      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                ${canManage ? '<th style="width:36px;text-align:center"><input type="checkbox" id="leaveSelectAll" title="Tout sélectionner" onchange="PageRh.toggleSelectAllLeaves(this.checked)" /></th>' : ''}
                <th>Employé</th>
                <th>Type</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Statut</th>
                <th>Motif</th>
                <th>Validateur</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="${canManage ? 9 : 8}" class="text-center">Aucune demande enregistrée</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  async requestLeave() {
    CrudPage.openForm({
      title: 'Demande de Congé',
      fields: [
        { name: 'type', label: 'Type de congé', type: 'select', options: [
          { value: 'annual', label: 'Annuel' },
          { value: 'sick', label: 'Maladie' },
          { value: 'maternity', label: 'Maternité' },
          { value: 'paternity', label: 'Paternité' },
          { value: 'unpaid', label: 'Sans solde' },
          { value: 'other', label: 'Autre' }
        ], required: true },
        { name: 'start_date', label: 'Date de début', type: 'date', required: true },
        { name: 'end_date', label: 'Date de fin', type: 'date', required: true },
        { name: 'reason', label: 'Motif', type: 'textarea' }
      ],
      onSubmit: async (data) => {
        await API.post('/rh/conges', data);
        Toast.success('Demande envoyée !');
        this.loadTabContent();
      }
    });
  },

  async verifyLeave(id, status) {
    if (!confirm(`Confirmer la décision : ${status === 'approved' ? 'Approuver' : 'Rejeter'} ?`)) return;
    try {
      await API.put(`/rh/conges/${id}`, { status });
      Toast.success('Statut du congé mis à jour');
      this.loadTabContent();
    } catch (err) { Toast.error(err.message); }
  },

  async deleteLeave(id) {
    if (!confirm('Supprimer cette demande de congé ?')) return;
    try {
      await API.delete(`/rh/conges/${id}`);
      Toast.success('Congé supprimé');
      this.loadTabContent();
    } catch (err) { Toast.error(err.message); }
  },

  toggleSelectAllLeaves(checked) {
    document.querySelectorAll('.leave-row-chk').forEach(c => { c.checked = checked; });
    this.onLeaveRowSelectChange();
  },

  onLeaveRowSelectChange() {
    const checked = document.querySelectorAll('.leave-row-chk:checked');
    const bar = document.getElementById('leaveBulkBar');
    const cnt = document.getElementById('leaveSelectedCount');
    const allChk = document.getElementById('leaveSelectAll');
    const total = document.querySelectorAll('.leave-row-chk').length;
    if (cnt) cnt.textContent = checked.length;
    if (bar) bar.style.display = checked.length > 0 ? 'flex' : 'none';
    if (allChk) allChk.checked = total > 0 && checked.length === total;
  },

  clearLeaveSelection() {
    document.querySelectorAll('.leave-row-chk').forEach(c => { c.checked = false; });
    const allChk = document.getElementById('leaveSelectAll');
    if (allChk) allChk.checked = false;
    this.onLeaveRowSelectChange();
  },

  async bulkDeleteLeaves() {
    const checked = Array.from(document.querySelectorAll('.leave-row-chk:checked')).map(c => Number(c.value));
    if (!checked.length) { Toast.warning('Aucun congé sélectionné'); return; }
    if (!confirm(`Confirmez-vous la suppression de ces ${checked.length} demande(s) de congé ?`)) return;
    try {
      const res = await API.post('/rh/conges/bulk-delete', { ids: checked });
      Toast.success(res.message || `${checked.length} congé(s) supprimé(s)`);
      this.clearLeaveSelection();
      this.loadTabContent();
    } catch (e) { Toast.error(e.message || 'Erreur suppression groupée'); }
  },

  // --- PLANNINGS ---
  async renderShifts(container) {
    const res = await API.get('/rh/plannings');
    const shifts = res.data || [];
    const canManage = Auth.hasRole('super_admin', 'manager', 'dir_admin');

    const rows = shifts.map(s => `
      <tr>
        ${canManage ? `<td style="text-align:center"><input type="checkbox" class="shift-row-chk" value="${s.id}" onchange="PageRh.onShiftRowSelectChange()" /></td>` : ''}
        <td><strong>${s.employee?.full_name || '—'}</strong></td>
        <td>${s.title}</td>
        <td>${new Date(s.start_datetime).toLocaleString('fr-FR')}</td>
        <td>${new Date(s.end_datetime).toLocaleString('fr-FR')}</td>
        <td>${s.description || '—'}</td>
        <td>${s.creator?.full_name || '—'}</td>
        <td>
          ${canManage ? `<button class="btn btn-sm btn-outline-danger" onclick="PageRh.deleteShift(${s.id})">Supprimer</button>` : '—'}
        </td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div class="page-head" style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
        <h3>Plannings & Horaires (${shifts.length})</h3>
        <button class="btn btn-primary" onclick="PageRh.createShift()">+ Planifier un horaire</button>
      </div>

      <!-- Barre d'action groupée pour plannings -->
      ${canManage ? `
        <div id="shiftBulkBar" style="display:none;background:#fee2e2;border:1px solid #fca5a5;padding:10px 16px;border-radius:8px;margin-bottom:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div style="font-size:13px;color:#991b1b;font-weight:600">
            <span id="shiftSelectedCount">0</span> planning(s) sélectionné(s)
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm btn-outline" style="border-color:#f87171;color:#991b1b" onclick="PageRh.clearShiftSelection()">Annuler</button>
            <button class="btn btn-sm btn-danger" onclick="PageRh.bulkDeleteShifts()">🗑️ Tout supprimer la sélection</button>
          </div>
        </div>
      ` : ''}

      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                ${canManage ? '<th style="width:36px;text-align:center"><input type="checkbox" id="shiftSelectAll" title="Tout sélectionner" onchange="PageRh.toggleSelectAllShifts(this.checked)" /></th>' : ''}
                <th>Employé</th>
                <th>Tâche/Titre</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Description</th>
                <th>Planifié par</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="${canManage ? 8 : 7}" class="text-center">Aucune planification</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  async createShift() {
    const uRes = await API.get('/users');
    const users = (uRes.data || []).map(u => ({ value: u.id, label: u.full_name }));

    CrudPage.openForm({
      title: 'Planifier un Horaire',
      fields: [
        { name: 'user_id', label: 'Employé', type: 'select', options: users, required: true },
        { name: 'title', label: 'Titre/Activité', type: 'text', required: true },
        { name: 'start_datetime', label: 'Début', type: 'datetime-local', required: true },
        { name: 'end_datetime', label: 'Fin', type: 'datetime-local', required: true },
        { name: 'description', label: 'Description', type: 'textarea' }
      ],
      onSubmit: async (data) => {
        await API.post('/rh/plannings', data);
        Toast.success('Horaire planifié avec succès !');
        this.loadTabContent();
      }
    });
  },

  async deleteShift(id) {
    if (!confirm('Supprimer cette planification ?')) return;
    try {
      await API.delete(`/rh/plannings/${id}`);
      Toast.success('Supprimé');
      this.loadTabContent();
    } catch (err) { Toast.error(err.message); }
  },

  toggleSelectAllShifts(checked) {
    document.querySelectorAll('.shift-row-chk').forEach(c => { c.checked = checked; });
    this.onShiftRowSelectChange();
  },

  onShiftRowSelectChange() {
    const checked = document.querySelectorAll('.shift-row-chk:checked');
    const bar = document.getElementById('shiftBulkBar');
    const cnt = document.getElementById('shiftSelectedCount');
    const allChk = document.getElementById('shiftSelectAll');
    const total = document.querySelectorAll('.shift-row-chk').length;
    if (cnt) cnt.textContent = checked.length;
    if (bar) bar.style.display = checked.length > 0 ? 'flex' : 'none';
    if (allChk) allChk.checked = total > 0 && checked.length === total;
  },

  clearShiftSelection() {
    document.querySelectorAll('.shift-row-chk').forEach(c => { c.checked = false; });
    const allChk = document.getElementById('shiftSelectAll');
    if (allChk) allChk.checked = false;
    this.onShiftRowSelectChange();
  },

  async bulkDeleteShifts() {
    const checked = Array.from(document.querySelectorAll('.shift-row-chk:checked')).map(c => Number(c.value));
    if (!checked.length) { Toast.warning('Aucun planning sélectionné'); return; }
    if (!confirm(`Confirmez-vous la suppression de ces ${checked.length} planning(s) ?`)) return;
    try {
      const res = await API.post('/rh/plannings/bulk-delete', { ids: checked });
      Toast.success(res.message || `${checked.length} planning(s) supprimé(s)`);
      this.clearShiftSelection();
      this.loadTabContent();
    } catch (e) { Toast.error(e.message || 'Erreur suppression groupée'); }
  },

  // --- EQUIPES & SERVICES ---
  async renderTeams(container) {
    const [sRes, eRes] = await Promise.all([
      API.get('/rh/services'),
      API.get('/rh/equipes')
    ]);

    const services = sRes.data || [];
    const equipes = eRes.data || [];

    let servicesHtml = services.map(s => `
      <li style="display:flex; justify-content:between; padding:8px 0; border-bottom:1px solid #eee;">
        <strong>${s.name}</strong>
        <button class="btn btn-sm btn-outline-danger" onclick="PageRh.deleteService(${s.id})">Supprimer</button>
      </li>
    `).join('');

    let teamsHtml = equipes.map(e => `
      <li style="display:flex; justify-content:between; padding:8px 0; border-bottom:1px solid #eee;">
        <div>
          <strong>${e.name}</strong>
          <span style="font-size:12px; color:#999; margin-left:10px;">(Service: ${e.service?.name || '—'})</span>
        </div>
        <button class="btn btn-sm btn-outline-danger" onclick="PageRh.deleteTeam(${e.id})">Supprimer</button>
      </li>
    `).join('');

    container.innerHTML = `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
        <div class="card">
          <div class="card-header" style="display:flex; justify-content:between; align-items:center;">
            <span>🏢 Services</span>
            <button class="btn btn-sm btn-primary" onclick="PageRh.addService()">+ Ajouter</button>
          </div>
          <div style="padding:15px;">
            <ul style="list-style:none; padding:0; margin:0;">${servicesHtml || '<li>Aucun service</li>'}</ul>
          </div>
        </div>

        <div class="card">
          <div class="card-header" style="display:flex; justify-content:between; align-items:center;">
            <span>👥 Équipes</span>
            <button class="btn btn-sm btn-primary" onclick="PageRh.addTeam()">+ Ajouter</button>
          </div>
          <div style="padding:15px;">
            <ul style="list-style:none; padding:0; margin:0;">${teamsHtml || '<li>Aucune équipe</li>'}</ul>
          </div>
        </div>
      </div>
    `;
  },

  async addService() {
    const name = prompt('Nom du service :');
    if (!name) return;
    try {
      await API.post('/rh/services', { name });
      Toast.success('Service créé !');
      this.loadTabContent();
    } catch (err) { Toast.error(err.message); }
  },

  async deleteService(id) {
    if (!confirm('Supprimer ce service ?')) return;
    try {
      await API.delete(`/rh/services/${id}`);
      Toast.success('Service supprimé');
      this.loadTabContent();
    } catch (err) { Toast.error(err.message); }
  },

  async addTeam() {
    const sRes = await API.get('/rh/services');
    const services = (sRes.data || []).map(s => ({ value: s.id, label: s.name }));

    if (!services.length) {
      return Toast.error('Veuillez créer un service d\'abord.');
    }

    CrudPage.openForm({
      title: 'Créer une Équipe',
      fields: [
        { name: 'name', label: 'Nom de l\'équipe', type: 'text', required: true },
        { name: 'service_id', label: 'Service rattaché', type: 'select', options: services, required: true }
      ],
      onSubmit: async (data) => {
        await API.post('/rh/equipes', data);
        Toast.success('Équipe créée !');
        this.loadTabContent();
      }
    });
  },

  async deleteTeam(id) {
    if (!confirm('Supprimer cette équipe ?')) return;
    try {
      await API.delete(`/rh/equipes/${id}`);
      Toast.success('Équipe supprimée');
      this.loadTabContent();
    } catch (err) { Toast.error(err.message); }
  }
};

window.PageRh = PageRh;
