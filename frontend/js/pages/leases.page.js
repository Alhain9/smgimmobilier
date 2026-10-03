// ============ Page Contrats de Bail — SMG IMMOBILIER ============
// Modèles de bail par immeuble, durées fermes (6 mois, 1 an, 2 ans, 3 ans) et renouvellement de bail
const PageLeases = {
  register() { Router.register('leases', () => this.render()); },
  _tenants: [],
  _apartments: [],
  _properties: [],
  _rows: {},

  async fields() {
    this._tenants = (await API.get('/tenants')).data || [];
    this._apartments = (await API.get('/apartments')).data || [];
    return [
      {
        name: 'tenant_id', label: 'Locataire', type: 'select', required: true,
        options: this._tenants.map((t) => ({ value: t.id, label: t.full_name || (t.user?.full_name) || ('Locataire #' + t.id) })),
      },
      {
        name: 'apartment_id', label: 'Logement & Immeuble', type: 'select', required: true,
        options: this._apartments.map((a) => ({
          value: a.id,
          label: `${a.apartment_number} — ${a.property?.property_name || 'Immeuble'} (${Helpers.formatMoney(a.rent_amount)}/mois)`,
          rent: a.rent_amount,
        })),
      },
      {
        name: 'duration_preset', label: 'Durée du bail', type: 'select', half: true,
        options: [
          { value: '12', label: '1 an (12 mois) — Recommandé' },
          { value: '6', label: '6 mois' },
          { value: '24', label: '2 ans (24 mois)' },
          { value: '36', label: '3 ans (36 mois)' },
          { value: 'custom', label: 'Personnalisée' },
        ],
      },
      { name: 'start_date', label: 'Date de début', type: 'date', required: true, half: true },
      { name: 'end_date', label: 'Date de fin', type: 'date', required: true, half: true },
      { name: 'monthly_rent', label: 'Loyer mensuel contractuel (FCFA)', type: 'number', required: true, half: true },
      { name: 'deposit_amount', label: 'Caution (FCFA)', type: 'number', half: true },
      {
        name: 'status', label: 'Statut du bail', type: 'select', options: [
          { value: 'active', label: 'Actif' },
          { value: 'pending', label: 'En attente de signature' },
          { value: 'expired', label: 'Expiré' },
          { value: 'terminated', label: 'Résilié' },
        ],
      },
    ];
  },

  async render() {
    const canEdit = Auth.hasRole('manager', 'dir_admin', 'gestionnaire', 'comptable');
    const canContact = Auth.hasRole('manager', 'dir_admin', 'gestionnaire', 'comptable');

    const toolbar = `
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <button class="btn btn-outline" onclick="Router.go('properties')">
          <span class="btn-icon">🏢</span> Modèles de contrat dans les Immeubles
        </button>
      </div>
    `;

    const data = await CrudPage.list({
      endpoint: '/leases',
      title: 'Contrats de bail',
      toolbar,
      canCreate: canEdit,
      onCreate: 'PageLeases.create',
      searchable: true,
      columns: [
        {
          label: 'Locataire',
          render: (r) => {
            const name = r.tenant?.user?.full_name || r.tenant?.full_name || '—';
            const phone = r.tenant?.user?.phone || r.tenant?.phone || '';
            return `<b>${name}</b>${phone ? `<br><small class="text-muted">📞 ${phone}</small>` : ''}`;
          },
        },
        {
          label: 'Bien loué',
          render: (r) => {
            const apt = r.apartment?.apartment_number || '—';
            const prop = r.apartment?.property?.property_name || '—';
            return `<b>Logement ${apt}</b><br><small class="text-muted">🏢 ${prop}</small>`;
          },
        },
        {
          label: 'Loyer mensuel',
          render: (r) => `<b style="color:var(--primary)">${Helpers.formatMoney(r.monthly_rent)}</b>`,
        },
        {
          label: 'Période du bail',
          render: (r) => {
            const start = Helpers.formatDate(r.start_date);
            const end = r.end_date ? Helpers.formatDate(r.end_date) : 'Indéterminé';
            return `Du ${start}<br>au <b>${end}</b>`;
          },
        },
        {
          label: 'Échéance & Validité',
          render: (r) => {
            if (!r.end_date) return '<span class="badge badge-muted">Non définie</span>';
            const end = new Date(r.end_date);
            const now = new Date();
            const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

            let renewalBadge = '';
            if (r.renewal_count > 0) {
              renewalBadge = `<span class="badge badge-info" style="font-size:10px;margin-left:4px" title="Renouvelé ${r.renewal_count} fois">🔄 R${r.renewal_count}</span>`;
            }

            if (r.status === 'terminated') {
              return `<span class="badge badge-muted">Résilié</span>${renewalBadge}`;
            }
            if (diffDays < 0) {
              return `<span class="badge badge-danger">⚠️ Expiré (${Math.abs(diffDays)} j)</span>${renewalBadge}`;
            }
            if (diffDays <= 30) {
              return `<span class="badge badge-warning">⏰ Expire dans ${diffDays} j</span>${renewalBadge}`;
            }
            const monthsLeft = Math.round(diffDays / 30.5);
            return `<span class="badge badge-success">✅ Actif (${monthsLeft} mois)</span>${renewalBadge}`;
          },
        },
        {
          label: 'Contrat signé (Word / PDF)',
          render: (r) => {
            if (r.contract_file) {
              const isWord = /\.docx?$/i.test(r.contract_file);
              return `<div class="flex items-center gap-1">
                <a class="btn btn-sm btn-outline" href="${Helpers.fileUrl(r.contract_file)}" ${isWord ? 'download' : 'target="_blank"'} title="${isWord ? 'Télécharger le contrat Word signé' : 'Consulter le contrat PDF signé'}" style="color:var(--primary);font-weight:600">
                  ${isWord ? '📄 Word signé' : '📄 PDF signé'}
                </a>
                ${canEdit ? `<button class="btn btn-sm btn-outline" onclick="PageLeases.uploadContract(${r.id})" title="Remplacer le fichier signé">🔄</button>` : ''}
              </div>`;
            }
            if (canEdit) {
              return `<button class="btn btn-sm btn-outline" onclick="PageLeases.uploadContract(${r.id})" title="Joindre le contrat signé (Word ou PDF)" style="color:var(--primary);font-weight:600">⬆ Joindre Contrat</button>`;
            }
            return '<span class="text-muted">Non téléversé</span>';
          },
        },
      ],
      rowActions: (r) => `
        <button class="btn btn-sm btn-outline" title="Imprimer ou télécharger le modèle de l'immeuble" onclick="PageLeases.printBuildingTemplate(${r.id})">🖨️ Modèle Immeuble</button>
        ${canEdit ? `<button class="btn btn-sm btn-success" title="Renouveler le bail (nouvelle période)" onclick="PageLeases.renewModal(${r.id})">🔄 Renouveler</button>` : ''}
        ${canContact ? `<button class="btn btn-sm btn-whatsapp" title="Relance WhatsApp" onclick="PageLeases.whatsapp(${r.id})">🟢</button>` : ''}
        ${canEdit ? `<button class="btn btn-sm btn-outline" title="Joindre / Remplacer contrat signé" onclick="PageLeases.uploadContract(${r.id})">⬆</button>
        <button class="btn btn-sm btn-outline" title="Modifier" onclick="PageLeases.edit(${r.id})">✏️</button>` : ''}
        ${Auth.hasRole('manager', 'dir_admin', 'comptable') ? `<button class="btn btn-sm btn-danger" title="Supprimer" onclick="PageLeases.remove(${r.id})">🗑</button>` : ''}
      `,
    });

    this._rows = {};
    (data || []).forEach((r) => { this._rows[r.id] = r; });
  },

  /**
   * Ouvre la fenêtre de gestion des modèles de contrats de bail par immeuble
   */
  async openBuildingTemplatesModal() {
    Toast.info('Chargement des immeubles...');
    try {
      const res = await API.get('/properties');
      this._properties = res.data || [];

      const rowsHtml = this._properties.map((p) => {
        const hasTemplate = !!p.lease_template_file;
        const isDocx = hasTemplate && /\.docx?$/i.test(p.lease_template_file);
        const templateUrl = hasTemplate ? Helpers.fileUrl(p.lease_template_file) : '';

        return `
          <tr style="border-bottom:1px solid #e2e8f0">
            <td style="padding:10px">
              <strong>🏢 ${p.property_name}</strong>
              <div style="font-size:11px;color:var(--text-muted)">${p.address || ''}, ${p.city || ''}</div>
            </td>
            <td style="padding:10px">
              ${hasTemplate
                ? `<span class="badge badge-success"><i class="fas fa-check"></i> Modèle enregistré (${isDocx ? 'Word .docx' : 'PDF'})</span>`
                : `<span class="badge badge-warning"><i class="fas fa-exclamation-circle"></i> Modèle standard SMG</span>`}
            </td>
            <td style="padding:10px;text-align:right;white-space:nowrap">
              ${hasTemplate
                ? `<a class="btn btn-sm btn-outline" href="${templateUrl}" target="_blank" style="margin-right:4px"><i class="fas fa-eye"></i> Voir</a>`
                : ''}
              <button class="btn btn-sm btn-primary" onclick="PageLeases.promptUploadTemplate(${p.id}, '${p.property_name.replace(/'/g, "\\'")}')">
                <i class="fas fa-upload"></i> ${hasTemplate ? 'Remplacer Word / PDF' : 'Téléverser Word (.docx)'}
              </button>
            </td>
          </tr>
        `;
      }).join('');

      const html = `
        <div style="padding:4px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
            <p style="font-size:13px;color:var(--text);margin:0;line-height:1.5;flex:1">
              Chaque bailleur ou gestionnaire peut définir le <strong>modèle officiel de contrat de bail au format Word (.docx)</strong> propre à son immeuble.
              Les balises indiquées ci-dessous seront automatiquement complétées avec les données réelles du locataire et du bien loué.
            </p>
            <a href="http://localhost:5000/api/properties/lease-template/sample" target="_blank" class="btn btn-sm btn-outline" style="font-weight:600;color:var(--primary);border-color:var(--primary)">
              📥 Télécharger le Modèle Word Type (.docx)
            </a>
          </div>

          <!-- Guide des balises dynamiques -->
          <details style="background:rgba(26,58,92,0.05);padding:10px 14px;border-radius:6px;margin-bottom:14px;font-size:12px;cursor:pointer">
            <summary><b>ℹ️ Guide des balises Word (.docx) utilisables [Cliquer pour afficher]</b></summary>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
              <div><code>{nom_locataire}</code> : Nom complet du preneur</div>
              <div><code>{telephone}</code> : Téléphone du preneur</div>
              <div><code>{cni_numero}</code> : Numéro CNI</div>
              <div><code>{date_cni}</code> : Date de délivrance CNI</div>
              <div><code>{lieu_cni}</code> : Lieu de délivrance CNI</div>
              <div><code>{profession}</code> : Profession du locataire</div>
              <div><code>{immeuble}</code> : Nom de l'immeuble</div>
              <div><code>{logement}</code> : Numéro du logement (ex: AW08)</div>
              <div><code>{type_logement}</code> : Type (Studio, Chambre...)</div>
              <div><code>{etage}</code> : Étage du logement</div>
              <div><code>{loyer}</code> : Loyer mensuel en FCFA</div>
              <div><code>{caution}</code> : Dépôt de garantie en FCFA</div>
              <div><code>{date_debut}</code> : Date de début du bail</div>
              <div><code>{date_fin}</code> : Date d'échéance du bail</div>
              <div><code>{duree_bail}</code> : Durée (ex: 12 mois)</div>
              <div><code>{date_du_jour}</code> : Date du jour de signature</div>
            </div>
            <p style="margin:8px 0 0;font-size:11px;color:var(--text-muted)">
              <i>Note : Les informations de votre agence / bailleur étant déjà présentes dans l'en-tête de vos documents, seuls le locataire et le bien loué sont complétés automatiquement.</i>
            </p>
          </details>

          <div class="table-responsive">
            <table class="table" style="width:100%">
              <thead>
                <tr>
                  <th>Immeuble</th>
                  <th>Statut du Modèle</th>
                  <th style="text-align:right">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colspan="3" class="text-center text-muted">Aucun immeuble enregistré</td></tr>'}
              </tbody>
            </table>
          </div>

          <div style="display:flex;justify-content:flex-end;margin-top:16px">
            <button class="btn btn-outline" onclick="Modal.close()">Fermer</button>
          </div>
        </div>
      `;

      Modal.open({
        title: 'Modèles Officiels de Contrat de Bail Word (.docx) & PDF',
        content: html,
        size: 'large',
      });
    } catch (e) {
      console.error(e);
      Toast.error('Erreur chargement des modèles');
    }
  },

  promptUploadTemplate(propertyId, propertyName) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      Toast.info(`Téléversement du modèle de contrat pour ${propertyName}...`);
      const fd = new FormData();
      fd.append('template', file);

      try {
        const token = Auth.getToken();
        const res = await fetch(`http://localhost:5000/api/properties/${propertyId}/lease-template`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Erreur téléversement');

        Toast.success(`Modèle officiel de bail pour ${propertyName} enregistré avec succès ! ✅`);
        Modal.close();
        PageLeases.openBuildingTemplatesModal();
      } catch (err) {
        console.error(err);
        Toast.error(err.message || 'Erreur téléversement modèle');
      }
    };
    input.click();
  },

  async printBuildingTemplate(leaseId) {
    this.downloadDocx(leaseId);
  },

  /**
   * Modal de renouvellement de bail
   */
  renewModal(id) {
    const l = this._rows[id];
    if (!l) return;

    const tenantName = l.tenant?.user?.full_name || l.tenant?.full_name || 'Locataire';
    const aptNumber = l.apartment?.apartment_number || '—';
    const propName = l.apartment?.property?.property_name || '—';
    const currentRent = l.monthly_rent || 0;

    // Nouvelle date de début = lendemain de l'ancien end_date
    let defaultStart = new Date().toISOString().slice(0, 10);
    if (l.end_date) {
      const oldEnd = new Date(l.end_date);
      oldEnd.setDate(oldEnd.getDate() + 1);
      defaultStart = oldEnd.toISOString().slice(0, 10);
    }

    // Calcul par défaut pour 1 an
    const defaultEnd = new Date(defaultStart);
    defaultEnd.setFullYear(defaultEnd.getFullYear() + 1);
    defaultEnd.setDate(defaultEnd.getDate() - 1);
    const defaultEndStr = defaultEnd.toISOString().slice(0, 10);

    const html = `
      <div style="padding:4px">
        <div style="background:#f0f4f8;border-left:4px solid var(--primary);padding:10px 14px;border-radius:4px;margin-bottom:16px">
          <strong>👤 Locataire :</strong> ${tenantName} &nbsp;|&nbsp; <strong>Logement :</strong> ${aptNumber} (${propName})<br>
          <small style="color:var(--text-muted)">Ancien bail : du ${Helpers.formatDate(l.start_date)} au <strong>${Helpers.formatDate(l.end_date)}</strong></small>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div style="grid-column:1 / -1">
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Durée du renouvellement *</label>
            <select id="renewDurationSelect" class="form-control" onchange="PageLeases.onRenewDurationChange()">
              <option value="12" selected>1 an (12 mois) — Période standard</option>
              <option value="6">6 mois</option>
              <option value="24">2 ans (24 mois)</option>
              <option value="36">3 ans (36 mois)</option>
              <option value="custom">Personnalisée</option>
            </select>
          </div>

          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Nouvelle date de prise d'effet (Début) *</label>
            <input type="date" id="renewStartDate" class="form-control" value="${defaultStart}" onchange="PageLeases.onRenewDurationChange()" />
          </div>

          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Nouvelle date d'échéance (Fin) *</label>
            <input type="date" id="renewEndDate" class="form-control" value="${defaultEndStr}" />
          </div>

          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Loyer mensuel contractuel (FCFA) *</label>
            <input type="number" id="renewRent" class="form-control" value="${currentRent}" step="1000" />
            <small style="color:var(--text-muted);font-size:11px">Ajustable en cas de réévaluation</small>
          </div>

          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Avenant signé (Optionnel, PDF)</label>
            <input type="file" id="renewContractFile" class="form-control" accept="application/pdf" />
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
          <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
          <button class="btn btn-success" onclick="PageLeases.submitRenewal(${id})">
            <span class="btn-icon">🔄</span> Valider le renouvellement
          </button>
        </div>
      </div>
    `;

    Modal.open({
      title: 'Renouvellement Officiel du Contrat de Bail',
      content: html,
      size: 'medium',
    });
  },

  onRenewDurationChange() {
    const duration = document.getElementById('renewDurationSelect')?.value;
    const startVal = document.getElementById('renewStartDate')?.value;
    if (!startVal || duration === 'custom') return;

    const months = parseInt(duration, 10);
    if (isNaN(months) || months <= 0) return;

    const end = new Date(startVal);
    end.setMonth(end.getMonth() + months);
    end.setDate(end.getDate() - 1);

    const endInput = document.getElementById('renewEndDate');
    if (endInput) endInput.value = end.toISOString().slice(0, 10);
  },

  async submitRenewal(id) {
    const start_date = document.getElementById('renewStartDate')?.value;
    const end_date = document.getElementById('renewEndDate')?.value;
    const monthly_rent = document.getElementById('renewRent')?.value;
    const durationVal = document.getElementById('renewDurationSelect')?.value;
    const file = document.getElementById('renewContractFile')?.files[0];

    if (!end_date || !monthly_rent) {
      Toast.error('Veuillez renseigner la date de fin et le loyer.');
      return;
    }

    Toast.info('Enregistrement du renouvellement...');

    try {
      const payload = {
        start_date,
        end_date,
        monthly_rent: Number(monthly_rent),
        duration_months: durationVal !== 'custom' ? parseInt(durationVal, 10) : null,
      };

      await API.post(`/leases/${id}/renew`, payload);

      // Si un nouvel avenant est joint
      if (file) {
        const fd = new FormData();
        fd.append('contract', file);
        await API.upload(`/leases/${id}/contract`, fd);
      }

      Modal.close();
      Toast.success('Bail renouvelé avec succès avec les nouvelles dates ! 🎉');
      await PageLeases.render();
    } catch (err) {
      console.error(err);
      Toast.error(err.message || 'Erreur lors du renouvellement');
    }
  },

  whatsapp(id) {
    const l = this._rows[id];
    Communication.openWhatsApp({
      name: l.tenant?.user?.full_name || l.tenant?.full_name,
      phone: l.tenant?.user?.phone || l.tenant?.phone,
      apartmentNumber: l.apartment?.apartment_number,
      propertyName: l.apartment?.property?.property_name,
      city: l.apartment?.property?.city,
      district: l.apartment?.property?.district,
      kind: 'contract',
    });
  },

  async openLeaseModal(options = {}) {
    const { isEdit = false, values = {} } = options;
    const title = isEdit ? 'Modifier le contrat de bail' : 'Nouveau contrat de bail';

    const [tenantsRes, aptsRes] = await Promise.all([
      API.get('/tenants'),
      API.get('/apartments')
    ]);
    this._tenants = tenantsRes.data || [];
    this._apartments = aptsRes.data || [];

    const defaultDuration = values.duration_preset || '12';
    const defaultStart = values.start_date || new Date().toISOString().slice(0, 10);
    let defaultEnd = values.end_date || '';
    if (!defaultEnd && defaultStart) {
      const d = new Date(defaultStart);
      d.setFullYear(d.getFullYear() + 1);
      d.setDate(d.getDate() - 1);
      defaultEnd = d.toISOString().slice(0, 10);
    }
    const defaultRent = values.monthly_rent || '';
    const defaultDeposit = values.deposit_amount || '';
    const defaultStatus = values.status || 'active';
    const selectedAptId = values.apartment_id || (values.apartment ? values.apartment.id : '');

    const aptOptions = [
      '<option value="">— Sélectionner un logement & immeuble —</option>',
      ...this._apartments.map(a => {
        const propName = a.property?.property_name || 'Immeuble';
        const city = a.property?.city ? ` (${a.property.city})` : '';
        const rent = a.rent_amount > 0 ? ` · ${Helpers.formatMoney(a.rent_amount)}/m` : '';
        const isSelected = String(a.id) === String(selectedAptId) ? 'selected' : '';
        return `<option value="${a.id}" ${isSelected} data-rent="${a.rent_amount || 0}">Logement ${Helpers.escapeHtml(a.apartment_number)} — ${Helpers.escapeHtml(propName)}${city}${rent}</option>`;
      })
    ].join('');

    const modalBody = `
      <form id="leaseForm" onsubmit="return false;" style="display:flex;flex-direction:column;gap:14px;">
        
        <!-- 1. SÉLECTEUR DE LOCATAIRE AVEC RECHERCHE ET DÉFILEMENT -->
        ${TenantPicker.html({
          name: 'tenant_id',
          label: 'Locataire preneur du bail *',
          placeholder: '🔍 Rechercher le locataire (nom, tél, immeuble, logement)...',
          required: true
        })}

        <!-- 2. LOGEMENT & IMMEUBLE LOUÉ (SÉLECTION AUTOMATIQUE) -->
        <div class="form-group" style="position:relative;">
          <label for="lease_apartment_id" style="font-weight:600;display:flex;justify-content:space-between;align-items:center;">
            <span>🏢 Logement & Immeuble attribué *</span>
            <span class="badge badge-info" style="font-size:10.5px;padding:2px 6px;">
              Auto-sélectionnable
            </span>
          </label>
          <select class="form-control" id="lease_apartment_id" required style="font-size:13.5px;">
            ${aptOptions}
          </select>
          <small id="lease_apt_hint" class="text-muted" style="font-size:11.5px;margin-top:3px;display:block;">
            💡 Si le locataire a déjà un logement assigné, il se positionne automatiquement ici.
          </small>
        </div>

        <!-- 3. DURÉE ET PÉRIODE DU BAIL -->
        <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group">
            <label for="lease_duration_preset" style="font-weight:600;">Durée du bail</label>
            <select id="lease_duration_preset" class="form-control">
              <option value="12" ${defaultDuration === '12' ? 'selected' : ''}>1 an (12 mois) — Recommandé</option>
              <option value="6" ${defaultDuration === '6' ? 'selected' : ''}>6 mois</option>
              <option value="24" ${defaultDuration === '24' ? 'selected' : ''}>2 ans (24 mois)</option>
              <option value="36" ${defaultDuration === '36' ? 'selected' : ''}>3 ans (36 mois)</option>
              <option value="custom" ${defaultDuration === 'custom' ? 'selected' : ''}>Personnalisée</option>
            </select>
          </div>
          <div class="form-group">
            <label for="lease_status" style="font-weight:600;">Statut du bail *</label>
            <select id="lease_status" class="form-control">
              <option value="active" ${defaultStatus === 'active' ? 'selected' : ''}>Actif</option>
              <option value="pending" ${defaultStatus === 'pending' ? 'selected' : ''}>En attente de signature</option>
              <option value="expired" ${defaultStatus === 'expired' ? 'selected' : ''}>Expiré</option>
              <option value="terminated" ${defaultStatus === 'terminated' ? 'selected' : ''}>Résilié</option>
            </select>
          </div>
        </div>

        <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group">
            <label for="lease_start_date" style="font-weight:600;">Date de prise d'effet (Début) *</label>
            <input type="date" id="lease_start_date" class="form-control" value="${defaultStart}" required />
          </div>
          <div class="form-group">
            <label for="lease_end_date" style="font-weight:600;">Date d'échéance (Fin) *</label>
            <input type="date" id="lease_end_date" class="form-control" value="${defaultEnd}" required />
          </div>
        </div>

        <!-- 4. CONDITIONS FINANCIÈRES -->
        <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group">
            <label for="lease_monthly_rent" style="font-weight:600;">Loyer mensuel contractuel (FCFA) *</label>
            <input type="number" id="lease_monthly_rent" class="form-control" value="${defaultRent}" placeholder="ex: 150000" step="1000" required />
          </div>
          <div class="form-group">
            <label for="lease_deposit_amount" style="font-weight:600;">Caution / Dépôt de garantie (FCFA)</label>
            <input type="number" id="lease_deposit_amount" class="form-control" value="${defaultDeposit}" placeholder="ex: 300000" step="1000" />
          </div>
        </div>

      </form>
    `;

    const modalFooter = `
      <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
      <button class="btn btn-primary" id="btnSubmitLease">
        ${isEdit ? '💾 Mettre à jour le bail' : '✅ Créer le contrat de bail'}
      </button>
    `;

    Modal.open({
      title,
      content: modalBody,
      footer: modalFooter,
      size: 'medium'
    });

    // Recalcul auto de la date de fin selon la durée
    const calcEndDate = () => {
      const dur = document.getElementById('lease_duration_preset')?.value;
      const startVal = document.getElementById('lease_start_date')?.value;
      if (!startVal || dur === 'custom') return;
      const months = parseInt(dur, 10);
      if (isNaN(months) || months <= 0) return;
      const end = new Date(startVal);
      end.setMonth(end.getMonth() + months);
      end.setDate(end.getDate() - 1);
      const endInput = document.getElementById('lease_end_date');
      if (endInput) endInput.value = end.toISOString().slice(0, 10);
    };

    document.getElementById('lease_duration_preset')?.addEventListener('change', calcEndDate);
    document.getElementById('lease_start_date')?.addEventListener('change', calcEndDate);

    // Si on change le logement manuellement, mettre à jour le loyer suggéré si vide
    document.getElementById('lease_apartment_id')?.addEventListener('change', (e) => {
      const selectedOpt = e.target.options[e.target.selectedIndex];
      const rent = selectedOpt?.getAttribute('data-rent');
      const rentInput = document.getElementById('lease_monthly_rent');
      if (rent && rentInput && (!rentInput.value || parseFloat(rentInput.value) === 0)) {
        rentInput.value = rent;
      }
    });

    // Initialisation du TenantPicker
    TenantPicker.init({
      tenants: this._tenants,
      apartments: this._apartments,
      selectedTenantId: values.tenant_id || (values.tenant ? values.tenant.id : null),
      apartmentSelectId: 'lease_apartment_id',
      rentInputId: 'lease_monthly_rent',
      onSelect: (tenant, meta) => {
        const hintEl = document.getElementById('lease_apt_hint');
        if (hintEl && meta.hasApartment) {
          hintEl.innerHTML = `<span style="color:#16a34a;font-weight:600;">✓ Logement assigné à ${Helpers.escapeHtml(meta.name)} : ${Helpers.escapeHtml(meta.propertyName)} (${Helpers.escapeHtml(meta.apartmentNumber)})</span>`;
        }
      }
    });

    // Soumission du bail
    document.getElementById('btnSubmitLease').onclick = async () => {
      const tenantId = document.getElementById('tp_hidden_id')?.value;
      const apartmentId = document.getElementById('lease_apartment_id')?.value;
      const startDate = document.getElementById('lease_start_date')?.value;
      const endDate = document.getElementById('lease_end_date')?.value;
      const monthlyRent = document.getElementById('lease_monthly_rent')?.value;
      const depositAmount = document.getElementById('lease_deposit_amount')?.value;
      const status = document.getElementById('lease_status')?.value;
      const durationPreset = document.getElementById('lease_duration_preset')?.value;

      if (!tenantId) {
        Toast.error('Veuillez sélectionner un locataire dans la liste');
        document.getElementById('tp_search_input')?.focus();
        return;
      }
      if (!apartmentId) {
        Toast.error('Veuillez sélectionner un logement pour ce contrat de bail');
        document.getElementById('lease_apartment_id')?.focus();
        return;
      }
      if (!startDate) {
        Toast.error('Veuillez indiquer la date de début du bail');
        return;
      }
      if (!monthlyRent || parseFloat(monthlyRent) <= 0) {
        Toast.error('Veuillez indiquer le loyer mensuel en FCFA');
        document.getElementById('lease_monthly_rent')?.focus();
        return;
      }

      const payload = {
        tenant_id: parseInt(tenantId, 10),
        apartment_id: parseInt(apartmentId, 10),
        start_date: startDate,
        end_date: endDate || null,
        monthly_rent: parseFloat(monthlyRent),
        deposit_amount: depositAmount ? parseFloat(depositAmount) : 0,
        status: status,
      };

      if (durationPreset && durationPreset !== 'custom') {
        payload.duration_months = parseInt(durationPreset, 10);
      }

      try {
        if (isEdit) {
          await API.put(`/leases/${values.id}`, payload);
          Toast.success('Contrat de bail mis à jour avec succès');
        } else {
          await API.post('/leases', payload);
          Toast.success('Contrat de bail créé avec succès');
        }

        Modal.close();
        PageLeases.render();
      } catch (err) {
        Toast.error(err.message || 'Erreur lors de l’enregistrement du contrat de bail');
      }
    };
  },

  async create() {
    await this.openLeaseModal({ isEdit: false });
  },

  async edit(id) {
    const r = (await API.get('/leases/' + id)).data;
    await this.openLeaseModal({ isEdit: true, values: r });
  },

  uploadContract(id) {
    Modal.open({
      title: '📄 Contrat de bail — Téléversement du document signé',
      content: `
        <div class="form-group mb-3">
          <label style="font-weight:600">Fichier du contrat signé ou validé (Word .docx ou PDF) :</label>
          <input type="file" id="contractFile" class="form-control" accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword" />
          <small class="text-muted" style="font-size:12px;display:block;margin-top:4px">
            Formats acceptés : Document Word (.docx, .doc) ou PDF signé (.pdf)
          </small>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
          <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
          <button class="btn btn-primary" onclick="PageLeases.submitContract(${id})">⬆ Enregistrer le contrat</button>
        </div>
      `,
      size: 'medium',
    });
  },

  async submitContract(id) {
    const file = document.getElementById('contractFile')?.files[0];
    if (!file) { Toast.error('Veuillez sélectionner un fichier Word (.docx) ou PDF'); return; }
    const fd = new FormData();
    fd.append('contract', file);

    try {
      await API.upload('/leases/' + id + '/contract', fd);
      Modal.close();
      Toast.success('Contrat de bail enregistré avec succès dans le dossier ✅');
      PageLeases.render();
    } catch (e) {
      Toast.error(e.message);
    }
  },


  remove(id) {
    CrudPage.confirmDelete('/leases/' + id, () => PageLeases.render());
  },
};

window.PageLeases = PageLeases;
