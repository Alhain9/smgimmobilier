// ============ Charges & Factures d'Électricité / Eau (Complémentaire & Intégré) ============
const PageUtilities = {
  register() {
    Router.register('utilities', () => this.render());
    Router.register('my-utilities', () => this.renderMine());
  },

  _apts: [],
  _rows: {},
  _allBills: [],
  _currentTab: 'factures', // 'factures' | 'facturer' | 'recap_mois' | 'recap_logement'
  MONTHS: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],

  monthLabel(m) { return this.MONTHS[m - 1] || m; },
  typeLabel(t) { return t === 'water' ? '💧 Eau' : '⚡ Électricité'; },
  conso(b) { return parseFloat((Math.max(0, Number(b.current_index || 0) - Number(b.previous_index || 0))).toFixed(2)); },

  // Logements des immeubles où la redistribution est activée
  async loadBillable() {
    try {
      const props = (await API.get('/properties')).data || [];
      this._apts = [];
      props.forEach((p) => {
        (p.apartments || []).forEach((a) => {
          this._apts.push({
            id: a.id,
            number: a.apartment_number,
            property_name: p.property_name,
            label: `${a.apartment_number} — ${p.property_name}`,
            type: a.apartment_type || 'Appartement',
            utilities_enabled: p.utilities_enabled,
            electricity_price: p.electricity_price || 0,
            water_price: p.water_price || 0,
            garbage_fee: p.garbage_fee || 0,
            transport_fee: p.transport_fee || 0,
          });
        });
      });
      return this._apts;
    } catch (_) {
      return [];
    }
  },

  // ===== Rendu Principal de la Page =====
  async render() {
    Layout.setTitle('Charges & Factures d\'Électricité');
    await this.loadBillable();

    // Charger les stats et factures en parallèle
    let stats = { total_logements: this._apts.length, total_factures: 0, total_collecte: 0, total_impaye: 0, nb_impayes: 0 };
    let bills = [];
    try {
      const [resStats, resBills] = await Promise.all([
        API.get('/utility-bills/stats').catch(() => ({ data: null })),
        API.get('/utility-bills').catch(() => ({ data: [] }))
      ]);
      if (resStats && resStats.data) stats = resStats.data;
      bills = resBills.data || [];
      this._allBills = bills;
      this._rows = {};
      bills.forEach((b) => { this._rows[b.id] = b; });
    } catch (e) {
      console.error(e);
    }

    const canEdit = Auth.hasRole('super_admin', 'manager', 'comptable', 'dir_admin', 'gestionnaire');

    const content = `
      <div class="page-head" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px">
        <div>
          <h2>⚡ Factures d'Électricité & Charges</h2>
          <div class="subtitle">Gestion complète des compteurs divisionnaires, refacturation et reçus officiels de paiement</div>
        </div>
        <div class="actions-bar" style="display:flex;gap:8px;flex-wrap:wrap">
          ${canEdit ? `
            <button class="btn btn-outline" onclick="PageUtilities.openBatchModal()">⚡ Saisie groupée par immeuble</button>
            <button class="btn btn-primary" onclick="PageUtilities.switchTab('facturer')">➕ Créer une facture</button>
          ` : ''}
          <button class="btn btn-success" onclick="PageUtilities.generateAllPDF()">📥 Exporter toutes les factures (PDF)</button>
        </div>
      </div>

      <!-- KPIs Synthétiques -->
      <div class="dashboard-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px;margin-bottom:24px">
        <div class="card p-3" style="display:flex;align-items:center;gap:15px;border-left:4px solid var(--primary)">
          <div style="font-size:2rem">🚪</div>
          <div>
            <div style="font-size:1.6rem;font-weight:bold;color:var(--text-primary)">${stats.total_logements || this._apts.length}</div>
            <div style="font-size:0.85rem;color:var(--text-muted)">Logements configurés</div>
          </div>
        </div>
        <div class="card p-3" style="display:flex;align-items:center;gap:15px;border-left:4px solid var(--info)">
          <div style="font-size:2rem">📄</div>
          <div>
            <div style="font-size:1.6rem;font-weight:bold;color:var(--info)">${bills.length}</div>
            <div style="font-size:0.85rem;color:var(--text-muted)">Factures générées</div>
          </div>
        </div>
        <div class="card p-3" style="display:flex;align-items:center;gap:15px;border-left:4px solid var(--success)">
          <div style="font-size:2rem">💰</div>
          <div>
            <div style="font-size:1.6rem;font-weight:bold;color:var(--success)">${Helpers.formatMoney(stats.total_collecte || 0)}</div>
            <div style="font-size:0.85rem;color:var(--text-muted)">Total Collecté</div>
          </div>
        </div>
        <div class="card p-3" style="display:flex;align-items:center;gap:15px;border-left:4px solid var(--danger)">
          <div style="font-size:2rem">⚠️</div>
          <div>
            <div style="font-size:1.6rem;font-weight:bold;color:var(--danger)">${stats.nb_impayes || bills.filter(b => b.status !== 'paid').length}</div>
            <div style="font-size:0.85rem;color:var(--text-muted)">Facture(s) en impayé (${Helpers.formatMoney(stats.total_impaye || 0)})</div>
          </div>
        </div>
      </div>

      <!-- Navigation par Onglets -->
      <div class="tabs-nav" style="display:flex;gap:8px;border-bottom:1px solid var(--border-color);margin-bottom:20px;overflow-x:auto">
        <button class="tab-btn ${this._currentTab === 'factures' ? 'active' : ''}" onclick="PageUtilities.switchTab('factures')">
          📄 Factures (${bills.length})
        </button>
        ${canEdit ? `
          <button class="tab-btn ${this._currentTab === 'facturer' ? 'active' : ''}" onclick="PageUtilities.switchTab('facturer')">
            ✏️ Créer Facture
          </button>
        ` : ''}
        <button class="tab-btn ${this._currentTab === 'recap_mois' ? 'active' : ''}" onclick="PageUtilities.switchTab('recap_mois')">
          📊 Récapitulatif Mensuel
        </button>
        <button class="tab-btn ${this._currentTab === 'recap_logement' ? 'active' : ''}" onclick="PageUtilities.switchTab('recap_logement')">
          📋 Par Logement
        </button>
      </div>

      <!-- Conteneur de l'onglet actif -->
      <div id="utilityTabContent"></div>
    `;

    Layout.content(content);
    this.renderTab(this._currentTab);
  },

  switchTab(tab) {
    this._currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick')?.includes(`'${tab}'`));
    if (btn) btn.classList.add('active');
    this.renderTab(tab);
  },

  renderTab(tab) {
    const box = document.getElementById('utilityTabContent');
    if (!box) return;

    if (tab === 'factures') this.renderFacturesTab(box);
    else if (tab === 'facturer') this.renderFacturerTab(box);
    else if (tab === 'recap_mois') this.renderRecapMoisTab(box);
    else if (tab === 'recap_logement') this.renderRecapLogementTab(box);
  },

  // ============================================================
  // ONGLET 1 : LISTE DES FACTURES
  // ============================================================
  renderFacturesTab(box) {
    const canEdit = Auth.hasRole('super_admin', 'manager', 'comptable', 'dir_admin', 'gestionnaire');
    const bills = this._allBills || [];

    const rows = bills.map((b) => {
      const aptNum = b.apartment ? b.apartment.apartment_number : (b.identifiant_logement || '—');
      const propName = b.apartment && b.apartment.property ? b.apartment.property.property_name : (b.immeuble || '');
      const tenantName = (b.apartment && b.apartment.tenants && b.apartment.tenants[0] && b.apartment.tenants[0].user)
        ? b.apartment.tenants[0].user.full_name : '—';
      const conso = this.conso(b);
      const isPaid = b.status === 'paid';
      const unit = b.type === 'water' ? 'm³' : 'kWh';

      return `
        <tr>
          <td>
            <b>${aptNum}</b>
            ${propName ? `<br><span class="text-muted" style="font-size:0.75rem">${propName}</span>` : ''}
          </td>
          <td>${tenantName}</td>
          <td>${this.typeLabel(b.type)}</td>
          <td><b>${this.monthLabel(b.period_month)} ${b.period_year}</b></td>
          <td>
            <div style="font-family:monospace;font-size:0.85rem">${b.previous_index} → ${b.current_index}</div>
            <span class="badge badge-info" style="font-size:0.75rem">${conso} ${unit}</span>
          </td>
          <td><b>${Helpers.formatMoney(b.total_amount)}</b></td>
          <td>
            ${isPaid
              ? `<span class="badge badge-success" style="font-weight:600">PAYÉ</span>`
              : `<span class="badge badge-danger" style="font-weight:600">IMPAYÉ</span>`
            }
          </td>
          <td>
            ${isPaid
              ? `<button class="btn btn-sm btn-outline-success" title="Voir le Reçu de Paiement" onclick="PageUtilities.viewReceipt(${b.id})">🧾 Reçu</button>`
              : (canEdit ? `<button class="btn btn-sm btn-primary" onclick="PageUtilities.openPaymentModal(${b.id})">💳 Régler</button>` : '—')
            }
          </td>
          <td>
            <div class="btn-group" style="display:inline-flex;gap:4px">
              <button class="btn btn-sm btn-outline" title="Visualiser la facture" onclick="PageUtilities.viewFacture(${b.id})">👁️ Voir</button>
              <button class="btn btn-sm btn-outline" title="Télécharger facture PDF" onclick="PageUtilities.downloadBillPdf(${b.id})">📄 PDF</button>
              ${canEdit ? `
                <button class="btn btn-sm btn-outline" title="Modifier" onclick="PageUtilities.edit(${b.id})">✏️</button>
                <button class="btn btn-sm btn-danger" title="Supprimer" onclick="PageUtilities.remove(${b.id})">🗑️</button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <input type="search" id="utilitySearchInput" class="form-control search" placeholder="🔎 Rechercher par logement, immeuble, locataire, mois..." style="max-width:360px" oninput="PageUtilities.filterFactures(this.value)" />
        <div style="font-size:12.5px;color:var(--text-muted)" id="utilityFacturesCount">${bills.length} facture(s)</div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Logement</th>
                <th>Locataire</th>
                <th>Type</th>
                <th>Mois</th>
                <th>Index (Conso)</th>
                <th>Total Facturé</th>
                <th>Statut</th>
                <th>Reçu</th>
                <th style="width:170px">Actions</th>
              </tr>
            </thead>
            <tbody id="utilityFacturesTbody">
              ${rows.length ? rows : '<tr><td colspan="9" class="text-center text-muted p-4">Aucune facture enregistrée pour le moment.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  filterFactures(query) {
    const q = (query || '').toLowerCase().trim();
    const bills = this._allBills || [];
    const canEdit = Auth.hasRole('super_admin', 'manager', 'comptable', 'dir_admin', 'gestionnaire');

    const filtered = !q ? bills : bills.filter((b) => {
      const apt = (b.apartment?.apartment_number || b.identifiant_logement || '').toLowerCase();
      const prop = (b.apartment?.property?.property_name || b.immeuble || '').toLowerCase();
      const tenant = (b.apartment?.tenants?.[0]?.user?.full_name || '').toLowerCase();
      const month = `${this.monthLabel(b.period_month)} ${b.period_year}`.toLowerCase();
      const status = (b.status || '').toLowerCase();
      return apt.includes(q) || prop.includes(q) || tenant.includes(q) || month.includes(q) || status.includes(q);
    });

    const tbody = document.getElementById('utilityFacturesTbody');
    const cnt = document.getElementById('utilityFacturesCount');
    if (cnt) cnt.textContent = `${filtered.length} facture(s)`;
    if (!tbody) return;

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted p-4">Aucune facture ne correspond à votre recherche.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map((b) => {
      const aptNum = b.apartment ? b.apartment.apartment_number : (b.identifiant_logement || '—');
      const propName = b.apartment && b.apartment.property ? b.apartment.property.property_name : (b.immeuble || '');
      const tenantName = (b.apartment && b.apartment.tenants && b.apartment.tenants[0] && b.apartment.tenants[0].user)
        ? b.apartment.tenants[0].user.full_name : '—';
      const conso = this.conso(b);
      const isPaid = b.status === 'paid';
      const unit = b.type === 'water' ? 'm³' : 'kWh';

      return `
        <tr>
          <td>
            <b>${aptNum}</b>
            ${propName ? `<br><span class="text-muted" style="font-size:0.75rem">${propName}</span>` : ''}
          </td>
          <td>${tenantName}</td>
          <td>${this.typeLabel(b.type)}</td>
          <td><b>${this.monthLabel(b.period_month)} ${b.period_year}</b></td>
          <td>
            <div style="font-family:monospace;font-size:0.85rem">${b.previous_index} → ${b.current_index}</div>
            <span class="badge badge-info" style="font-size:0.75rem">${conso} ${unit}</span>
          </td>
          <td><b>${Helpers.formatMoney(b.total_amount)}</b></td>
          <td>
            ${isPaid
              ? `<span class="badge badge-success" style="font-weight:600">PAYÉ</span>`
              : `<span class="badge badge-danger" style="font-weight:600">IMPAYÉ</span>`
            }
          </td>
          <td>
            ${isPaid
              ? `<button class="btn btn-sm btn-outline-success" title="Voir le Reçu de Paiement" onclick="PageUtilities.viewReceipt(${b.id})">🧾 Reçu</button>`
              : (canEdit ? `<button class="btn btn-sm btn-primary" onclick="PageUtilities.openPaymentModal(${b.id})">💳 Régler</button>` : '—')
            }
          </td>
          <td>
            <div class="btn-group" style="display:inline-flex;gap:4px">
              <button class="btn btn-sm btn-outline" title="Visualiser la facture" onclick="PageUtilities.viewFacture(${b.id})">👁️ Voir</button>
              <button class="btn btn-sm btn-outline" title="Télécharger facture PDF" onclick="PageUtilities.downloadBillPdf(${b.id})">📄 PDF</button>
              ${canEdit ? `
                <button class="btn btn-sm btn-outline" title="Modifier" onclick="PageUtilities.edit(${b.id})">✏️</button>
                <button class="btn btn-sm btn-danger" title="Supprimer" onclick="PageUtilities.remove(${b.id})">🗑️</button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ============================================================
  // ONGLET 2 : CRÉER UNE NOUVELLE FACTURE (FORMULAIRE INTÉGRÉ)
  // ============================================================
  renderFacturerTab(box) {
    const now = new Date();
    const aptOptions = this._apts.map((a) => `<option value="${a.id}">${a.label}</option>`).join('')
      || '<option value="">— Aucun logement disponible —</option>';

    const yearOpts = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]
      .map((y) => `<option value="${y}" ${now.getFullYear() === y ? 'selected' : ''}>${y}</option>`).join('');

    const monthOpts = this.MONTHS.map((m, i) => `<option value="${i + 1}" ${(now.getMonth() + 1) === i + 1 ? 'selected' : ''}>${m}</option>`).join('');

    const defaultDueDate = new Date(now.getFullYear(), now.getMonth(), 15).toISOString().slice(0, 10);

    box.innerHTML = `
      <div class="card" style="max-width:800px;margin:0 auto">
        <h3 style="color:var(--primary);margin-bottom:16px;display:flex;align-items:center;gap:8px">
          ⚡ Nouvelle Facture d'Électricité
        </h3>
        <p class="text-muted" style="margin-bottom:20px;font-size:0.9rem">
          Renseignez le relevé de compteur. L'ancien index et les arriérés éventuels sont reportés automatiquement. Le reçu sera disponible dès l'encaissement.
        </p>

        <form id="formNewUtilityBill">
          <div class="form-row">
            <div class="form-group" style="flex:2">
              <label>Logement <span style="color:var(--danger)">*</span></label>
              <select class="form-control" id="fAptId" required onchange="PageUtilities.onLogementChange()">
                <option value="">-- Choisir un logement --</option>
                ${aptOptions}
              </select>
            </div>
            <div class="form-group" style="flex:1">
              <label>Type de charge</label>
              <select class="form-control" id="fType" onchange="PageUtilities.onLogementChange()">
                <option value="electricity" selected>⚡ Électricité</option>
                <option value="water">💧 Eau</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label>Mois</label>
              <select class="form-control" id="fMonth">${monthOpts}</select>
            </div>
            <div class="form-group" style="flex:1">
              <label>Année</label>
              <select class="form-control" id="fYear">${yearOpts}</select>
            </div>
            <div class="form-group" style="flex:1">
              <label>Date limite de paiement</label>
              <input type="date" class="form-control" id="fDueDate" value="${defaultDueDate}"/>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label>Ancien Index (kWh) <span style="color:var(--danger)">*</span></label>
              <input type="number" step="0.01" class="form-control" id="fPrevIndex" value="0" required oninput="PageUtilities.updateLiveCalculation()"/>
            </div>
            <div class="form-group" style="flex:1">
              <label>Nouvel Index (kWh) <span style="color:var(--danger)">*</span></label>
              <input type="number" step="0.01" class="form-control" id="fCurrIndex" placeholder="Saisir nouvel index" required oninput="PageUtilities.updateLiveCalculation()"/>
            </div>
            <div class="form-group" style="flex:1">
              <label>Prix unitaire (FCFA/kWh)</label>
              <input type="number" step="0.01" class="form-control" id="fUnitPrice" value="150" required oninput="PageUtilities.updateLiveCalculation()"/>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label>Taxe Poubelle (FCFA)</label>
              <input type="number" step="0.01" class="form-control" id="fGarbage" value="0" oninput="PageUtilities.updateLiveCalculation()"/>
            </div>
            <div class="form-group" style="flex:1">
              <label>Frais Transport (FCFA)</label>
              <input type="number" step="0.01" class="form-control" id="fTransport" value="0" oninput="PageUtilities.updateLiveCalculation()"/>
            </div>
            <div class="form-group" style="flex:1">
              <label>Arriéré / Impayé reporté (FCFA)</label>
              <input type="number" step="0.01" class="form-control" id="fImpayer" value="0" oninput="PageUtilities.updateLiveCalculation()"/>
            </div>
          </div>

          <!-- Panneau Récapitulatif en Temps Réel -->
          <div class="card p-3 my-3" style="background:var(--bg-surface-2);border-radius:8px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span>Consommation calculée :</span>
              <b id="liveConso" style="font-size:1.1rem;color:var(--primary)">0 kWh</b>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span>Montant électricité (Conso × Prix) :</span>
              <span id="liveElecCost">0 FCFA</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span>Frais annexes (Poubelle + Transport) :</span>
              <span id="liveFees">0 FCFA</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span>Impayés reportés :</span>
              <span id="liveImpayer">0 FCFA</span>
            </div>
            <hr style="margin:10px 0;border-color:var(--border-color)"/>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:1.1rem;font-weight:bold">TOTAL FACTURE :</span>
              <span id="liveTotal" style="font-size:1.4rem;font-weight:bold;color:var(--primary)">0 FCFA</span>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label>Statut initial</label>
              <select class="form-control" id="fStatus" onchange="PageUtilities.onStatusChange()">
                <option value="pending" selected>⏳ En attente de paiement (Impayé)</option>
                <option value="paid">✅ Déjà réglé (Générer immédiatement le reçu)</option>
              </select>
            </div>
            <div class="form-group" id="fPaymentMethodBox" style="flex:1;display:none">
              <label>Mode de règlement</label>
              <select class="form-control" id="fPaymentMethod">
                <option value="Espèces">💵 Espèces</option>
                <option value="Orange Money">📱 Orange Money</option>
                <option value="MTN Mobile Money">📱 MTN Mobile Money</option>
                <option value="Virement bancaire">🏦 Virement bancaire</option>
                <option value="Chèque">🧾 Chèque</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Observations / Notes</label>
            <textarea class="form-control" id="fNotes" rows="2" placeholder="Notes optionnelles..."></textarea>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px">
            <button type="button" class="btn btn-outline" onclick="PageUtilities.switchTab('factures')">Annuler</button>
            <button type="submit" class="btn btn-primary">💾 Enregistrer la facture</button>
          </div>
        </form>
      </div>
    `;

    document.getElementById('formNewUtilityBill').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitNewBill();
    });
  },

  async onLogementChange() {
    const aptId = document.getElementById('fAptId')?.value;
    const type = document.getElementById('fType')?.value || 'electricity';
    if (!aptId) return;

    try {
      const res = await API.get(`/utility-bills/last?apartment_id=${aptId}&type=${type}`);
      const d = res.data || {};
      const apt = this._apts.find(a => String(a.id) === String(aptId));

      document.getElementById('fPrevIndex').value = d.current_index ?? (d.last_bill ? d.last_bill.current_index : 0);
      document.getElementById('fUnitPrice').value = d.unit_price || (type === 'water' ? (apt?.water_price || 0) : (apt?.electricity_price || 150));
      document.getElementById('fGarbage').value = d.garbage_fee || (apt?.garbage_fee || 0);
      document.getElementById('fTransport').value = d.transport_fee || (apt?.transport_fee || 0);
      document.getElementById('fImpayer').value = d.impayer || 0;

      this.updateLiveCalculation();
    } catch (_) {}
  },

  onStatusChange() {
    const status = document.getElementById('fStatus')?.value;
    const box = document.getElementById('fPaymentMethodBox');
    if (box) box.style.display = status === 'paid' ? 'block' : 'none';
  },

  updateLiveCalculation() {
    const prev = Number(document.getElementById('fPrevIndex')?.value) || 0;
    const curr = Number(document.getElementById('fCurrIndex')?.value) || 0;
    const price = Number(document.getElementById('fUnitPrice')?.value) || 0;
    const garbage = Number(document.getElementById('fGarbage')?.value) || 0;
    const transport = Number(document.getElementById('fTransport')?.value) || 0;
    const impayer = Number(document.getElementById('fImpayer')?.value) || 0;

    const conso = Math.max(0, curr - prev);
    const elecCost = conso * price;
    const fees = garbage + transport;
    const total = elecCost + fees + impayer;

    const c = document.getElementById('liveConso'); if (c) c.textContent = `${conso} kWh`;
    const ec = document.getElementById('liveElecCost'); if (ec) ec.textContent = Helpers.formatMoney(elecCost);
    const fc = document.getElementById('liveFees'); if (fc) fc.textContent = Helpers.formatMoney(fees);
    const ic = document.getElementById('liveImpayer'); if (ic) ic.textContent = Helpers.formatMoney(impayer);
    const tc = document.getElementById('liveTotal'); if (tc) tc.textContent = Helpers.formatMoney(total);
  },

  async submitNewBill() {
    const val = (id) => document.getElementById(id)?.value;
    const payload = {
      apartment_id: Number(val('fAptId')),
      type: val('fType'),
      period_month: Number(val('fMonth')),
      period_year: Number(val('fYear')),
      due_date: val('fDueDate') || null,
      previous_index: Number(val('fPrevIndex')) || 0,
      current_index: Number(val('fCurrIndex')),
      unit_price: Number(val('fUnitPrice')) || 0,
      garbage_fee: Number(val('fGarbage')) || 0,
      transport_fee: Number(val('fTransport')) || 0,
      impayer: Number(val('fImpayer')) || 0,
      status: val('fStatus'),
      payment_method: val('fPaymentMethod') || 'Espèces',
      notes: val('fNotes') || null,
    };

    if (!payload.apartment_id) { Toast.error('Veuillez sélectionner un logement'); return; }
    if (isNaN(payload.current_index) || payload.current_index < payload.previous_index) {
      Toast.error('Le nouvel index doit être supérieur ou égal à l\'ancien index.');
      return;
    }

    try {
      Toast.info('Enregistrement de la facture...');
      const res = await API.post('/utility-bills', payload);
      Toast.success('Facture d\'électricité enregistrée avec succès !');
      this.render(); // recharge tout et rafraîchit la vue
      if (res.data?.id) {
        this.viewFacture(res.data.id);
      }
    } catch (e) {
      Toast.error(e.message || 'Erreur lors de l\'enregistrement');
    }
  },

  // ============================================================
  // ONGLET 3 : RÉCAPITULATIF MENSUEL
  // ============================================================
  async renderRecapMoisTab(box) {
    box.innerHTML = '<div class="spinner"></div>';
    try {
      const res = await API.get('/utility-bills/recap/month');
      const data = res.data || [];

      let totalFacture = 0;
      let totalCollecte = 0;
      let totalImpaye = 0;
      let totalNb = 0;

      const rows = data.map((d) => {
        totalFacture += Number(d.total_facture || 0);
        totalCollecte += Number(d.total_collecte || 0);
        totalImpaye += Number(d.total_impaye || 0);
        totalNb += Number(d.nb_factures || 0);

        return `
          <tr>
            <td><b>${d.mois}</b></td>
            <td>${d.nb_factures}</td>
            <td>${Helpers.formatMoney(d.total_facture)}</td>
            <td style="color:var(--success);font-weight:bold">${Helpers.formatMoney(d.total_collecte)}</td>
            <td style="color:var(--danger);font-weight:bold">${Helpers.formatMoney(d.total_impaye)}</td>
            <td>${Helpers.formatMoney(d.moyenne_facture)}</td>
          </tr>
        `;
      }).join('');

      box.innerHTML = `
        <div class="card">
          <div class="card-head" style="margin-bottom:16px">
            <h3>📊 Récapitulatif Mensuel des Encaissements d'Électricité</h3>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mois</th>
                  <th>Nb Factures</th>
                  <th>Total Facturé</th>
                  <th>Total Collecté (Payé)</th>
                  <th>Total Impayé</th>
                  <th>Moyenne Facture</th>
                </tr>
              </thead>
              <tbody>
                ${rows.length ? rows : '<tr><td colspan="6" class="text-center text-muted p-3">Aucune donnée disponible.</td></tr>'}
                <tr style="background:var(--bg-surface-2);font-weight:bold">
                  <td>TOTAL GÉNÉRAL</td>
                  <td>${totalNb}</td>
                  <td>${Helpers.formatMoney(totalFacture)}</td>
                  <td style="color:var(--success)">${Helpers.formatMoney(totalCollecte)}</td>
                  <td style="color:var(--danger)">${Helpers.formatMoney(totalImpaye)}</td>
                  <td>${totalNb > 0 ? Helpers.formatMoney(totalFacture / totalNb) : '0 FCFA'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (e) {
      box.innerHTML = `<div class="card text-danger p-3">Erreur : ${e.message}</div>`;
    }
  },

  // ============================================================
  // ONGLET 4 : RÉCAPITULATIF PAR LOGEMENT
  // ============================================================
  renderRecapLogementTab(box) {
    const aptOptions = this._apts.map((a) => `<option value="${a.id}">${a.label}</option>`).join('')
      || '<option value="">— Aucun logement disponible —</option>';

    box.innerHTML = `
      <div class="card">
        <div class="card-head" style="margin-bottom:16px">
          <h3>📋 Historique & Récapitulatif par Logement</h3>
        </div>
        <div class="form-group" style="max-width:450px;margin-bottom:20px">
          <label>Sélectionnez un logement</label>
          <select class="form-control" id="recapAptSelect" onchange="PageUtilities.loadApartmentHistory(this.value)">
            <option value="">-- Choisir un logement --</option>
            ${aptOptions}
          </select>
        </div>
        <div id="recapAptResultBox">
          <div class="card p-4 text-center text-muted" style="background:var(--bg-surface-2)">
            Sélectionnez un logement pour visualiser son historique de consommations, factures et paiements.
          </div>
        </div>
      </div>
    `;
  },

  async loadApartmentHistory(aptId) {
    const box = document.getElementById('recapAptResultBox');
    if (!box || !aptId) return;

    box.innerHTML = '<div class="spinner"></div>';
    try {
      const res = await API.get(`/utility-bills/recap/apartment/${aptId}`);
      const data = res.data;
      const apt = data.apartment || {};
      const bills = data.factures || [];

      const rows = bills.map((f) => `
        <tr>
          <td><b>${f.mois}</b></td>
          <td>${f.ancien_index} kWh</td>
          <td>${f.nouvel_index} kWh</td>
          <td><b>${f.consommation_kwh} kWh</b></td>
          <td>${Helpers.formatMoney(f.prix_kwh)}</td>
          <td>${Helpers.formatMoney(f.impayer)}</td>
          <td><b>${Helpers.formatMoney(f.montant_total)}</b></td>
          <td>
            ${f.status === 'paid'
              ? `<span class="badge badge-success">PAYÉ</span>`
              : `<span class="badge badge-danger">IMPAYÉ</span>`
            }
          </td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="PageUtilities.viewFacture(${f.id})">👁️ Voir</button>
            ${f.status === 'paid' ? `<button class="btn btn-sm btn-outline-success" onclick="PageUtilities.viewReceipt(${f.id})">🧾 Reçu</button>` : ''}
          </td>
        </tr>
      `).join('');

      box.innerHTML = `
        <div class="p-3 mb-3" style="background:var(--bg-surface-2);border-radius:8px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div>
            <h4 style="color:var(--primary);margin:0">${apt.apartment_number} (${apt.property_name})</h4>
            <div class="text-muted" style="font-size:0.85rem">Locataire : <b>${apt.tenant_name}</b> · Type : ${apt.apartment_type}</div>
          </div>
          <div style="display:flex;gap:20px;text-align:right">
            <div>
              <div style="font-size:0.8rem;color:var(--text-muted)">Conso Totale</div>
              <b style="font-size:1.1rem;color:var(--primary)">${data.total_consommation_kwh} kWh</b>
            </div>
            <div>
              <div style="font-size:0.8rem;color:var(--text-muted)">Total Réglé</div>
              <b style="font-size:1.1rem;color:var(--success)">${Helpers.formatMoney(data.total_collecte)}</b>
            </div>
            <div>
              <div style="font-size:0.8rem;color:var(--text-muted)">Reste Impayé</div>
              <b style="font-size:1.1rem;color:var(--danger)">${Helpers.formatMoney(data.total_impaye)}</b>
            </div>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mois</th>
                <th>Ancien Index</th>
                <th>Nouvel Index</th>
                <th>Consommation</th>
                <th>Prix kWh</th>
                <th>Arriéré</th>
                <th>Montant Total</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows : '<tr><td colspan="9" class="text-center text-muted p-3">Aucune facture enregistrée pour ce logement.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      box.innerHTML = `<div class="card text-danger p-3">Erreur : ${e.message}</div>`;
    }
  },

  // ============================================================
  // VISUALISATION FACTURE (MODÈLE PREMIUM SELON LA DEMANDE)
  // ============================================================
  async viewFacture(id) {
    let b = this._rows[id];
    if (!b) {
      try { b = (await API.get(`/utility-bills/${id}`)).data; } catch (_) {}
    }
    if (!b) { Toast.error('Facture introuvable'); return; }

    const isWater = b.type === 'water';
    const title = isWater ? "FACTURE D'EAU" : "FACTURE D'ÉLECTRICITÉ";
    const aptNumber = b.apartment?.apartment_number || b.identifiant_logement || '—';
    const propName = b.apartment?.property?.property_name || b.immeuble || '';
    const aptType = b.apartment?.apartment_type || b.type_logement || 'Appartement';
    const tenantName = (b.apartment && b.apartment.tenants && b.apartment.tenants[0] && b.apartment.tenants[0].user)
      ? b.apartment.tenants[0].user.full_name
      : (b.tenant_name || '—');
    const conso = this.conso(b);
    const unit = isWater ? 'm³' : 'kWh';
    const isPaid = b.status === 'paid';
    const moisStr = b.mois || `${this.monthLabel(b.period_month)} ${b.period_year}`;

    const modalHtml = `
      <div class="facture-container" id="printableFacture" style="max-width:750px;margin:0 auto;font-family:inherit">
        <div style="background:linear-gradient(135deg, #2563eb, #1d4ed8);color:white;padding:24px;border-radius:10px 10px 0 0;text-align:center;position:relative">
          <div style="font-size:0.85rem;letter-spacing:1px;opacity:0.9;text-transform:uppercase">SMG IMMOBILIER</div>
          <h2 style="margin:4px 0 6px;color:white;font-size:1.6rem;font-weight:700">${title}</h2>
          <p style="margin:0;opacity:0.9;font-size:0.95rem">N° FACT-${b.id} | Période : <b>${moisStr}</b></p>
          <div style="position:absolute;top:18px;right:18px">
            ${isPaid 
              ? `<span style="background:#22c55e;color:white;padding:5px 12px;border-radius:20px;font-size:0.8rem;font-weight:bold">PAYÉ</span>`
              : `<span style="background:#ef4444;color:white;padding:5px 12px;border-radius:20px;font-size:0.8rem;font-weight:bold">IMPAYÉ</span>`
            }
          </div>
        </div>

        <div style="padding:24px;background:var(--bg-surface);border:1px solid var(--border-color);border-top:none;border-radius:0 0 10px 10px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid var(--border-color)">
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase">Logement / Immeuble</div>
              <div style="font-size:1.05rem;font-weight:bold">${aptNumber}</div>
              <div style="font-size:0.85rem;color:var(--text-muted)">${propName} (${aptType})</div>
            </div>
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase">Locataire en place</div>
              <div style="font-size:1.05rem;font-weight:bold">${tenantName}</div>
              <div style="font-size:0.85rem;color:var(--text-muted)">Date facture : ${b.created_at ? Helpers.formatDate(b.created_at) : Helpers.formatDate(new Date())}</div>
            </div>
          </div>

          <table style="width:100%;margin-bottom:16px;border-collapse:collapse">
            <tbody>
              <tr style="border-bottom:1px solid var(--border-color)"><td style="padding:8px 0;color:var(--text-muted)">Ancien Index</td><td style="padding:8px 0;text-align:right;font-weight:600">${b.previous_index} ${unit}</td></tr>
              <tr style="border-bottom:1px solid var(--border-color)"><td style="padding:8px 0;color:var(--text-muted)">Nouvel Index</td><td style="padding:8px 0;text-align:right;font-weight:600">${b.current_index} ${unit}</td></tr>
              <tr style="border-bottom:1px solid var(--border-color)"><td style="padding:8px 0;color:var(--text-muted)">Consommation réelle</td><td style="padding:8px 0;text-align:right;font-weight:bold;color:var(--primary)">${conso} ${unit}</td></tr>
              <tr style="border-bottom:1px solid var(--border-color)"><td style="padding:8px 0;color:var(--text-muted)">Prix unitaire (${unit})</td><td style="padding:8px 0;text-align:right;font-weight:600">${Helpers.formatMoney(b.unit_price)}</td></tr>
              <tr style="border-bottom:1px solid var(--border-color)"><td style="padding:8px 0;color:var(--text-muted)">Montant Consommation</td><td style="padding:8px 0;text-align:right;font-weight:600">${Helpers.formatMoney(conso * Number(b.unit_price || 0))}</td></tr>
              <tr style="border-bottom:1px solid var(--border-color)"><td style="padding:8px 0;color:var(--text-muted)">Taxe Poubelle</td><td style="padding:8px 0;text-align:right">${Helpers.formatMoney(b.garbage_fee || 0)}</td></tr>
              <tr style="border-bottom:1px solid var(--border-color)"><td style="padding:8px 0;color:var(--text-muted)">Frais de Transport</td><td style="padding:8px 0;text-align:right">${Helpers.formatMoney(b.transport_fee || 0)}</td></tr>
              ${Number(b.other_fee || 0) > 0 ? `
                <tr style="border-bottom:1px solid var(--border-color)"><td style="padding:8px 0;color:var(--text-muted)">${b.other_label || 'Autre frais'}</td><td style="padding:8px 0;text-align:right">${Helpers.formatMoney(b.other_fee)}</td></tr>
              ` : ''}
              <tr style="border-bottom:1px solid var(--border-color)"><td style="padding:8px 0;color:var(--text-muted)">Arriérés / Impayé antérieur</td><td style="padding:8px 0;text-align:right;color:var(--danger);font-weight:600">${Helpers.formatMoney(b.impayer || 0)}</td></tr>
              <tr><td style="padding:8px 0;color:var(--text-muted)">Date limite de paiement</td><td style="padding:8px 0;text-align:right;font-weight:600">${b.due_date ? Helpers.formatDate(b.due_date) : '15 du mois suivant'}</td></tr>
            </tbody>
          </table>

          <div style="background:var(--bg-surface-2);padding:14px 18px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;border-left:4px solid var(--primary)">
            <span style="font-size:1.1rem;font-weight:bold">MONTANT TOTAL À PAYER :</span>
            <span style="font-size:1.4rem;font-weight:bold;color:var(--primary)">${Helpers.formatMoney(b.total_amount)}</span>
          </div>

          ${isPaid ? `
            <div style="margin-top:14px;padding:10px 14px;background:#ecfdf5;color:#166534;border-radius:6px;font-size:0.85rem;display:flex;justify-content:space-between;align-items:center">
              <span>✅ Réglé le ${Helpers.formatDate(b.paid_date || new Date())} via ${b.payment_method || 'Espèces'}</span>
              <b>Reçu : ${b.receipt_number || 'Disponible'}</b>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    const buttons = `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-outline" onclick="Modal.close()">Fermer</button>
        <button class="btn btn-outline" onclick="PageUtilities.printElement('printableFacture')">🖨️ Imprimer</button>
        <button class="btn btn-success" onclick="PageUtilities.downloadBillPdf(${b.id})">📥 Facture PDF</button>
        ${isPaid
          ? `<button class="btn btn-primary" onclick="PageUtilities.viewReceipt(${b.id})">🧾 Voir le Reçu</button>`
          : `<button class="btn btn-primary" onclick="Modal.close();PageUtilities.openPaymentModal(${b.id})">💳 Encaisser & Reçu</button>`
        }
      </div>
    `;

    Modal.open(`Facture d'Électricité — ${aptNumber}`, modalHtml, buttons);
  },

  // ============================================================
  // VISUALISATION DU REÇU OFFICIEL DE PAIEMENT
  // ============================================================
  async viewReceipt(id) {
    let b = this._rows[id];
    if (!b) {
      try { b = (await API.get(`/utility-bills/${id}`)).data; } catch (_) {}
    }
    if (!b) { Toast.error('Facture introuvable'); return; }

    const isWater = b.type === 'water';
    const ref = b.receipt_number || `R-CHARGE-${b.id}`;
    const aptNumber = b.apartment?.apartment_number || b.identifiant_logement || '—';
    const propName = b.apartment?.property?.property_name || b.immeuble || '';
    const tenantName = (b.apartment && b.apartment.tenants && b.apartment.tenants[0] && b.apartment.tenants[0].user)
      ? b.apartment.tenants[0].user.full_name
      : (b.tenant_name || '—');
    const payDate = b.paid_date ? Helpers.formatDate(b.paid_date) : Helpers.formatDate(new Date());
    const method = b.payment_method || 'Espèces';
    const moisStr = b.mois || `${this.monthLabel(b.period_month)} ${b.period_year}`;

    const receiptHtml = `
      <div id="printableReceipt" style="max-width:700px;margin:0 auto;border:2px solid var(--border-color);border-radius:10px;padding:25px;background:var(--bg-surface);position:relative">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--primary);padding-bottom:14px;margin-bottom:16px">
          <div>
            <div style="font-size:1.3rem;font-weight:bold;color:var(--primary)">SMG IMMOBILIER</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">Douala & Yaoundé, Cameroun • Gestion Immobilière</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:1.2rem;font-weight:bold;color:var(--text-primary)">REÇU DE CHARGES</div>
            <div style="font-size:0.85rem;color:var(--primary);font-family:monospace;font-weight:bold">N° ${ref}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">Date : ${payDate}</div>
          </div>
        </div>

        <div style="background:#ecfdf5;border:1px solid #bbf7d0;color:#15803d;padding:8px 14px;border-radius:6px;margin-bottom:16px;font-weight:bold;text-align:center">
          ✅ PAIEMENT INTÉGRAL EFFECTUÉ — QUITUS DÉLIVRÉ
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
          <div style="background:var(--bg-surface-2);padding:12px;border-radius:6px">
            <div style="font-size:0.75rem;color:var(--text-muted)">REÇU DE :</div>
            <div style="font-weight:bold;font-size:1rem">${tenantName}</div>
            <div style="font-size:0.85rem;color:var(--text-muted)">Locataire</div>
          </div>
          <div style="background:var(--bg-surface-2);padding:12px;border-radius:6px">
            <div style="font-size:0.75rem;color:var(--text-muted)">LOGEMENT CONCERNÉ :</div>
            <div style="font-weight:bold;font-size:1rem">${aptNumber}</div>
            <div style="font-size:0.85rem;color:var(--text-muted)">${propName}</div>
          </div>
        </div>

        <table style="width:100%;margin-bottom:16px;border-collapse:collapse;font-size:0.9rem">
          <tbody>
            <tr style="border-bottom:1px solid var(--border-color)"><td style="padding:6px 0">Objet du règlement</td><td style="padding:6px 0;text-align:right;font-weight:600">Facture ${this.typeLabel(b.type)} #${b.id} (${moisStr})</td></tr>
            <tr style="border-bottom:1px solid var(--border-color)"><td style="padding:6px 0">Relevé d'index</td><td style="padding:6px 0;text-align:right">${b.previous_index} → ${b.current_index} (${this.conso(b)} kWh)</td></tr>
            <tr style="border-bottom:1px solid var(--border-color)"><td style="padding:6px 0">Mode de paiement</td><td style="padding:6px 0;text-align:right;font-weight:600">${method}</td></tr>
            <tr style="border-bottom:1px solid var(--border-color)"><td style="padding:6px 0">Solde restant</td><td style="padding:6px 0;text-align:right;color:var(--success);font-weight:bold">0 FCFA (À jour)</td></tr>
          </tbody>
        </table>

        <div style="background:var(--bg-surface-2);padding:14px 18px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;border:1px solid var(--border-color)">
          <span style="font-size:1.1rem;font-weight:bold">MONTANT ENCAISSÉ :</span>
          <span style="font-size:1.4rem;font-weight:bold;color:var(--success)">${Helpers.formatMoney(b.total_amount)}</span>
        </div>

        <div style="display:flex;justify-content:space-between;margin-top:24px;padding-top:12px;border-top:1px dashed var(--border-color);font-size:0.85rem">
          <div style="color:var(--text-muted)">
            Document certifié et généré par le gestionnaire SMG.<br>
            Merci pour votre confiance.
          </div>
          <div style="text-align:center;min-width:180px">
            <div style="color:var(--text-muted);margin-bottom:20px">Cachet et Signature autorisée</div>
            <div style="border-bottom:1px solid var(--border-color);width:150px;margin:0 auto"></div>
          </div>
        </div>
      </div>
    `;

    const buttons = `
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline" onclick="Modal.close()">Fermer</button>
        <button class="btn btn-outline" onclick="PageUtilities.printElement('printableReceipt')">🖨️ Imprimer Reçu</button>
        <button class="btn btn-success" onclick="PageUtilities.downloadReceiptPdf(${b.id})">📥 Reçu PDF</button>
      </div>
    `;

    Modal.open(`Reçu de Paiement — ${ref}`, receiptHtml, buttons);
  },

  // Modal d'encaissement direct avec génération de reçu
  openPaymentModal(id) {
    const b = this._rows[id];
    if (!b) return;

    Modal.open('💳 Règlement de facture & Émission de reçu', `
      <div style="margin-bottom:15px">
        Logement : <b>${b.apartment ? b.apartment.apartment_number : ''}</b><br>
        Période : <b>${this.monthLabel(b.period_month)} ${b.period_year}</b><br>
        Montant à régler : <b style="font-size:1.2rem;color:var(--primary)">${Helpers.formatMoney(b.total_amount)}</b>
      </div>
      <div class="form-group">
        <label>Mode de règlement <span style="color:var(--danger)">*</span></label>
        <select class="form-control" id="payMethod">
          <option value="Espèces" selected>💵 Espèces</option>
          <option value="Orange Money">📱 Orange Money</option>
          <option value="MTN Mobile Money">📱 MTN Mobile Money</option>
          <option value="Virement bancaire">🏦 Virement bancaire</option>
          <option value="Chèque">🧾 Chèque</option>
        </select>
      </div>
      <div class="form-group">
        <label>Date de paiement</label>
        <input type="date" class="form-control" id="payDate" value="${new Date().toISOString().slice(0, 10)}"/>
      </div>
      <div class="form-group">
        <label>Notes ou référence de transaction</label>
        <input class="form-control" id="payNotes" placeholder="Ex: Réf reçu, N° transfert..."/>
      </div>
    `, `
      <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
      <button class="btn btn-success" onclick="PageUtilities.submitPayment(${id})">✅ Confirmer & Générer le Reçu</button>
    `);
  },

  async submitPayment(id) {
    const method = document.getElementById('payMethod')?.value || 'Espèces';
    const date = document.getElementById('payDate')?.value || new Date().toISOString().slice(0, 10);
    const notes = document.getElementById('payNotes')?.value || '';

    try {
      Toast.info('Enregistrement du règlement...');
      await API.patch(`/utility-bills/${id}/paid`, {
        paid: true,
        payment_method: method,
        paid_date: date,
        notes,
      });

      Modal.close();
      Toast.success('Paiement enregistré et reçu officiel généré !');
      await this.render();
      this.viewReceipt(id);
    } catch (e) {
      Toast.error(e.message || 'Erreur lors du paiement');
    }
  },

  downloadBillPdf(id) {
    const b = this._rows[id];
    if (!b) return;
    const pdf = window.PDF || (typeof PDF !== 'undefined' ? PDF : null);
    if (pdf && pdf.utilityBill) {
      pdf.utilityBill(b);
    } else {
      this.pdf(id);
    }
  },

  downloadReceiptPdf(id) {
    const b = this._rows[id];
    if (!b) return;
    const pdf = window.PDF || (typeof PDF !== 'undefined' ? PDF : null);
    if (pdf && pdf.utilityReceipt) {
      pdf.utilityReceipt(b);
    } else {
      Toast.info('Téléchargement du reçu PDF...');
      window.open(API.baseURL + `/utility-bills/${id}/receipt-pdf`, '_blank');
    }
  },

  generateAllPDF() {
    if (!this._allBills || !this._allBills.length) {
      Toast.error('Aucune facture à exporter');
      return;
    }
    const pdf = window.PDF || (typeof PDF !== 'undefined' ? PDF : null);
    if (pdf && pdf.allUtilityBills) {
      pdf.allUtilityBills(this._allBills);
    } else {
      Toast.error('Module PDF indisponible');
    }
  },

  printElement(elementId) {
    const el = document.getElementById(elementId);
    if (!el) { window.print(); return; }
    const printWin = window.open('', '', 'width=800,height=600');
    printWin.document.write(`
      <html>
        <head>
          <title>Impression SMG IMMOBILIER</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
            .total { font-weight: bold; font-size: 1.2rem; }
          </style>
        </head>
        <body>
          ${el.innerHTML}
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 350);
  },

  // ----- Création / édition modale (compatible avec CrudPage existant) -----
  async openForm(existing) {
    await this.loadBillable();
    const now = new Date();
    const v = existing || {};
    const aptOptions = this._apts.map((a) => `<option value="${a.id}" ${v.apartment_id == a.id ? 'selected' : ''}>${a.label}</option>`).join('')
      || '<option value="">— Aucun logement —</option>';
    const yearOpts = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]
      .map((y) => `<option value="${y}" ${(v.period_year || now.getFullYear()) === y ? 'selected' : ''}>${y}</option>`).join('');
    const monthOpts = this.MONTHS.map((m, i) => `<option value="${i + 1}" ${(v.period_month || (now.getMonth() + 1)) === i + 1 ? 'selected' : ''}>${m}</option>`).join('');

    Modal.open(existing ? 'Modifier la facture' : 'Nouvelle facture', `
      <div class="form-row">
        <div class="form-group" style="flex:2"><label>Logement</label>
          <select class="form-control" id="uApt" ${existing ? 'disabled' : ''} onchange="PageUtilities.prefill()">${aptOptions}</select></div>
        <div class="form-group" style="flex:1"><label>Type</label>
          <select class="form-control" id="uType" onchange="PageUtilities.prefill()">
            <option value="electricity" ${v.type !== 'water' ? 'selected' : ''}>⚡ Électricité</option>
            <option value="water" ${v.type === 'water' ? 'selected' : ''}>💧 Eau</option>
          </select></div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1"><label>Mois</label><select class="form-control" id="uMonth">${monthOpts}</select></div>
        <div class="form-group" style="flex:1"><label>Année</label><select class="form-control" id="uYear">${yearOpts}</select></div>
        <div class="form-group" style="flex:1"><label>Date limite</label><input type="date" class="form-control" id="uDueDate" value="${v.due_date || ''}"/></div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1"><label>Ancien index</label><input type="number" step="0.01" class="form-control" id="uPrev" value="${v.previous_index ?? 0}" oninput="PageUtilities.updateTotal()"/></div>
        <div class="form-group" style="flex:1"><label>Nouvel index</label><input type="number" step="0.01" class="form-control" id="uCurr" value="${v.current_index ?? ''}" oninput="PageUtilities.updateTotal()"/></div>
        <div class="form-group" style="flex:1"><label>Prix unité (FCFA)</label><input type="number" step="0.01" class="form-control" id="uPrice" value="${v.unit_price ?? ''}" oninput="PageUtilities.updateTotal()"/></div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1"><label>Poubelle (FCFA)</label><input type="number" class="form-control" id="uGarbage" value="${v.garbage_fee ?? 0}" oninput="PageUtilities.updateTotal()"/></div>
        <div class="form-group" style="flex:1"><label>Transport (FCFA)</label><input type="number" class="form-control" id="uTransport" value="${v.transport_fee ?? 0}" oninput="PageUtilities.updateTotal()"/></div>
        <div class="form-group" style="flex:1"><label>Impayé (FCFA)</label><input type="number" class="form-control" id="uImpayer" value="${v.impayer ?? 0}" oninput="PageUtilities.updateTotal()"/></div>
      </div>
      <div class="form-group"><label>Statut</label><select class="form-control" id="uStatus">
        <option value="pending" ${v.status !== 'paid' ? 'selected' : ''}>En attente (Impayé)</option>
        <option value="paid" ${v.status === 'paid' ? 'selected' : ''}>Payé</option>
      </select></div>
      <div class="list-item" style="background:var(--bg-surface-2);border-radius:8px;padding:10px 12px">
        <div style="flex:1">Consommation : <b id="uConso">0</b> · Total à payer</div><b id="uTotal" style="font-size:1.1rem">0 FCFA</b></div>`,
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
       <button class="btn btn-primary" id="uSubmit">Enregistrer</button>`);

    if (!existing) await this.prefill();
    else this.updateTotal();
    document.getElementById('uSubmit').onclick = () => this.submit(existing ? existing.id : null);
  },

  async prefill() {
    const aptId = document.getElementById('uApt')?.value;
    const type = document.getElementById('uType')?.value || 'electricity';
    if (!aptId) return;
    const apt = this._apts.find((a) => String(a.id) === String(aptId)) || {};
    let last = null;
    try { last = (await API.get(`/utility-bills/last?apartment_id=${aptId}&type=${type}`)).data; } catch (_) { last = null; }
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    if (last) {
      set('uPrev', last.current_index ?? 0);
      set('uPrice', last.unit_price || (type === 'water' ? (apt.water_price || 0) : (apt.electricity_price || 150)));
      set('uGarbage', last.garbage_fee || (apt.garbage_fee || 0));
      set('uTransport', last.transport_fee || (apt.transport_fee || 0));
      set('uImpayer', last.impayer || 0);
    } else {
      set('uPrev', 0);
      set('uPrice', type === 'water' ? (apt.water_price || 0) : (apt.electricity_price || 150));
      set('uGarbage', apt.garbage_fee || 0);
      set('uTransport', apt.transport_fee || 0);
      set('uImpayer', 0);
    }
    this.updateTotal();
  },

  updateTotal() {
    const n = (id) => Number(document.getElementById(id) ? document.getElementById(id).value : 0) || 0;
    const conso = Math.max(0, n('uCurr') - n('uPrev'));
    const total = conso * n('uPrice') + n('uGarbage') + n('uTransport') + n('uImpayer');
    const c = document.getElementById('uConso'); if (c) c.textContent = conso;
    const t = document.getElementById('uTotal'); if (t) t.textContent = Helpers.formatMoney(total);
  },

  async submit(id) {
    const val = (x) => document.getElementById(x)?.value;
    const payload = {
      apartment_id: val('uApt'), type: val('uType'),
      period_month: Number(val('uMonth')), period_year: Number(val('uYear')),
      due_date: val('uDueDate') || null,
      previous_index: Number(val('uPrev')) || 0, current_index: Number(val('uCurr')) || 0,
      unit_price: Number(val('uPrice')) || 0,
      garbage_fee: Number(val('uGarbage')) || 0, transport_fee: Number(val('uTransport')) || 0,
      impayer: Number(val('uImpayer')) || 0,
      status: val('uStatus'),
    };
    if (!payload.apartment_id) { Toast.error('Sélectionnez un logement'); return; }
    if (!payload.current_index && payload.current_index !== 0) { Toast.error('Saisissez le nouvel index'); return; }
    try {
      if (id) await API.put('/utility-bills/' + id, payload);
      else await API.post('/utility-bills', payload);
      Modal.close(); Toast.success('Facture enregistrée'); PageUtilities.render();
    } catch (e) { Toast.error(e.message); }
  },

  create() { this.openForm(null); },
  async edit(id) { const r = (await API.get('/utility-bills/' + id)).data; this.openForm(r); },
  remove(id) { CrudPage.confirmDelete('/utility-bills/' + id, () => PageUtilities.render()); },

  pdf(id) { this.downloadBillPdf(id); },

  // ----- Espace locataire : mes charges -----
  async renderMine() {
    Layout.setTitle('Mes charges');
    const { data } = await API.get('/utility-bills/mine');
    this._rows = {};
    (data || []).forEach(b => { this._rows[b.id] = b; });

    const rows = (data || []).map((b) => `<tr>
      <td>${this.typeLabel(b.type)}</td>
      <td><b>${this.monthLabel(b.period_month)} ${b.period_year}</b></td>
      <td>${b.previous_index} → ${b.current_index} <span class="text-muted">(${this.conso(b)} kWh)</span></td>
      <td><b>${Helpers.formatMoney(b.total_amount)}</b></td>
      <td>${b.status === 'paid' ? '<span class="badge badge-success">PAYÉ</span>' : '<span class="badge badge-danger">IMPAYÉ</span>'}</td>
      <td>
        <div style="display:flex;gap:5px">
          <button class="btn btn-sm btn-outline" onclick="PageUtilities.viewFacture(${b.id})">👁️ Facture</button>
          ${b.status === 'paid'
            ? `<button class="btn btn-sm btn-success" onclick="PageUtilities.viewReceipt(${b.id})">🧾 Reçu</button>`
            : `<button class="btn btn-sm btn-primary" onclick="PageDashboard.payUtilityBill(${b.id}, ${b.total_amount})">💳 Payer</button>`
          }
        </div>
      </td>
    </tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted p-3">Aucune facture de charges pour votre logement.</td></tr>';

    Layout.content(`
      <div class="page-head"><h2>Mes factures d'électricité & charges</h2><div class="subtitle">Consultez vos relevés d'index, factures et téléchargez vos reçus</div></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Type</th><th>Période</th><th>Index (Conso)</th><th>Total</th><th>Statut</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody></table></div></div>
    `);
  },

  // ----- Saisie de Masse d'Index & Génération par Immeuble -----
  async openBatchModal() {
    const props = (await API.get('/properties')).data || [];
    const utilProps = props.filter((p) => p.utilities_enabled);
    if (!utilProps.length) {
      Toast.error('Aucun immeuble n\'a la redistribution des charges activée.');
      return;
    }
    const now = new Date();
    const propOptions = utilProps.map((p) => `<option value="${p.id}">${p.property_name} (${p.city || 'Immeuble'})</option>`).join('');
    const yearOpts = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]
      .map((y) => `<option value="${y}" ${now.getFullYear() === y ? 'selected' : ''}>${y}</option>`).join('');
    const monthOpts = this.MONTHS.map((m, i) => `<option value="${i + 1}" ${(now.getMonth() + 1) === i + 1 ? 'selected' : ''}>${m}</option>`).join('');

    Modal.open('⚡ Saisie de Masse d\'Index & Génération par Immeuble', `
      <div class="form-row mb-3">
        <div class="form-group" style="flex:2">
          <label>Immeuble / Cité <span style="color:var(--danger)">*</span></label>
          <select class="form-control" id="bPropertyId" onchange="PageUtilities.loadBatchGrid()">${propOptions}</select>
        </div>
        <div class="form-group" style="flex:1">
          <label>Type de charge <span style="color:var(--danger)">*</span></label>
          <select class="form-control" id="bType" onchange="PageUtilities.loadBatchGrid()">
            <option value="electricity">⚡ Électricité</option>
            <option value="water">💧 Eau</option>
          </select>
        </div>
        <div class="form-group" style="flex:1">
          <label>Mois</label>
          <select class="form-control" id="bMonth" onchange="PageUtilities.loadBatchGrid()">${monthOpts}</select>
        </div>
        <div class="form-group" style="flex:1">
          <label>Année</label>
          <select class="form-control" id="bYear" onchange="PageUtilities.loadBatchGrid()">${yearOpts}</select>
        </div>
      </div>

      <div id="batchGridBox">
        <div class="spinner"></div>
      </div>
    `, `
      <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
      <button class="btn btn-primary" onclick="PageUtilities.submitBatch()">⚡ Générer toutes les factures</button>
    `);

    await this.loadBatchGrid();
  },

  async loadBatchGrid() {
    const box = document.getElementById('batchGridBox');
    const propertyId = document.getElementById('bPropertyId')?.value;
    const type = document.getElementById('bType')?.value;
    if (!box || !propertyId) return;

    box.innerHTML = '<div class="spinner"></div>';
    try {
      const { data: d } = await API.get(`/utility-bills/batch-prepare?property_id=${propertyId}&type=${type}`);
      this._batchPrepared = d;

      if (!d.items || !d.items.length) {
        box.innerHTML = '<div class="card p-3 text-center text-muted">Aucun logement trouvé dans cet immeuble.</div>';
        return;
      }

      const rows = d.items.map((item) => `
        <tr id="bRow_${item.apartment_id}">
          <td><b>${item.apartment_number}</b></td>
          <td>${item.tenant_name}</td>
          <td><input type="number" step="0.01" class="form-control form-control-sm b-prev" value="${item.previous_index}" oninput="PageUtilities.updateBatchRowTotal(${item.apartment_id})"/></td>
          <td><input type="number" step="0.01" class="form-control form-control-sm b-curr" placeholder="Saisir index..." oninput="PageUtilities.updateBatchRowTotal(${item.apartment_id})"/></td>
          <td><b class="b-conso">0</b></td>
          <td><input type="number" step="0.01" class="form-control form-control-sm b-price" value="${item.unit_price}" oninput="PageUtilities.updateBatchRowTotal(${item.apartment_id})"/></td>
          <td><input type="number" class="form-control form-control-sm b-fee" value="${Number(item.garbage_fee || 0) + Number(item.transport_fee || 0)}" oninput="PageUtilities.updateBatchRowTotal(${item.apartment_id})"/></td>
          <td><input type="number" class="form-control form-control-sm b-impayer" value="${item.impayer || 0}" oninput="PageUtilities.updateBatchRowTotal(${item.apartment_id})"/></td>
          <td><b class="b-total" style="color:var(--success)">0 FCFA</b></td>
        </tr>
      `).join('');

      box.innerHTML = `
        <div class="table-wrap" style="max-height: 400px; overflow-y: auto;">
          <table>
            <thead>
              <tr>
                <th>Logement</th>
                <th>Locataire</th>
                <th style="width:100px">Ancien</th>
                <th style="width:120px">Nouvel <span style="color:var(--danger)">*</span></th>
                <th style="width:80px">Conso</th>
                <th style="width:90px">Prix</th>
                <th style="width:90px">Frais</th>
                <th style="width:90px">Impayé</th>
                <th style="width:120px">Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    } catch (e) {
      box.innerHTML = `<div class="card p-3 text-danger">Erreur : ${e.message}</div>`;
    }
  },

  updateBatchRowTotal(aptId) {
    const row = document.getElementById(`bRow_${aptId}`);
    if (!row) return;
    const prev = Number(row.querySelector('.b-prev')?.value) || 0;
    const curr = Number(row.querySelector('.b-curr')?.value) || 0;
    const price = Number(row.querySelector('.b-price')?.value) || 0;
    const fee = Number(row.querySelector('.b-fee')?.value) || 0;
    const impayer = Number(row.querySelector('.b-impayer')?.value) || 0;

    const conso = Math.max(0, curr - prev);
    const total = (conso * price) + fee + impayer;

    const c = row.querySelector('.b-conso'); if (c) c.textContent = conso;
    const t = row.querySelector('.b-total'); if (t) t.textContent = Helpers.formatMoney(total);
  },

  async submitBatch() {
    const propertyId = document.getElementById('bPropertyId')?.value;
    const type = document.getElementById('bType')?.value;
    const month = Number(document.getElementById('bMonth')?.value);
    const year = Number(document.getElementById('bYear')?.value);

    if (!propertyId || !this._batchPrepared || !this._batchPrepared.items) {
      Toast.error('Sélectionnez un immeuble valide.');
      return;
    }

    const items = [];
    for (const item of this._batchPrepared.items) {
      const row = document.getElementById(`bRow_${item.apartment_id}`);
      if (row) {
        const currVal = row.querySelector('.b-curr').value;
        if (currVal !== undefined && currVal !== null && currVal.trim() !== '') {
          const prev = Number(row.querySelector('.b-prev').value) || 0;
          const curr = Number(currVal);
          if (curr < prev) {
            Toast.error(`Logement ${item.apartment_number} : Le nouvel index (${curr}) ne peut pas être inférieur à l'ancien index (${prev}).`);
            return;
          }
          items.push({
            apartment_id: item.apartment_id,
            previous_index: prev,
            current_index: curr,
            unit_price: Number(row.querySelector('.b-price').value) || 0,
            garbage_fee: Number(row.querySelector('.b-fee').value) || 0,
            transport_fee: 0,
            impayer: Number(row.querySelector('.b-impayer')?.value) || 0,
          });
        }
      }
    }

    if (!items.length) {
      Toast.error('Veuillez saisir au moins un nouvel index pour un logement.');
      return;
    }

    try {
      Toast.info('Génération des factures en cours...');
      const res = await API.post('/utility-bills/batch', {
        property_id: propertyId,
        type,
        period_month: month,
        period_year: year,
        items,
      });

      Modal.close();
      Toast.success(res.message || 'Factures générées avec succès !');
      PageUtilities.render();
    } catch (e) {
      Toast.error(e.message || 'Échec de la génération des factures.');
    }
  },
};
