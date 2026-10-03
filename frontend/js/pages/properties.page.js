const PageProperties = {
  register() { Router.register('properties', () => this.render()); },
  _rows: {},

  // Types de logement disponibles pour la composition d'un immeuble
  TYPES: [
    { value: 'appartement', label: 'Appartement' }, { value: 'studio', label: 'Studio' },
    { value: 'chambre', label: 'Chambre' }, { value: 'duplex', label: 'Duplex' },
    { value: 'villa', label: 'Villa' }, { value: 'boutique', label: 'Boutique' },
    { value: 'bureau', label: 'Bureau' }, { value: 'magasin', label: 'Magasin' },
    { value: 'espace_commercial', label: 'Espace commercial' },
  ],
  typeLabel(v) { const t = this.TYPES.find((x) => x.value === v); return t ? t.label : (v || '—'); },

  fields() {
    return [
      { name: 'property_name', label: 'Nom de l\'immeuble', required: true },
      { name: 'property_type', label: 'Type de bien', type: 'select',
        options: [{ value: 'immeuble', label: 'Immeuble' }, { value: 'maison', label: 'Maison' }, { value: 'terrain', label: 'Terrain' }] },
      { name: 'address', label: 'Adresse', required: true },
      { name: 'district', label: 'Quartier', half: true },
      { name: 'city', label: 'Ville', required: true, default: 'Douala', half: true },
      { name: 'caretaker_name', label: '🛡️ Gardien de l\'immeuble (Nom complet)', placeholder: 'Ex: Jean Mbarga (Optionnel)', half: true },
      { name: 'caretaker_phone', label: 'Téléphone gardien', placeholder: 'Ex: +237 699 00 00 00', half: true },
      { name: 'caretaker_salary', label: 'Salaire mensuel gardien (FCFA)', type: 'number', default: 0, half: true },
      { name: 'status', label: 'Statut', type: 'select',
        options: [{ value: 'active', label: 'Actif' }, { value: 'inactive', label: 'Inactif' }] },
      { name: 'utilities_enabled', label: '⚡ Redistribution des charges (électricité/eau par compteur)', type: 'checkbox' },
      { name: 'electricity_price', label: 'Prix kWh électricité (FCFA)', type: 'number', default: 0, half: true },
      { name: 'water_price', label: 'Prix m³ eau (FCFA)', type: 'number', default: 0, half: true },
      { name: 'garbage_fee', label: 'Poubelle / mois (FCFA)', type: 'number', default: 0, half: true },
      { name: 'transport_fee', label: 'Transport / mois (FCFA)', type: 'number', default: 0, half: true },
      { name: 'description', label: 'Description', type: 'textarea' },
    ];
  },
  // Force les champs numériques de charges en nombres (évite '' -> erreur SQL)
  cleanNums(d) {
    ['electricity_price', 'water_price', 'garbage_fee', 'transport_fee', 'caretaker_salary'].forEach((k) => {
      if (k in d) d[k] = Number(d[k]) || 0;
    });
    return d;
  },

  _showAll: false,
  toggleShowAll() {
    this._showAll = !this._showAll;
    this.render();
  },

  async render() {
    const canEdit = Auth.hasRole('manager', 'dir_admin', 'gestionnaire', 'comptable');
    const isRestrictedRole = Auth.hasRole('comptable', 'gestionnaire') && !Auth.hasRole('manager', 'super_admin');

    // Charger la liste brute pour vérifier le statut d'affectation
    let rawProps = [];
    try {
      const res = await API.get('/properties');
      rawProps = res.data || [];
    } catch (_) { rawProps = []; }

    const assignedCount = rawProps.filter((p) => p.is_assigned).length;
    const othersCount = rawProps.length - assignedCount;
    const hasAssigned = assignedCount > 0;

    let filterBanner = '';
    if (isRestrictedRole && hasAssigned) {
      if (!this._showAll) {
        filterBanner = `
          <div style="background:#e8f5e9;border:1px solid #c8e6c9;padding:10px 16px;border-radius:8px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
            <div style="font-size:13px;color:#1b5e20;font-weight:600">
              🏢 <b>Affichage prioritaire :</b> Vous visualisez vos <b>${assignedCount}</b> immeuble(s) assigné(s). ${othersCount > 0 ? `(${othersCount} autre(s) immeuble(s) masqué(s))` : ''}
            </div>
            ${othersCount > 0 ? `
              <button class="btn btn-sm btn-outline" style="border-color:#2e7d32;color:#1b5e20" onclick="PageProperties.toggleShowAll()">
                👁️ Afficher tous les immeubles (démasquer)
              </button>
            ` : ''}
          </div>
        `;
      } else {
        filterBanner = `
          <div style="background:#fff3cd;border:1px solid #ffeeba;padding:10px 16px;border-radius:8px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
            <div style="font-size:13px;color:#856404;font-weight:600">
              👁️ <b>Tous les immeubles sont visibles :</b> Vos immeubles assignés sont placés en tête de liste.
            </div>
            <button class="btn btn-sm btn-primary" onclick="PageProperties.toggleShowAll()">
              🔒 Masquer les autres immeubles (Afficher uniquement mes immeubles)
            </button>
          </div>
        `;
      }
    }

    const toolbar = `
      ${filterBanner}
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
        ${canEdit ? `<button class="btn btn-outline" onclick="PageProperties.openImportModal()">📤 Importer la situation (Excel)</button>` : ''}
      </div>
    `;

    const data = await CrudPage.list({
      endpoint: '/properties', title: 'Immeubles',
      canCreate: canEdit, onCreate: 'PageProperties.create',
      toolbar,
      mapData: (all) => {
        if (!isRestrictedRole || !hasAssigned || this._showAll) return all;
        return all.filter((p) => p.is_assigned);
      },
      columns: [
        {
          label: 'Nom',
          render: (r) => {
            const assignedBadge = r.is_assigned
              ? `<span style="display:inline-block;background:#d4edda;color:#155724;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;margin-left:6px;vertical-align:middle">★ Mon immeuble</span>`
              : (isRestrictedRole && hasAssigned ? `<span style="display:inline-block;background:#f1f5f9;color:#64748b;font-size:10px;font-weight:600;padding:1px 7px;border-radius:20px;margin-left:6px;vertical-align:middle">Autre gestionnaire</span>` : '');
            return `<b>${r.property_name}</b>${assignedBadge}`;
          },
        },
        { label: 'Type', render: (r) => Helpers.propertyType(r.property_type) },
        { label: 'Localisation', render: (r) => `${r.city || '—'}${r.district ? `<br><span class="text-muted" style="font-size:12px">${r.district}</span>` : ''}` },
        { label: 'Logements', render: (r) => (r.apartments ? r.apartments.length : 0) },
        { label: 'Occupation', render: (r) => { const a = r.apartments || []; return a.length ? `${a.filter(x => x.status === 'occupied').length}/${a.length}` : '0'; } },
        { label: 'Statut', render: (r) => Helpers.statusBadge(r.status) },
      ],
      rowActions: (r) => {
        const hasContract = !!r.lease_template_file;
        const contractUrl = hasContract ? Helpers.fileUrl(r.lease_template_file) : '';
        return `
          ${hasContract ? `<a href="${contractUrl}" target="_blank" class="btn btn-sm btn-outline" style="color:var(--primary);font-weight:600" title="Télécharger le contrat de bail de l'immeuble">📥 Télécharger le contrat</a>` : ''}
          <button class="btn btn-sm btn-outline" title="Modèle de Contrat de Bail selon l'immeuble" onclick="PageProperties.openContractModal(${r.id})">📄 Modèle Contrat</button>
          <button class="btn btn-sm btn-outline" title="Voir la fiche immeuble" onclick="PageProperties.view(${r.id})">👁</button>
          ${canEdit ? `<button class="btn btn-sm btn-outline" title="Modifier" onclick="PageProperties.edit(${r.id})">✏️</button>` : ''}
          ${Auth.hasRole('manager', 'dir_admin', 'comptable') ? `<button class="btn btn-sm btn-danger" title="Supprimer" onclick="PageProperties.remove(${r.id})">🗑</button>` : ''}
        `;
      },
    });
    this._rows = {}; (data || []).forEach((r) => { this._rows[r.id] = r; });
  },

  openImportModal() {
    Modal.open('Importer un fichier Excel de situation', `
      <p style="font-size:13px; color:var(--text-muted); margin-bottom:14px;">
        Le fichier Excel créera ou mettra à jour automatiquement l'immeuble, ses logements, les locataires, leurs contrats de bail et l'historique financier des versements.
      </p>
      <div class="form-group">
        <label>Fichier Excel (.xlsx / .xls)</label>
        <input type="file" id="excelImportFile" class="form-control" accept=".xlsx,.xls"/>
      </div>
      <div class="form-row mt-2">
        <div class="form-group half"><label>Ville par défaut</label><input class="form-control" id="excelCity" value="Douala"/></div>
        <div class="form-group half"><label>Quartier par défaut</label><input class="form-control" id="excelDistrict" placeholder="Ex: Akwa"/></div>
      </div>`,
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
       <button class="btn btn-primary" onclick="PageProperties.submitImport()">Importer l'Excel</button>`);
  },

  async submitImport() {
    const file = document.getElementById('excelImportFile')?.files[0];
    if (!file) { Toast.error('Veuillez sélectionner un fichier Excel.'); return; }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('city', document.getElementById('excelCity')?.value || 'Douala');
    fd.append('district', document.getElementById('excelDistrict')?.value || '');

    try {
      Modal.close();
      Toast.info('Importation et traitement de l\'Excel en cours...');
      const res = await API.upload('/properties/import', fd);
      const data = res.data;
      Toast.success(`Importation réussie ! ${data.propertiesCount || 1} immeuble(s), ${data.apartments.total} logement(s), ${data.tenants.total} locataire(s) mis à jour.`);
      this.render();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de l\'importation de l\'Excel.');
    }
  },

  // ----- Création : champs standard + constructeur de composition -----
  create() {
    const fields = this.fields();
    Modal.open('Nouvel immeuble',
      `<form id="crudForm">${CrudPage.formFields(fields)}</form>
       <div class="form-group" style="margin-top:6px; flex: 1 1 100%;">
         <label style="font-weight:600">🏢 Composition de l'immeuble (logements)</label>
         <div class="text-muted" style="font-size:12.5px;margin-bottom:8px">Déclarez les types de logements et leur loyer — ils seront créés automatiquement.</div>
         <div id="compRows"></div>
         <button type="button" class="btn btn-sm btn-outline mt-2" onclick="PageProperties.addCompRow()">+ Ajouter un type de logement</button>
         <div class="mt-2" id="compTotal" style="font-weight:600">Total : 0 logement(s)</div>
       </div>`,
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
       <button class="btn btn-primary" id="propSubmit">Enregistrer</button>`);
    this.addCompRow();
    this.injectLocationUI();
    document.getElementById('propSubmit').onclick = () => this.submitCreate(fields);
  },
  addCompRow() {
    const wrap = document.getElementById('compRows');
    const opts = this.TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join('');
    const row = document.createElement('div');
    row.className = 'comp-row form-row';
    row.style.cssText = 'gap:8px;align-items:end;margin-bottom:8px';
    row.innerHTML = `
      <div class="form-group" style="flex:2;margin-bottom:0"><label style="font-size:12px">Type</label>
        <select class="form-control comp-type">${opts}</select></div>
      <div class="form-group" style="flex:1;margin-bottom:0;max-width:90px"><label style="font-size:12px">Nombre</label>
        <input type="number" min="0" class="form-control comp-count" value="1" oninput="PageProperties.updateCompTotal()"/></div>
      <div class="form-group" style="flex:1;margin-bottom:0"><label style="font-size:12px">Loyer (FCFA)</label>
        <input type="number" min="0" class="form-control comp-rent" value="0"/></div>
      <button type="button" class="btn btn-sm btn-danger" title="Retirer" onclick="this.closest('.comp-row').remove();PageProperties.updateCompTotal()">×</button>`;
    wrap.appendChild(row);
    this.updateCompTotal();
  },
  updateCompTotal() {
    let total = 0;
    document.querySelectorAll('#compRows .comp-count').forEach((i) => { total += parseInt(i.value, 10) || 0; });
    const el = document.getElementById('compTotal');
    if (el) el.textContent = `Total : ${total} logement(s)`;
  },
  collectComposition() {
    return Array.from(document.querySelectorAll('#compRows .comp-row')).map((row) => ({
      apartment_type: row.querySelector('.comp-type').value,
      count: parseInt(row.querySelector('.comp-count').value, 10) || 0,
      rent_amount: parseFloat(row.querySelector('.comp-rent').value) || 0,
    })).filter((c) => c.count > 0);
  },
  async submitCreate(fields) {
    try {
      const data = this.cleanNums(CrudPage.collectForm(fields));
      const composition = this.collectComposition();
      const res = await API.post('/properties', { ...data, composition });
      const n = (res.data && res.data.apartments) ? res.data.apartments.length : 0;
      Modal.close();
      Toast.success(`Immeuble créé${n ? ` avec ${n} logement(s)` : ''}`);
      PageProperties.render();
    } catch (e) { Toast.error(e.message); }
  },

  async edit(id) {
    const r = (await API.get('/properties/' + id)).data;
    CrudPage.openForm({ title: 'Modifier immeuble', fields: this.fields(), values: r,
      onSubmit: async (d) => { await API.put('/properties/' + id, this.cleanNums(d)); Toast.success('Mis à jour'); PageProperties.render(); } });
    this.injectLocationUI(r);
  },

  // ----- Fiche immeuble : localisation + composition + occupation -----
  async view(id) {
    const r = (await API.get('/properties/' + id)).data;
    const apts = r.apartments || [];
    const occupied = apts.filter((a) => a.status === 'occupied').length;

    const aptTiles = apts.map(a => {
      const statusClass = `status-${a.status}`;
      return `
        <div class="apartment-tile ${statusClass}" onclick="PageProperties.quickEditApartment(${a.id}, ${r.id})">
          <div class="apt-num">${a.apartment_number}</div>
          <div class="apt-type">${this.typeLabel(a.apartment_type)}</div>
          <div class="apt-rent">${Helpers.formatMoney(a.rent_amount)}</div>
        </div>`;
    }).join('') || '<p class="text-muted" style="grid-column: 1/-1;">Aucun logement déclaré</p>';

    const hasContract = !!r.lease_template_file;
    const isWord = hasContract && /\.docx?$/i.test(r.lease_template_file);
    const contractUrl = hasContract ? Helpers.fileUrl(r.lease_template_file) : '';

    Modal.open('🏢 ' + r.property_name, `
      <h4 style="margin:4px 0 8px">📍 Localisation</h4>
      <div class="list-item"><div style="flex:1">Adresse</div><b>${r.address || '—'}</b></div>
      <div class="list-item"><div style="flex:1">Quartier / Ville</div><b>${r.district ? r.district + ' · ' : ''}${r.city || '—'}</b></div>

      <h4 style="margin:20px 0 8px">🛡️ Gardiennage & Sécurité</h4>
      <div class="card p-3 mb-3" style="background:var(--bg-surface-2); border:1px solid var(--border)">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            ${r.caretaker_name 
              ? `<div style="font-weight:700;font-size:14px;color:var(--primary)">👤 ${r.caretaker_name}</div>
                 <div style="font-size:12.5px;color:var(--text-muted);margin-top:2px">
                   📞 ${r.caretaker_phone || 'Sans contact'} · Salaire mensuel : <b style="color:var(--success)">${Helpers.formatMoney(r.caretaker_salary || 0)}</b>
                 </div>`
              : `<span class="badge badge-warning">Aucun gardien assigné à cet immeuble</span>
                 <div class="text-muted" style="font-size:12px; margin-top:4px;">Vous pouvez renseigner un gardien en modifiant l'immeuble.</div>`}
          </div>
          <div style="display:flex; gap:6px;">
            ${Auth.hasRole('manager','comptable','gestionnaire','super_admin','dir_admin') ? `
              <button class="btn btn-sm btn-primary" onclick="Modal.close();PageExpenses.payCaretaker(${r.id}, '${(r.caretaker_name || '').replace(/'/g, "\\'")}', ${r.caretaker_salary || 0})">
                💵 Payer salaire gardien
              </button>
            ` : ''}
          </div>
        </div>
      </div>
      
      <h4 style="margin:20px 0 8px">📄 Modèle de Contrat de Bail de l'immeuble</h4>
      <div class="card p-3 mb-3" style="background:var(--bg-surface-2)">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            ${hasContract
              ? `<span class="badge badge-success"><i class="fas fa-check"></i> Modèle enregistré (${isWord ? 'Word .docx' : 'PDF'})</span>
                 <div class="text-muted" style="font-size:12px; margin-top:4px;">Fichier : <b>${r.lease_template_file.split('/').pop()}</b></div>`
              : `<span class="badge badge-warning"><i class="fas fa-exclamation-circle"></i> Aucun modèle personnalisé</span>
                 <div class="text-muted" style="font-size:12px; margin-top:4px;">Le modèle standard SMG est utilisé par défaut.</div>`}
          </div>
          <div style="display:flex; gap:6px;">
            ${hasContract ? `<a href="${contractUrl}" target="_blank" class="btn btn-sm btn-primary">📥 Télécharger le contrat</a>` : ''}
            ${Auth.hasRole('manager','dir_admin','gestionnaire','comptable') ? `
              <button class="btn btn-sm btn-outline" onclick="Modal.close();PageProperties.openContractModal(${r.id})">
                ${hasContract ? '🔄 Remplacer' : '📤 Téléverser un contrat'}
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <h4 style="margin:20px 0 8px">🏠 Logements (${apts.length} logement(s) · ${occupied} occupé(s))</h4>
      <div class="text-muted" style="font-size:12px; margin-bottom:8px;">Cliquez sur un logement pour le modifier rapidement.</div>
      <div class="apartment-grid">
        ${aptTiles}
      </div>`,
      `<button class="btn btn-outline" onclick="Modal.close()">Fermer</button>
       ${Auth.hasRole('manager','dir_admin','gestionnaire','comptable') ? `
         <button class="btn btn-outline" onclick="Modal.close();PageProperties.edit(${r.id})">✏️ Modifier</button>
         <button class="btn btn-primary" onclick="Modal.close();Router.go('apartments')">Gérer les logements</button>
       ` : ''}`);
  },

  // ===== GESTION DU MODÈLE DE CONTRAT WORD PAR IMMEUBLE =====
  async openContractModal(propertyId) {
    let prop = this._rows[propertyId];
    if (!prop) {
      try {
        const res = await API.get('/properties/' + propertyId);
        prop = res.data;
      } catch (e) { Toast.error(e.message); return; }
    }

    const hasTemplate = !!prop.lease_template_file;
    const isDocx = hasTemplate && /\.docx?$/i.test(prop.lease_template_file);
    const templateUrl = hasTemplate ? Helpers.fileUrl(prop.lease_template_file) : '';

    Modal.open(`📄 Modèle de Contrat de Bail — ${prop.property_name}`, `
      <div style="padding:4px">
        <p style="font-size:13.5px; color:var(--text); line-height:1.5; margin-bottom:16px;">
          Chaque immeuble dispose de son propre <strong>modèle officiel de contrat de bail (fichier Word .docx ou .doc)</strong>. 
          Les baux établis pour cet immeuble feront référence à ce modèle contractuel.
        </p>

        <div class="card p-3 mb-4" style="background:var(--bg-surface-2); border:1px solid var(--border)">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <div style="font-size:12px; text-transform:uppercase; font-weight:700; color:var(--text-muted)">Statut actuel</div>
              <div style="margin-top:4px">
                ${hasTemplate 
                  ? `<span class="badge badge-success"><i class="fas fa-check-circle"></i> Contrat Word enregistré (${isDocx ? '.docx' : 'document'})</span>`
                  : `<span class="badge badge-warning"><i class="fas fa-exclamation-triangle"></i> Aucun contrat spécifique attribué</span>`}
              </div>
              ${hasTemplate ? `<div class="text-muted" style="font-size:12px; margin-top:4px">Fichier : ${prop.lease_template_file.split('/').pop()}</div>` : ''}
            </div>
            <div style="display:flex; gap:8px;">
              ${hasTemplate ? `<a href="${templateUrl}" target="_blank" class="btn btn-sm btn-primary">📥 Télécharger</a>` : ''}
              ${hasTemplate ? `<button class="btn btn-sm btn-danger" onclick="PageProperties.deleteContract(${prop.id})">🗑 Retirer</button>` : ''}
            </div>
          </div>
        </div>

        <form id="propContractForm">
          <div class="form-group mb-3">
            <label style="font-weight:600">
              ${hasTemplate ? 'Remplacer le contrat Word de l\'immeuble :' : 'Téléverser le contrat Word pour cet immeuble :'}
            </label>
            <input type="file" class="form-control" id="propContractInput" accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/pdf" required />
            <div class="text-muted" style="font-size:12px; margin-top:4px">
              Formats acceptés : Document Microsoft Word (.docx, .doc) ou PDF (.pdf).
            </div>
          </div>
        </form>
      </div>
    `, `
      <button class="btn btn-outline" onclick="Modal.close()">Fermer</button>
      <button class="btn btn-primary" onclick="PageProperties.submitContract(${prop.id})">
        📤 Enregistrer le contrat Word
      </button>
    `);
  },

  async submitContract(propertyId) {
    const file = document.getElementById('propContractInput')?.files[0];
    if (!file) { Toast.error('Veuillez sélectionner un fichier Word (.docx) ou PDF'); return; }

    const fd = new FormData();
    fd.append('template', file);

    try {
      Toast.info('Téléversement du contrat en cours...');
      await API.upload('/properties/' + propertyId + '/lease-template', fd);
      Modal.close();
      Toast.success('Modèle de contrat Word enregistré avec succès pour cet immeuble ! 📄✅');
      this.render();
    } catch (e) {
      Toast.error(e.message || 'Échec du téléversement du contrat');
    }
  },

  async deleteContract(propertyId) {
    if (!confirm('Êtes-vous sûr de vouloir retirer le modèle de contrat de cet immeuble ?')) return;
    try {
      await API.delete('/properties/' + propertyId + '/lease-template');
      Modal.close();
      Toast.success('Modèle de contrat retiré de l\'immeuble');
      this.render();
    } catch (e) { Toast.error(e.message); }
  },

  downloadSampleTemplate() {
    window.open('http://localhost:5000/api/properties/lease-template/sample', '_blank');
  },

  remove(id) { CrudPage.confirmDelete('/properties/' + id, () => PageProperties.render()); },

  // Predefined Cameroon Cities & Districts map
  _camerounLocations: {
    'Douala': ['Akwa', 'Bonapriso', 'Bonanjo', 'Deido', 'Bali', 'Kotto', 'Logbessou', 'Bassa', 'Lendi', 'Yassa', 'Ndogpassi'],
    'Yaoundé': ['Bastos', 'Tsinga', 'Essos', 'Mvan', 'Obili', 'Ngoa-Ekelle', 'Emana', 'Odza', 'Nlongkak', 'Biyem-Assi'],
    'Bafoussam': ['Tamdja', 'Ndiangdam', 'Djeleng', 'Toungang'],
    'Garoua': ['Plateau', 'Yelwa', 'Louti'],
    'Ngaoundéré': ['Baladji', 'Djamboutou'],
    'Buea': ['Molyko', 'Great Soppo', 'Mile 16'],
    'Limbe': ['Down Beach', 'Bota', 'Mile 4'],
    'Kribi': ['Mpalla', 'Talla', 'Ngoye']
  },

  injectLocationUI(values = {}) {
    const isEdit = !!values.id;
    const cityVal = values.city || 'Douala';
    const districtVal = values.district || 'Akwa';
    
    const predefinedCities = Object.keys(this._camerounLocations);
    const isPredefinedCity = predefinedCities.includes(cityVal);
    const isPredefinedDistrict = isPredefinedCity && this._camerounLocations[cityVal].includes(districtVal);
    const startManual = isEdit && (!isPredefinedCity || !isPredefinedDistrict);
    
    const fCity = document.getElementById('f_city');
    const fDistrict = document.getElementById('f_district');
    if (!fCity || !fDistrict) return;
    
    fCity.type = 'hidden';
    fDistrict.type = 'hidden';
    
    const container = document.createElement('div');
    container.style.cssText = 'flex: 1 1 100%; display: flex; flex-wrap: wrap; gap: 14px;';
    container.innerHTML = `
      <div class="form-group" style="margin-bottom: 4px; flex: 1 1 100%;">
        <label class="flex items-center gap-2" style="cursor:pointer; font-weight:400">
          <input type="checkbox" id="f_location_manual_toggle" style="width:auto" ${startManual ? 'checked' : ''}/>
          📍 Saisie manuelle de la ville & quartier
        </label>
      </div>
      
      <div class="form-group half" id="cityGroup" style="margin-bottom: 16px;">
        <label>Ville</label>
        <select class="form-control" id="f_city_select"></select>
        <input type="text" class="form-control" id="f_city_manual" style="display:none;" placeholder="Saisir la ville..."/>
      </div>
      
      <div class="form-group half" id="districtGroup" style="margin-bottom: 16px;">
        <label>Quartier</label>
        <select class="form-control" id="f_district_select"></select>
        <input type="text" class="form-control" id="f_district_manual" style="display:none;" placeholder="Saisir le quartier..."/>
      </div>
    `;
    
    fCity.parentNode.insertBefore(container, fCity);
    
    const citySelect = document.getElementById('f_city_select');
    citySelect.innerHTML = predefinedCities.map(c => `<option value="${c}" ${c === cityVal ? 'selected' : ''}>${c}</option>`).join('');
    
    const populateDistricts = (city, selectedDist) => {
      const distSelect = document.getElementById('f_district_select');
      const districts = this._camerounLocations[city] || [];
      distSelect.innerHTML = districts.map(d => `<option value="${d}" ${d === selectedDist ? 'selected' : ''}>${d}</option>`).join('');
    };
    
    populateDistricts(citySelect.value, districtVal);
    
    const toggleUI = (manual) => {
      const citySel = document.getElementById('f_city_select');
      const cityMan = document.getElementById('f_city_manual');
      const distSel = document.getElementById('f_district_select');
      const distMan = document.getElementById('f_district_manual');
      
      if (manual) {
        citySel.style.display = 'none';
        cityMan.style.display = 'block';
        distSel.style.display = 'none';
        distMan.style.display = 'block';
      } else {
        citySel.style.display = 'block';
        cityMan.style.display = 'none';
        distSel.style.display = 'block';
        distMan.style.display = 'none';
      }
      this.syncLocationValues();
    };
    
    const toggleCheckbox = document.getElementById('f_location_manual_toggle');
    toggleCheckbox.onchange = (e) => toggleUI(e.target.checked);
    
    citySelect.onchange = (e) => {
      populateDistricts(e.target.value, '');
      this.syncLocationValues();
    };
    
    document.getElementById('f_district_select').onchange = () => this.syncLocationValues();
    
    const cityMan = document.getElementById('f_city_manual');
    const distMan = document.getElementById('f_district_manual');
    
    cityMan.value = cityVal;
    distMan.value = districtVal;
    
    cityMan.oninput = () => this.syncLocationValues();
    distMan.oninput = () => this.syncLocationValues();
    
    toggleUI(startManual);
  },
  
  syncLocationValues() {
    const isManual = document.getElementById('f_location_manual_toggle').checked;
    const cityInput = document.getElementById('f_city');
    const districtInput = document.getElementById('f_district');
    if (!cityInput || !districtInput) return;
    
    if (isManual) {
      cityInput.value = document.getElementById('f_city_manual').value.trim();
      districtInput.value = document.getElementById('f_district_manual').value.trim();
    } else {
      cityInput.value = document.getElementById('f_city_select').value;
      districtInput.value = document.getElementById('f_district_select').value;
    }
  },

  async quickEditApartment(aptId, propertyId) {
    if (!Auth.hasRole('manager', 'dir_admin', 'gestionnaire', 'comptable')) return;
    const apt = (await API.get('/apartments/' + aptId)).data;
    
    Modal.open(`Modifier le logement ${apt.apartment_number}`, `
      <div class="form-group"><label>Numéro de logement</label>
        <input class="form-control" id="qa_num" value="${apt.apartment_number}" required/></div>
      <div class="form-group"><label>Loyer mensuel (FCFA)</label>
        <input type="number" class="form-control" id="qa_rent" value="${apt.rent_amount}" required/></div>
      <div class="form-group"><label>Statut</label>
        <select class="form-control" id="qa_status">
          <option value="free" ${apt.status === 'free' ? 'selected' : ''}>Libre</option>
          <option value="occupied" ${apt.status === 'occupied' ? 'selected' : ''}>Occupé</option>
          <option value="maintenance" ${apt.status === 'maintenance' ? 'selected' : ''}>En maintenance</option>
          <option value="reserved" ${apt.status === 'reserved' ? 'selected' : ''}>Réservé</option>
        </select></div>
      <div class="form-group"><label>Notes descriptives</label>
        <textarea class="form-control" id="qa_desc" rows="3">${apt.description || ''}</textarea></div>`,
      `<button class="btn btn-outline" onclick="PageProperties.view(${propertyId})">Retour</button>
       <button class="btn btn-primary" onclick="PageProperties.submitQuickEdit(${aptId}, ${propertyId})">Enregistrer</button>`);
  },
  
  async submitQuickEdit(aptId, propertyId) {
    const apartment_number = document.getElementById('qa_num').value.trim();
    const rent_amount = parseFloat(document.getElementById('qa_rent').value) || 0;
    const status = document.getElementById('qa_status').value;
    const description = document.getElementById('qa_desc').value.trim();
    
    if (!apartment_number) { Toast.error('Numéro requis'); return; }
    if (rent_amount <= 0) { Toast.error('Loyer invalide'); return; }
    
    try {
      await API.put('/apartments/' + aptId, { apartment_number, rent_amount, status, description });
      Toast.success('Logement mis à jour');
      PageProperties.view(propertyId);
    } catch(e) {
      Toast.error(e.message);
    }
  }
};
