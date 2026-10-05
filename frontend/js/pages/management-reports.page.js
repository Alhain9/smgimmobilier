// ============ Page Rapports de Gestion Périodiques — SMG IMMOBILIER ============
const PageManagementReports = {
  register() {
    Router.register('management-reports', () => this.render());
  },

  _currentTab: 'building',
  _properties: [],
  _selectedInflowPropertyIds: [],
  _currentReport: null,
  _currentInflowsData: null,

  switchTab(tab) {
    this._currentTab = tab;
    this.render();
  },

  async render() {
    Layout.setTitle('Rapports de gestion');
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const lastDayNum = new Date(y, today.getMonth() + 1, 0).getDate();
    const firstDay = `${y}-${m}-01`;
    const lastDay = `${y}-${m}-${String(lastDayNum).padStart(2, '0')}`;

    if (!this._properties || !this._properties.length) {
      await this.loadProperties();
    }

    const appContent = document.getElementById('appContent');
    const isBuildingTab = this._currentTab !== 'inflows';

    appContent.innerHTML = `
      <!-- ONGLETS DE NAVIGATION DU MODULE RAPPORTS -->
      <div style="display:flex;gap:10px;margin-bottom:16px;border-bottom:2px solid var(--border);padding-bottom:10px;flex-wrap:wrap">
        <button class="btn ${isBuildingTab ? 'btn-primary' : 'btn-outline'}" onclick="PageManagementReports.switchTab('building')" style="font-weight:700">
          🏢 Bilan Détaillé par Immeuble
        </button>
        <button class="btn ${!isBuildingTab ? 'btn-primary' : 'btn-outline'}" onclick="PageManagementReports.switchTab('inflows')" style="font-weight:700">
          📑 Récapitulatif des Entrées par Immeuble (Virement & Cash)
        </button>
      </div>

      <div id="mReportTabContainer">
        ${isBuildingTab ? this._renderBuildingTab(firstDay, lastDay) : this._renderInflowsTab(firstDay, lastDay)}
      </div>
    `;

    if (isBuildingTab) {
      this.populatePropertySelect();
      if (this._currentReport) {
        this.renderReport(this._currentReport);
      }
    } else {
      this.renderInflowsPropertyChips();
      if (this._currentInflowsData) {
        this.renderInflowsRecap(this._currentInflowsData);
      }
    }
  },

  _renderBuildingTab(firstDay, lastDay) {
    return `
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h2 style="font-size:18px;font-weight:700;color:var(--text)">🏢 Bilan Périodique de Gestion</h2>
            <p style="font-size:13px;color:var(--text-muted);margin-top:2px">Sélectionnez une période libre et un bien immobilier pour générer un bilan complet (situation 12 colonnes, revenus, dépenses, travaux, résultat net).</p>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:16px">
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted)">Immeuble / Bien</label>
            <select id="mReportPropertySelect" class="form-control">
              <option value="">Chargement des immeubles...</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted)">Date de début 📅</label>
            <input type="date" id="mReportStartDate" class="form-control" value="${firstDay}" />
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted)">Date de fin 📅</label>
            <input type="date" id="mReportEndDate" class="form-control" value="${lastDay}" />
          </div>
          <div style="display:flex;align-items:flex-end;gap:8px">
            <button class="btn btn-primary" style="flex:1" onclick="PageManagementReports.generateReport()">
              <span class="btn-icon">⚡</span> Analyser & Afficher
            </button>
            <button class="btn btn-success" id="mReportPdfBtn" style="${this._currentReport ? 'display:inline-flex' : 'display:none'}" onclick="PageManagementReports.downloadPdf()">
              <span class="btn-icon">📄</span> Exporter PDF
            </button>
          </div>
        </div>
      </div>

      <div id="mReportResultArea">
        <div class="card" style="text-align:center;padding:40px;color:var(--text-muted)">
          <span style="font-size:40px">📊</span>
          <p style="margin-top:12px;font-size:14px">Sélectionnez un immeuble et cliquez sur <b>« Analyser & Afficher »</b> pour générer le rapport.</p>
        </div>
      </div>
    `;
  },

  _renderInflowsTab(firstDay, lastDay) {
    const totalProps = (this._properties || []).length;
    const selectedCount = this._selectedInflowPropertyIds.length;
    const selText = selectedCount === 0 || selectedCount === totalProps 
      ? `Tous les immeubles (${totalProps})` 
      : `${selectedCount} immeuble(s) sélectionné(s)`;

    return `
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h2 style="font-size:18px;font-weight:700;color:var(--text)">📑 Récapitulatif des Entrées par Immeuble</h2>
            <p style="font-size:13px;color:var(--text-muted);margin-top:2px">
              Consolidez et comparez les encaissements (Virements bancaires vs Cash / Espèces), la part de chaque immeuble, les constats et l'analyse globale de gestion.
            </p>
          </div>
        </div>

        <!-- FILTRES DE DATES -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:16px">
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted)">Date de début 📅</label>
            <input type="date" id="mReportInflowsStart" class="form-control" value="${firstDay}" />
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted)">Date de fin 📅</label>
            <input type="date" id="mReportInflowsEnd" class="form-control" value="${lastDay}" />
          </div>
          <div style="display:flex;align-items:flex-end;gap:8px">
            <button class="btn btn-primary" style="flex:1" onclick="PageManagementReports.generateInflowsRecap()">
              <span class="btn-icon">⚡</span> Analyser & Afficher
            </button>
            <button class="btn btn-success" id="mReportInflowsPdfBtn" style="${this._currentInflowsData ? 'display:inline-flex' : 'display:none'}" onclick="PageManagementReports.downloadInflowsRecapPdf()">
              <span class="btn-icon">📄</span> Exporter PDF Officiel
            </button>
          </div>
        </div>

        <!-- SÉLECTION CIBLÉE MULTI-IMMEUBLES -->
        <div style="margin-top:16px;padding-top:14px;border-top:1px dashed var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
            <div style="font-size:12.5px;font-weight:700;color:var(--text)">
              🏢 Immeubles ciblés : <span id="inflowSelectedBadge" class="badge badge-info" style="font-size:11px">${selText}</span>
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm btn-outline" style="font-size:11px;padding:3px 8px" onclick="PageManagementReports.selectAllInflowProperties(true)">
                ✓ Tout sélectionner
              </button>
              <button class="btn btn-sm btn-outline" style="font-size:11px;padding:3px 8px" onclick="PageManagementReports.selectAllInflowProperties(false)">
                ✗ Tout désélectionner
              </button>
            </div>
          </div>
          <div id="inflowPropertiesChipsContainer" style="display:flex;flex-wrap:wrap;gap:8px;max-height:160px;overflow-y:auto;padding:8px;background:var(--secondary-bg,#f8fafc);border:1px solid var(--border);border-radius:8px">
            <!-- Rendu dynamique des chips -->
          </div>
        </div>
      </div>

      <div id="mReportInflowsResultArea">
        <div class="card" style="text-align:center;padding:40px;color:var(--text-muted)">
          <span style="font-size:40px">📑</span>
          <p style="margin-top:12px;font-size:14px">
            Sélectionnez les immeubles à analyser et cliquez sur <b>« Analyser & Afficher »</b> pour générer le récapitulatif des entrées.
          </p>
        </div>
      </div>
    `;
  },

  async loadProperties() {
    try {
      const res = await API.get('/properties');
      this._properties = res.data || [];
      if (!this._selectedInflowPropertyIds.length && this._properties.length) {
        this._selectedInflowPropertyIds = this._properties.map((p) => Number(p.id));
      }
    } catch (err) {
      Toast.error('Impossible de charger les immeubles');
    }
  },

  populatePropertySelect() {
    const select = document.getElementById('mReportPropertySelect');
    if (!select) return;
    const props = this._properties || [];
    if (!props.length) {
      select.innerHTML = '<option value="">Aucun immeuble disponible</option>';
      return;
    }
    select.innerHTML = props.map((p) => `<option value="${p.id}">${Helpers.escapeHtml(p.property_name)} (${p.city || '—'})</option>`).join('');
  },

  async generateReport() {
    const propertyId = document.getElementById('mReportPropertySelect')?.value;
    const start = document.getElementById('mReportStartDate')?.value;
    const end = document.getElementById('mReportEndDate')?.value;

    if (!propertyId) { Toast.warning('Veuillez sélectionner un immeuble'); return; }
    if (!start || !end) { Toast.warning('Veuillez renseigner les dates'); return; }
    if (start > end) { Toast.error('La date de début ne peut pas être après la date de fin'); return; }

    const area = document.getElementById('mReportResultArea');
    area.innerHTML = '<div class="card" style="text-align:center;padding:40px"><div class="spinner"></div><p style="margin-top:12px;color:var(--text-muted)">Génération du rapport en cours...</p></div>';

    try {
      const res = await API.get(`/management-reports/building/${propertyId}?start=${start}&end=${end}`);
      const data = res.data;
      this._currentReport = data;

      const pdfBtn = document.getElementById('mReportPdfBtn');
      if (pdfBtn) pdfBtn.style.display = 'inline-flex';
      this.renderReport(data);
    } catch (err) {
      Toast.error('Erreur lors de la génération du rapport');
      area.innerHTML = `<div class="card" style="text-align:center;padding:30px;color:var(--danger)">Échec de génération du rapport.</div>`;
    }
  },

  // ===== GESTION DES CASES À COCHER ET SUPPRESSION (12 COLONNES) =====
  toggleSelectAll(checked) {
    document.querySelectorAll('.row-mr-chk:not(:disabled)').forEach((chk) => { chk.checked = checked; });
    this.updateSelection();
  },

  updateSelection() {
    const checked = Array.from(document.querySelectorAll('.row-mr-chk:checked'));
    const btn = document.getElementById('bulkDelBtn_mr');
    const numEl = document.getElementById('selNum_mr');
    if (btn) btn.style.display = checked.length > 0 ? 'inline-flex' : 'none';
    if (numEl) numEl.textContent = String(checked.length);
  },

  async deleteSelected() {
    const checked = Array.from(document.querySelectorAll('.row-mr-chk:checked'));
    const tenantIds = checked.map((c) => parseInt(c.value, 10)).filter(Boolean);
    if (!tenantIds.length) { Toast.warning('Aucun locataire sélectionné.'); return; }

    if (!confirm(`Confirmez-vous la suppression définitive des ${tenantIds.length} locataire(s) sélectionné(s) ?`)) return;

    try {
      await API.post('/tenants/bulk-delete', { ids: tenantIds });
      Toast.success(`${tenantIds.length} locataire(s) supprimé(s) avec succès 🗑✅`);
      this.generateReport();
    } catch (e) {
      Toast.error(e.message || 'Erreur lors de la suppression groupée');
    }
  },

  async deleteSingle(tenantId, apartmentId) {
    if (tenantId) {
      if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement ce locataire ?')) return;
      try {
        await API.delete('/tenants/' + tenantId);
        Toast.success('Locataire supprimé avec succès 🗑✅');
        this.generateReport();
      } catch (e) {
        Toast.error(e.message || 'Erreur lors de la suppression');
      }
    } else if (apartmentId) {
      if (!confirm('Ce logement est actuellement libre. Confirmez-vous la suppression du logement ?')) return;
      try {
        await API.delete('/apartments/' + apartmentId);
        Toast.success('Logement supprimé avec succès');
        this.generateReport();
      } catch (e) {
        Toast.error(e.message);
      }
    }
  },

  editRow(apartmentId, tenantId) {
    if (!this._currentReport) return;
    const r = this._currentReport;
    const sitLignes = (r.building_situation && r.building_situation.lignes) || r.rental_situation.apartments || [];
    const line = sitLignes.find((l) => (apartmentId && l.apartment_id === apartmentId) || (tenantId && l.tenant_id === tenantId));
    if (!line) {
      Toast.warning('Ligne de situation introuvable');
      return;
    }

    const effAptId = line.apartment_id || apartmentId || null;
    const effTenantId = line.tenant_id || tenantId || null;
    const effPropId = r.property?.id || null;
    const effPeriodYm = r.period?.start ? r.period.start.slice(0, 7) : new Date().toISOString().slice(0, 7);

    const safeNum = Helpers.escapeHtml(line.numero_chambre || line.apartment_number || '');
    const safeName = Helpers.escapeHtml(line.nom_locataire === '—' ? '' : (line.nom_locataire || line.tenant_name || ''));
    const safePhone = Helpers.escapeHtml(line.telephone === '—' ? '' : (line.telephone || line.tenant_phone || ''));
    const safeRent = Number(line.montant_loyer != null ? line.montant_loyer : line.rent_amount) || 0;
    const safeDesc = Helpers.escapeHtml(line.description_logement === 'vide' || line.description_logement === '—' ? '' : (line.description_logement || line.description || ''));
    const safeArriere = Number(line.arriere_loyer) || 0;
    const safeAnticip = Number(line.anticipation) || 0;
    const safeVersement = Number(line.versement_mois) || 0;
    const safePeriode = Helpers.escapeHtml(line.periode_paiement === '—' ? '' : (line.periode_paiement || ''));
    const safeMode = (line.mode_paiement === '—' ? '' : (line.mode_paiement || '')).toLowerCase();
    const safeCaution = Number(line.caution) || 0;
    const safeObs = Helpers.escapeHtml(line.observations === '—' ? '' : (line.observations || ''));

    Modal.open({
      title: `✏️ Modifier les 12 colonnes — Logement ${safeNum}`,
      content: `
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:12px;background:#f8fafc;padding:10px 14px;border-radius:8px;border-left:4px solid var(--primary)">
          <b>✏️ Mise à jour directe de la situation et du rapport :</b><br/>
          Vous pouvez ajuster librement les 12 colonnes (loyer, arriérés réels, avance, versement du mois, période concrète, etc.).
          Ces données mettront à jour immédiatement le rapport de gestion, les encaissements, les KPI et le document PDF officiel.
        </div>

        <!-- BLOC 1 : LOGEMENT & LOCATAIRE (COLONNES 1 À 5) -->
        <div style="background:var(--bg-surface-2);padding:10px 12px;border-radius:8px;margin-bottom:12px;border:1px solid var(--border)">
          <div style="font-weight:700;color:var(--primary);margin-bottom:8px;font-size:12.5px">🏠 1. INFORMATIONS DU LOGEMENT & DU LOCATAIRE</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px">1. N° Logement / Chambre *</label>
              <input type="text" id="edit_col_num_mr" class="form-control" value="${safeNum}" required placeholder="ex: 703, 602..." />
            </div>
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px">2. Noms & Prénoms Locataire</label>
              <input type="text" id="edit_col_name_mr" class="form-control" value="${safeName}" placeholder="ex: Nom du locataire" />
            </div>
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px">3. Contact / Téléphone</label>
              <input type="text" id="edit_col_phone_mr" class="form-control" value="${safePhone}" placeholder="ex: 699000000" />
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:10px;margin-top:8px">
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px">5. Description du logement</label>
              <input type="text" id="edit_col_desc_mr" class="form-control" value="${safeDesc}" placeholder="ex: Appartement 3 pièces, Studio..." />
            </div>
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px">4. Montant du loyer mensuel (FCFA) *</label>
              <input type="number" id="edit_col_rent_mr" class="form-control" value="${safeRent}" min="0" required />
            </div>
          </div>
        </div>

        <!-- BLOC 2 : FINANCES & PAIEMENTS (COLONNES 6 À 11) -->
        <div style="background:var(--bg-surface-2);padding:10px 12px;border-radius:8px;margin-bottom:12px;border:1px solid var(--border)">
          <div style="font-weight:700;color:var(--primary);margin-bottom:8px;font-size:12.5px">💰 2. FINANCES & PAIEMENTS (CORRECTION DES CHIFFRES)</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px;color:var(--danger)">6. Arriéré de loyer (Dette FCFA)</label>
              <input type="number" id="edit_col_arriere_mr" class="form-control" value="${safeArriere}" min="0" placeholder="0" />
            </div>
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px;color:var(--success)">7. Loyer par anticipation (Avance FCFA)</label>
              <input type="number" id="edit_col_anticip_mr" class="form-control" value="${safeAnticip}" min="0" placeholder="0" />
            </div>
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px;color:var(--primary)">8. Versement au cours du mois (FCFA)</label>
              <input type="number" id="edit_col_versement_mr" class="form-control" value="${safeVersement}" min="0" placeholder="0" />
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:10px;margin-top:8px">
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px">9. Période correspondant au paiement</label>
              <input type="text" id="edit_col_periode_mr" class="form-control" value="${safePeriode}" placeholder="ex: 01/06/2026 au 01/08/2026" />
            </div>
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px">10. Mode de paiement</label>
              <select id="edit_col_mode_mr" class="form-control">
                <option value="Espèces" ${safeMode.includes('esp') || safeMode === 'cash' ? 'selected' : ''}>Espèces</option>
                <option value="Virement bancaire" ${safeMode.includes('vir') || safeMode === 'bank_transfer' ? 'selected' : ''}>Virement bancaire</option>
                <option value="Chèque" ${safeMode.includes('chè') || safeMode.includes('che') || safeMode === 'check' ? 'selected' : ''}>Chèque</option>
                <option value="Mobile Money" ${safeMode.includes('momo') || safeMode.includes('om') || safeMode.includes('mobile') ? 'selected' : ''}>Mobile Money</option>
                <option value="Autre" ${!safeMode || safeMode === '—' ? 'selected' : ''}>— Non spécifié —</option>
              </select>
            </div>
            <div class="form-group">
              <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px">11. Caution (FCFA)</label>
              <input type="number" id="edit_col_caution_mr" class="form-control" value="${safeCaution}" min="0" placeholder="0" />
            </div>
          </div>
        </div>

        <!-- BLOC 3 : OBSERVATIONS & VALIDATION (COLONNE 12) -->
        <div style="background:var(--bg-surface-2);padding:10px 12px;border-radius:8px;margin-bottom:6px;border:1px solid var(--border)">
          <div style="font-weight:700;color:var(--primary);margin-bottom:8px;font-size:12.5px">📝 3. OBSERVATION & PÉRIODE D'APPLICATION</div>
          <div class="form-group" style="margin-bottom:8px">
            <label style="font-size:11.5px;font-weight:600;display:block;margin-bottom:3px">12. Observation (gestion des loyers / litiges / promesses) :</label>
            <input type="text" id="edit_col_obs_mr" class="form-control" value="${safeObs}" placeholder="ex: À jour, promesse de paiement..." />
          </div>
          <div style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:8px">
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer">
              <input type="checkbox" id="edit_col_apply_month_mr" checked />
              <span>Associer cette correction spécifiquement au mois sélectionné (<b>${effPeriodYm}</b>)</span>
            </label>
          </div>
        </div>
      `,
      footer: `
        <div class="flex justify-between items-center w-100" style="width:100%">
          <div>
            ${line.is_overridden ? `
              <button class="btn btn-sm btn-outline" style="color:var(--danger);border-color:var(--danger)" onclick="PageManagementReports.resetRowOverride(${effAptId}, ${effPropId}, '${effPeriodYm}')" title="Annuler les corrections manuelles et restaurer le calcul automatique">
                🔄 Restaurer calcul auto
              </button>
            ` : ''}
          </div>
          <div class="flex gap-2">
            <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
            <button class="btn btn-primary" onclick="PageManagementReports.saveRow(${effAptId || 'null'}, ${effTenantId || 'null'}, ${effPropId || 'null'}, '${effPeriodYm}')">💾 Enregistrer les 12 colonnes</button>
          </div>
        </div>
      `,
      size: 'large',
    });
  },

  async saveRow(apartmentId, tenantId, propertyId, defaultPeriodYm) {
    const aptNum = document.getElementById('edit_col_num_mr')?.value.trim();
    const name = document.getElementById('edit_col_name_mr')?.value.trim();
    const phone = document.getElementById('edit_col_phone_mr')?.value.trim();
    const desc = document.getElementById('edit_col_desc_mr')?.value.trim();
    const rent = parseFloat(document.getElementById('edit_col_rent_mr')?.value) || 0;
    const arriere = parseFloat(document.getElementById('edit_col_arriere_mr')?.value) || 0;
    const anticip = parseFloat(document.getElementById('edit_col_anticip_mr')?.value) || 0;
    const versement = parseFloat(document.getElementById('edit_col_versement_mr')?.value) || 0;
    const periode = document.getElementById('edit_col_periode_mr')?.value.trim();
    const mode = document.getElementById('edit_col_mode_mr')?.value;
    const caution = parseFloat(document.getElementById('edit_col_caution_mr')?.value) || 0;
    const obs = document.getElementById('edit_col_obs_mr')?.value.trim();
    const applyMonth = document.getElementById('edit_col_apply_month_mr')?.checked;

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
      this.generateReport();
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
      this.generateReport();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de la réinitialisation');
    }
  },

  renderReport(r) {
    const s = r.summary;
    const p = r.property;
    const fmt = (n) => Number(n || 0).toLocaleString('fr-FR') + ' FCFA';
    const area = document.getElementById('mReportResultArea');

    const netResultColor = s.net_result >= 0 ? 'var(--success)' : 'var(--danger)';
    const netResultSign = s.net_result >= 0 ? '+' : '';

    // Situation locative standardisée complète SMG (12 colonnes)
    const sitLignes = (r.building_situation && r.building_situation.lignes) || r.rental_situation.apartments || [];
    const sum = (k) => sitLignes.reduce((acc, l) => acc + (Number(l[k]) || 0), 0);
    const sitTotal = (r.building_situation && r.building_situation.total) || {
      montant_loyer: sum('montant_loyer'),
      arriere_loyer: sum('arriere_loyer'),
      anticipation: sum('anticipation'),
      versement_mois: sum('versement_mois'),
      caution: sum('caution'),
    };

    const sitTableRows = sitLignes.map((l) => {
      const canCheck = !!l.tenant_id;
      return `
        <tr>
          <td class="no-print" style="text-align:center">
            <input type="checkbox" class="row-mr-chk" value="${l.tenant_id || ''}" data-apt="${l.apartment_id || ''}" onchange="PageManagementReports.updateSelection()" ${!canCheck ? 'disabled title="Aucun locataire associé"' : ''} />
          </td>
          <td><b>${l.numero_chambre || l.apartment_number || '—'}</b></td>
          <td><b>${l.nom_locataire || l.tenant_name || '—'}</b></td>
          <td>${(l.telephone || l.tenant_phone) && (l.telephone || l.tenant_phone) !== '—' ? `<a href="tel:${l.telephone || l.tenant_phone}">${l.telephone || l.tenant_phone}</a>` : '—'}</td>
          <td>${fmt(l.montant_loyer != null ? l.montant_loyer : l.rent_amount)}</td>
          <td>${l.description_logement || l.description || l.apartment_type || '—'}</td>
          <td style="${Number(l.arriere_loyer) > 0 ? 'color:var(--danger);font-weight:700' : ''}">${fmt(l.arriere_loyer)}</td>
          <td style="${Number(l.anticipation) > 0 ? 'color:var(--success);font-weight:700' : ''}">${fmt(l.anticipation)}</td>
          <td style="${Number(l.versement_mois) > 0 ? 'color:var(--primary);font-weight:700' : ''}">${fmt(l.versement_mois)}</td>
          <td>${l.periode_paiement || '—'}</td>
          <td>${Helpers.methodLabel(l.mode_paiement)}</td>
          <td>${fmt(l.caution)}</td>
          <td style="font-size:12px">${l.observations || '—'}</td>
          <td class="no-print" style="text-align:center;white-space:nowrap">
            <button class="btn btn-sm btn-primary" style="padding:2px 7px;margin-right:4px;" title="Modifier les 12 colonnes" onclick="PageManagementReports.editRow(${l.apartment_id || 'null'}, ${l.tenant_id || 'null'})">✏️</button>
            <button class="btn btn-sm btn-danger" style="padding:2px 7px;" title="Supprimer individuellement" onclick="PageManagementReports.deleteSingle(${l.tenant_id || 'null'}, ${l.apartment_id || 'null'})">🗑</button>
          </td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="14" class="text-center text-muted">Aucun logement répertorié</td></tr>`;

    const sitTotalRow = `
      <tr style="font-weight:700;background:var(--bg-surface-2);border-top:2px solid var(--border)">
        <td class="no-print"></td>
        <td>TOTAL</td>
        <td></td>
        <td></td>
        <td><b>${fmt(sitTotal.montant_loyer)}</b></td>
        <td></td>
        <td style="color:var(--danger)"><b>${fmt(sitTotal.arriere_loyer)}</b></td>
        <td style="color:var(--success)"><b>${fmt(sitTotal.anticipation)}</b></td>
        <td style="color:var(--primary);font-weight:800"><b>${fmt(sitTotal.versement_mois)}</b></td>
        <td></td>
        <td></td>
        <td><b>${fmt(sitTotal.caution)}</b></td>
        <td></td>
        <td class="no-print"></td>
      </tr>
    `;

    area.innerHTML = `
      <!-- EN-TÊTE DU RAPPORT -->
      <div class="card" style="margin-bottom:16px;border-left:4px solid var(--primary)">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <span class="badge badge-info" style="font-size:12px">🏢 ${p.property_name}</span>
            <h3 style="font-size:16px;font-weight:700;margin-top:4px">${p.address || ''}, ${p.city || ''}</h3>
            <p style="font-size:12px;color:var(--text-muted);margin:0">
              Propriétaire : <b>${p.owner ? p.owner.full_name : '—'}</b> | Période : <b>${r.period.start}</b> au <b>${r.period.end}</b> (${r.period.months} mois)
            </p>
          </div>
          <button class="btn btn-success" onclick="PageManagementReports.downloadPdf()">
            <span class="btn-icon">📄</span> Télécharger en PDF
          </button>
        </div>
      </div>

      <!-- 1. KPI FINANCIERS -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px">
        <div class="card stat-card">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Loyer Attendu (Théorique)</div>
          <div style="font-size:20px;font-weight:800;color:var(--primary);margin-top:4px">${fmt(s.theoretical_rent)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${r.rental_situation.occupied_apartments} logement(s) × ${r.period.months} mois</div>
        </div>

        <div class="card stat-card">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Loyer Réellement Encaissé</div>
          <div style="font-size:20px;font-weight:800;color:var(--success);margin-top:4px">${fmt(s.collected_rent)}</div>
          <div style="font-size:11px;color:var(--success);margin-top:2px">Taux d'encaissement : <b>${s.collection_rate}%</b></div>
        </div>

        <div class="card stat-card">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Reste à Encaisser / Impayés</div>
          <div style="font-size:20px;font-weight:800;color:var(--danger);margin-top:4px">${fmt(s.remaining_to_collect)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Écart sur la période</div>
        </div>

        <div class="card stat-card">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Total Dépenses Immeuble</div>
          <div style="font-size:20px;font-weight:800;color:var(--accent);margin-top:4px">${fmt(s.total_expenses)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Maint: ${fmt(s.maintenance_expenses)} | Autre: ${fmt(s.other_expenses)}</div>
        </div>
      </div>

      <!-- RÉSULTAT NET -->
      <div class="card" style="margin-bottom:16px;background:var(--secondary-bg, #f0f4f8);border:2px solid ${netResultColor}">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h4 style="font-size:14px;font-weight:700;color:var(--text);margin:0">💰 RÉSULTAT FINANCIER DE LA PÉRIODE</h4>
            <p style="font-size:12px;color:var(--text-muted);margin:2px 0 0">
              Encaissements (${fmt(s.collected_rent)}) − Dépenses (${fmt(s.total_expenses)})
            </p>
          </div>
          <div style="font-size:24px;font-weight:900;color:${netResultColor}">
            ${netResultSign}${fmt(s.net_result)}
          </div>
        </div>
      </div>

      <!-- 2. SITUATION LOCATIVE CONFORME 12 COLONNES -->
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div>
            <h4 style="font-size:15px;font-weight:700;margin:0">🏠 2. Situation Locative Complète de l'Immeuble (${r.rental_situation.occupied_apartments}/${r.rental_situation.total_apartments} occupés)</h4>
            <small class="text-muted">Modèle officiel SMG à 12 colonnes standardisées avec suivi des cautions, arriérés et observations.</small>
          </div>
          <button class="btn btn-sm btn-danger" id="bulkDelBtn_mr" style="display:none;font-weight:600" onclick="PageManagementReports.deleteSelected()">
            🗑 Supprimer la sélection (<span id="selNum_mr">0</span>)
          </button>
        </div>

        <div class="table-wrap" style="overflow-x:auto">
          <table class="table table-bordered">
            <thead>
              <tr>
                <th class="no-print" style="width:36px;text-align:center">
                  <input type="checkbox" id="chkAll_mr" onchange="PageManagementReports.toggleSelectAll(this.checked)" title="Tout sélectionner" />
                </th>
                <th>Num du logement</th>
                <th>Noms locataires</th>
                <th>Numéro de téléphone</th>
                <th>Montant loyers</th>
                <th>Description du logement</th>
                <th>ARRIERE DE LOYER</th>
                <th>LOYER PAR ANTICIPATION</th>
                <th>VERSEMENT AU COUR DU MOIS</th>
                <th>PÉRIODE CORRESPONDANT AU PAIEMENT</th>
                <th>MODE DE PAIEMENT</th>
                <th>CAUTION</th>
                <th>Observation</th>
                <th class="no-print" style="text-align:center;width:75px">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${sitTableRows}
              ${sitTotalRow}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 3. ENCAISSEMENTS RÉALISÉS (SYNTHÈSE AGRÉGÉE PAR LOGEMENT / LOCATAIRE) -->
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <h4 style="font-size:15px;font-weight:700;margin:0">💳 3. Encaissements Réalisés (${(r.aggregated_collections || []).length} logements réglés — Total : ${fmt(s.collected_rent)})</h4>
          <span class="badge badge-success" style="font-size:12px">Total Encaissé : ${fmt(s.collected_rent)}</span>
        </div>
        ${!(r.aggregated_collections || []).length ? '<p style="color:var(--text-muted);font-size:13px">Aucun encaissement sur cette période.</p>' : `
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Logement</th>
                  <th>Locataire</th>
                  <th>PERIODE CORRESPONDANT AU PAYEMENT</th>
                  <th>Mode(s)</th>
                  <th>N° Reçus</th>
                  <th style="text-align:right">Total Encaissé</th>
                </tr>
              </thead>
              <tbody>
                ${(r.aggregated_collections || []).map((c) => `
                  <tr>
                    <td><b>${c.apartment_number}</b></td>
                    <td><b>${c.tenant_name}</b></td>
                    <td>
                      <span style="font-weight:600">${c.periode_paiement || c.nature}</span>
                      ${c.transaction_count > 1 ? `<span class="badge badge-info" style="margin-left:6px;font-size:10px">${c.transaction_count} versements</span>` : ''}
                      ${c.date_range && c.date_range !== '—' && c.date_range !== (c.periode_paiement || c.nature) ? `<br><small style="color:var(--text-muted)">Date encaissement : ${c.date_range}</small>` : ''}
                    </td>
                    <td><small>${c.methods}</small></td>
                    <td>${(c.receipt_numbers || '—').split(/,\n|, /).map(rn => `<span class="badge badge-outline" style="display:inline-block;margin:2px 0;font-size:10.5px;font-weight:600;color:var(--primary)">${rn.trim()}</span>`).join('<br>')}</td>
                    <td style="text-align:right"><b style="color:var(--success);font-size:13px">${fmt(c.total_collected)}</b></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}

        <!-- DÉTAIL DES TRANSACTIONS INDIVIDUELLES -->
        ${(r.transactions || []).length ? `
          <div style="margin-top:16px;border-top:1px dashed var(--border);padding-top:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <h5 style="font-size:13px;font-weight:700;color:var(--text-muted);margin:0">
                🔍 Historique Détaillé des Transactions (${r.transactions.length} opération(s))
              </h5>
              <button class="btn btn-sm btn-outline" style="font-size:11px" onclick="
                const el = document.getElementById('reportTxDetailBox');
                if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
              ">Afficher / Masquer le détail</button>
            </div>
            <div id="reportTxDetailBox" class="table-responsive" style="max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:6px">
              <table class="table table-sm">
                <thead>
                  <tr style="background:var(--secondary-bg)">
                    <th>Date</th>
                    <th>Locataire</th>
                    <th>Logement</th>
                    <th>Mode</th>
                    <th>N° Reçu</th>
                    <th style="text-align:right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  ${r.transactions.map((t) => `
                    <tr>
                      <td><small>${new Date(t.date).toLocaleDateString('fr-FR')}</small></td>
                      <td><b>${t.tenant_name}</b></td>
                      <td>${t.apartment_number}</td>
                      <td><small>${t.payment_method || '—'}</small></td>
                      <td><small style="color:var(--primary)">${t.receipt_number || '—'}</small></td>
                      <td style="text-align:right"><b style="color:var(--success)">${fmt(t.amount)}</b></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- 4. TRAVAUX & INTERVENTIONS TECHNIQUES -->
      <div class="card" style="margin-bottom:16px">
        <h4 style="font-size:15px;font-weight:700;margin-bottom:12px">🔧 4. Travaux & Interventions Techniques (${(r.works_done || []).length})</h4>
        ${!(r.works_done || []).length ? '<p style="color:var(--text-muted);font-size:13px">Aucun travail de maintenance sur cette période.</p>' : `
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Intervention</th>
                  <th>Logement</th>
                  <th>Technicien</th>
                  <th>Statut</th>
                  <th>Coût</th>
                </tr>
              </thead>
              <tbody>
                ${r.works_done.map((w) => `
                  <tr>
                    <td><small>${new Date(w.date).toLocaleDateString('fr-FR')}</small></td>
                    <td><b>${w.title}</b><br><small style="color:var(--text-muted)">${w.description || ''}</small></td>
                    <td>${w.apartment_number}</td>
                    <td>${w.technician}</td>
                    <td><span class="badge badge-info">${w.status}</span></td>
                    <td><b style="color:var(--danger)">${fmt(w.cost)}</b></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <!-- 5. DÉPENSES DÉTAILLÉES -->
      <div class="card" style="margin-bottom:16px">
        <h4 style="font-size:15px;font-weight:700;margin-bottom:12px">🧾 5. Dépenses Détaillées (Total : ${fmt(s.total_expenses)})</h4>
        ${!(r.expenses_detail || []).length ? '<p style="color:var(--text-muted);font-size:13px">Aucune dépense sur cette période.</p>' : `
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Désignation</th>
                  <th>Catégorie</th>
                  <th>Contexte / Logement</th>
                  <th>Qté</th>
                  <th>Prix Unitaire</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${r.expenses_detail.map((e) => `
                  <tr>
                    <td><small>${new Date(e.date).toLocaleDateString('fr-FR')}</small></td>
                    <td><b>${e.item_name}</b></td>
                    <td><span class="badge badge-secondary">${e.category}</span></td>
                    <td><small>${e.apartment_number} (${e.maintenance_title || '—'})</small></td>
                    <td>${e.quantity}</td>
                    <td>${Number(e.unit_price).toLocaleString('fr-FR')}</td>
                    <td><b style="color:var(--danger)">${fmt(e.total_price)}</b></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <!-- 6. BILAN ET RÉSULTAT DE LA PÉRIODE -->
      <div class="card" style="background:var(--secondary-bg, #f0f4f8);border:2px solid ${netResultColor}">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h4 style="font-size:15px;font-weight:700;color:var(--text);margin:0">📊 6. BILAN ET RÉSULTAT NET DE LA PÉRIODE</h4>
            <p style="font-size:13px;color:var(--text-muted);margin:4px 0 0">
              Total Encaissements (${fmt(s.collected_rent)}) − Total Dépenses (${fmt(s.total_expenses)})
            </p>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:${netResultColor}">Montant Net à Reverser</div>
            <div style="font-size:24px;font-weight:900;color:${netResultColor}">
              ${netResultSign}${fmt(s.net_result)}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async downloadPdf() {
    if (!this._currentReport) return;
    const propertyId = this._currentReport.property.id;
    const start = this._currentReport.period.start;
    const end = this._currentReport.period.end;

    Toast.info('Génération du rapport PDF en cours...');
    try {
      const blob = await API.downloadBlob(`/management-reports/building/${propertyId}/pdf?start=${start}&end=${end}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = String(this._currentReport.property.property_name || 'Immeuble').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Rapport_${safeName}_${start}_${end}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      Toast.success('Rapport PDF téléchargé avec succès ✅');
    } catch (err) {
      console.error('Erreur PDF:', err);
      Toast.error(err.message || 'Impossible de télécharger le rapport PDF');
    }
  },

  // ===== GESTION DU RÉCAPITULATIF DES ENTRÉES PAR IMMEUBLE =====
  renderInflowsPropertyChips() {
    const container = document.getElementById('inflowPropertiesChipsContainer');
    if (!container) return;
    const props = this._properties || [];
    if (!props.length) {
      container.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">Aucun immeuble disponible</span>';
      return;
    }

    container.innerHTML = props.map((p) => {
      const isChecked = this._selectedInflowPropertyIds.includes(Number(p.id));
      return `
        <label style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;background:${isChecked ? 'var(--primary, #1a3a5c)' : 'var(--bg-surface, #fff)'};color:${isChecked ? '#fff' : 'var(--text)'};border:1px solid ${isChecked ? 'var(--primary)' : 'var(--border)'};font-size:12px;cursor:pointer;user-select:none;transition:all 0.2s">
          <input type="checkbox" value="${p.id}" ${isChecked ? 'checked' : ''} onchange="PageManagementReports.toggleInflowProperty(${p.id}, this.checked)" style="accent-color:var(--primary);cursor:pointer" />
          <span><b>${Helpers.escapeHtml(p.property_name)}</b> <small style="opacity:0.85">(${Helpers.escapeHtml(p.city || '—')})</small></span>
        </label>
      `;
    }).join('');

    const badge = document.getElementById('inflowSelectedBadge');
    if (badge) {
      const totalProps = props.length;
      const count = this._selectedInflowPropertyIds.length;
      badge.textContent = count === 0 || count === totalProps 
        ? `Tous les immeubles (${totalProps})` 
        : `${count} immeuble(s) sélectionné(s)`;
    }
  },

  toggleInflowProperty(id, checked) {
    const numId = Number(id);
    const idx = this._selectedInflowPropertyIds.indexOf(numId);
    if (checked && idx < 0) {
      this._selectedInflowPropertyIds.push(numId);
    } else if (!checked && idx >= 0) {
      this._selectedInflowPropertyIds.splice(idx, 1);
    }
    this.renderInflowsPropertyChips();
  },

  selectAllInflowProperties(selectAll) {
    if (selectAll) {
      this._selectedInflowPropertyIds = (this._properties || []).map((p) => Number(p.id));
    } else {
      this._selectedInflowPropertyIds = [];
    }
    this.renderInflowsPropertyChips();
  },

  async generateInflowsRecap() {
    const start = document.getElementById('mReportInflowsStart')?.value;
    const end = document.getElementById('mReportInflowsEnd')?.value;

    if (!start || !end) { Toast.warning('Veuillez renseigner les dates'); return; }
    if (start > end) { Toast.error('La date de début ne peut pas être après la date de fin'); return; }

    const propIds = this._selectedInflowPropertyIds;
    let url = `/management-reports/inflows-recap?start=${start}&end=${end}`;
    if (propIds && propIds.length > 0 && propIds.length < (this._properties || []).length) {
      url += `&property_ids=${propIds.join(',')}`;
    }

    const area = document.getElementById('mReportInflowsResultArea');
    area.innerHTML = '<div class="card" style="text-align:center;padding:40px"><div class="spinner"></div><p style="margin-top:12px;color:var(--text-muted)">Analyse et consolidation des entrées par immeuble en cours...</p></div>';

    try {
      const res = await API.get(url);
      const data = res.data;
      this._currentInflowsData = data;

      const pdfBtn = document.getElementById('mReportInflowsPdfBtn');
      if (pdfBtn) pdfBtn.style.display = 'inline-flex';
      this.renderInflowsRecap(data);
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de la génération du récapitulatif');
      area.innerHTML = `<div class="card" style="text-align:center;padding:30px;color:var(--danger)">Échec de génération du récapitulatif.</div>`;
    }
  },

  renderInflowsRecap(data) {
    const s = data.summary || {};
    const items = data.items || [];
    const obs = data.observations || [];
    const p = data.period || {};
    const fmt = (n) => Number(n || 0).toLocaleString('fr-FR') + ' FCFA';
    const area = document.getElementById('mReportInflowsResultArea');
    if (!area) return;

    const totalEntrees = s.total_entrees || 0;
    const totalVirement = s.total_virement || 0;
    const totalCash = s.total_cash || 0;
    const pctVirement = s.percent_virement || 0;
    const pctCash = s.percent_cash || 0;

    const tableRows = items.map((it) => {
      let badgeStyle = 'background:var(--secondary-bg);color:var(--text-muted);border:1px solid var(--border)';
      if (it.dominance_class === 'badge-danger') badgeStyle = 'background:#fee2e2;color:#991b1b;border:1px solid #f87171';
      else if (it.dominance_class === 'badge-warning') badgeStyle = 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d';
      else if (it.dominance_class === 'badge-success') badgeStyle = 'background:#dcfce7;color:#166534;border:1px solid #86efac';
      else if (it.dominance_class === 'badge-info') badgeStyle = 'background:#e0f2fe;color:#075985;border:1px solid #7dd3fc';
      else if (it.dominance_class === 'badge-primary') badgeStyle = 'background:#e0e7ff;color:#3730a3;border:1px solid #a5b4fc';

      return `
        <tr>
          <td>
            <b>${Helpers.escapeHtml(it.property_name || '—')}</b>
            ${it.city ? `<br><small style="color:var(--text-muted)">📍 ${Helpers.escapeHtml(it.city)}</small>` : ''}
          </td>
          <td style="text-align:right">
            <span style="font-weight:600;color:var(--primary)">${fmt(it.virement)}</span>
          </td>
          <td style="text-align:right">
            <span style="font-weight:600;color:var(--warning, #b45309)">${fmt(it.cash)}</span>
          </td>
          <td style="text-align:right">
            <b style="font-size:13.5px;color:var(--success, #15803d)">${fmt(it.total)}</b>
          </td>
          <td style="text-align:center">
            <span class="badge badge-outline" style="font-weight:700">${it.share || 0}%</span>
          </td>
          <td style="text-align:center">
            <span class="badge" style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:12px;${badgeStyle}">
              ${it.dominance_badge || '—'}
            </span>
          </td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="6" class="text-center text-muted" style="padding:20px">Aucun encaissement sur la période sélectionnée</td></tr>`;

    area.innerHTML = `
      <!-- EN-TÊTE DU RÉCAPITULATIF -->
      <div class="card" style="margin-bottom:16px;border-left:4px solid var(--primary)">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="badge badge-primary" style="font-size:12px">📑 Récapitulatif Consolidé</span>
              <span class="badge badge-outline" style="font-size:12px">${items.length} immeuble(s) analysé(s)</span>
            </div>
            <h3 style="font-size:16px;font-weight:700;margin-top:6px">
              Répartition des Entrées du ${Helpers.formatDate(p.start)} au ${Helpers.formatDate(p.end)}
            </h3>
            <p style="font-size:12px;color:var(--text-muted);margin:0">
              Ventilation officielle des flux financiers par bien immobilier (Virement vs Cash / Mobile Money)
            </p>
          </div>
          <button class="btn btn-success" onclick="PageManagementReports.downloadInflowsRecapPdf()">
            <span class="btn-icon">📄</span> Télécharger le Récapitulatif PDF
          </button>
        </div>
      </div>

      <!-- 1. 4 KPI CARDS -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px">
        <div class="card stat-card" style="border-top:3px solid var(--success)">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Total Entrées de la période</div>
          <div style="font-size:22px;font-weight:900;color:var(--success);margin-top:4px">${fmt(totalEntrees)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">100% des encaissements enregistrés</div>
        </div>

        <div class="card stat-card" style="border-top:3px solid var(--primary)">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Virements Bancaires</div>
          <div style="font-size:20px;font-weight:800;color:var(--primary);margin-top:4px">${fmt(totalVirement)}</div>
          <div style="font-size:11px;color:var(--primary);font-weight:700;margin-top:2px">${pctVirement}% du total global</div>
        </div>

        <div class="card stat-card" style="border-top:3px solid var(--warning, #b45309)">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Cash / Espèces & Mobile</div>
          <div style="font-size:20px;font-weight:800;color:var(--warning, #b45309);margin-top:4px">${fmt(totalCash)}</div>
          <div style="font-size:11px;color:var(--warning, #b45309);font-weight:700;margin-top:2px">${pctCash}% du total global</div>
        </div>

        <div class="card stat-card" style="border-top:3px solid var(--text-muted)">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Immeubles Couverts</div>
          <div style="font-size:20px;font-weight:800;color:var(--text);margin-top:4px">${items.filter(it => it.total > 0).length} / ${items.length}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${items.filter(it => it.total > 0).length} bien(s) avec entrées</div>
        </div>
      </div>

      <!-- 2. TABLEAU DE VENTILATION DES ENTRÉES PAR IMMEUBLE -->
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <h4 style="font-size:15px;font-weight:700;margin:0">
            📊 Ventilation des Encaissements par Immeuble
          </h4>
          <span style="font-size:12px;color:var(--text-muted)">Trier par volume d'entrées décroissant</span>
        </div>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr style="background:var(--secondary-bg, #f8fafc)">
                <th>Immeuble & Ville</th>
                <th style="text-align:right">Virement</th>
                <th style="text-align:right">Cash / Espèces</th>
                <th style="text-align:right">Total Encaissé</th>
                <th style="text-align:center">Part (%)</th>
                <th style="text-align:center">Ventilation des flux</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
              <tr style="font-weight:800;background:var(--secondary-bg, #f0f4f8);border-top:2px solid var(--border);font-size:13.5px">
                <td>TOTAL GÉNÉRAL CONSOLIDÉ</td>
                <td style="text-align:right;color:var(--primary)">${fmt(totalVirement)}</td>
                <td style="text-align:right;color:var(--warning, #b45309)">${fmt(totalCash)}</td>
                <td style="text-align:right;color:var(--success, #15803d);font-size:14px">${fmt(totalEntrees)}</td>
                <td style="text-align:center">100%</td>
                <td style="text-align:center"><span class="badge badge-primary">Consolidé</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 3. CONSTATS ET ANALYSES DE GESTION -->
      <div class="card" style="margin-bottom:16px;background:var(--secondary-bg, #f9fafb);border:1px solid var(--border);border-left:4px solid var(--primary)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <span style="font-size:18px">💡</span>
          <h4 style="font-size:15px;font-weight:700;color:var(--primary);margin:0">
            3. Constats et Analyses de Gestion
          </h4>
        </div>
        ${obs.length ? `
          <ul style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px">
            ${obs.map(o => `
              <li style="font-size:13px;line-height:1.5;color:var(--text)">
                ${Helpers.escapeHtml(o)}
              </li>
            `).join('')}
          </ul>
        ` : `
          <p style="font-size:13px;color:var(--text-muted);margin:0">Aucun constat automatique généré pour cette période.</p>
        `}
      </div>

      <!-- 4. CADRE DE VALIDATION & VISA -->
      <div class="card" style="margin-bottom:16px">
        <h4 style="font-size:14px;font-weight:700;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase">
          ✍️ Validation & Visas Officiels
        </h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div style="border:1px dashed var(--border);padding:14px;border-radius:8px;min-height:90px">
            <div style="font-size:12px;font-weight:700;color:var(--primary)">POUR LA DIRECTION SMG IMMOBILIER</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Visa & Cachet autorisés</div>
          </div>
          <div style="border:1px dashed var(--border);padding:14px;border-radius:8px;min-height:90px">
            <div style="font-size:12px;font-weight:700;color:var(--primary)">LE RESPONSABLE ADMINISTRATIF & FINANCIER</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Vérification de la comptabilité</div>
          </div>
        </div>
      </div>
    `;
  },

  async downloadInflowsRecapPdf() {
    const start = document.getElementById('mReportInflowsStart')?.value || this._currentInflowsData?.period?.start;
    const end = document.getElementById('mReportInflowsEnd')?.value || this._currentInflowsData?.period?.end;

    if (!start || !end) {
      Toast.warning('Veuillez renseigner les dates');
      return;
    }

    const propIds = this._selectedInflowPropertyIds;
    const allCount = (this._properties || []).length;
    let url = `/management-reports/inflows-recap/pdf?start=${start}&end=${end}`;
    if (propIds && propIds.length > 0 && propIds.length < allCount) {
      url += `&property_ids=${propIds.join(',')}`;
    }

    Toast.info('Génération du récapitulatif PDF en cours...');
    try {
      const blob = await API.downloadBlob(url);
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Recapitulatif_Entrees_${start}_${end}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      Toast.success('Récapitulatif des entrées PDF téléchargé avec succès ✅');
    } catch (err) {
      console.error('Erreur PDF Récapitulatif:', err);
      Toast.error(err.message || 'Impossible de télécharger le PDF du récapitulatif');
    }
  },
};

window.PageManagementReports = PageManagementReports;
