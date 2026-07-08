const PagePayments = {
  register() { Router.register('payments', () => this.render()); },
  _tenants: [], _apartments: [], _rows: {},

  // Construit le contexte de communication/PDF depuis un paiement
  ctxOf(p) {
    return {
      name: p.tenant?.user?.full_name,
      phone: p.tenant?.user?.phone,
      apartmentType: p.apartment?.apartment_type,
      apartmentNumber: p.apartment?.apartment_number,
      propertyName: p.apartment?.property?.property_name,
      city: p.apartment?.property?.city,
      district: p.apartment?.property?.district,
      amount: p.amount,
      dueDate: p.payment_date,
      kind: 'relance',
    };
  },
  whatsapp(id) { Communication.openWhatsApp(this.ctxOf(this._rows[id])); },
  call(id) { Communication.call(this._rows[id]?.tenant?.user?.phone); },
  pdfReceipt(id) { PDF.paymentReceipt(this._rows[id]); },
  pdfInvoice(id) { PDF.invoice(this._rows[id]); },
  pdfReminder(id) { PDF.paymentReminder(this.ctxOf(this._rows[id])); },

  async fields() {
    this._tenants = (await API.get('/tenants')).data;
    this._apartments = (await API.get('/apartments')).data;
    return [
      { name: 'tenant_id', label: 'Locataire', type: 'select', required: true, options: this._tenants.map((t) => ({ value: t.id, label: t.user?.full_name || ('Locataire #' + t.id), apt: t.apartment_id })) },
      { name: 'apartment_id', label: 'Logement', type: 'select', options: [{ value: '', label: '— Aucun —' }].concat(this._apartments.map((a) => ({ value: a.id, label: a.apartment_number }))) },
      { name: 'amount', label: 'Montant (FCFA)', type: 'number', required: true, half: true },
      { name: 'payment_date', label: 'Date de paiement', type: 'date', required: true, half: true },
      { name: 'payment_method', label: 'Méthode', type: 'select', options: [
        { value: 'orange_money', label: 'Orange Money' }, { value: 'mtn_mobile_money', label: 'MTN MoMo' },
        { value: 'bank_transfer', label: 'Virement bancaire' }, { value: 'cash', label: 'Espèces' },
        { value: 'kang', label: 'Mobile Money (Kang)' }] },
      { name: 'status', label: 'Statut', type: 'select', options: [
        { value: 'completed', label: 'Payé' }, { value: 'pending', label: 'En attente' },
        { value: 'awaiting_confirmation', label: 'À vérifier' },
        { value: 'failed', label: 'Échoué' }, { value: 'refunded', label: 'Remboursé' }] },
    ];
  },
  async render() {
    const canEdit = Auth.hasRole('manager', 'comptable');
    const canContact = Auth.hasRole('manager', 'comptable', 'dir_admin', 'gestionnaire');
    const data = await CrudPage.list({
      endpoint: '/payments', title: 'Paiements',
      canCreate: canEdit, onCreate: 'PagePayments.create',
      toolbar: '<div class="toolbar"><button class="btn btn-outline" onclick="Router.go(\'payments\')">Tous</button><button class="btn btn-outline" onclick="PagePayments.showDebts()">🔴 Voir les impayés</button></div>',
      columns: [
        { label: 'Locataire', render: (r) => r.tenant?.user ? r.tenant.user.full_name : '—' },
        { label: 'Immeuble', render: (r) => r.apartment?.property
          ? `${r.apartment.property.property_name}${r.apartment.property.city ? `<br><span class="text-muted" style="font-size:12px">${r.apartment.property.city}</span>` : ''}`
          : '—' },
        { label: 'Logement', render: (r) => r.apartment
          ? `${r.apartment.apartment_number}${r.apartment.apartment_type ? `<br><span class="text-muted" style="font-size:12px">${r.apartment.apartment_type}</span>` : ''}`
          : '—' },
        { label: 'Montant', render: (r) => Helpers.formatMoney(r.amount) },
        { label: 'Date', render: (r) => Helpers.formatDate(r.payment_date) },
        { label: 'Méthode', render: (r) => Helpers.methodLabel(r.payment_method) },
        { label: 'Statut', render: (r) => Helpers.statusBadge(r.status) },
        { label: 'Preuve', render: (r) => r.payment_proof ? `<a href="${Helpers.fileUrl(r.payment_proof)}" target="_blank">📎 Voir</a>` : '—' },
      ],
      rowActions: (r) => `
        ${canContact && r.status === 'awaiting_confirmation' ? `<button class="btn btn-sm btn-success" title="Valider" onclick="PagePayments.verify(${r.id},'completed')">✅</button>
        <button class="btn btn-sm btn-danger" title="Rejeter" onclick="PagePayments.verify(${r.id},'failed')">❌</button>` : ''}
        ${canContact ? `<button class="btn btn-sm btn-whatsapp" title="WhatsApp" onclick="PagePayments.whatsapp(${r.id})">🟢</button>
        <button class="btn btn-sm btn-outline" title="Appeler" onclick="PagePayments.call(${r.id})">📞</button>` : ''}
        <button class="btn btn-sm btn-outline" title="${r.status === 'completed' ? 'Reçu PDF' : 'Rappel PDF'}" onclick="PagePayments.${r.status === 'completed' ? 'pdfReceipt' : 'pdfReminder'}(${r.id})">📄</button>
        ${r.tenant?.id ? `<button class="btn btn-sm btn-outline" title="Relevé de compte" onclick="PageSituation.ledger(${r.tenant.id})">📋</button>` : ''}
        ${canEdit ? `<button class="btn btn-sm btn-outline" onclick="PagePayments.uploadProof(${r.id})">⬆</button>
        <button class="btn btn-sm btn-outline" onclick="PagePayments.edit(${r.id})">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="PagePayments.remove(${r.id})">🗑</button>` : ''}`,
    });
    this._rows = {}; (data || []).forEach((r) => { this._rows[r.id] = r; });
  },
  async showDebts() {
    Layout.setTitle('Impayés');
    const { data } = await API.get('/payments/debts');
    this._rows = {}; data.forEach((r) => { this._rows[r.id] = r; });
    const canContact = Auth.hasRole('manager', 'comptable', 'dir_admin', 'gestionnaire');
    const rows = data.map((p) => `<tr>
      <td>${p.tenant?.user?.full_name || '—'}</td>
      <td>${p.apartment?.property?.property_name || '—'}</td>
      <td>${p.apartment?.apartment_number || '—'}${p.apartment?.apartment_type ? ' · ' + p.apartment.apartment_type : ''}</td>
      <td>${Helpers.formatMoney(p.amount)}</td>
      <td>${Helpers.formatDate(p.payment_date)}</td>
      <td>${Helpers.statusBadge(p.status)}</td>
      <td>${canContact ? `<button class="btn btn-sm btn-whatsapp" onclick="PagePayments.whatsapp(${p.id})">🟢 Relancer</button>
        <button class="btn btn-sm btn-outline" onclick="PagePayments.call(${p.id})">📞</button>` : ''}
        <button class="btn btn-sm btn-outline" onclick="PagePayments.pdfReminder(${p.id})">📄</button></td>
    </tr>`).join('') || '<tr><td colspan="7" class="text-center text-muted">Aucun impayé 🎉</td></tr>';
    Layout.content(`<div class="page-head"><h2>🔴 Impayés & relances</h2><button class="btn btn-outline" onclick="Router.go('payments')">← Retour</button></div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Locataire</th><th>Immeuble</th><th>Logement</th><th>Montant</th><th>Date</th><th>Statut</th><th>Relance</th></tr></thead><tbody>${rows}</tbody></table></div></div>`);
  },
  async create() {
    CrudPage.openForm({ title: 'Nouveau paiement', fields: await this.fields(),
      onSubmit: async (d) => { if (!d.apartment_id) delete d.apartment_id; await API.post('/payments', d); Toast.success('Paiement enregistré'); PagePayments.render(); } });
  },
  async edit(id) {
    const r = (await API.get('/payments/' + id)).data;
    CrudPage.openForm({ title: 'Modifier paiement', fields: await this.fields(), values: r,
      onSubmit: async (d) => { if (!d.apartment_id) delete d.apartment_id; await API.put('/payments/' + id, d); Toast.success('Mis à jour'); PagePayments.render(); } });
  },
  uploadProof(id) {
    Modal.open('Uploader le justificatif', '<div class="form-group"><label>Reçu (image ou PDF)</label><input type="file" id="proofFile" class="form-control" accept="image/*,application/pdf"/></div>',
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button><button class="btn btn-primary" onclick="PagePayments.submitProof(${id})">Uploader</button>`);
  },
  async submitProof(id) {
    const file = document.getElementById('proofFile').files[0];
    if (!file) { Toast.error('Sélectionnez un fichier'); return; }
    const fd = new FormData(); fd.append('proof', file);
    try { await API.upload('/payments/' + id + '/proof', fd); Modal.close(); Toast.success('Justificatif enregistré'); PagePayments.render(); } catch (e) { Toast.error(e.message); }
  },
  remove(id) { CrudPage.confirmDelete('/payments/' + id, () => PagePayments.render()); },
  async verify(id, decision) {
    try {
      await API.patch('/payments/' + id + '/verify', { decision });
      Toast.success(decision === 'completed' ? 'Paiement validé' : 'Paiement rejeté');
      PagePayments.render();
    } catch (e) { Toast.error(e.message); }
  },
};
