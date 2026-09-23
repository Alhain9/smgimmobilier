const PageApartments = {
  register() { Router.register('apartments', () => this.render()); },
  _properties: [],
  async fields() {
    this._properties = (await API.get('/properties')).data;
    return [
      { name: 'property_id', label: 'Immeuble', type: 'select', required: true, options: this._properties.map((p) => ({ value: p.id, label: p.property_name })) },
      { name: 'apartment_number', label: 'Numéro', required: true, half: true },
      { name: 'apartment_type', label: 'Type de logement', type: 'select', half: true, options: [
        { value: 'appartement', label: 'Appartement' }, { value: 'studio', label: 'Studio' },
        { value: 'chambre', label: 'Chambre' }, { value: 'duplex', label: 'Duplex' },
        { value: 'villa', label: 'Villa' }, { value: 'boutique', label: 'Boutique' },
        { value: 'bureau', label: 'Bureau' }, { value: 'magasin', label: 'Magasin' },
        { value: 'espace_commercial', label: 'Espace commercial' },
      ] },
      { name: 'floor', label: 'Étage', type: 'number', half: true },
      { name: 'rent_amount', label: 'Loyer (FCFA)', type: 'number', required: true, half: true },
      { name: 'status', label: 'Statut', type: 'select', options: [
        { value: 'free', label: 'Libre' }, { value: 'occupied', label: 'Occupé' },
        { value: 'maintenance', label: 'En maintenance' }, { value: 'reserved', label: 'Réservé' },
      ] },
      { name: 'description', label: 'Description', type: 'textarea' },
    ];
  },
  async render() {
    const canEdit = Auth.hasRole('manager', 'dir_admin', 'gestionnaire');
    await CrudPage.list({
      endpoint: '/apartments', title: 'Logements',
      canCreate: canEdit, onCreate: 'PageApartments.create',
      toolbar: canEdit ? `<div class="mb-3"><button class="btn btn-outline" onclick="PageProperties.openImportModal()">📤 Importer la situation (Excel)</button></div>` : '',
      columns: [
        { label: 'Numéro', render: (r) => `<b>${r.apartment_number}</b>` },
        { label: 'Type', render: (r) => r.apartment_type || '—' },
        { label: 'Immeuble', render: (r) => r.property ? r.property.property_name : '—' },
        { label: 'Loyer', render: (r) => Helpers.formatMoney(r.rent_amount) },
        { label: 'Locataire', render: (r) => (r.tenants && r.tenants[0] && r.tenants[0].user) ? r.tenants[0].user.full_name : '—' },
        { label: 'Statut', render: (r) => Helpers.statusBadge(r.status) },
      ],
      rowActions: canEdit ? (r) => `
        <button class="btn btn-sm btn-outline" onclick="PageApartments.edit(${r.id})">✏️</button>
        ${Auth.hasRole('manager') ? `<button class="btn btn-sm btn-danger" onclick="PageApartments.remove(${r.id})">🗑</button>` : ''}` : null,
    });
  },
  async create() { CrudPage.openForm({ title: 'Nouveau logement', fields: await this.fields(), onSubmit: async (d) => { await API.post('/apartments', d); Toast.success('Créé'); PageApartments.render(); } }); },
  async edit(id) { const r = (await API.get('/apartments/' + id)).data; CrudPage.openForm({ title: 'Modifier le logement', fields: await this.fields(), values: r, onSubmit: async (d) => { await API.put('/apartments/' + id, d); Toast.success('Mis à jour'); PageApartments.render(); } }); },
  remove(id) { CrudPage.confirmDelete('/apartments/' + id, () => PageApartments.render()); },
};
