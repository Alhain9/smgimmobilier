const PageMaintenance = {
  register() { Router.register('maintenance', () => this.render()); },
  _apartments: [], _technicians: [], _rows: {},
  async loadRefs() {
    this._apartments = (await API.get('/apartments')).data;
    try { this._technicians = (await API.get('/users/technicians')).data; } catch { this._technicians = []; }
  },
  async fields() {
    await this.loadRefs();
    return [
      { name: 'apartment_id', label: 'Logement', type: 'select', required: true, options: this._apartments.map((a) => ({ value: a.id, label: `${a.apartment_number} (${a.property?.property_name || ''})` })) },
      { name: 'title', label: 'Titre', required: true },
      { name: 'priority', label: 'Priorité', type: 'select', options: [
        { value: 'low', label: 'Basse' }, { value: 'medium', label: 'Normale' }, { value: 'high', label: 'Haute' }, { value: 'urgent', label: 'Urgente' }] },
      { name: 'photo', label: 'Photo du problème (Obligatoire)', type: 'file', accept: 'image/*', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
    ];
  },
  async render() {
    const canCreate = Auth.hasRole('manager', 'dir_technique', 'gestionnaire', 'dir_admin');
    const data = await CrudPage.list({
      endpoint: '/maintenance', title: 'Maintenances',
      canCreate, onCreate: 'PageMaintenance.create',
      columns: [
        { label: 'Titre', render: (r) => `<b>${r.title}</b>` },
        { label: 'Immeuble', render: (r) => r.apartment?.property
          ? `${r.apartment.property.property_name}<br><span class="text-muted" style="font-size:12px">Logt ${r.apartment.apartment_number}</span>`
          : (r.apartment ? `Logt ${r.apartment.apartment_number}` : '—') },
        { label: 'Priorité', render: (r) => Helpers.priorityBadge(r.priority) },
        { label: 'Équipe', render: (r) => {
          const n = (r.team || []).length;
          const lead = r.technician ? r.technician.full_name : null;
          if (!n && !lead) return '<span class="text-muted">Non assigné</span>';
          return `${lead ? `<b>${lead}</b>` : ''}${n ? `<br><span class="text-muted" style="font-size:12px">👷 ${n} technicien${n > 1 ? 's' : ''}</span>` : ''}`;
        } },
        { label: 'Statut', render: (r) => Helpers.maintStatus(r.status) },
      ],
      rowActions: (r) => `
        <button class="btn btn-sm btn-outline" onclick="PageMaintenance.view(${r.id})">👁</button>
        ${Auth.hasRole('manager','dir_technique','comptable') ? `<button class="btn btn-sm btn-outline" title="Générer un devis" onclick="PageMaintenance.quote(${r.id})">🧾</button>` : ''}
        ${Auth.hasRole('manager','dir_technique') ? `<button class="btn btn-sm btn-outline" onclick="PageMaintenance.assign(${r.id})">👷</button>` : ''}
        ${Auth.hasRole('manager','dir_technique','technicien','gestionnaire') ? `<button class="btn btn-sm btn-outline" onclick="PageMaintenance.updateStatus(${r.id},'${r.status}')">🔄</button>` : ''}`,
    });
    this._rows = {}; (data || []).forEach((r) => { this._rows[r.id] = r; });
  },

  // ---- Générateur de devis (traçabilité + PDF) ----
  quote(id) {
    const m = this._rows[id];
    const u = Auth.getUser();
    Modal.open('Générer un devis — ' + (m?.title || ''), `
      <div class="form-row">
        <div class="form-group"><label>Créé par</label><input class="form-control" id="qCreator" value="${u ? u.full_name : ''}" /></div>
        <div class="form-group"><label>Rôle</label><input class="form-control" id="qRole" value="${ROLE_LABELS[Auth.getRole()] || ''}" readonly /></div>
      </div>
      <div class="form-group"><label>Description des travaux</label><textarea class="form-control" id="qDesc" rows="2">${m?.title || ''}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Durée estimée</label><input class="form-control" id="qDuration" placeholder="ex: 2 jours" /></div>
        <div class="form-group"><label>Main d'œuvre (FCFA)</label><input type="number" class="form-control" id="qLabor" value="0" /></div>
      </div>
      <label style="font-weight:600;font-size:13px">Matériaux</label>
      <div id="qItems"></div>
      <button type="button" class="btn btn-sm btn-outline mt-2" onclick="PageMaintenance.addQuoteRow()">+ Ajouter un matériau</button>
      <div class="form-group" style="margin-top:14px"><label>Observations</label><textarea class="form-control" id="qNotes" rows="2"></textarea></div>`,
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
       <button class="btn btn-primary" onclick="PageMaintenance.submitQuote(${id})">📄 Générer le PDF</button>`);
    this.addQuoteRow();
  },
  addQuoteRow() {
    const wrap = document.getElementById('qItems');
    const div = document.createElement('div');
    div.className = 'form-row qrow'; div.style.gap = '8px'; div.style.alignItems = 'end';
    div.innerHTML = `
      <div class="form-group" style="margin-bottom:8px"><input class="form-control q-name" placeholder="Matériau" /></div>
      <div class="form-group" style="margin-bottom:8px;max-width:70px"><input type="number" class="form-control q-qty" placeholder="Qté" value="1" /></div>
      <div class="form-group" style="margin-bottom:8px;max-width:110px"><input type="number" class="form-control q-price" placeholder="Prix u." value="0" /></div>`;
    wrap.appendChild(div);
  },
  submitQuote(id) {
    const m = this._rows[id];
    const items = Array.from(document.querySelectorAll('#qItems .qrow')).map((row) => ({
      name: row.querySelector('.q-name').value || '—',
      qty: parseFloat(row.querySelector('.q-qty').value) || 0,
      unitPrice: parseFloat(row.querySelector('.q-price').value) || 0,
    })).filter((it) => it.name !== '—' || it.qty);
    PDF.quote({
      creatorName: document.getElementById('qCreator').value,
      creatorRole: document.getElementById('qRole').value,
      propertyName: m?.apartment?.property?.property_name,
      apartmentNumber: m?.apartment?.apartment_number,
      description: document.getElementById('qDesc').value,
      duration: document.getElementById('qDuration').value,
      labor: document.getElementById('qLabor').value,
      notes: document.getElementById('qNotes').value,
      items,
    });
    Modal.close();
  },
  async create() {
    CrudPage.openForm({
      title: 'Nouveau ticket maintenance',
      fields: await this.fields(),
      onSubmit: async (d) => {
        const fileInput = document.getElementById('f_photo');
        const file = fileInput ? fileInput.files[0] : null;
        if (!file) {
          Toast.error('Une photo du problème est obligatoire');
          throw new Error('Photo manquante');
        }
        const fd = new FormData();
        Object.keys(d).forEach((k) => { if (d[k] != null) fd.append(k, d[k]); });
        fd.append('photo', file);
        await API.upload('/maintenance', fd);
        Toast.success('Ticket créé avec succès');
        PageMaintenance.render();
      }
    });
  },
  async assign(id) {
    await this.loadRefs();
    const opts = this._technicians.map((t) => `<option value="${t.id}">${t.full_name}</option>`).join('');
    Modal.open('Assigner un technicien', `<div class="form-group"><label>Technicien</label><select class="form-control" id="techSel">${opts || '<option value="">Aucun technicien</option>'}</select></div>`,
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button><button class="btn btn-primary" onclick="PageMaintenance.submitAssign(${id})">Assigner</button>`);
  },
  async submitAssign(id) {
    try { await API.patch('/maintenance/' + id + '/assign', { assigned_technician_id: document.getElementById('techSel').value }); Modal.close(); Toast.success('Technicien assigné'); PageMaintenance.render(); } catch (e) { Toast.error(e.message); }
  },
  updateStatus(id, current) {
    Modal.open('Changer le statut', `<div class="form-group"><label>Nouveau statut</label><select class="form-control" id="statSel">
        <option value="reported" ${current==='reported'?'selected':''}>Signalé</option>
        <option value="validated" ${current==='validated'?'selected':''}>Validé</option>
        <option value="in_progress" ${current==='in_progress'?'selected':''}>En cours</option>
        <option value="completed" ${current==='completed'?'selected':''}>Terminé</option>
        <option value="cancelled" ${current==='cancelled'?'selected':''}>Annulé</option>
      </select></div>`,
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button><button class="btn btn-primary" onclick="PageMaintenance.submitStatus(${id})">Enregistrer</button>`);
  },
  async submitStatus(id) {
    try { await API.put('/maintenance/' + id, { status: document.getElementById('statSel').value }); Modal.close(); Toast.success('Statut mis à jour'); PageMaintenance.render(); } catch (e) { Toast.error(e.message); }
  },
  async view(id) {
    const r = (await API.get('/maintenance/' + id)).data;
    this._rows[r.id] = r;
    const gallery = (type, lbl) => {
      const imgs = (r.images || []).filter((p) => p.image_type === type);
      return `<h4 style="margin:14px 0 8px">${lbl}</h4><div class="photo-grid">${imgs.length ? imgs.map((p) => `<div class="photo-item"><img src="${Helpers.fileUrl(p.image_url)}"/></div>`).join('') : '<p class="text-muted">Aucune photo</p>'}</div>`;
    };
    const canUpload = Auth.hasRole('manager','dir_technique','technicien','gestionnaire');
    const canManage = Auth.hasRole('manager','dir_technique');

    // Équipe de techniciens
    const team = r.team || [];
    const teamBadges = team.length
      ? team.map((t) => `<span class="badge badge-info" style="margin:2px">👷 ${t.full_name}</span>`).join('')
      : (r.technician ? `<span class="badge badge-info">👷 ${r.technician.full_name}</span>` : '<span class="text-muted">Aucun technicien affecté</span>');

    // Matériel & équipements (dépenses liées) + coût total
    const expenses = r.expenses || [];
    const totalCost = expenses.reduce((s, e) => s + parseFloat(e.total_price || 0), 0);
    const materials = expenses.length
      ? expenses.map((e) => `<div class="list-item">
          <div style="flex:1">${e.item_name}${e.category ? ` · <span class="text-muted">${e.category}</span>` : ''}<br>
            <span class="text-muted" style="font-size:12px">${e.quantity} × ${Helpers.formatMoney(e.unit_price)}${e.supplier ? ' · ' + e.supplier : ''}</span></div>
          <div class="flex items-center gap-2"><b>${Helpers.formatMoney(e.total_price)}</b>
            ${e.invoice_file ? `<a class="btn btn-sm btn-outline" href="${Helpers.fileUrl(e.invoice_file)}" target="_blank">📎</a>` : ''}
            ${e.photo ? `<a class="btn btn-sm btn-outline" href="${Helpers.fileUrl(e.photo)}" target="_blank">📷</a>` : ''}</div>
        </div>`).join('') + `<div class="list-item"><div style="flex:1"><b>Coût total du chantier</b></div><b>${Helpers.formatMoney(totalCost)}</b></div>`
      : '<p class="text-muted">Aucun matériel/équipement enregistré</p>';

    // Travaux / tâches
    const tasks = (r.tasks || []).length
      ? r.tasks.map((t) => `<div class="list-item"><div style="flex:1">${t.title}${t.assignee ? ` · <span class="text-muted">${t.assignee.full_name}</span>` : ''}</div>${Helpers.statusBadge(t.status)}</div>`).join('')
      : '<p class="text-muted">Aucune tâche</p>';

    const tenantName = r.tenant?.user?.full_name;

    Modal.open('Chantier — ' + r.title, `
      <div class="list-item"><div style="flex:1">Immeuble</div><b>${r.apartment?.property?.property_name || '—'}${r.apartment?.property?.city ? ' (' + r.apartment.property.city + ')' : ''}</b></div>
      <div class="list-item"><div style="flex:1">Logement</div><b>${r.apartment?.apartment_number || '—'}${r.apartment?.apartment_type ? ' · ' + r.apartment.apartment_type : ''}</b></div>
      ${tenantName ? `<div class="list-item"><div style="flex:1">Locataire</div><b>${tenantName}</b></div>` : ''}
      <div class="list-item"><div style="flex:1">Priorité</div>${Helpers.priorityBadge(r.priority)}</div>
      <div class="list-item"><div style="flex:1">Statut</div>${Helpers.maintStatus(r.status)}</div>
      ${r.description ? `<p style="margin:12px 0;color:var(--text-secondary)">${r.description}</p>` : ''}

      <div class="flex items-center justify-between mt-4"><h4 style="margin:0">👷 Équipe de techniciens</h4>
        ${canManage ? `<button class="btn btn-sm btn-outline" onclick="PageMaintenance.manageTeam(${id})">Gérer l'équipe</button>` : ''}</div>
      <div style="margin:8px 0">${teamBadges}</div>

      <div class="flex items-center justify-between mt-4"><h4 style="margin:0">🧰 Matériel & équipements</h4>
        ${canManage ? `<button class="btn btn-sm btn-outline" onclick="PageMaintenance.addMaterial(${id})">➕ Ajouter</button>` : ''}</div>
      <div style="margin-top:8px">${materials}</div>

      <h4 style="margin:16px 0 8px">📋 Travaux</h4>${tasks}

      ${gallery('before','📷 Avant travaux')}
      ${gallery('during','📷 Pendant travaux')}
      ${gallery('after','📷 Après travaux')}
      ${canUpload ? `<div class="mt-4">
        <select class="form-control mb-4" id="photoType"><option value="before">Avant</option><option value="during">Pendant</option><option value="after">Après</option></select>
        <input type="file" class="form-control mb-4" id="photoFiles" multiple accept="image/*"/>
        <button class="btn btn-primary btn-block" onclick="PageMaintenance.uploadPhotos(${id})">⬆ Ajouter des photos</button></div>` : ''}
    `);
  },

  // ---- Gérer l'équipe de techniciens (multi-sélection) ----
  async manageTeam(id) {
    const r = this._rows[id] || (await API.get('/maintenance/' + id)).data;
    await this.loadRefs();
    const current = new Set((r.team || []).map((t) => t.id));
    const opts = this._technicians.map((t) => `<label class="list-item" style="cursor:pointer">
      <input type="checkbox" class="team-chk" value="${t.id}" ${current.has(t.id) ? 'checked' : ''} style="margin-right:10px"/>
      <div style="flex:1">${t.full_name}</div></label>`).join('') || '<p class="text-muted">Aucun technicien disponible</p>';
    Modal.open('Équipe du chantier — ' + r.title, `<p class="text-muted" style="margin-bottom:10px">Sélectionnez les techniciens affectés à ce chantier.</p>${opts}`,
      `<button class="btn btn-outline" onclick="PageMaintenance.view(${id})">Annuler</button><button class="btn btn-primary" onclick="PageMaintenance.submitTeam(${id})">Enregistrer</button>`);
  },
  async submitTeam(id) {
    const ids = Array.from(document.querySelectorAll('.team-chk:checked')).map((c) => Number(c.value));
    try { await API.put('/maintenance/' + id + '/technicians', { user_ids: ids }); Toast.success('Équipe mise à jour'); PageMaintenance.view(id); PageMaintenance.render(); }
    catch (e) { Toast.error(e.message); }
  },

  // ---- Ajouter du matériel / équipement (depuis le stock ou achat direct) ----
  async addMaterial(id) {
    let stockItems = [];
    try {
      const res = await API.get('/stock/items');
      stockItems = res.data || [];
    } catch (_) {}

    const stockOptions = stockItems.map((it) => `<option value="${it.id}">${it.name} [${it.item_code}] (Dispo: ${it.quantity} ${it.unit} · PUMP: ${it.unit_price_avg} FCFA)</option>`).join('');

    Modal.open('Prélever du matériel pour l\'intervention', `
      <p class="text-muted" style="font-size:12px;margin-bottom:12px">
        Choisissez un article disponible dans l'entrepôt. La déduction du stock et la dépense imputée à l'immeuble seront automatiques.
      </p>
      <div class="form-group">
        <label>Article en Stock *</label>
        <select class="form-control" id="matStockId">
          <option value="">Sélectionner un article du stock...</option>
          ${stockOptions}
        </select>
      </div>
      <div class="form-group">
        <label>Quantité utilisée *</label>
        <input type="number" class="form-control" id="matQty" value="1" min="1" step="any"/>
      </div>`,
      `<button class="btn btn-outline" onclick="PageMaintenance.view(${id})">Annuler</button>
       <button class="btn btn-primary" onclick="PageMaintenance.submitMaterial(${id})">Prélever & Valider</button>`);
  },
  async submitMaterial(id) {
    const stock_item_id = parseInt(document.getElementById('matStockId').value, 10);
    const quantity = parseFloat(document.getElementById('matQty').value);

    if (!stock_item_id || quantity <= 0) {
      Toast.error('Veuillez sélectionner un article et une quantité');
      return;
    }

    try {
      await API.post(`/maintenance/${id}/materials`, {
        materials: [{ stock_item_id, quantity }],
      });
      Toast.success('Matériel prélevé du stock et dépense imputée avec succès ✅');
      PageMaintenance.view(id);
    } catch (e) {
      Toast.error(e.message || 'Erreur lors du prélèvement');
    }
  },
  async uploadPhotos(id) {
    const files = document.getElementById('photoFiles').files;
    if (!files.length) { Toast.error('Sélectionnez des photos'); return; }
    const fd = new FormData();
    fd.append('image_type', document.getElementById('photoType').value);
    for (const f of files) fd.append('photo', f);
    try { await API.upload('/maintenance/' + id + '/photos', fd); Toast.success('Photos ajoutées'); PageMaintenance.view(id); } catch (e) { Toast.error(e.message); }
  },
};
