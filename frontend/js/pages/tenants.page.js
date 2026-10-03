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

  _showAll: false,
  toggleShowAll() {
    this._showAll = !this._showAll;
    this.render();
  },

  async render() {
    await this.loadAuxiliaryData();

    const isRestrictedRole = Auth.hasRole('comptable', 'gestionnaire') && !Auth.hasRole('manager', 'super_admin');

    let rawTenants = [];
    try {
      const res = await API.get('/tenants');
      rawTenants = res.data || [];
    } catch (_) { rawTenants = []; }

    const assignedCount = rawTenants.filter((t) => t.is_assigned).length;
    const othersCount = rawTenants.length - assignedCount;
    const hasAssigned = assignedCount > 0;

    let filterBanner = '';
    if (isRestrictedRole && hasAssigned) {
      if (!this._showAll) {
        filterBanner = `
          <div style="background:#e8f5e9;border:1px solid #c8e6c9;padding:10px 16px;border-radius:8px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
            <div style="font-size:13px;color:#1b5e20;font-weight:600">
              👤 <b>Affichage prioritaire :</b> Vous visualisez les <b>${assignedCount}</b> locataire(s) de vos immeubles. ${othersCount > 0 ? `(${othersCount} autre(s) locataire(s) masqué(s))` : ''}
            </div>
            ${othersCount > 0 ? `
              <button class="btn btn-sm btn-outline" style="border-color:#2e7d32;color:#1b5e20" onclick="PageTenants.toggleShowAll()">
                👁️ Afficher tous les locataires (démasquer)
              </button>
            ` : ''}
          </div>
        `;
      } else {
        filterBanner = `
          <div style="background:#fff3cd;border:1px solid #ffeeba;padding:10px 16px;border-radius:8px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
            <div style="font-size:13px;color:#856404;font-weight:600">
              👁️ <b>Tous les locataires sont visibles :</b> Ceux de vos immeubles assignés sont placés en tête de liste.
            </div>
            <button class="btn btn-sm btn-primary" onclick="PageTenants.toggleShowAll()">
              🔒 Masquer les autres locataires
            </button>
          </div>
        `;
      }
    }

    const data = await CrudPage.list({
      endpoint: '/tenants',
      title: 'Locataires & Affectations',
      canCreate: true,
      onCreate: 'PageTenants.openTenantModal',
      toolbar: filterBanner,
      mapData: (all) => {
        if (!isRestrictedRole || !hasAssigned || this._showAll) return all;
        return all.filter((t) => t.is_assigned);
      },
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
            const badge = r.is_assigned
              ? `<span style="display:inline-block;background:#d4edda;color:#155724;font-size:10px;font-weight:700;padding:1px 6px;border-radius:20px;margin-left:4px">★ Mon immeuble</span>`
              : (isRestrictedRole && hasAssigned ? `<span style="display:inline-block;background:#f1f5f9;color:#64748b;font-size:10px;font-weight:600;padding:1px 6px;border-radius:20px;margin-left:4px">Autre</span>` : '');
            return prop
              ? `<b style="color:var(--primary)">🏢 ${prop.property_name}</b>${badge}${prop.city ? `<br><small class="text-muted">📍 ${prop.city}</small>` : ''}`
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

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
            <div>
              <label class="form-label">Montant du loyer mensuel (FCFA) *</label>
              <input type="number" id="tm_monthly_rent" class="form-control" required placeholder="ex: 150000" oninput="PageTenants.updateCalculatedMonths()" />
            </div>
            <div>
              <label class="form-label">Description du logement</label>
              <input type="text" id="tm_description" class="form-control" placeholder="ex: Studio moderne, Chambre 12..." />
            </div>
          </div>

          <div id="tm_apt_info_box" style="display:none;margin-top:10px;padding:10px;background:rgba(26,58,92,0.05);border-radius:6px;font-size:12px">
            <!-- Rempli dynamiquement -->
          </div>
        </div>

        <!-- VOLET 3 : RÈGLEMENT INITIAL & OBSERVATIONS -->
        <div style="background:var(--card-bg, #ffffff);border:1px solid var(--border);padding:14px;border-radius:8px;margin-bottom:14px">
          <h4 style="font-size:14px;font-weight:700;margin:0 0 12px;color:var(--primary);display:flex;align-items:center;gap:6px">
            <span>💰</span> 3. Modalités Financières, Paiement & Observations
          </h4>
          <p style="font-size:12px;color:var(--text-muted);margin:-6px 0 12px">
            Renseignez le montant versé, la période couverte, le mode de règlement, la caution et les observations contractuelles pour l'archivage.
          </p>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label class="form-label">Montant versé (FCFA)</label>
              <input type="number" id="tm_paid_amount" class="form-control" placeholder="0" oninput="PageTenants.updateCalculatedMonths()" />
              <small id="tm_months_calc_badge" class="text-muted" style="display:block;margin-top:3px;font-size:11.5px;font-weight:600;color:var(--primary)"></small>
            </div>
            <div>
              <label class="form-label">Caution / Dépôt de garantie (FCFA)</label>
              <input type="number" id="tm_deposit" class="form-control" placeholder="0" />
            </div>
            <div>
              <label class="form-label">Période correspondant au paiement (Début)</label>
              <input type="date" id="tm_period_start" class="form-control" value="${t?.start_date ? t.start_date.slice(0, 10) : new Date().toISOString().slice(0, 10)}" onchange="PageTenants.updateCalculatedMonths()" />
            </div>
            <div>
              <label class="form-label">Période correspondant au paiement (Fin)</label>
              <input type="date" id="tm_period_end" class="form-control" value="${t?.end_date ? t.end_date.slice(0, 10) : ''}" />
            </div>
            <div style="grid-column: 1 / -1">
              <label class="form-label">Mode de paiement</label>
              <select id="tm_payment_method" class="form-control">
                <option value="cash" selected>Espèces (Cash)</option>
                <option value="bank_transfer">Virement bancaire</option>
                <option value="orange_money">Orange Money</option>
                <option value="mtn_mobile_money">MTN MoMo</option>
                <option value="campay">Campay</option>
              </select>
            </div>
            <div style="grid-column: 1 / -1">
              <label class="form-label">Observation (Archivage et historique des modalités)</label>
              <textarea id="tm_observations" class="form-control" rows="3" placeholder="ex: Paye 08 mois + la caution maintenant et à la fin du mois il complète le reste...">${t ? (t.observations || '') : ''}</textarea>
              <small class="text-muted" style="font-size:11px">Très important pour archiver les informations du locataire et les modalités de paiement.</small>
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Annuler</button>
          <button type="submit" class="btn btn-primary" id="tm_submit_btn">
            ${t ? 'Enregistrer les Modifications' : 'Enregistrer le Locataire'}
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

        return `<option value="${a.id}" data-rent="${a.rent_amount}" data-type="${a.apartment_type || ''}" data-desc="${Helpers.escapeHtml(a.description || a.apartment_type || '')}" data-status="${a.status}" ${isSel ? 'selected' : ''}>
          Logement ${a.apartment_number}${typeStr}${floorStr} — ${fmt(a.rent_amount)} FCFA [${statusBadge}]
        </option>`;
      }).join('');

    this.onApartmentChange();
  },

  onApartmentChange() {
    const aptSelect = document.getElementById('tm_apartment');
    const infoBox = document.getElementById('tm_apt_info_box');
    const rentInput = document.getElementById('tm_monthly_rent');
    const descInput = document.getElementById('tm_description');
    const depositInput = document.getElementById('tm_deposit');
    if (!aptSelect) return;

    const opt = aptSelect.options[aptSelect.selectedIndex];
    if (!opt || !opt.value) {
      if (infoBox) infoBox.style.display = 'none';
      return;
    }

    const rent = opt.getAttribute('data-rent') || '0';
    const type = opt.getAttribute('data-type') || 'Logement';
    const desc = opt.getAttribute('data-desc') || type;
    const status = opt.getAttribute('data-status') || '';

    if (rentInput && (!rentInput.value || rentInput.value === '0')) {
      rentInput.value = rent;
    }
    if (descInput && !descInput.value) {
      descInput.value = desc;
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
    this.updateCalculatedMonths();
  },

  updateCalculatedMonths() {
    const rent = parseFloat(document.getElementById('tm_monthly_rent')?.value) || 0;
    const paid = parseFloat(document.getElementById('tm_paid_amount')?.value) || 0;
    const badge = document.getElementById('tm_months_calc_badge');
    const startVal = document.getElementById('tm_period_start')?.value;
    const endInput = document.getElementById('tm_period_end');

    if (rent > 0 && paid > 0) {
      const months = Math.floor(paid / rent);
      const remainder = paid % rent;
      const desc = months > 0 
        ? `💡 Correspond à ${months} mois de loyer${remainder > 0 ? ` + reliquat ${remainder.toLocaleString('fr-FR')} FCFA` : ''}`
        : `💡 Avance partielle (${paid.toLocaleString('fr-FR')} FCFA)`;
      if (badge) badge.textContent = desc;

      if (startVal && endInput && months > 0 && (!endInput.value || endInput.dataset.autoCalculated === 'true')) {
        const d = new Date(startVal);
        d.setMonth(d.getMonth() + months);
        d.setDate(d.getDate() - 1);
        endInput.value = d.toISOString().slice(0, 10);
        endInput.dataset.autoCalculated = 'true';
      }
    } else {
      if (badge) badge.textContent = '';
    }
  },

  async submitTenantModal(e, tenantId) {
    e.preventDefault();
    const btn = document.getElementById('tm_submit_btn');
    if (btn) btn.disabled = true;

    const civility = document.getElementById('tm_civility')?.value || 'Monsieur';
    const full_name = document.getElementById('tm_full_name').value.trim();
    const phone = document.getElementById('tm_phone').value.trim();
    const email = document.getElementById('tm_email')?.value.trim() || `${phone.replace(/\s+/g, '')}@smg-immobilier.com`;
    const password = document.getElementById('tm_password')?.value;
    const profession = document.getElementById('tm_profession')?.value.trim() || null;
    const national_id = document.getElementById('tm_cni')?.value.trim() || null;
    const cni_delivery_date = document.getElementById('tm_cni_date')?.value || null;
    const cni_delivery_place = document.getElementById('tm_cni_place')?.value.trim() || null;
    const emergency_contact = document.getElementById('tm_emergency')?.value.trim() || null;

    const apartment_id = document.getElementById('tm_apartment').value ? parseInt(document.getElementById('tm_apartment').value, 10) : null;
    const monthly_rent = parseFloat(document.getElementById('tm_monthly_rent')?.value) || 0;
    const description = document.getElementById('tm_description')?.value.trim() || '';
    const deposit_amount = parseFloat(document.getElementById('tm_deposit')?.value) || 0;
    const paid_amount = parseFloat(document.getElementById('tm_paid_amount')?.value) || 0;
    const period_start = document.getElementById('tm_period_start')?.value || null;
    const period_end = document.getElementById('tm_period_end')?.value || null;
    const payment_method = document.getElementById('tm_payment_method')?.value || 'cash';
    const observations = document.getElementById('tm_observations')?.value.trim() || '';

    const payload = {
      civility,
      full_name,
      phone,
      email,
      profession,
      national_id,
      cni: national_id,
      cni_delivery_date,
      cni_delivery_place,
      emergency_contact,
      apartment_id,
      monthly_rent,
      deposit_amount,
      start_date: period_start || new Date().toISOString().slice(0, 10),
      end_date: period_end,
      observations,
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

      // Mettre à jour la description et le loyer du logement si renseigné
      if (apartment_id && (description || monthly_rent > 0)) {
        try {
          await API.put('/apartments/' + apartment_id, {
            description: description,
            rent_amount: monthly_rent
          });
        } catch (_) {}
      }

      // Si un versement initial est effectué, créer le paiement correspondant
      if (paid_amount > 0 && savedTenant) {
        try {
          await API.post('/payments', {
            tenant_id: savedTenant.id,
            apartment_id: apartment_id,
            amount: paid_amount,
            payment_date: new Date().toISOString().slice(0, 10),
            payment_method: payment_method,
            period_start: period_start,
            period_end: period_end,
            observations: observations,
            status: 'completed'
          });
        } catch (payErr) {
          console.warn('Erreur enregistrement versement initial:', payErr);
        }
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
