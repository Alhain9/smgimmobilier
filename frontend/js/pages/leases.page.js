const PageLeases = {
  register() { Router.register('leases', () => this.render()); },
  _tenants: [], _apartments: [], _rows: {},

  async fields() {
    this._tenants = (await API.get('/tenants')).data;
    this._apartments = (await API.get('/apartments')).data;
    return [
      { name: 'tenant_id', label: 'Locataire', type: 'select', required: true,
        options: this._tenants.map((t) => ({ value: t.id, label: t.full_name || ('Locataire #' + t.id) })) },
      { name: 'apartment_id', label: 'Logement', type: 'select', required: true,
        options: this._apartments.map((a) => ({ value: a.id, label: `${a.apartment_number} (${a.property?.property_name || ''})` })) },
      { name: 'start_date', label: 'Date de début', type: 'date', required: true, half: true },
      { name: 'end_date', label: 'Date de fin', type: 'date', half: true },
      { name: 'monthly_rent', label: 'Loyer mensuel (FCFA)', type: 'number', required: true, half: true },
      { name: 'deposit_amount', label: 'Caution (FCFA)', type: 'number', half: true },
      { name: 'status', label: 'Statut', type: 'select', options: [
        { value: 'pending', label: 'En attente' }, { value: 'active', label: 'Actif' },
        { value: 'expired', label: 'Expiré' }, { value: 'terminated', label: 'Résilié' }] },
    ];
  },

  async render() {
    const canEdit = Auth.hasRole('manager', 'dir_admin', 'gestionnaire');
    const canContact = Auth.hasRole('manager', 'dir_admin', 'gestionnaire');
    const data = await CrudPage.list({
      endpoint: '/leases', title: 'Contrats de bail',
      canCreate: canEdit, onCreate: 'PageLeases.create',
      columns: [
        { label: 'Locataire', render: (r) => r.tenant?.user ? r.tenant.user.full_name : '—' },
        { label: 'Logement', render: (r) => r.apartment ? r.apartment.apartment_number : '—' },
        { label: 'Immeuble', render: (r) => r.apartment?.property ? r.apartment.property.property_name : '—' },
        { label: 'Loyer', render: (r) => Helpers.formatMoney(r.monthly_rent) },
        { label: 'Début', render: (r) => Helpers.formatDate(r.start_date) },
        { label: 'Signé', render: (r) => r.contract_file ? `<a class="btn btn-sm btn-outline" href="${Helpers.fileUrl(r.contract_file)}" target="_blank">📎</a>` : '—' },
        { label: 'Statut', render: (r) => Helpers.statusBadge(r.status) },
      ],
      rowActions: (r) => `
        <button class="btn btn-sm btn-outline" title="Générer le contrat PDF" onclick="PageLeases.pdf(${r.id})">📄</button>
        ${canContact ? `<button class="btn btn-sm btn-whatsapp" title="WhatsApp" onclick="PageLeases.whatsapp(${r.id})">🟢</button>` : ''}
        ${canEdit ? `<button class="btn btn-sm btn-outline" title="Uploader le PDF signé" onclick="PageLeases.uploadContract(${r.id})">⬆</button>
        <button class="btn btn-sm btn-outline" onclick="PageLeases.edit(${r.id})">✏️</button>` : ''}
        ${Auth.hasRole('manager','dir_admin') ? `<button class="btn btn-sm btn-danger" onclick="PageLeases.remove(${r.id})">🗑</button>` : ''}`,
    });
    this._rows = {}; (data || []).forEach((r) => { this._rows[r.id] = r; });
  },

  pdf(id) { PDF.leaseContract(this._rows[id]); },
  whatsapp(id) {
    const l = this._rows[id];
    Communication.openWhatsApp({
      name: l.tenant?.user?.full_name, phone: l.tenant?.user?.phone,
      apartmentNumber: l.apartment?.apartment_number,
      propertyName: l.apartment?.property?.property_name,
      city: l.apartment?.property?.city, district: l.apartment?.property?.district,
      kind: 'contract',
    });
  },

  async create() {
    CrudPage.openForm({ title: 'Nouveau contrat', fields: await this.fields(),
      onSubmit: async (d) => { await API.post('/leases', d); Toast.success('Contrat créé'); PageLeases.render(); } });
  },
  async edit(id) {
    const r = (await API.get('/leases/' + id)).data;
    CrudPage.openForm({ title: 'Modifier contrat', fields: await this.fields(), values: r,
      onSubmit: async (d) => { await API.put('/leases/' + id, d); Toast.success('Mis à jour'); PageLeases.render(); } });
  },
  uploadContract(id) {
    Modal.open('Uploader le contrat PDF signé',
      '<div class="form-group"><label>Fichier PDF</label><input type="file" id="contractFile" class="form-control" accept="application/pdf"/></div>',
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button><button class="btn btn-primary" onclick="PageLeases.submitContract(${id})">Uploader</button>`);
  },
  async submitContract(id) {
    const file = document.getElementById('contractFile').files[0];
    if (!file) { Toast.error('Sélectionnez un fichier'); return; }
    const fd = new FormData(); fd.append('contract', file);
    try { await API.upload('/leases/' + id + '/contract', fd); Modal.close(); Toast.success('Contrat enregistré'); PageLeases.render(); }
    catch (e) { Toast.error(e.message); }
  },
  remove(id) { CrudPage.confirmDelete('/leases/' + id, () => PageLeases.render()); },
};
