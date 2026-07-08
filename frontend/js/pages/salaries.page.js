const PageSalaries = {
  register() {
    Router.register('salaries', () => this.renderManage());
    Router.register('my-salary', () => this.renderMine());
  },
  _users: [], _rows: {},
  MONTHS: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
  monthLabel(m) { return this.MONTHS[m - 1] || m; },
  typeLabel(t) { return t === 'cash' ? '💵 Espèces' : '🏦 Dépôt bancaire'; },

  async fields() {
    this._users = (await API.get('/users')).data.filter((u) => u.role?.name !== 'locataire');
    const now = new Date();
    return [
      { name: 'user_id', label: 'Employé', type: 'select', required: true,
        options: this._users.map((u) => ({ value: u.id, label: `${u.full_name} (${u.role?.label || ''})` })) },
      { name: 'period_month', label: 'Mois', type: 'select', default: now.getMonth() + 1,
        options: this.MONTHS.map((m, i) => ({ value: i + 1, label: m })) },
      { name: 'period_year', label: 'Année', type: 'number', default: now.getFullYear(), half: true },
      { name: 'base_salary', label: 'Salaire de base (FCFA)', type: 'number', required: true, half: true },
      { name: 'bonus', label: 'Prime (FCFA)', type: 'number', default: 0, half: true },
      { name: 'deductions', label: 'Retenues (FCFA)', type: 'number', default: 0, half: true },
      { name: 'payment_type', label: 'Mode de paiement', type: 'select',
        options: [{ value: 'deposit', label: 'Dépôt bancaire' }, { value: 'cash', label: 'Espèces' }] },
      { name: 'status', label: 'Statut', type: 'select',
        options: [{ value: 'pending', label: 'En attente' }, { value: 'paid', label: 'Payé' }] },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ];
  },

  // ===== Gestion (manager / comptable) =====
  async renderManage() {
    const canEdit = Auth.hasRole('manager', 'comptable');
    const data = await CrudPage.list({
      endpoint: '/salaries', title: 'Salaires & paie',
      canCreate: canEdit, onCreate: 'PageSalaries.create',
      columns: [
        { label: 'Employé', render: (r) => `<b>${r.employee ? r.employee.full_name : '—'}</b><br><span class="text-muted" style="font-size:12px">${r.employee?.role?.role_name || ''}</span>` },
        { label: 'Période', render: (r) => `${this.monthLabel(r.period_month)} ${r.period_year}` },
        { label: 'Base', render: (r) => Helpers.formatMoney(r.base_salary) },
        { label: 'Prime', render: (r) => Helpers.formatMoney(r.bonus) },
        { label: 'Net', render: (r) => `<b>${Helpers.formatMoney(r.net_salary)}</b>` },
        { label: 'Mode', render: (r) => this.typeLabel(r.payment_type) },
        { label: 'Preuve', render: (r) => r.proof_photo ? `<a href="${Helpers.fileUrl(r.proof_photo)}" target="_blank">📎</a>` : '—' },
        { label: 'Statut', render: (r) => Helpers.statusBadge(r.status === 'paid' ? 'completed' : 'pending') },
      ],
      rowActions: canEdit ? (r) => `
        <button class="btn btn-sm btn-outline" title="Preuve de paiement" onclick="PageSalaries.uploadProof(${r.id})">📷</button>
        <button class="btn btn-sm btn-outline" onclick="PageSalaries.edit(${r.id})">✏️</button>
        ${Auth.hasRole('manager') ? `<button class="btn btn-sm btn-danger" onclick="PageSalaries.remove(${r.id})">🗑</button>` : ''}` : null,
    });
    this._rows = {}; (data || []).forEach((r) => { this._rows[r.id] = r; });
  },

  // ===== Espace employé : mes salaires =====
  async renderMine() {
    Layout.setTitle('Mon salaire');
    const { data } = await API.get('/salaries/mine');
    const totalPaid = data.filter((s) => s.status === 'paid').reduce((s, x) => s + parseFloat(x.net_salary || 0), 0);
    const cards = data.map((s) => `
      <div class="card mb-4"><div class="card-body">
        <div class="flex justify-between items-center">
          <div><h3>${this.monthLabel(s.period_month)} ${s.period_year}</h3>
            <div class="text-muted" style="font-size:13px">${this.typeLabel(s.payment_type)}${s.status === 'paid' && s.paid_date ? ' · payé le ' + Helpers.formatDate(s.paid_date) : ''}</div></div>
          ${Helpers.statusBadge(s.status === 'paid' ? 'completed' : 'pending')}
        </div>
        <div class="stats-grid" style="margin-top:14px">
          <div class="stat-card"><div class="stat-icon sky">💼</div><div class="stat-info"><div class="stat-value">${Helpers.formatMoney(s.base_salary)}</div><div class="stat-name">Salaire de base</div></div></div>
          <div class="stat-card"><div class="stat-icon green">🎁</div><div class="stat-info"><div class="stat-value">${Helpers.formatMoney(s.bonus)}</div><div class="stat-name">Prime</div></div></div>
          <div class="stat-card"><div class="stat-icon orange">➖</div><div class="stat-info"><div class="stat-value">${Helpers.formatMoney(s.deductions)}</div><div class="stat-name">Retenues</div></div></div>
          <div class="stat-card"><div class="stat-icon green">💰</div><div class="stat-info"><div class="stat-value">${Helpers.formatMoney(s.net_salary)}</div><div class="stat-name">Net à payer</div></div></div>
        </div>
        ${s.proof_photo ? `<a class="btn btn-outline mt-4" href="${Helpers.fileUrl(s.proof_photo)}" target="_blank">📎 Voir la preuve de paiement</a>` : ''}
      </div></div>`).join('') || '<div class="empty-state"><div class="icon">💰</div><h3>Aucune fiche de salaire</h3></div>';

    Layout.content(`
      <div class="page-head"><div><h2>Mon salaire</h2><div class="subtitle">Historique de vos rémunérations</div></div></div>
      <div class="stats-grid"><div class="stat-card"><div class="stat-icon green">💰</div>
        <div class="stat-info"><div class="stat-value">${Helpers.formatMoney(totalPaid)}</div><div class="stat-name">Total perçu</div></div></div></div>
      ${cards}`);
  },

  create() { CrudPage.openForm({ title: 'Nouvelle fiche de salaire', fields: this.fields(),
    onSubmit: async (d) => { await API.post('/salaries', d); Toast.success('Salaire enregistré'); PageSalaries.renderManage(); } }); },
  async edit(id) { const r = (await API.get('/salaries/' + id)).data;
    CrudPage.openForm({ title: 'Modifier la fiche', fields: await this.fields(), values: r,
      onSubmit: async (d) => { await API.put('/salaries/' + id, d); Toast.success('Mis à jour'); PageSalaries.renderManage(); } }); },
  uploadProof(id) {
    Modal.open('Preuve de paiement (photo)',
      '<div class="form-group"><label>Reçu de dépôt ou photo (cash)</label><input type="file" id="salProof" class="form-control" accept="image/*,application/pdf"/></div>',
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button><button class="btn btn-primary" onclick="PageSalaries.submitProof(${id})">Enregistrer</button>`);
  },
  async submitProof(id) {
    const file = document.getElementById('salProof').files[0];
    if (!file) { Toast.error('Sélectionnez un fichier'); return; }
    const fd = new FormData(); fd.append('proof', file);
    try { await API.upload('/salaries/' + id + '/proof', fd); Modal.close(); Toast.success('Preuve enregistrée'); PageSalaries.renderManage(); }
    catch (e) { Toast.error(e.message); }
  },
  remove(id) { CrudPage.confirmDelete('/salaries/' + id, () => PageSalaries.renderManage()); },
};
