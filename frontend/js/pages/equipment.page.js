const PageEquipment = {
  register() { Router.register('equipment', () => this.render()); },
  fields() {
    return [
      { name: 'equipment_name', label: 'Nom', required: true },
      { name: 'quantity', label: 'Quantité', type: 'number', half: true },
      { name: 'price', label: 'Prix unitaire (FCFA)', type: 'number', half: true },
      { name: 'status', label: 'Statut', type: 'select', options: [
        { value: 'available', label: 'Disponible' }, { value: 'in_use', label: 'Utilisé' },
        { value: 'out_of_stock', label: 'Rupture de stock' }, { value: 'maintenance', label: 'En maintenance' }] },
    ];
  },
  async render() {
    const canEdit = Auth.hasRole('manager', 'dir_technique', 'comptable');
    await CrudPage.list({
      endpoint: '/equipment', title: 'Équipements & matériels',
      canCreate: canEdit, onCreate: 'PageEquipment.create',
      columns: [
        { label: 'Nom', render: (r) => `<b>${r.equipment_name}</b>` },
        { label: 'Quantité', render: (r) => r.quantity },
        { label: 'Prix unit.', render: (r) => Helpers.formatMoney(r.price) },
        { label: 'Valeur stock', render: (r) => Helpers.formatMoney(r.quantity * r.price) },
        { label: 'Statut', render: (r) => Helpers.statusBadge(r.status) },
      ],
      rowActions: canEdit ? (r) => `
        <button class="btn btn-sm btn-outline" onclick="PageEquipment.edit(${r.id})">✏️</button>
        ${Auth.hasRole('manager','dir_technique') ? `<button class="btn btn-sm btn-danger" onclick="PageEquipment.remove(${r.id})">🗑</button>` : ''}` : null,
    });
  },
  create() { CrudPage.openForm({ title: 'Nouvel équipement', fields: this.fields(), onSubmit: async (d) => { await API.post('/equipment', d); Toast.success('Créé'); PageEquipment.render(); } }); },
  async edit(id) { const r = (await API.get('/equipment/' + id)).data; CrudPage.openForm({ title: 'Modifier équipement', fields: this.fields(), values: r, onSubmit: async (d) => { await API.put('/equipment/' + id, d); Toast.success('Mis à jour'); PageEquipment.render(); } }); },
  remove(id) { CrudPage.confirmDelete('/equipment/' + id, () => PageEquipment.render()); },
};
