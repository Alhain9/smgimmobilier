const PageTenants = {
  register() { Router.register('tenants', () => this.render()); },
  _rows: {},
  ctxOf(t) {
    return {
      name: t.full_name, phone: t.phone,
      apartmentNumber: t.apartment?.apartment_number,
      kind: 'generic',
    };
  },
  whatsapp(id) { Communication.openWhatsApp(this.ctxOf(this._rows[id])); },
  call(id) { Communication.call(this._rows[id]?.phone); },


  fields(isEdit = false) {
    return [
      { name: 'full_name', label: 'Nom complet', required: true },
      { name: 'phone', label: 'Téléphone', required: true, half: true },
      { name: 'email', label: 'Email (pour connexion)', type: 'email', required: true, half: true },
      { name: 'password', label: isEdit ? 'Nouveau mot de passe (laisser vide)' : 'Mot de passe', type: 'password', required: false, half: true, placeholder: isEdit ? 'Laisser vide pour ne pas modifier...' : 'Par défaut: loc123' },
      { name: 'cni', label: 'Numéro CNI', half: true },
      { name: 'profession', label: 'Profession', half: true },
      { name: 'emergency_contact', label: 'Contact d\'urgence' }
    ];
  },

  async render() {
    const data = await CrudPage.list({
      endpoint: '/tenants', title: 'Locataires',
      canCreate: true, onCreate: 'PageTenants.create',
      columns: [
        { label: 'Nom', render: (r) => `<div class="flex items-center gap-3">
          <div class="user-avatar" style="width:34px;height:34px;font-size:13px">${Helpers.initials(r.full_name)}</div><b>${r.full_name}</b></div>` },
        { label: 'Téléphone', render: (r) => r.phone || '—' },
        { label: 'Logement', render: (r) => r.apartment
          ? `<b>${r.apartment.apartment_number}</b>${r.apartment.apartment_type ? `<br><span class="text-muted" style="font-size:12px">${r.apartment.apartment_type}</span>` : ''}`
          : '<span class="text-muted">Non attribué</span>' },
        { label: 'Immeuble', render: (r) => r.apartment?.property
          ? `${r.apartment.property.property_name}${r.apartment.property.city ? `<br><span class="text-muted" style="font-size:12px">${r.apartment.property.city}</span>` : ''}`
          : '—' },
        { label: 'Compte', render: (r) => r.user ? '<span class="badge badge-success">Oui</span>' : '<span class="badge badge-muted">Non</span>' },
        { label: 'Statut', render: (r) => Helpers.statusBadge(r.status) },
      ],
      rowActions: (r) => `
        <button class="btn btn-sm btn-whatsapp" title="WhatsApp" onclick="PageTenants.whatsapp(${r.id})">🟢</button>
        <button class="btn btn-sm btn-outline" title="Appeler" onclick="PageTenants.call(${r.id})">📞</button>
        <button class="btn btn-sm btn-outline" title="Dossier complet" onclick="PageTenants.view(${r.id})">👁</button>
        <button class="btn btn-sm btn-outline" title="Modifier" onclick="PageTenants.edit(${r.id})">✏️</button>
        <button class="btn btn-sm btn-danger" title="Supprimer" onclick="PageTenants.remove(${r.id})">🗑</button>`,
    });
    this._rows = {}; (data || []).forEach((r) => { this._rows[r.id] = r; });
  },

  create() {
    CrudPage.openForm({ title: 'Nouveau locataire', fields: this.fields(false),
      onSubmit: async (data) => { await API.post('/tenants', data); Toast.success('Créé'); PageTenants.render(); } });
  },
  async edit(id) {
    const r = (await API.get('/tenants/' + id)).data;
    CrudPage.openForm({ title: 'Modifier locataire', fields: this.fields(true), values: r,
      onSubmit: async (data) => { await API.put('/tenants/' + id, data); Toast.success('Mis à jour'); PageTenants.render(); } });
  },
  async view(id) {
    const r = (await API.get('/tenants/' + id)).data;
    const apt = r.apartment;
    const logement = apt ? `
      <div class="list-item"><div style="flex:1">Logement</div><b>${apt.apartment_number}${apt.apartment_type ? ' · ' + apt.apartment_type : ''}</b></div>
      <div class="list-item"><div style="flex:1">Immeuble</div><b>${apt.property?.property_name || '—'}${apt.property?.city ? ' (' + apt.property.city + ')' : ''}</b></div>
      ${apt.floor != null ? `<div class="list-item"><div style="flex:1">Étage</div><b>${apt.floor}</b></div>` : ''}
      ${apt.rent_amount ? `<div class="list-item"><div style="flex:1">Loyer du logement</div><b>${Helpers.formatMoney(apt.rent_amount)}</b></div>` : ''}`
      : '<p class="text-muted">Aucun logement attribué</p>';

    const leases = (r.leases || []).map((l) => {
      let renewBtn = '';
      if (l.status === 'active' || l.status === 'expired' || l.status === 'terminated') {
        renewBtn = `<button class="btn btn-sm btn-outline" title="Renouveler le bail" onclick="PageTenants.renewLease(${l.id}, ${r.id})">🔄 Renouveler</button>`;
      }
      return `
        <div class="list-item" style="flex-direction: column; align-items: stretch; gap: 6px; padding: 12px 0; border-bottom: 1px solid var(--border);">
          <div class="flex items-center justify-between">
            <div style="flex:1">
              Bail #${l.id} — <b>${l.apartment?.apartment_number || '—'}</b>${l.apartment?.property ? ' · ' + l.apartment.property.property_name : ''}<br>
              <span class="text-muted" style="font-size:12px">${Helpers.formatMoney(l.monthly_rent)}/mois · caution ${Helpers.formatMoney(l.deposit_amount)}${l.start_date ? ' · dès ' + Helpers.formatDate(l.start_date) : ''}</span>
            </div>
            <div class="flex items-center gap-2">
              ${Helpers.statusBadge(l.status)}
              ${l.contract_file ? `<a class="btn btn-sm btn-outline" href="${Helpers.fileUrl(l.contract_file)}" target="_blank">📄</a>` : ''}
            </div>
          </div>
          ${renewBtn ? `
            <div class="flex justify-between items-center mt-1" style="border-top:1px dashed var(--border); padding-top:6px;">
              <span style="font-size:12px;" class="text-muted">Nouvelle période ?</span>
              ${renewBtn}
            </div>` : ''}
        </div>`;
    }).join('') || '<p class="text-muted">Aucun bail</p>';

    const payments = r.payments || [];
    const paid = payments.filter((p) => p.status === 'completed').length;
    const unpaid = payments.filter((p) => ['pending', 'failed', 'awaiting_confirmation'].includes(p.status)).length;
    const last = payments.slice().sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))[0];

    Modal.open('Fiche locataire — ' + r.full_name, `
      <div class="list-item"><div style="flex:1">Téléphone</div><b>${r.phone || '—'}</b></div>
      <div class="list-item"><div style="flex:1">Email</div><b>${r.email || '—'}</b></div>
      <div class="list-item"><div style="flex:1">Profession</div><b>${r.profession || '—'}</b></div>
      <div class="list-item"><div style="flex:1">CNI</div><b>${r.cni || '—'}</b></div>
      <h4 style="margin:16px 0 8px">🏠 Logement & immeuble</h4>${logement}
      <h4 style="margin:16px 0 8px">📄 Contrats de bail</h4>${leases}
      <h4 style="margin:16px 0 8px">💰 Paiements</h4>
      <div class="list-item"><div style="flex:1">Payés</div><b>${paid}</b></div>
      <div class="list-item"><div style="flex:1">En attente / impayés</div><b>${unpaid}</b></div>
      ${last ? `<div class="list-item"><div style="flex:1">Dernier paiement</div><b>${Helpers.formatMoney(last.amount)} · ${Helpers.formatDate(last.payment_date)}</b></div>` : ''}`,
      `<button class="btn btn-outline" onclick="Modal.close()">Fermer</button>
       ${Auth.hasRole('manager','dir_admin','gestionnaire') ? `<button class="btn btn-primary" onclick="Modal.close();PageTenants.edit(${r.id})">✏️ Modifier la fiche</button>` : ''}`);
  },
  
  renewLease(leaseId, tenantId) {
    Modal.open('Renouveler le contrat de bail', `
      <div class="form-group"><label>Nouveau loyer mensuel (FCFA)</label>
        <input type="number" class="form-control" id="renew_rent" required placeholder="Loyer ajusté..."/></div>
      <div class="form-group"><label>Nouvelle date d'échéance (fin de contrat)</label>
        <input type="date" class="form-control" id="renew_end_date" required/></div>`,
      `<button class="btn btn-outline" onclick="PageTenants.view(${tenantId})">Annuler</button>
       <button class="btn btn-primary" onclick="PageTenants.submitRenewLease(${leaseId}, ${tenantId})">Confirmer le renouvellement</button>`);
  },
  
  async submitRenewLease(leaseId, tenantId) {
    const end_date = document.getElementById('renew_end_date').value;
    const monthly_rent = parseFloat(document.getElementById('renew_rent').value) || 0;
    
    if (!end_date) { Toast.error('Date d\'échéance requise'); return; }
    if (monthly_rent <= 0) { Toast.error('Loyer invalide'); return; }
    
    try {
      await API.post(`/leases/${leaseId}/renew`, { end_date, monthly_rent });
      Toast.success('Bail renouvelé avec succès');
      PageTenants.view(tenantId);
    } catch(e) {
      Toast.error(e.message);
    }
  },

  remove(id) { CrudPage.confirmDelete('/tenants/' + id, () => PageTenants.render()); },
};
