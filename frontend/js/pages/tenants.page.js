// ============ Page Locataires & Attribution Immobilière — SMG IMMOBILIER ============
const PageTenants = {
  register() { Router.register('tenants', () => this.render()); },
  _rows: {},
  _properties: [],
  _apartments: [],

  ctxOf(t) {
    return {
      name: t.full_name,
      phone: t.phone,
      apartmentNumber: t.apartment?.apartment_number,
      propertyName: t.apartment?.property?.property_name,
      kind: 'generic',
    };
  },

  whatsapp(id) { Communication.openWhatsApp(this.ctxOf(this._rows[id])); },
  call(id) { Communication.call(this._rows[id]?.phone); },

  async loadAuxiliaryData() {
    try {
      const [resP, resA] = await Promise.all([
        API.get('/properties'),
        API.get('/apartments'),
      ]);
      this._properties = resP.data || [];
      this._apartments = resA.data || [];
    } catch (_) {
      this._properties = [];
      this._apartments = [];
    }
  },

  async render() {
    await this.loadAuxiliaryData();

    const data = await CrudPage.list({
      endpoint: '/tenants',
      title: 'Locataires & Affectations',
      canCreate: true,
      onCreate: 'PageTenants.openTenantModal',
      columns: [
        {
          label: 'Locataire',
          render: (r) => `<div class="flex items-center gap-3">
            <div class="user-avatar" style="width:36px;height:36px;font-size:13px">${Helpers.initials(r.full_name)}</div>
            <div>
              <b>${r.full_name}</b>
              ${r.national_id ? `<br><small style="color:var(--text-muted);font-size:11px">CNI: ${r.national_id}${r.cni_delivery_date ? ' (du ' + Helpers.formatDate(r.cni_delivery_date) + ')' : ''}</small>` : ''}
            </div>
          </div>`,
        },
        {
          label: 'Téléphone & Email',
          render: (r) => `<b>${r.phone || '—'}</b>${r.email ? `<br><small class="text-muted">${r.email}</small>` : ''}`,
        },
        {
          label: 'Logement Occupé',
          render: (r) => r.apartment
            ? `<b>Logement ${r.apartment.apartment_number}</b>${r.apartment.apartment_type ? `<br><span class="badge badge-secondary" style="font-size:11px">${r.apartment.apartment_type}</span>` : ''}`
            : '<span class="badge badge-warning">Non attribué</span>',
        },
        {
          label: 'Immeuble de Résidence',
          render: (r) => {
            const prop = r.apartment?.property;
            return prop
              ? `<b style="color:var(--primary)">🏢 ${prop.property_name}</b>${prop.city ? `<br><small class="text-muted">📍 ${prop.city}</small>` : ''}`
              : '<span class="text-muted">—</span>';
          },
        },
        {
          label: 'Bail & Validité',
          render: (r) => {
            const activeLease = (r.leases || []).find((l) => l.status === 'active') || (r.leases && r.leases[0]);
            const end = activeLease ? activeLease.end_date : r.end_date;
            if (!end) return '<span class="text-muted">Aucun bail actif</span>';
            const diffDays = Math.ceil((new Date(end) - new Date()) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) return `<span class="badge badge-danger">⚠️ Expiré (${Helpers.formatDate(end)})</span>`;
            if (diffDays <= 30) return `<span class="badge badge-warning">⏰ Expire dans ${diffDays} j</span>`;
            return `<span class="badge badge-success">✅ Actif (${Helpers.formatDate(end)})</span>`;
          },
        },
        {
          label: 'Compte Mobile',
          render: (r) => r.user ? '<span class="badge badge-success">Actif</span>' : '<span class="badge badge-muted">Non créé</span>',
        },
        {
          label: 'Statut',
          render: (r) => Helpers.statusBadge(r.status),
        },
      ],
      rowActions: (r) => `
        <button class="btn btn-sm btn-whatsapp" title="WhatsApp" onclick="PageTenants.whatsapp(${r.id})">🟢</button>
        <button class="btn btn-sm btn-outline" title="Appeler" onclick="PageTenants.call(${r.id})">📞</button>
        <button class="btn btn-sm btn-outline" title="Dossier complet" onclick="PageTenants.view(${r.id})">👁</button>
        <button class="btn btn-sm btn-outline" title="Modifier" onclick="PageTenants.openTenantModal(${r.id})">✏️</button>
        <button class="btn btn-sm btn-danger" title="Supprimer" onclick="PageTenants.remove(${r.id})">🗑</button>`,
    });

    this._rows = {};
    (data || []).forEach((r) => { this._rows[r.id] = r; });
  },

  // ===== MODAL CRÉATION / ÉDITION CONNECTÉE (IMMEUBLE + LOGEMENT + BAIL) =====
  async openTenantModal(tenantId = null) {
    let t = null;
    if (tenantId) {
      try {
        const res = await API.get('/tenants/' + tenantId);
        t = res.data;
      } catch (_) {}
    }

    if (!PageTenants._properties?.length || !PageTenants._apartments?.length) {
      await PageTenants.loadAuxiliaryData();
    }

    // Pré-sélection de l'immeuble du locataire
    const currentApt = t?.apartment;
    const currentPropId = currentApt?.property?.id || currentApt?.property_id || '';
    const currentAptId = currentApt?.id || t?.apartment_id || '';

    const propsOptions = '<option value="">-- Sélectionner un Immeuble (ex: Malika, Chalivre...) --</option>' +
      (PageTenants._properties || []).map((p) =>
        `<option value="${p.id}" ${String(currentPropId) === String(p.id) ? 'selected' : ''}>🏢 ${p.property_name} (${p.city || '—'})</option>`
      ).join('');

    const html = `
      <form id="tenantConnectedForm" onsubmit="PageTenants.submitTenantModal(event, ${tenantId || 'null'})" style="max-height:80vh;overflow-y:auto;padding-right:4px">
        
        <!-- VOLET 1 : IDENTITÉ & COORDONNÉES DU LOCATAIRE -->
        <div style="background:var(--card-bg, #ffffff);border:1px solid var(--border);padding:14px;border-radius:8px;margin-bottom:14px">
          <h4 style="font-size:14px;font-weight:700;margin:0 0 12px;color:var(--primary);display:flex;align-items:center;gap:6px">
            <span>👤</span> 1. Identité & Accès du Locataire
          </h4>
          <div style="display:grid;grid-template-columns:1fr 2fr;gap:12px">
            <div>
              <label class="form-label">Titre / Civilité *</label>
              <select id="tm_civility" class="form-control" required>
                <option value="Monsieur" ${t?.civility === 'Monsieur' || (!t?.civility && !t) ? 'selected' : ''}>Monsieur (M.)</option>
                <option value="Madame" ${t?.civility === 'Madame' ? 'selected' : ''}>Madame (Mme)</option>
                <option value="Mademoiselle" ${t?.civility === 'Mademoiselle' ? 'selected' : ''}>Mademoiselle (Mlle)</option>
              </select>
            </div>
            <div>
              <label class="form-label">Nom complet du locataire *</label>
              <input type="text" id="tm_full_name" class="form-control" required placeholder="ex: DORA, MAWANBA WAMBA SYLVANA..." value="${t ? (t.full_name || '') : ''}" />
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
            <div>
              <label class="form-label">Numéro de téléphone *</label>
              <input type="tel" id="tm_phone" class="form-control" required placeholder="ex: 699 00 00 00" value="${t ? (t.phone || '') : ''}" />
            </div>
            <div>
              <label class="form-label">Email de connexion *</label>
              <input type="email" id="tm_email" class="form-control" required placeholder="locataire@smg.cm" value="${t ? (t.email || '') : ''}" />
            </div>
            <div>
              <label class="form-label">Mot de passe pour l'application</label>
              <input type="password" id="tm_password" class="form-control" placeholder="${t ? 'Laisser vide pour ne pas modifier' : 'Par défaut: loc123'}" />
            </div>
            <div>
              <label class="form-label">Profession</label>
              <input type="text" id="tm_profession" class="form-control" placeholder="ex: Cadre, Commerçant(e)..." value="${t ? (t.profession || '') : ''}" />
            </div>
            <div>
              <label class="form-label">Numéro de CNI</label>
              <input type="text" id="tm_cni" class="form-control" placeholder="ex: 118492048" value="${t ? (t.cni || t.national_id || '') : ''}" />
            </div>
            <div>
              <label class="form-label">Date de délivrance CNI</label>
              <input type="date" id="tm_cni_date" class="form-control" value="${t ? (t.cni_delivery_date ? t.cni_delivery_date.slice(0, 10) : '') : ''}" />
            </div>
            <div>
              <label class="form-label">Lieu de délivrance CNI</label>
              <input type="text" id="tm_cni_place" class="form-control" placeholder="ex: Yaoundé, Douala..." value="${t ? (t.cni_delivery_place || '') : ''}" />
            </div>
            <div>
              <label class="form-label">Contact d'urgence (Nom & Tél)</label>
              <input type="text" id="tm_emergency" class="form-control" placeholder="ex: Époux/Parent : 677 00 00 00" value="${t ? (t.emergency_contact || '') : ''}" />
            </div>
          </div>
        </div>

        <!-- VOLET 2 : AFFECTATION IMMOBILIÈRE (IMMEUBLE & LOGEMENT) -->
        <div style="background:var(--card-bg, #ffffff);border:1px solid var(--border);padding:14px;border-radius:8px;margin-bottom:14px">
          <h4 style="font-size:14px;font-weight:700;margin:0 0 12px;color:var(--primary);display:flex;align-items:center;gap:6px">
            <span>🏢</span> 2. Affectation Immobilière (Immeuble & Logement)
          </h4>
          <p style="font-size:12px;color:var(--text-muted);margin:-6px 0 12px">
            Sélectionnez l'immeuble pour faire apparaître instantanément tous les logements correspondants (chambres, studios, appartements).
          </p>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label class="form-label">Immeuble de résidence *</label>
              <select id="tm_property" class="form-control" onchange="PageTenants.onPropertyChange()">
                ${propsOptions}
              </select>
            </div>
            <div>
              <label class="form-label">Logement attribué *</label>
              <select id="tm_apartment" class="form-control" onchange="PageTenants.onApartmentChange()">
                <option value="">-- Choisissez d'abord un immeuble --</option>
              </select>
            </div>
          </div>

          <div id="tm_apt_info_box" style="display:none;margin-top:10px;padding:10px;background:rgba(26,58,92,0.05);border-radius:6px;font-size:12px">
            <!-- Rempli dynamiquement -->
          </div>
        </div>

        <!-- VOLET 3 : CONTRAT DE BAIL & MODALITÉS -->
        <div id="tm_lease_section" style="background:var(--card-bg, #ffffff);border:1px solid var(--border);padding:14px;border-radius:8px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h4 style="font-size:14px;font-weight:700;margin:0;color:var(--primary);display:flex;align-items:center;gap:6px">
              <span>📄</span> 3. Contrat de Bail & Modalités Financières
            </h4>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
              <input type="checkbox" id="tm_create_lease" checked onchange="PageTenants.toggleLeaseFields()" />
              Établir le bail automatiquement
            </label>
          </div>

          <div id="tm_lease_fields">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div>
                <label class="form-label">Date d'entrée / prise d'effet *</label>
                <input type="date" id="tm_start_date" class="form-control" value="${t?.start_date ? t.start_date.slice(0, 10) : new Date().toISOString().slice(0, 10)}" onchange="PageTenants.onDurationOrStartChange()" />
              </div>
              <div>
                <label class="form-label">Durée ferme du bail *</label>
                <select id="tm_duration" class="form-control" onchange="PageTenants.onDurationOrStartChange()">
                  <option value="12" selected>1 an (12 mois) — Recommandé</option>
                  <option value="6">6 mois</option>
                  <option value="24">2 ans (24 mois)</option>
                  <option value="36">3 ans (36 mois)</option>
                  <option value="custom">Personnalisée</option>
                </select>
              </div>
              <div>
                <label class="form-label">Date d'échéance (Fin du bail) *</label>
                <input type="date" id="tm_end_date" class="form-control" value="${t?.end_date ? t.end_date.slice(0, 10) : ''}" />
              </div>
              <div>
                <label class="form-label">Loyer mensuel contractuel (FCFA) *</label>
                <input type="number" id="tm_monthly_rent" class="form-control" placeholder="Loyer en FCFA" />
              </div>
              <div>
                <label class="form-label">Dépôt de garantie / Caution (FCFA)</label>
                <input type="number" id="tm_deposit" class="form-control" placeholder="Montant caution" />
              </div>
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Annuler</button>
          <button type="submit" class="btn btn-primary" id="tm_submit_btn">
            ${t ? 'Enregistrer les Modifications' : 'Enregistrer le Locataire & Établir le Bail'}
          </button>
        </div>
      </form>
    `;

    Modal.open({
      title: t ? `✏️ Modifier le Locataire — ${t.full_name}` : '👤 Nouveau Locataire & Attribution de Logement',
      content: html,
      size: 'large',
    });

    // Initialiser les logements de l'immeuble pré-sélectionné
    if (currentPropId) {
      PageTenants.populateApartmentsForProperty(currentPropId, currentAptId);
    }
    PageTenants.onDurationOrStartChange();
  },

  onPropertyChange() {
    const propId = document.getElementById('tm_property')?.value;
    PageTenants.populateApartmentsForProperty(propId);
  },

  populateApartmentsForProperty(propId, selectedAptId = '') {
    const aptSelect = document.getElementById('tm_apartment');
    const infoBox = document.getElementById('tm_apt_info_box');
    if (!aptSelect) return;

    if (!propId) {
      aptSelect.innerHTML = '<option value="">-- Choisissez d\'abord un immeuble --</option>';
      if (infoBox) infoBox.style.display = 'none';
      return;
    }

    const filtered = (PageTenants._apartments || []).filter((a) => String(a.property_id || a.property?.id) === String(propId));

    if (!filtered.length) {
      aptSelect.innerHTML = '<option value="">Aucun logement enregistré dans cet immeuble</option>';
      if (infoBox) infoBox.style.display = 'none';
      return;
    }

    const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');

    // Trier les logements : d'abord les libres, puis par numéro
    filtered.sort((a, b) => {
      if (a.status === 'free' && b.status !== 'free') return -1;
      if (a.status !== 'free' && b.status === 'free') return 1;
      return (a.apartment_number || '').localeCompare(b.apartment_number || '');
    });

    aptSelect.innerHTML = '<option value="">-- Sélectionner un logement --</option>' +
      filtered.map((a) => {
        const isFree = a.status === 'free';
        const typeStr = a.apartment_type ? ` · ${a.apartment_type}` : '';
        const floorStr = a.floor != null ? (a.floor === 0 ? ' (RDC)' : ` (Étage ${a.floor})`) : '';
        const isSel = String(selectedAptId) === String(a.id);
        const statusBadge = isFree ? '🟢 Libre' : '🔴 Occupé';

        return `<option value="${a.id}" data-rent="${a.rent_amount}" data-type="${a.apartment_type || ''}" data-status="${a.status}" ${isSel ? 'selected' : ''}>
          Logement ${a.apartment_number}${typeStr}${floorStr} — ${fmt(a.rent_amount)} FCFA [${statusBadge}]
        </option>`;
      }).join('');

    this.onApartmentChange();
  },

  onApartmentChange() {
    const aptSelect = document.getElementById('tm_apartment');
    const infoBox = document.getElementById('tm_apt_info_box');
    const rentInput = document.getElementById('tm_monthly_rent');
    const depositInput = document.getElementById('tm_deposit');
    if (!aptSelect) return;

    const opt = aptSelect.options[aptSelect.selectedIndex];
    if (!opt || !opt.value) {
      if (infoBox) infoBox.style.display = 'none';
      return;
    }

    const rent = opt.getAttribute('data-rent') || '0';
    const type = opt.getAttribute('data-type') || 'Logement';
    const status = opt.getAttribute('data-status') || '';

    if (rentInput && (!rentInput.value || rentInput.value === '0')) {
      rentInput.value = rent;
    }
    if (depositInput && (!depositInput.value || depositInput.value === '0')) {
      depositInput.value = rent;
    }

    if (infoBox) {
      const isFree = status === 'free';
      infoBox.style.display = 'block';
      infoBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <b>${opt.text.split('[')[0].trim()}</b>
            <br><span style="color:var(--text-muted)">Loyer de référence configuré : <b>${Number(rent).toLocaleString('fr-FR')} FCFA/mois</b></span>
          </div>
          <span class="badge badge-${isFree ? 'success' : 'warning'}">${isFree ? 'Logement disponible' : 'Actuellement occupé'}</span>
        </div>
      `;
    }
  },

  toggleLeaseFields() {
    const chk = document.getElementById('tm_create_lease');
    const fields = document.getElementById('tm_lease_fields');
    if (fields && chk) {
      fields.style.display = chk.checked ? 'block' : 'none';
    }
  },

  onDurationOrStartChange() {
    const startVal = document.getElementById('tm_start_date')?.value;
    const durVal = document.getElementById('tm_duration')?.value;
    const endInput = document.getElementById('tm_end_date');
    if (!startVal || !endInput) return;

    if (durVal === 'custom') return;

    const months = parseInt(durVal, 10);
    if (isNaN(months) || months <= 0) return;

    const end = new Date(startVal);
    end.setMonth(end.getMonth() + months);
    end.setDate(end.getDate() - 1);
    endInput.value = end.toISOString().slice(0, 10);
  },

  async submitTenantModal(e, tenantId) {
    e.preventDefault();
    const btn = document.getElementById('tm_submit_btn');
    if (btn) btn.disabled = true;

    const civility = document.getElementById('tm_civility')?.value || 'Monsieur';
    const full_name = document.getElementById('tm_full_name').value.trim();
    const phone = document.getElementById('tm_phone').value.trim();
    const email = document.getElementById('tm_email').value.trim();
    const password = document.getElementById('tm_password').value;
    const profession = document.getElementById('tm_profession').value.trim();
    const national_id = document.getElementById('tm_cni').value.trim();
    const cni_delivery_date = document.getElementById('tm_cni_date').value || null;
    const cni_delivery_place = document.getElementById('tm_cni_place').value.trim() || null;
    const emergency_contact = document.getElementById('tm_emergency').value.trim();

    const apartment_id = document.getElementById('tm_apartment').value ? parseInt(document.getElementById('tm_apartment').value, 10) : null;
    const create_lease = document.getElementById('tm_create_lease') ? document.getElementById('tm_create_lease').checked : false;

    const start_date = document.getElementById('tm_start_date')?.value || null;
    const end_date = document.getElementById('tm_end_date')?.value || null;
    const duration_months = document.getElementById('tm_duration')?.value !== 'custom' ? parseInt(document.getElementById('tm_duration').value, 10) : null;
    const monthly_rent = parseFloat(document.getElementById('tm_monthly_rent')?.value) || 0;
    const deposit_amount = parseFloat(document.getElementById('tm_deposit')?.value) || 0;

    const downloadWord = document.getElementById('tm_download_word')?.checked;

    const payload = {
      civility,
      full_name,
      phone,
      email,
      profession: profession || null,
      national_id: national_id || null,
      cni: national_id || null,
      cni_delivery_date,
      cni_delivery_place,
      emergency_contact: emergency_contact || null,
      apartment_id,
      create_lease,
      start_date,
      end_date,
      duration_months,
      monthly_rent,
      deposit_amount,
    };

    if (password) payload.password = password;

    try {
      let savedTenant = null;
      if (tenantId) {
        const res = await API.put('/tenants/' + tenantId, payload);
        savedTenant = res.data;
        Toast.success('Fiche locataire mise à jour avec succès ✅');
      } else {
        const res = await API.post('/tenants', payload);
        savedTenant = res.data;
        Toast.success('Locataire enregistré et logement attribué avec succès ! 🎉');
      }

      Modal.close();
      await this.render();
    } catch (err) {
      console.error(err);
      Toast.error(err.message || 'Erreur lors de l\'enregistrement');
      if (btn) btn.disabled = false;
    }
  },

  create() {
    this.openTenantModal();
  },

  edit(id) {
    this.openTenantModal(id);
  },

  async view(id) {
    const r = (await API.get('/tenants/' + id)).data;
    const apt = r.apartment;
    const logement = apt ? `
      <div class="list-item"><div style="flex:1">Logement</div><b>${apt.apartment_number}${apt.apartment_type ? ' · ' + apt.apartment_type : ''}</b></div>
      <div class="list-item"><div style="flex:1">Immeuble</div><b>${apt.property?.property_name || '—'}${apt.property?.city ? ' (' + apt.property.city + ')' : ''}</b></div>
      ${apt.floor != null ? `<div class="list-item"><div style="flex:1">Étage</div><b>${apt.floor === 0 ? 'RDC' : 'Étage ' + apt.floor}</b></div>` : ''}
      ${apt.rent_amount ? `<div class="list-item"><div style="flex:1">Loyer de référence</div><b>${Helpers.formatMoney(apt.rent_amount)}</b></div>` : ''}`
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
              ${l.contract_file ? `<a class="btn btn-sm btn-outline" href="${Helpers.fileUrl(l.contract_file)}" target="_blank" title="Contrat de bail">📑 Contrat</a>` : ''}
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
      <div class="list-item"><div style="flex:1">Numéro CNI</div><b>${r.national_id || r.cni || '—'}</b></div>
      ${r.cni_delivery_date ? `<div class="list-item"><div style="flex:1">Date délivrance CNI</div><b>${Helpers.formatDate(r.cni_delivery_date)}</b></div>` : ''}
      ${r.cni_delivery_place ? `<div class="list-item"><div style="flex:1">Lieu délivrance CNI</div><b>${r.cni_delivery_place}</b></div>` : ''}
      <h4 style="margin:16px 0 8px">🏠 Logement & Immeuble</h4>${logement}
      <h4 style="margin:16px 0 8px">📄 Contrats de bail</h4>${leases}
      <h4 style="margin:16px 0 8px">💰 Paiements</h4>
      <div class="list-item"><div style="flex:1">Payés</div><b>${paid}</b></div>
      <div class="list-item"><div style="flex:1">En attente / impayés</div><b>${unpaid}</b></div>
      ${last ? `<div class="list-item"><div style="flex:1">Dernier paiement</div><b>${Helpers.formatMoney(last.amount)} · ${Helpers.formatDate(last.payment_date)}</b></div>` : ''}`,
      `<button class="btn btn-outline" onclick="Modal.close()">Fermer</button>
       ${Auth.hasRole('manager', 'dir_admin', 'gestionnaire') ? `<button class="btn btn-primary" onclick="Modal.close();PageTenants.openTenantModal(${r.id})">✏️ Modifier la fiche</button>` : ''}`);
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
    } catch (e) {
      Toast.error(e.message);
    }
  },

  remove(id) { CrudPage.confirmDelete('/tenants/' + id, () => PageTenants.render()); },
};

window.PageTenants = PageTenants;
