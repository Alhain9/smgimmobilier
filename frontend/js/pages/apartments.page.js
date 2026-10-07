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
        { label: 'Statut', render: (r) => {
          if (r.status === 'free') return '<span class="badge badge-success" style="font-weight:700">🟢 Libre (Disponible)</span>';
          if (r.status === 'occupied') return '<span class="badge badge-primary" style="font-weight:700">🔵 Occupé</span>';
          return Helpers.statusBadge(r.status);
        } },
      ],
      rowActions: canEdit ? (r) => `
        ${r.status === 'occupied' ? `
          <button class="btn btn-sm btn-warning" title="Libérer le logement (départ du locataire / fin de bail)" onclick="PageApartments.openVacateModal(${r.id})">🚪 Libérer</button>
        ` : ''}
        ${r.status === 'free' ? `
          <button class="btn btn-sm btn-success" title="Attribuer à un nouveau locataire (Relouer)" onclick="PageApartments.installTenant(${r.id}, ${r.property_id})">👤 Relouer</button>
        ` : ''}
        <button class="btn btn-sm btn-outline" title="Modifier le logement" onclick="PageApartments.edit(${r.id})">✏️</button>
        ${Auth.hasRole('manager') ? `<button class="btn btn-sm btn-danger" title="Supprimer" onclick="PageApartments.remove(${r.id})">🗑</button>` : ''}` : null,
    });
  },
  async create() { CrudPage.openForm({ title: 'Nouveau logement', fields: await this.fields(), onSubmit: async (d) => { await API.post('/apartments', d); Toast.success('Créé'); PageApartments.render(); } }); },
  async edit(id) { const r = (await API.get('/apartments/' + id)).data; CrudPage.openForm({ title: 'Modifier le logement', fields: await this.fields(), values: r, onSubmit: async (d) => { await API.put('/apartments/' + id, d); Toast.success('Mis à jour'); PageApartments.render(); } }); },
  remove(id) { CrudPage.confirmDelete('/apartments/' + id, () => PageApartments.render()); },

  // ===== LIBÉRATION DE LOGEMENT & CONSTAT DE SORTIE =====
  async openVacateModal(apartmentId) {
    try {
      const apt = (await API.get('/apartments/' + apartmentId)).data;
      const tenant = (apt.tenants && apt.tenants[0]) || null;
      const tenantName = tenant?.user?.full_name || tenant?.full_name || 'Locataire actuel';
      const today = new Date().toISOString().slice(0, 10);

      let debtEstimate = 0;
      let echeanceDesc = '';
      if (tenant?.id) {
        try {
          const ledgerRes = await API.get('/tenants/' + tenant.id);
          debtEstimate = Math.max(0, ledgerRes.data?.due_info?.solde || 0);
          echeanceDesc = ledgerRes.data?.due_info?.echeance_message || '';
        } catch (_) {}
      }

      Modal.open({
        title: `🚪 Libérer le logement ${apt.apartment_number} (${apt.property?.property_name || 'Immeuble'})`,
        content: `
          <div style="background:#fff3cd;border:1px solid #ffeeba;padding:12px;border-radius:8px;margin-bottom:14px;font-size:13px;color:#856404">
            <b>⚠️ Procédure officielle de libération des lieux & fin d'occupation :</b><br>
            • Le logement repassera immédiatement au statut <b>« Libre »</b> (prêt pour un nouvel occupant).<br>
            • Le bail de <b>${Helpers.escapeHtml(tenantName)}</b> sera résilié/clôturé.<br>
            • Si le locataire quitte avec des arriérés, la dette restera attachée à son dossier et <b>ne sera jamais reportée sur le nouveau locataire</b>.
          </div>

          <form id="vacateAptForm" onsubmit="PageApartments.submitVacate(event, ${apartmentId})">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="form-group">
                <label class="form-label">Date effective de libération *</label>
                <input type="date" id="vac_departure_date" class="form-control" value="${today}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Motif de libération *</label>
                <select id="vac_reason" class="form-control" required onchange="PageApartments.toggleDebtField()">
                  <option value="Fin de contrat normale">Fin de contrat normale (Non-renouvellement)</option>
                  <option value="Déménagement">Déménagement / Départ volontaire</option>
                  <option value="Départ avec arriérés (Reconnaissance de dette)" ${debtEstimate > 0 ? 'selected' : ''}>Départ avec arriérés (Reconnaissance de dette signée)</option>
                  <option value="Résiliation amiable">Résiliation amiable anticipée</option>
                  <option value="Contentieux / Expulsion">Contentieux / Litige / Expulsion</option>
                  <option value="Autre motif">Autre motif</option>
                </select>
              </div>
            </div>

            <!-- VOLET RECONNAISSANCE DE DETTE -->
            <div style="background:var(--bg-surface-2);border:1px solid var(--border);border-radius:8px;padding:12px;margin:12px 0">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <label style="font-weight:700;color:var(--danger);font-size:13px;display:flex;align-items:center;gap:6px;cursor:pointer;margin:0">
                  <input type="checkbox" id="vac_has_debt" ${debtEstimate > 0 ? 'checked' : ''} onchange="PageApartments.toggleDebtField()" />
                  📝 Reconnaissance de dette signée par l'ancien locataire
                </label>
                ${debtEstimate > 0 ? `<span class="badge badge-danger">Arriérés calculés : ${Helpers.formatMoney(debtEstimate)}</span>` : ''}
              </div>

              <div id="vac_debt_section" style="${debtEstimate > 0 ? 'display:block' : 'display:none'}">
                <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:12px;margin-top:10px">
                  <div class="form-group">
                    <label class="form-label">Montant de la dette reconnue (FCFA) *</label>
                    <input type="number" id="vac_debt_amount" class="form-control" value="${debtEstimate}" min="0" placeholder="ex: 760000" />
                    <small class="text-muted">Montant que l'ancien locataire s'est formellement engagé à rembourser.</small>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Date d'engagement / Échéance</label>
                    <input type="date" id="vac_debt_due_date" class="form-control" />
                    <small class="text-muted">Date convenue pour le règlement.</small>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Observations & Constat de sortie</label>
              <textarea id="vac_observations" class="form-control" rows="3" placeholder="Constat d'état des lieux, relevé d'index eau/électricité, engagement écrit d'apurement...">${echeanceDesc ? Helpers.escapeHtml(echeanceDesc) : ''}</textarea>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
              <button type="button" class="btn btn-outline" onclick="Modal.close()">Annuler</button>
              <button type="submit" class="btn btn-danger" id="vac_submit_btn">🚪 Confirmer la libération du logement</button>
            </div>
          </form>
        `
      });
    } catch (err) {
      Toast.error(err.message || 'Erreur lors du chargement des informations');
    }
  },

  toggleDebtField() {
    const chk = document.getElementById('vac_has_debt');
    const reason = document.getElementById('vac_reason')?.value;
    const sec = document.getElementById('vac_debt_section');
    if (!sec) return;
    const shouldShow = (chk && chk.checked) || (reason && reason.includes('arriérés'));
    sec.style.display = shouldShow ? 'block' : 'none';
  },

  async submitVacate(e, apartmentId) {
    e.preventDefault();
    const btn = document.getElementById('vac_submit_btn');
    if (btn) btn.disabled = true;

    const departure_date = document.getElementById('vac_departure_date')?.value;
    const departure_reason = document.getElementById('vac_reason')?.value;
    const has_debt = document.getElementById('vac_has_debt')?.checked;
    const debt_acknowledged = has_debt ? (parseFloat(document.getElementById('vac_debt_amount')?.value) || 0) : 0;
    const debt_due_date = has_debt ? (document.getElementById('vac_debt_due_date')?.value || null) : null;
    const observations = document.getElementById('vac_observations')?.value || '';

    try {
      await API.post('/apartments/' + apartmentId + '/vacate', {
        departure_date,
        departure_reason,
        debt_acknowledged,
        debt_due_date,
        observations,
      });

      Toast.success('Logement libéré avec succès ! Le logement est désormais Libre et prêt pour relocation ✅');
      Modal.close();
      PageApartments.render();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de la libération du logement');
      if (btn) btn.disabled = false;
    }
  },

  installTenant(apartmentId, propertyId) {
    Router.navigate('tenants');
    setTimeout(() => {
      if (window.PageTenants) {
        PageTenants.openTenantModal(null, apartmentId, propertyId);
      }
    }, 200);
  },
};
