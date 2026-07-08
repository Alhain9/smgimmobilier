const PageExpenses = {
  register() { Router.register('expenses', () => this.render()); },
  _maintenances: [],
  async fields() {
    this._maintenances = (await API.get('/maintenance')).data;
    return [
      { name: 'maintenance_id', label: 'Maintenance liée', type: 'select', required: true, options: this._maintenances.map((m) => ({ value: m.id, label: `${m.title} (${m.apartment?.apartment_number || ''})` })) },
      { name: 'item_name', label: 'Nom équipement / matériel', required: true, half: true },
      { name: 'category', label: 'Catégorie', half: true, placeholder: 'Plomberie, peinture...' },
      { name: 'quantity', label: 'Quantité', type: 'number', default: 1, half: true },
      { name: 'unit_price', label: 'Prix unitaire (FCFA)', type: 'number', half: true },
      { name: 'supplier', label: 'Fournisseur' },
    ];
  },
  async render() {
    const canEdit = Auth.hasRole('manager', 'comptable', 'dir_technique');
    await CrudPage.list({
      endpoint: '/expenses', title: 'Dépenses',
      canCreate: canEdit, onCreate: 'PageExpenses.create',
      columns: [
        { label: 'Équipement', render: (r) => `<b>${r.item_name}</b>${r.category ? `<br><span class="text-muted" style="font-size:12px">${r.category}</span>` : ''}` },
        { label: 'Maintenance', render: (r) => r.maintenance ? r.maintenance.title : '—' },
        { label: 'Fournisseur', render: (r) => r.supplier || '—' },
        { label: 'Qté', render: (r) => r.quantity },
        { label: 'Prix unit.', render: (r) => Helpers.formatMoney(r.unit_price) },
        { label: 'Total', render: (r) => Helpers.formatMoney(r.total_price) },
      ],
      rowActions: canEdit ? (r) => `
        <button class="btn btn-sm btn-outline" onclick="PageExpenses.edit(${r.id})">✏️</button>
        ${Auth.hasRole('manager','comptable') ? `<button class="btn btn-sm btn-danger" onclick="PageExpenses.remove(${r.id})">🗑</button>` : ''}` : null,
    });
  },
  async create() { CrudPage.openForm({ title: 'Nouvelle dépense', fields: await this.fields(), onSubmit: async (d) => { await API.post('/expenses', d); Toast.success('Créée'); PageExpenses.render(); } }); },
  async edit(id) { const r = (await API.get('/expenses/' + id)).data; CrudPage.openForm({ title: 'Modifier dépense', fields: await this.fields(), values: r, onSubmit: async (d) => { await API.put('/expenses/' + id, d); Toast.success('Mis à jour'); PageExpenses.render(); } }); },
  remove(id) { CrudPage.confirmDelete('/expenses/' + id, () => PageExpenses.render()); },
};
