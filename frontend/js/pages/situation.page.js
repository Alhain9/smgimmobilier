// ============ Situation des locataires + récapitulatifs par période ============
// Réservé à ceux qui gèrent les locataires (super_admin, manager, dir_admin, gestionnaire).
const PageSituation = {
  register() { Router.register('situation', () => this.render()); },
  _situation: [], _start: null, _end: null,
  _month: new Date().getMonth() + 1,
  _year: new Date().getFullYear(),
  _recapPropertyIds: [], // IDs des immeubles filtrés pour le récap
  _propertiesList: [], // Liste des immeubles disponibles
  _selectedBuildingIds: [], // IDs des immeubles sélectionnés pour la vue détaillée
  _buildings: [], // Données de tous les immeubles chargés

  async render() {
    Layout.setTitle('Situation & rapports');
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    this._start = `${y}-${m}-01`;
    this._end = `${y}-${m}-${d}`;
    this._month = now.getMonth() + 1;
    this._year = now.getFullYear();

    Layout.content(`
      <div class="page-head flex justify-between items-center flex-wrap gap-3">
        <div><h2>Situation & rapports</h2><div class="subtitle">Rapports périodiques de gestion immobilière et situation officielle des immeubles</div></div>
        <div class="flex gap-2 items-center flex-wrap no-print">
          <select class="form-control" id="sitHeaderBldSelect" style="max-width:260px" onchange="PageSituation.selectBuildingFilter(this.value)">
            <option value="">🏢 Tous les immeubles</option>
          </select>
          <button class="btn btn-outline" onclick="window.print()">🖨 Imprimer</button>
        </div>
      </div>

      <div class="card no-print">
        <div class="card-header flex justify-between items-center flex-wrap gap-2">
          <h3>📅 Période du récapitulatif</h3>
          <div class="flex gap-2 items-center flex-wrap">
            <button class="btn btn-sm btn-outline" onclick="PageSituation.toggleRecapBuildingFilter()" title="Filtrer par immeuble">🏢 Filtrer immeubles</button>
          </div>
        </div>
        <div class="card-body">
          <div id="recapBuildingFilter" style="display:none;margin-bottom:12px;padding:10px;background:var(--bg-surface-2);border-radius:8px;border:1px solid var(--border)">
            <div style="font-weight:600;margin-bottom:6px;font-size:13px;color:var(--primary)">🏢 Sélectionner les immeubles à inclure dans le récapitulatif :</div>
            <div id="recapBldCheckboxes" class="flex gap-3 flex-wrap" style="max-height:120px;overflow-y:auto"></div>
            <div class="flex gap-2 mt-2">
              <button class="btn btn-sm btn-outline" onclick="PageSituation.selectAllRecapBuildings(true)">✅ Tous</button>
              <button class="btn btn-sm btn-outline" onclick="PageSituation.selectAllRecapBuildings(false)">❌ Aucun</button>
              <button class="btn btn-sm btn-primary" onclick="PageSituation.applyRecapBuildingFilter()">Appliquer le filtre</button>
            </div>
          </div>
          <div class="period-bar">
            <div class="period-presets">
              <button class="btn btn-sm btn-primary" onclick="PageSituation.applyPreset('month')">Ce mois</button>
              <button class="btn btn-sm btn-outline" onclick="PageSituation.applyPreset(30)">30 jours</button>
              <button class="btn btn-sm btn-outline" onclick="PageSituation.applyPreset(90)">3 mois</button>
              <button class="btn btn-sm btn-outline" onclick="PageSituation.applyPreset('year')">Cette année</button>
            </div>
            <div class="period-custom">
              <input type="date" class="form-control" id="sitStart" value="${this._start}"/>
              <span>→</span>
              <input type="date" class="form-control" id="sitEnd" value="${this._end}"/>
              <button class="btn btn-sm btn-primary" onclick="PageSituation.applyCustom()">Appliquer</button>
            </div>
          </div>
        </div>
      </div>

      <div id="recapBox"><div class="spinner"></div></div>

      <div class="card" id="buildingCardSection">
        <div class="card-header flex justify-between items-center flex-wrap gap-2">
          <h3>🏢 Situation détaillée par immeuble (Modèle Officiel 12 Colonnes)</h3>
          <div class="flex gap-2 no-print flex-wrap items-center">
            <select class="form-control" id="bldMonth" style="max-width:120px" onchange="PageSituation.onPeriodChange()">
              <option value="1" ${this._month === 1 ? 'selected' : ''}>Janvier</option>
              <option value="2" ${this._month === 2 ? 'selected' : ''}>Février</option>
              <option value="3" ${this._month === 3 ? 'selected' : ''}>Mars</option>
              <option value="4" ${this._month === 4 ? 'selected' : ''}>Avril</option>
              <option value="5" ${this._month === 5 ? 'selected' : ''}>Mai</option>
              <option value="6" ${this._month === 6 ? 'selected' : ''}>Juin</option>
              <option value="7" ${this._month === 7 ? 'selected' : ''}>Juillet</option>
              <option value="8" ${this._month === 8 ? 'selected' : ''}>Août</option>
              <option value="9" ${this._month === 9 ? 'selected' : ''}>Septembre</option>
              <option value="10" ${this._month === 10 ? 'selected' : ''}>Octobre</option>
              <option value="11" ${this._month === 11 ? 'selected' : ''}>Novembre</option>
              <option value="12" ${this._month === 12 ? 'selected' : ''}>Décembre</option>
            </select>
            <select class="form-control" id="bldYear" style="max-width:90px" onchange="PageSituation.onPeriodChange()">
              <option value="2024" ${this._year === 2024 ? 'selected' : ''}>2024</option>
              <option value="2025" ${this._year === 2025 ? 'selected' : ''}>2025</option>
              <option value="2026" ${this._year === 2026 ? 'selected' : ''}>2026</option>
              <option value="2027" ${this._year === 2027 ? 'selected' : ''}>2027</option>
              <option value="2028" ${this._year === 2028 ? 'selected' : ''}>2028</option>
            </select>
            <button class="btn btn-sm btn-outline" id="bldExport" style="display:none" onclick="PageSituation.exportBuildingExcel()">⬇ Exporter Excel</button>
            <button class="btn btn-sm btn-outline" id="bldExportPdf" style="display:none" onclick="PageSituation.exportBuildingPdf()">📄 Exporter PDF</button>
            <button class="btn btn-sm btn-primary" onclick="PageProperties.openImportModal()">📤 Importer Excel</button>
            <button class="btn btn-sm btn-success" onclick="PageSituation.openQuickPayment()">💳 Nouveau Paiement</button>
          </div>
        </div>
        <div class="card-body">
          <div id="bldCheckboxArea" class="no-print" style="margin-bottom:12px;padding:10px;background:var(--bg-surface-2);border-radius:8px;border:1px solid var(--border)">
            <div style="font-weight:600;margin-bottom:8px;font-size:13px;color:var(--primary)">🏢 Sélectionnez les immeubles à afficher :</div>
            <div id="bldCheckboxes" class="flex gap-3 flex-wrap" style="max-height:140px;overflow-y:auto"></div>
            <div class="flex gap-2 mt-2 items-center flex-wrap">
              <button class="btn btn-sm btn-outline" style="border-color:#2e7d32;color:#1b5e20;font-weight:600" onclick="PageSituation.selectMyBuildingsOnly()">★ Mes immeubles uniquement</button>
              <button class="btn btn-sm btn-outline" onclick="PageSituation.selectAllBuildings(true)">✅ Tous</button>
              <button class="btn btn-sm btn-outline" onclick="PageSituation.selectAllBuildings(false)">❌ Aucun</button>
              <button class="btn btn-sm btn-primary" onclick="PageSituation.loadSelectedBuildings()" id="btnLoadBuildings">🔄 Charger la situation</button>
              <span id="bldSelCount" class="text-muted" style="font-size:12px"></span>
            </div>
          </div>
          <div id="buildingBox" class="text-muted">Sélectionnez un ou plusieurs immeubles ci-dessus, puis cliquez « Charger la situation ».</div>
        </div>
      </div>
    `);
    this.loadRecap();
    this.loadBuildingsList();
  },

  onPeriodChange() {
    const mEl = document.getElementById('bldMonth');
    const yEl = document.getElementById('bldYear');
    if (mEl) this._month = parseInt(mEl.value, 10) || (new Date().getMonth() + 1);
    if (yEl) this._year = parseInt(yEl.value, 10) || new Date().getFullYear();
    if (this._selectedBuildingIds.length > 0) this.loadSelectedBuildings();
  },

  // ---------- Situation par immeuble (modèle Excel officiel 12 colonnes) ----------
  async loadBuildingsList() {
    try {
      const props = (await API.get('/properties')).data || [];
      this._propertiesList = props;

      const isRestrictedRole = Auth.hasRole('comptable', 'gestionnaire') && !Auth.hasRole('manager', 'super_admin');
      const assignedProps = props.filter((p) => p.is_assigned);

      // Si le comptable/gestionnaire a des immeubles affectés et qu'aucune sélection n'est active :
      if (isRestrictedRole && assignedProps.length > 0 && this._selectedBuildingIds.length === 0) {
        this._selectedBuildingIds = assignedProps.map((p) => p.id);
      }

      // Header select (filtrage général situation locataires)
      const headSel = document.getElementById('sitHeaderBldSelect');
      if (headSel) {
        headSel.innerHTML = '<option value="">🏢 Tous les immeubles</option>'
          + props.map((p) => `<option value="${p.id}">${p.is_assigned ? '★ ' : ''}${p.property_name}${p.is_assigned ? ' (Mon immeuble)' : ''}</option>`).join('');
      }

      // Checkboxes multi-sélection pour la vue détaillée
      this.renderBuildingCheckboxes();
      // Remplir les checkboxes du filtre récap
      this.renderRecapBuildingCheckboxes();

      // Pré-charger la situation détaillée des immeubles assignés
      if (isRestrictedRole && this._selectedBuildingIds.length > 0) {
        this.loadSelectedBuildings();
      }
    } catch (_) { /* ignore */ }
  },
  _building: null,
  COLS: [
    ['numero_chambre', 'N° DU LOGEMENT', 'text'],
    ['nom_locataire', 'NOMS & PRÉNOMS', 'text_bold'],
    ['telephone', 'CONTACT', 'phone'],
    ['montant_loyer', 'MONTANT DU LOYER', 'money'],
    ['description_logement', 'DESCRIPTION DU LOGEMENT', 'text'],
    ['arriere_loyer', 'ARRIÉRÉ DU LOYER', 'money_arriere'],
    ['anticipation', 'LOYER PAR ANTICIPATION', 'money_anticipation'],
    ['versement_mois', 'VERSEMENT AU COURS DU MOIS', 'money_versement'],
    ['periode_paiement', 'PÉRIODE CORRESPONDANT AU PAIEMENT', 'text'],
    ['mode_paiement', 'MODE DE PAIEMENT', 'method'],
    ['caution', 'CAUTION', 'money'],
    ['observations', 'OBSERVATIONS', 'text'],
  ],
  _cell(l, key, type) {
    const v = l[key];
    if (v == null || v === '') return '—';
    if (type === 'money') return Helpers.formatMoney(v);
    if (type === 'money_arriere') {
      const n = Number(v) || 0;
      return n > 0 ? `<b style="color:var(--danger)">${Helpers.formatMoney(n)}</b>` : '0 FCFA';
    }
    if (type === 'money_versement') {
      const n = Number(v) || 0;
      return n > 0 ? `<b style="color:var(--primary);font-weight:700">${Helpers.formatMoney(n)}</b>` : '0 FCFA';
    }
    if (type === 'money_anticipation') {
      const n = Number(v) || 0;
      return n > 0 ? `<b style="color:var(--success)">${Helpers.formatMoney(n)}</b>` : '0 FCFA';
    }
    if (type === 'phone') {
      return (v && v !== '—') ? `<a href="tel:${v}">${v}</a>` : '—';
    }
    if (type === 'text_bold') {
      return (v && v !== '—') ? `<b>${v}</b>` : '—';
    }
    if (type === 'method') {
      return (v && v !== '—') ? Helpers.methodLabel(v) : '—';
    }
    return v;
  },

  render12ColTableHtml(containerId, lignes, total, propertyId = null, periodYm = null) {
    const sum = (k) => (lignes || []).reduce((s, l) => s + (Number(l[k]) || 0), 0);
    const tot = total || {
      montant_loyer: sum('montant_loyer'),
      arriere_loyer: sum('arriere_loyer'),
      anticipation: sum('anticipation'),
      versement_mois: sum('versement_mois'),
      caution: sum('caution'),
    };

    const headCols = this.COLS.map((c) => `<th style="white-space:nowrap;background:#e8f5e9;color:#1b5e20;border:1px solid #c8e6c9;font-weight:700;font-size:11.5px;text-align:center">${c[1]}</th>`).join('');
    const thead = `
      <thead>
        <tr>
          <th class="no-print" style="width:36px;text-align:center;background:#e8f5e9;border:1px solid #c8e6c9">
            <input type="checkbox" id="chkAll_${containerId}" onchange="PageSituation.toggleSelectAll('${containerId}', this.checked)" title="Tout sélectionner" />
          </th>
          ${headCols}
          <th class="no-print" style="text-align:center;width:120px;background:#e8f5e9;border:1px solid #c8e6c9">Actions</th>
        </tr>
      </thead>
    `;

    const rows = (lignes || []).map((l) => {
      const tds = this.COLS.map((c, idx) => {
        let cellContent = this._cell(l, c[0], c[2]);
        if (idx === 0 && l.is_overridden) {
          cellContent += ` <span title="Ligne modifiée manuellement (chiffres ajustés)" style="color:#d97706;font-size:10px;cursor:help">✏️</span>`;
        }
        return `<td>${cellContent}</td>`;
      }).join('');
      const canCheck = !!l.tenant_id;
      return `
        <tr ${l.is_overridden ? 'style="background:rgba(254, 243, 199, 0.25)"' : ''}>
          <td class="no-print" style="text-align:center">
            <input type="checkbox" class="row-chk-${containerId}" value="${l.tenant_id || ''}" data-apt="${l.apartment_id || ''}" onchange="PageSituation.updateSelection('${containerId}')" ${!canCheck ? 'disabled title="Aucun locataire associé"' : ''} />
          </td>
          ${tds}
          <td class="no-print" style="text-align:center;white-space:nowrap">
            ${l.tenant_id ? `
              <button class="btn btn-sm btn-success" style="padding:2px 6px;margin-right:2px;" title="Enregistrement d'un paiement" onclick="PageSituation.payTenant(${l.tenant_id}, ${l.apartment_id || 'null'}, ${l.montant_loyer || 0})">💳</button>
            ` : ''}
            <button class="btn btn-sm btn-primary" style="padding:2px 6px;margin-right:2px;" title="Modifier les 12 colonnes de cette ligne (chiffres & libellés)" onclick="PageSituation.editRow(${l.apartment_id || 'null'}, ${l.tenant_id || 'null'}, ${propertyId || 'null'}, '${periodYm || ''}')">✏️</button>
            ${l.tenant_id ? `
              <button class="btn btn-sm btn-outline" style="padding:2px 6px;margin-right:2px;" title="Modifier l'observation" onclick="PageSituation.editObservation(${l.tenant_id}, '${Helpers.escapeHtml(l.observations || '')}')">💬</button>
              <button class="btn btn-sm btn-outline" style="padding:2px 6px;margin-right:2px;" title="Relevé financier" onclick="PageSituation.ledger(${l.tenant_id})">📋</button>
            ` : ''}
            <button class="btn btn-sm btn-danger" style="padding:2px 7px;" title="Supprimer individuellement" onclick="PageSituation.deleteSingle(${l.tenant_id || 'null'}, ${l.apartment_id || 'null'})">🗑</button>
          </td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="${this.COLS.length + 2}" class="text-center text-muted">Aucun enregistrement disponible</td></tr>`;

    // Ligne TOTAL fidèle à l'Excel : TOTAL en rouge gras + sommes en rouge sous Montant loyer, Arriéré, Anticipation, Versement, Caution
    const totalRow = `
      <tr style="font-weight:700;background:var(--bg-surface-2);border-top:2px solid var(--border);border-bottom:3px double var(--border)">
        <td class="no-print"></td>
        <td style="color:#d32f2f;font-weight:800;font-size:12.5px;text-align:center">TOTAL</td>
        <td></td>
        <td></td>
        <td style="color:#d32f2f;font-weight:800;text-align:right"><b>${Helpers.formatMoney(tot.montant_loyer)}</b></td>
        <td></td>
        <td style="color:#d32f2f;font-weight:800;text-align:right"><b>${Helpers.formatMoney(tot.arriere_loyer)}</b></td>
        <td style="color:#d32f2f;font-weight:800;text-align:right"><b>${Helpers.formatMoney(tot.anticipation)}</b></td>
        <td style="color:#d32f2f;font-weight:800;text-align:right"><b>${Helpers.formatMoney(tot.versement_mois)}</b></td>
        <td></td>
        <td></td>
        <td style="color:#d32f2f;font-weight:800;text-align:right"><b>${Helpers.formatMoney(tot.caution)}</b></td>
        <td></td>
        <td class="no-print"></td>
      </tr>
    `;

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px" class="no-print">
        <button class="btn btn-sm btn-danger" id="bulkDelBtn_${containerId}" style="display:none;font-weight:600" onclick="PageSituation.deleteSelected('${containerId}')">
          🗑 Supprimer la sélection (<span id="selNum_${containerId}">0</span>)
        </button>
        <span class="text-muted" style="font-size:12px">${lignes.length} logement(s) / locataire(s) répertorié(s)</span>
      </div>
      <div class="table-wrap">
        <table>
          ${thead}
          <tbody>${rows}${totalRow}</tbody>
        </table>
      </div>
    `;
  },

  toggleSelectAll(containerId, checked) {
    document.querySelectorAll(`.row-chk-${containerId}:not(:disabled)`).forEach((chk) => {
      chk.checked = checked;
    });
    this.updateSelection(containerId);
  },

  updateSelection(containerId) {
    const checked = Array.from(document.querySelectorAll(`.row-chk-${containerId}:checked`));
    const btn = document.getElementById(`bulkDelBtn_${containerId}`);
    const numEl = document.getElementById(`selNum_${containerId}`);
    if (btn) btn.style.display = checked.length > 0 ? 'inline-flex' : 'none';
    if (numEl) numEl.textContent = String(checked.length);
  },

  async deleteSelected(containerId) {
    const checked = Array.from(document.querySelectorAll(`.row-chk-${containerId}:checked`));
    const tenantIds = checked.map((c) => parseInt(c.value, 10)).filter(Boolean);
    if (!tenantIds.length) { Toast.warning('Aucun locataire sélectionné.'); return; }

    if (!confirm(`Confirmez-vous la suppression définitive des ${tenantIds.length} locataire(s) sélectionné(s) ?`)) return;

    try {
      await API.post('/tenants/bulk-delete', { ids: tenantIds });
      Toast.success(`${tenantIds.length} locataire(s) supprimé(s) avec succès 🗑✅`);
      this.refreshAfterDelete();
    } catch (e) {
      Toast.error(e.message || 'Erreur lors de la suppression groupée.');
    }
  },

  async deleteSingle(tenantId, apartmentId) {
    if (tenantId) {
      if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement ce locataire ?')) return;
      try {
        await API.delete('/tenants/' + tenantId);
        Toast.success('Locataire supprimé avec succès 🗑✅');
        this.refreshAfterDelete();
      } catch (e) {
        Toast.error(e.message || 'Erreur lors de la suppression');
      }
    } else if (apartmentId) {
      if (!confirm('Ce logement est actuellement libre. Confirmez-vous la suppression du logement ?')) return;
      try {
        await API.delete('/apartments/' + apartmentId);
        Toast.success('Logement supprimé avec succès');
        this.refreshAfterDelete();
      } catch (e) {
        Toast.error(e.message);
      }
    }
  },

  refreshAfterDelete() {
    this.loadSituation();
    if (this._selectedBuildingIds.length > 0) this.loadSelectedBuildings();
  },

  selectMyBuildingsOnly() {
    const assignedIds = this._propertiesList.filter((p) => p.is_assigned).map((p) => p.id);
    if (!assignedIds.length) {
      Toast.info('Aucun immeuble assigné directement à votre compte.');
      return;
    }
    document.querySelectorAll('.bld-detail-chk').forEach((chk) => {
      chk.checked = assignedIds.includes(Number(chk.value));
    });
    this.updateBldSelCount();
    this.loadSelectedBuildings();
  },

  // Render les checkboxes pour la sélection multi-immeubles
  renderBuildingCheckboxes() {
    const box = document.getElementById('bldCheckboxes');
    if (!box) return;
    const isRestrictedRole = Auth.hasRole('comptable', 'gestionnaire') && !Auth.hasRole('manager', 'super_admin');
    const hasAssigned = this._propertiesList.some((p) => p.is_assigned);

    box.innerHTML = this._propertiesList.map((p) => {
      const checked = this._selectedBuildingIds.includes(p.id) ? 'checked' : '';
      const badge = p.is_assigned
        ? `<span style="background:#d4edda;color:#155724;font-size:10px;font-weight:700;padding:1px 6px;border-radius:12px;margin-left:4px">★ Mon immeuble</span>`
        : (isRestrictedRole && hasAssigned ? `<span style="background:#f1f5f9;color:#64748b;font-size:10px;padding:1px 6px;border-radius:12px;margin-left:4px">Autre</span>` : '');
      return `<label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer;padding:4px 10px;border-radius:6px;background:var(--bg-surface);border:1px solid var(--border);user-select:none">
        <input type="checkbox" class="bld-detail-chk" value="${p.id}" ${checked} onchange="PageSituation.updateBldSelCount()" />
        <span style="font-weight:500">${Helpers.escapeHtml(p.property_name)}</span>
        ${badge}
      </label>`;
    }).join('') || '<span class="text-muted">Aucun immeuble disponible</span>';
    this.updateBldSelCount();
  },

  selectAllBuildings(selectAll) {
    document.querySelectorAll('.bld-detail-chk').forEach((chk) => { chk.checked = selectAll; });
    this.updateBldSelCount();
  },

  updateBldSelCount() {
    const checked = document.querySelectorAll('.bld-detail-chk:checked').length;
    const el = document.getElementById('bldSelCount');
    if (el) el.textContent = checked > 0 ? `${checked} immeuble(s) sélectionné(s)` : '';
  },

  async loadSelectedBuildings() {
    const checked = Array.from(document.querySelectorAll('.bld-detail-chk:checked'));
    const ids = checked.map((c) => Number(c.value)).filter(Boolean);
    this._selectedBuildingIds = ids;

    const box = document.getElementById('buildingBox');
    const exp = document.getElementById('bldExport');
    const expPdf = document.getElementById('bldExportPdf');

    if (ids.length === 0) {
      box.innerHTML = '<div class="text-muted">Sélectionnez au moins un immeuble, puis cliquez « Charger la situation ».</div>';
      if (exp) exp.style.display = 'none';
      if (expPdf) expPdf.style.display = 'none';
      this._buildings = [];
      this._building = null;
      return;
    }

    box.innerHTML = '<div class="spinner"></div>';
    try {
      // Charger tous les immeubles sélectionnés en parallèle
      const results = await Promise.all(
        ids.map((id) => API.get(`/reports/building-situation/${id}?month=${this._month}&year=${this._year}`).then(r => r.data))
      );
      this._buildings = results;
      this._building = results[0]; // Premier pour l'export simple

      // Rendre toutes les situations en séquence
      let html = '';
      results.forEach((d, idx) => {
        html += `
          <div style="${idx > 0 ? 'margin-top:30px;padding-top:20px;border-top:3px solid var(--primary);' : ''}">
            <div class="mb-3" style="font-weight:800;font-size:16px;color:var(--primary);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
              <span>🏢 SITUATION IMMEUBLE ${(d.immeuble || '').toUpperCase()} — MOIS ${(d.periode_libelle || '').toUpperCase()}</span>
              <span class="badge badge-info" style="font-size:12px;">${d.lignes?.length || 0} logements</span>
            </div>
            ${this.render12ColTableHtml('bldTable_' + d.property_id, d.lignes, d.total, d.property_id, d.periode)}
          </div>
        `;
      });
      box.innerHTML = html;
      if (exp) exp.style.display = '';
      if (expPdf) expPdf.style.display = '';
    } catch (e) {
      box.innerHTML = `<div class="text-muted">Erreur : ${e.message}</div>`;
      if (exp) exp.style.display = 'none';
      if (expPdf) expPdf.style.display = 'none';
    }
  },

  // Ancien loadBuilding single pour compatibilité (appelé via selectBuildingFilter header)
  async loadBuilding(id) {
    if (!id) return;
    this._selectedBuildingIds = [Number(id)];
    // Cocher la checkbox correspondante
    document.querySelectorAll('.bld-detail-chk').forEach((chk) => {
      chk.checked = Number(chk.value) === Number(id);
    });
    this.updateBldSelCount();
    await this.loadSelectedBuildings();
  },

  async exportBuildingExcel() {
    const d = this._building;
    if (!d) { Toast.error('Aucun immeuble sélectionné'); return; }
    Toast.info('Préparation de l\'export Excel officiel...');
    try {
      const blob = await API.downloadBlob(`/export/situation-immeuble/${d.property_id}/excel?month=${this._month}&year=${this._year}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SITUATION_${String(d.immeuble).replace(/\s+/g, '_').toUpperCase()}_${d.periode || 'MOIS'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 2000);
      Toast.success('Fichier Excel officiel téléchargé avec succès ✅');
    } catch (err) {
      console.warn('Erreur download backend Excel, bascule client-side:', err);
      if (!window.XLSX) { Toast.error('Export impossible'); return; }
      const headers = this.COLS.map((c) => c[1]);
      const aoa = [[`SITUATION IMMEUBLE ${String(d.immeuble).toUpperCase()} MOIS ${String(d.periode_libelle || '').toUpperCase()}`], headers];
      d.lignes.forEach((l) => aoa.push(this.COLS.map((c) => {
        const v = l[c[0]];
        if (v == null || v === '') return c[2].startsWith('money') ? 0 : '—';
        if (c[2] === 'method') return Helpers.methodLabel(v);
        return v;
      })));
      const t = d.total || {};
      aoa.push(['TOTAL', '', '', t.montant_loyer || 0, '', t.arriere_loyer || 0, t.anticipation || 0, t.versement_mois || 0, '', '', t.caution || 0, '']);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Situation');
      XLSX.writeFile(wb, `situation_${String(d.immeuble).replace(/\s+/g, '_')}_${d.periode || ''}.xlsx`);
      Toast.success('Excel exporté avec succès');
    }
  },

  async exportBuildingPdf() {
    const d = this._building;
    if (!d) { Toast.error('Aucun immeuble sélectionné'); return; }
    Toast.info('Préparation du rapport PDF officiel...');
    try {
      const blob = await API.downloadBlob(`/export/situation-immeuble/${d.property_id}/pdf?month=${this._month}&year=${this._year}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SITUATION_${String(d.immeuble).replace(/\s+/g, '_').toUpperCase()}_${d.periode || 'MOIS'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 2000);
      Toast.success('Rapport PDF officiel téléchargé avec succès ✅');
    } catch (err) {
      Toast.error('Erreur lors du téléchargement du PDF : ' + err.message);
    }
  },

  // Actions rapides d'enregistrement et de gestion locative
  openQuickPayment() {
    if (window.PagePayments && typeof PagePayments.openPaymentModal === 'function') {
      PagePayments.openPaymentModal();
    } else {
      Router.go('payments');
    }
  },

  payTenant(tenantId, apartmentId, defaultRent) {
    if (window.PagePayments && typeof PagePayments.openPaymentModal === 'function') {
      PagePayments.openPaymentModal({
        values: {
          tenant_id: tenantId,
          apartment_id: apartmentId || '',
          amount: defaultRent > 0 ? defaultRent : '',
          status: 'completed',
        }
      });
    } else {
      Router.go('payments');
    }
  },

  editRow(apartmentId, tenantId, propertyId = null, periodYm = null) {
    let line = null;
    let foundPropId = propertyId;
    let foundPeriodYm = periodYm;

    for (const b of this._buildings || []) {
      const found = (b.lignes || []).find((x) => (apartmentId && x.apartment_id === apartmentId) || (tenantId && x.tenant_id === tenantId));
      if (found) {
        line = found;
        if (!foundPropId) foundPropId = b.property_id;
        if (!foundPeriodYm) foundPeriodYm = b.periode;
        break;
      }
    }
    if (!line && Array.isArray(this._situation)) {
      line = this._situation.find((x) => (apartmentId && x.apartment_id === apartmentId) || (tenantId && x.tenant_id === tenantId));
      if (line && !foundPropId) foundPropId = line.property_id;
    }

    const effAptId = apartmentId || (line && line.apartment_id) || null;
    const effTenantId = tenantId || (line && line.tenant_id) || null;
    const effPropId = foundPropId || (line && line.property_id) || null;
    const effPeriodYm = foundPeriodYm || (this._year + '-' + String(this._month).padStart(2, '0'));

    if (!line) {
      line = {
        apartment_id: effAptId,
        tenant_id: effTenantId,
        property_id: effPropId,
        numero_chambre: '',
        nom_locataire: '',
        telephone: '',
        montant_loyer: 0,
        description_logement: '',
        arriere_loyer: 0,
        anticipation: 0,
        versement_mois: 0,
        periode_paiement: '',
        mode_paiement: '',
        caution: 0,
        observations: '',
      };
    }

    const safeNum = Helpers.escapeHtml(line.numero_chambre || '');
    const safeName = Helpers.escapeHtml(line.nom_locataire === '—' ? '' : (line.nom_locataire || ''));
    const safePhone = Helpers.escapeHtml(line.telephone === '—' ? '' : (line.telephone || ''));
    const safeRent = Number(line.montant_loyer) || 0;
    const safeDesc = Helpers.escapeHtml(line.description_logement === 'vide' || line.description_logement === '—' ? '' : (line.description_logement || ''));
    const safeArriere = Number(line.arriere_loyer) || 0;
    const safeAnticip = Number(line.anticipation) || 0;
    const safeVersement = Number(line.versement_mois) || 0;
    const safePeriode = Helpers.escapeHtml(line.periode_paiement === '—' ? '' : (line.periode_paiement || ''));
    const safeMode = (line.mode_paiement === '—' ? '' : (line.mode_paiement || '')).toLowerCase();
    const safeCaution = Number(line.caution) || 0;
    const safeObs = Helpers.escapeHtml(line.observations === '—' ? '' : (line.observations || ''));

    Modal.open({
      title: '✏️ Modifier les 12 colonnes de la situation',
      content: `
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px;background:#f8fafc;padding:10px 14px;border-radius:8px;border-left:4px solid var(--primary)">
          <b>✏️ Correction directe de tous les chiffres et libellés :</b><br/>
          Vous pouvez ajuster librement les 12 colonnes (loyer, arriérés réels, avance, versement du mois, caution, etc.).
          Ces données mettront à jour immédiatement le tableau, les totaux ainsi que le rapport PDF officiel.
        </div>

        <!-- BLOC 1 : LOGEMENT & LOCATAIRE (COLONNES 1 À 5) -->
        <div style="background:var(--bg-surface-2);padding:10px 12px;border-radius:8px;margin-bottom:12px;border:1px solid var(--border)">
          <div style="font-weight:700;color:var(--primary);margin-bottom:8px;font-size:12.5px">🏠 1. INFORMATIONS DU LOGEMENT & DU LOCATAIRE</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px">1. N° Logement / Chambre *</label>
              <input type="text" id="edit_col_num" class="form-control" value="${safeNum}" required placeholder="ex: 501, D6..." />
            </div>
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px">2. Noms & Prénoms Locataire</label>
              <input type="text" id="edit_col_name" class="form-control" value="${safeName}" placeholder="ex: Nom du locataire" />
            </div>
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px">3. Contact / Téléphone</label>
              <input type="text" id="edit_col_phone" class="form-control" value="${safePhone}" placeholder="ex: 699000000" />
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:10px;margin-top:8px">
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px">5. Description du logement</label>
              <input type="text" id="edit_col_desc" class="form-control" value="${safeDesc}" placeholder="ex: Appartement 3 pièces, Studio..." />
            </div>
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px">4. Montant du loyer mensuel (FCFA) *</label>
              <input type="number" id="edit_col_rent" class="form-control" value="${safeRent}" min="0" required />
            </div>
          </div>
        </div>

        <!-- BLOC 2 : FINANCES & PAIEMENTS (COLONNES 6 À 11) -->
        <div style="background:var(--bg-surface-2);padding:10px 12px;border-radius:8px;margin-bottom:12px;border:1px solid var(--border)">
          <div style="font-weight:700;color:var(--primary);margin-bottom:8px;font-size:12.5px">💰 2. FINANCES & PAIEMENTS (CORRECTION DES CHIFFRES)</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px;color:var(--danger)">6. Arriéré de loyer (Dette FCFA)</label>
              <input type="number" id="edit_col_arriere" class="form-control" value="${safeArriere}" min="0" placeholder="0" />
            </div>
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px;color:var(--success)">7. Loyer par anticipation (Avance FCFA)</label>
              <input type="number" id="edit_col_anticip" class="form-control" value="${safeAnticip}" min="0" placeholder="0" />
            </div>
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px;color:var(--primary)">8. Versement au cours du mois (FCFA)</label>
              <input type="number" id="edit_col_versement" class="form-control" value="${safeVersement}" min="0" placeholder="0" />
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:10px;margin-top:8px">
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px">9. Période correspondant au paiement</label>
              <input type="text" id="edit_col_periode" class="form-control" value="${safePeriode}" placeholder="ex: 01/04/2026 au 01/07/2026" />
            </div>
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px">10. Mode de paiement</label>
              <select id="edit_col_mode" class="form-control">
                <option value="Espèces" ${safeMode.includes('esp') || safeMode === 'cash' ? 'selected' : ''}>Espèces</option>
                <option value="Virement bancaire" ${safeMode.includes('vir') || safeMode === 'bank_transfer' ? 'selected' : ''}>Virement bancaire</option>
                <option value="Chèque" ${safeMode.includes('chè') || safeMode.includes('che') || safeMode === 'check' ? 'selected' : ''}>Chèque</option>
                <option value="Mobile Money" ${safeMode.includes('momo') || safeMode.includes('om') || safeMode.includes('mobile') ? 'selected' : ''}>Mobile Money</option>
                <option value="Autre" ${!safeMode || safeMode === '—' ? 'selected' : ''}>— Non spécifié —</option>
              </select>
            </div>
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px">11. Caution (FCFA)</label>
              <input type="number" id="edit_col_caution" class="form-control" value="${safeCaution}" min="0" placeholder="0" />
            </div>
          </div>
        </div>

        <!-- BLOC 3 : OBSERVATIONS & VALIDATION (COLONNE 12) -->
        <div style="background:var(--bg-surface-2);padding:10px 12px;border-radius:8px;margin-bottom:6px;border:1px solid var(--border)">
          <div style="font-weight:700;color:var(--primary);margin-bottom:8px;font-size:12.5px">📝 3. OBSERVATION & PÉRIODE D'APPLICATION</div>
          <div class="form-group" style="margin-bottom:8px">
            <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px">12. Observation (gestion des loyers / litiges / promesses) :</label>
            <input type="text" id="edit_col_obs" class="form-control" value="${safeObs}" placeholder="ex: Impayé a partir du mois de juillet 2026, À jour..." />
          </div>
          <div style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:8px">
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer">
              <input type="checkbox" id="edit_col_apply_month" checked />
              <span>Associer cette correction spécifiquement au mois sélectionné (<b>${effPeriodYm}</b>)</span>
            </label>
          </div>
        </div>
      `,
      footer: `
        <div class="flex justify-between items-center w-100" style="width:100%">
          <div>
            ${line.is_overridden ? `
              <button class="btn btn-sm btn-outline" style="color:var(--danger);border-color:var(--danger)" onclick="PageSituation.resetRowOverride(${effAptId}, ${effPropId}, '${effPeriodYm}')" title="Annuler les corrections manuelles et restaurer le calcul automatique">
                🔄 Restaurer calcul auto
              </button>
            ` : ''}
          </div>
          <div class="flex gap-2">
            <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
            <button class="btn btn-primary" onclick="PageSituation.saveRow(${effAptId || 'null'}, ${effTenantId || 'null'}, ${effPropId || 'null'}, '${effPeriodYm}')">💾 Enregistrer les 12 colonnes</button>
          </div>
        </div>
      `,
      size: 'large',
    });
  },

  async saveRow(apartmentId, tenantId, propertyId, defaultPeriodYm) {
    const aptNum = document.getElementById('edit_col_num')?.value.trim();
    const name = document.getElementById('edit_col_name')?.value.trim();
    const phone = document.getElementById('edit_col_phone')?.value.trim();
    const desc = document.getElementById('edit_col_desc')?.value.trim();
    const rent = parseFloat(document.getElementById('edit_col_rent')?.value) || 0;
    const arriere = parseFloat(document.getElementById('edit_col_arriere')?.value) || 0;
    const anticip = parseFloat(document.getElementById('edit_col_anticip')?.value) || 0;
    const versement = parseFloat(document.getElementById('edit_col_versement')?.value) || 0;
    const periode = document.getElementById('edit_col_periode')?.value.trim();
    const mode = document.getElementById('edit_col_mode')?.value;
    const caution = parseFloat(document.getElementById('edit_col_caution')?.value) || 0;
    const obs = document.getElementById('edit_col_obs')?.value.trim();
    const applyMonth = document.getElementById('edit_col_apply_month')?.checked;

    if (!aptNum) { Toast.warning('Le numéro de logement est requis'); return; }

    const periodYm = applyMonth ? defaultPeriodYm : null;

    try {
      await API.put('/reports/building-situation/line', {
        apartment_id: apartmentId,
        tenant_id: tenantId || null,
        property_id: propertyId || null,
        period_ym: periodYm,
        numero_chambre: aptNum,
        nom_locataire: name,
        telephone: phone,
        description_logement: desc,
        montant_loyer: rent,
        arriere_loyer: arriere,
        anticipation: anticip,
        versement_mois: versement,
        periode_paiement: periode,
        mode_paiement: mode,
        caution: caution,
        observations: obs,
      });

      Toast.success('Ligne modifiée et chiffres synchronisés avec succès ✅');
      Modal.close();
      this.refreshAfterDelete();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de l\'enregistrement de la ligne');
    }
  },

  async resetRowOverride(apartmentId, propertyId, periodYm) {
    if (!confirm('Confirmez-vous la réinitialisation de cette ligne au calcul automatique ?')) return;
    try {
      await API.delete(`/reports/building-situation/override?apartment_id=${apartmentId}&property_id=${propertyId || ''}&period_ym=${periodYm || ''}`);
      Toast.success('Ligne réinitialisée au calcul automatique ✅');
      Modal.close();
      this.refreshAfterDelete();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de la réinitialisation');
    }
  },

  editObservation(tenantId, currentObs) {
    Modal.open({
      title: '✏️ Modifier l\'observation du locataire',
      content: `
        <div class="form-group">
          <label style="font-weight:600;margin-bottom:6px;display:block;">Observation locative (gestion des loyers / arriérés / promesses) :</label>
          <textarea id="quick_obs_text" class="form-control" rows="3" placeholder="ex: Promesse versement le 15, accord de paiement, litige...">${Helpers.escapeHtml(currentObs || '')}</textarea>
          <small class="text-muted" style="font-size:11.5px;margin-top:4px;display:block;">Cette mention figurera sur les rapports d'immeuble et l'historique du locataire.</small>
        </div>
      `,
      footer: `
        <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
        <button class="btn btn-primary" onclick="PageSituation.saveObservation(${tenantId})">💾 Enregistrer l'observation</button>
      `,
      size: 'small',
    });
  },

  async saveObservation(tenantId) {
    const textEl = document.getElementById('quick_obs_text');
    const val = textEl ? textEl.value.trim() : '';
    try {
      await API.put('/tenants/' + tenantId, { observations: val });
      Toast.success('Observation enregistrée avec succès ✅');
      Modal.close();
      this.refreshAfterDelete();
    } catch (e) {
      Toast.error(e.message || 'Erreur lors de l\'enregistrement de l\'observation');
    }
  },

  // ---------- Situation (état courant) ----------
  async loadSituation() {
    const box = document.getElementById('situationBox');
    try {
      this._situation = (await API.get('/reports/tenant-situation')).data || [];
      this.renderSituation(this._situation);
    } catch (e) {
      box.innerHTML = `<div class="text-muted">Erreur : ${e.message}</div>`;
    }
  },

  selectBuildingFilter(id) {
    const headSel = document.getElementById('sitHeaderBldSelect');
    if (headSel && headSel.value !== id) headSel.value = id;

    this.filter();

    // Aussi filtrer le récap si un immeuble est choisi
    if (id) {
      this._recapPropertyIds = [Number(id)];
      this.loadBuilding(id);
      this.loadRecap();
    } else {
      this._recapPropertyIds = [];
      this._selectedBuildingIds = [];
      const box = document.getElementById('buildingBox');
      if (box) box.innerHTML = 'Sélectionnez un ou plusieurs immeubles ci-dessus, puis cliquez « Charger la situation ».';
      document.querySelectorAll('.bld-detail-chk').forEach((chk) => { chk.checked = false; });
      this.updateBldSelCount();
      this._buildings = [];
      this._building = null;
      this.loadRecap();
    }
    // MAJ les checkboxes du filtre récap
    this.renderRecapBuildingCheckboxes();
  },

  filter() {
    const qEl = document.getElementById('sitSearch');
    const bldEl = document.getElementById('sitHeaderBldSelect');
    const s = qEl ? (qEl.value || '').toLowerCase() : '';
    const bldId = bldEl ? bldEl.value : '';

    let list = this._situation;
    if (bldId) {
      list = list.filter((r) => String(r.property_id) === String(bldId));
    }
    if (s) {
      list = list.filter((r) =>
        (r.nom || '').toLowerCase().includes(s) ||
        (r.nom_locataire || '').toLowerCase().includes(s) ||
        (r.immeuble || '').toLowerCase().includes(s) ||
        (r.logement || '').toLowerCase().includes(s) ||
        (r.numero_chambre || '').toLowerCase().includes(s) ||
        (r.telephone || '').includes(s)
      );
    }
    this.renderSituation(list);
  },

  renderSituation(list) {
    const box = document.getElementById('situationBox');
    if (!box) return;
    box.innerHTML = this.render12ColTableHtml('sitTable', list);
  },
  statutBadge(s) {
    const map = { a_jour: ['badge-success', 'À jour'], partiel: ['badge-warning', 'Partiellement à jour'], retard: ['badge-danger', 'En retard'] };
    const [cls, label] = map[s] || ['badge-muted', '—'];
    return `<span class="badge ${cls}">${label}</span>`;
  },

  // ---------- Relevé de compte d'un locataire (grand livre) ----------
  async ledger(tenantId) {
    Modal.open('Relevé de compte', '<div class="spinner"></div>', '<button class="btn btn-outline" onclick="Modal.close()">Fermer</button>');
    try {
      const { data: d } = await API.get('/payments/ledger/' + tenantId);
      const tx = (d.transactions || []).map((t) => `<tr>
        <td>${Helpers.formatDate(t.date)}</td>
        <td>${Helpers.formatMoney(t.montant)}</td>
        <td>${Helpers.methodLabel(t.methode)}</td>
        <td>${Helpers.statusBadge(t.statut)}</td>
        <td>${t.preuve ? `<a href="${Helpers.fileUrl(t.preuve)}" target="_blank">📎</a>` : '—'}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="text-center text-muted">Aucune transaction</td></tr>';

      const mods = (d.modifications || []).map((m) => `<div class="list-item">
        <div style="flex:1"><b>${this.actionLabel(m.action)}</b> — ${m.description || ''}<br>
          <span class="text-muted" style="font-size:12px">${Helpers.formatDateTime(m.date)}${m.par ? ' · ' + m.par : ''}</span></div>
      </div>`).join('') || '<div class="text-muted">Aucune modification enregistrée</div>';

      Modal.open('📋 Relevé — ' + (d.tenant.nom || ''), `
        <div class="text-muted" style="margin-bottom:6px">${d.tenant.logement || '—'}${d.tenant.immeuble ? ' · ' + d.tenant.immeuble : ''} · Loyer ${Helpers.formatMoney(d.loyer_mensuel)}/mois · ${d.mois_dus} mois dus</div>
        <div class="stats-grid">
          ${this._stat('🏠', 'sky', Helpers.formatMoney(d.total_du), 'Total loyers dus')}
          ${this._stat('✅', 'green', Helpers.formatMoney(d.total_valide), 'Paiements validés')}
          ${this._stat('🕓', 'orange', Helpers.formatMoney(d.en_attente_preuve), 'En attente de preuve')}
          ${this._stat('⚖️', d.solde > 0 ? 'red' : 'green', Helpers.formatMoney(Math.max(0, d.solde)), 'Solde restant dû')}
        </div>
        <div class="list-item"><div style="flex:1">Statut du locataire</div>${this.statutBadge(d.statut)}</div>
        <h4 class="mt-4">🧾 Historique des transactions</h4>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th>Montant</th><th>Méthode</th><th>Statut</th><th>Preuve</th></tr></thead><tbody>${tx}</tbody></table></div>
        <h4 class="mt-4">✏️ Historique des modifications</h4>${mods}`,
        '<button class="btn btn-outline" onclick="Modal.close()">Fermer</button>');
    } catch (e) {
      Modal.open('Relevé de compte', `<div class="text-muted">Erreur : ${e.message}</div>`, '<button class="btn btn-outline" onclick="Modal.close()">Fermer</button>');
    }
  },
  actionLabel(a) {
    return { created: 'Création', updated: 'Modification', proof_added: 'Preuve ajoutée', validated: 'Validé', rejected: 'Rejeté' }[a] || a;
  },

  // ---------- Récap par période ----------
  applyPreset(p) {
    const now = new Date();
    if (p === 'month') { this._start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10); this._end = now.toISOString().slice(0, 10); }
    else if (p === 'year') { this._start = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10); this._end = now.toISOString().slice(0, 10); }
    else { this._end = now.toISOString().slice(0, 10); this._start = new Date(now.getTime() - (p - 1) * 86400000).toISOString().slice(0, 10); }
    const a = document.getElementById('sitStart'); if (a) a.value = this._start;
    const b = document.getElementById('sitEnd'); if (b) b.value = this._end;
    this.loadRecap();
  },
  applyCustom() {
    const s = document.getElementById('sitStart').value, e = document.getElementById('sitEnd').value;
    if (!s || !e) { Toast.error('Choisissez les deux dates'); return; }
    if (s > e) { Toast.error('Début après fin'); return; }
    this._start = s; this._end = e; this.loadRecap();
  },
  async loadRecap() {
    const box = document.getElementById('recapBox');
    box.innerHTML = '<div class="spinner"></div>';
    try {
      let url = `/reports/recap?start=${this._start}&end=${this._end}`;
      if (this._recapPropertyIds.length > 0) {
        url += `&propertyIds=${this._recapPropertyIds.join(',')}`;
      }
      const { data: d } = await API.get(url);
      box.innerHTML = this.recapHtml(d);
    } catch (e) { box.innerHTML = `<div class="text-muted">Erreur : ${e.message}</div>`; }
  },
  recapHtml(d) {
    const range = `${Helpers.formatDate(d.start)} → ${Helpers.formatDate(d.end)}`;
    const tRows = (d.byTenant || []).map((r) => `<tr>
      <td><b>${r.nom}</b></td><td>${r.immeuble}</td><td>${r.logement}</td>
      <td style="color:var(--success)">${Helpers.formatMoney(r.paye)}</td>
      <td style="color:var(--danger)">${Helpers.formatMoney(r.impaye)}</td>
      <td>${r.nb_paiements}</td></tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted">Aucun paiement sur la période</td></tr>';

    const pRows = (d.byProperty || []).map((r) => `<tr>
      <td><b>${r.immeuble}</b></td>
      <td style="color:var(--success)">${Helpers.formatMoney(r.encaisse)}</td>
      <td style="color:var(--danger)">${Helpers.formatMoney(r.impaye)}</td>
      <td>${r.occupes}/${r.logements}</td>
      <td>${r.maintenances}</td>
      <td>${Helpers.formatMoney(r.cout_maintenance)}</td></tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted">Aucun immeuble</td></tr>';

    const m = d.maintenance || {};
    const mByProp = (m.byProperty || []).map((r) => `<div class="list-item"><div style="flex:1">${r.immeuble}</div><b>${r.total}</b></div>`).join('') || '<div class="text-muted">Aucune intervention</div>';

    return `
      <div class="card"><div class="card-header"><h3>💰 Récap par locataire</h3><span class="text-muted">${range}</span></div>
        <div class="card-body"><div class="table-wrap"><table>
          <thead><tr><th>Locataire</th><th>Immeuble</th><th>Logement</th><th>Encaissé</th><th>Impayé</th><th>Nb</th></tr></thead>
          <tbody>${tRows}</tbody></table></div></div></div>

      <div class="card"><div class="card-header"><h3>🏢 Récap par immeuble</h3><span class="text-muted">${range}</span></div>
        <div class="card-body"><div class="table-wrap"><table>
          <thead><tr><th>Immeuble</th><th>Encaissé</th><th>Impayé</th><th>Occupation</th><th>Maintenances</th><th>Coût maint.</th></tr></thead>
          <tbody>${pRows}</tbody></table></div></div></div>

      <div class="card"><div class="card-header"><h3>🔧 Récap maintenance</h3><span class="text-muted">${range}</span></div>
        <div class="card-body">
          <div class="stats-grid">
            ${this._stat('🔧', 'sky', m.total || 0, 'Total interventions')}
            ${this._stat('⏳', 'orange', (m.reported || 0) + (m.validated || 0) + (m.in_progress || 0), 'En cours / ouvertes')}
            ${this._stat('✅', 'green', m.completed || 0, 'Terminées')}
            ${this._stat('🧾', 'orange', Helpers.formatMoney(m.cout || 0), 'Coût matériel')}
          </div>
          <h4 class="mt-4">Par immeuble</h4>${mByProp}
        </div></div>`;
  },
  _stat(icon, color, value, name) {
    return `<div class="stat-card"><div class="stat-icon ${color}">${icon}</div>
      <div class="stat-info"><div class="stat-value">${value}</div><div class="stat-name">${name}</div></div></div>`;
  },

  // ---------- Filtrage immeubles pour le récap ----------
  toggleRecapBuildingFilter() {
    const el = document.getElementById('recapBuildingFilter');
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  },

  renderRecapBuildingCheckboxes() {
    const box = document.getElementById('recapBldCheckboxes');
    if (!box) return;
    box.innerHTML = this._propertiesList.map((p) => {
      const checked = this._recapPropertyIds.length === 0 || this._recapPropertyIds.includes(p.id) ? 'checked' : '';
      return `<label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;padding:3px 6px;border-radius:6px;background:var(--bg-surface);border:1px solid var(--border)">
        <input type="checkbox" class="recap-bld-chk" value="${p.id}" ${checked} />
        ${Helpers.escapeHtml(p.property_name)}
      </label>`;
    }).join('') || '<span class="text-muted">Aucun immeuble disponible</span>';
  },

  selectAllRecapBuildings(selectAll) {
    document.querySelectorAll('.recap-bld-chk').forEach((chk) => { chk.checked = selectAll; });
  },

  applyRecapBuildingFilter() {
    const checked = Array.from(document.querySelectorAll('.recap-bld-chk:checked'));
    const allCount = document.querySelectorAll('.recap-bld-chk').length;
    if (checked.length === allCount || checked.length === 0) {
      // Tous ou aucun = pas de filtre
      this._recapPropertyIds = [];
    } else {
      this._recapPropertyIds = checked.map((c) => Number(c.value));
    }
    this.loadRecap();
    Toast.info(`Récapitulatif filtré sur ${this._recapPropertyIds.length > 0 ? this._recapPropertyIds.length + ' immeuble(s)' : 'tous les immeubles'}`);
  },
};
