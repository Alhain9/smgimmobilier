const PageEquipment = {
  register() { Router.register('equipment', () => this.render()); },
  fields(isEdit = false) {
    return [
      { name: 'equipment_name', label: 'Nom de l\'équipement', required: true },
      { name: 'quantity', label: 'Quantité', type: 'number', half: true },
      { name: 'price', label: 'Prix unitaire (FCFA)', type: 'number', half: true },
      { name: 'photo', label: isEdit ? 'Photo (Changer l\'image)' : 'Photo de l\'équipement (Obligatoire)', type: 'file', accept: 'image/*', required: !isEdit },
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
        { label: 'Photo', render: (r) => r.photo ? `<a href="${Helpers.fileUrl(r.photo)}" target="_blank"><img src="${Helpers.fileUrl(r.photo)}" style="width:48px; height:48px; object-fit:cover; border-radius:6px; border:1px solid var(--border-color);" /></a>` : '<span class="text-muted">📷 Aucune</span>' },
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
  create() {
    CrudPage.openForm({
      title: 'Nouvel équipement',
      fields: this.fields(false),
      onSubmit: async (d) => {
        const photoInput = document.getElementById('f_photo');
        const photoFile = photoInput ? photoInput.files[0] : null;
        if (!photoFile) {
          Toast.error('Une photo de l\'équipement est obligatoire.');
          throw new Error('Photo manquante');
        }
        const fd = new FormData();
        Object.keys(d).forEach(k => { if (d[k] != null) fd.append(k, d[k]); });
        fd.append('photo', photoFile);

        await API.upload('/equipment', fd);
        Toast.success('Équipement créé avec succès');
        PageEquipment.render();
      }
    });
  },
  async edit(id) {
    const r = (await API.get('/equipment/' + id)).data;
    CrudPage.openForm({
      title: 'Modifier équipement',
      fields: this.fields(true),
      values: r,
      onSubmit: async (d) => {
        const photoInput = document.getElementById('f_photo');
        const photoFile = photoInput ? photoInput.files[0] : null;

        if (photoFile) {
          const fd = new FormData();
          Object.keys(d).forEach(k => { if (d[k] != null) fd.append(k, d[k]); });
          fd.append('photo', photoFile);
          await API.upload('/equipment/' + id, fd, 'PUT');
        } else {
          await API.put('/equipment/' + id, d);
        }
        Toast.success('Mis à jour avec succès');
        PageEquipment.render();
      }
    });
  },
  remove(id) { CrudPage.confirmDelete('/equipment/' + id, () => PageEquipment.render()); },
};
