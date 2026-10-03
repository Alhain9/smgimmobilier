const PageApartments = {
  register() { Router.register('apartments', () => this.render()); },
  _showAll: false,
  toggleShowAll() {
    this._showAll = !this._showAll;
    this.render();
  },

  async fields() {
    this._properties = (await API.get('/properties')).data || [];
    return [
      {
        name: 'property_id', label: 'Immeuble', type: 'select', required: true,
        options: this._properties.map((p) => ({
          value: p.id,
          label: `${p.is_assigned ? '★ ' : ''}${p.property_name}${p.is_assigned ? ' (Mon immeuble)' : ''}`
        }))
      },
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
    const canEdit = Auth.hasRole('manager', 'dir_admin', 'gestionnaire', 'comptable');
    const isRestrictedRole = Auth.hasRole('comptable', 'gestionnaire') && !Auth.hasRole('manager', 'super_admin');

    let rawApts = [];
    try {
      const res = await API.get('/apartments');
      rawApts = res.data || [];
    } catch (_) { rawApts = []; }

    const assignedCount = rawApts.filter((a) => a.is_assigned).length;
    const othersCount = rawApts.length - assignedCount;
    const hasAssigned = assignedCount > 0;

    let filterBanner = '';
    if (isRestrictedRole && hasAssigned) {
      if (!this._showAll) {
        filterBanner = `
          <div style="background:#e8f5e9;border:1px solid #c8e6c9;padding:10px 16px;border-radius:8px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
            <div style="font-size:13px;color:#1b5e20;font-weight:600">
              🚪 <b>Affichage prioritaire :</b> Vous visualisez les <b>${assignedCount}</b> logement(s) de vos immeubles. ${othersCount > 0 ? `(${othersCount} autre(s) logement(s) masqué(s))` : ''}
            </div>
            ${othersCount > 0 ? `
              <button class="btn btn-sm btn-outline" style="border-color:#2e7d32;color:#1b5e20" onclick="PageApartments.toggleShowAll()">
                👁️ Afficher tous les logements (démasquer)
              </button>
            ` : ''}
          </div>
        `;
      } else {
        filterBanner = `
          <div style="background:#fff3cd;border:1px solid #ffeeba;padding:10px 16px;border-radius:8px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
            <div style="font-size:13px;color:#856404;font-weight:600">
              👁️ <b>Tous les logements sont visibles :</b> Ceux de vos immeubles assignés sont placés en tête de liste.
            </div>
            <button class="btn btn-sm btn-primary" onclick="PageApartments.toggleShowAll()">
              🔒 Masquer les autres logements
            </button>
          </div>
        `;
      }
    }

    const toolbar = `
      ${filterBanner}
      ${canEdit ? `<div class="mb-3"><button class="btn btn-outline" onclick="PageProperties.openImportModal()">📤 Importer la situation (Excel)</button></div>` : ''}
    `;

    await CrudPage.list({
      endpoint: '/apartments', title: 'Logements',
      canCreate: canEdit, onCreate: 'PageApartments.create',
      toolbar,
      mapData: (all) => {
        if (!isRestrictedRole || !hasAssigned || this._showAll) return all;
        return all.filter((a) => a.is_assigned);
      },
      columns: [
        { label: 'Numéro', render: (r) => `<b>${r.apartment_number}</b>` },
        { label: 'Type', render: (r) => r.apartment_type || '—' },
        {
          label: 'Immeuble',
          render: (r) => {
            const pName = r.property ? r.property.property_name : '—';
            const badge = r.is_assigned
              ? `<span style="display:inline-block;background:#d4edda;color:#155724;font-size:10px;font-weight:700;padding:1px 6px;border-radius:20px;margin-left:4px">★ Mon immeuble</span>`
              : (isRestrictedRole && hasAssigned ? `<span style="display:inline-block;background:#f1f5f9;color:#64748b;font-size:10px;font-weight:600;padding:1px 6px;border-radius:20px;margin-left:4px">Autre</span>` : '');
            return `<b>${pName}</b>${badge}`;
          },
        },
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
