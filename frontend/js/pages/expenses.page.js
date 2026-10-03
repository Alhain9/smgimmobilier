// ============ Page Dépenses & Salaires Gardiens ============
const PageExpenses = {
  register() {
    Router.register('expenses', () => this.render());
  },

  _properties: [],
  _maintenances: [],
  _activeFilterType: 'all',
  _selectedPropertyId: '',
  _selectedMonth: '',
  _searchQuery: '',

  async loadLookups() {
    try {
      const [propsRes, maintRes] = await Promise.all([
        API.get('/properties'),
        API.get('/maintenance').catch(() => ({ data: [] })),
      ]);
      this._properties = propsRes.data || [];
      this._maintenances = maintRes.data || [];
    } catch (e) {
      console.error('Erreur chargement lookups expenses:', e);
    }
  },

  async render() {
    const isBailleur = Auth.hasRole('bailleur');
    const canManage = Auth.hasRole('manager', 'comptable', 'gestionnaire', 'super_admin', 'dir_admin');
    
    if (Auth.hasRole('technicien') && !canManage && !isBailleur) {
      document.getElementById('appContent').innerHTML = `
        <div class="card text-center" style="padding:40px;color:var(--danger)">
          <h3>🚫 Accès non autorisé</h3>
          <p>Les techniciens n'ont pas accès à la gestion financière et aux dépenses de l'agence.</p>
        </div>
      `;
      return;
    }

    Layout.setTitle(isBailleur ? 'Dépenses & Charges de vos Immeubles' : 'Dépenses & Salaires Gardiens');
    const appContent = document.getElementById('appContent');
    appContent.innerHTML = '<div class="card text-center" style="padding:40px"><div class="spinner"></div><p class="mt-2 text-muted">Chargement des dépenses...</p></div>';

    await this.loadLookups();
    await this.refreshContent();
  },

  async refreshContent() {
    const isBailleur = Auth.hasRole('bailleur');
    const canManage = Auth.hasRole('manager', 'comptable', 'gestionnaire', 'super_admin', 'dir_admin') || Auth.hasPermission('can_manage_expenses');
    const appContent = document.getElementById('appContent');

    const params = {};
    if (this._selectedPropertyId) params.property_id = this._selectedPropertyId;
    if (this._activeFilterType && this._activeFilterType !== 'all') params.expense_type = this._activeFilterType;
    if (this._selectedMonth) params.period_month = this._selectedMonth;
    if (this._searchQuery) params.search = this._searchQuery;

    let expenses = [];
    let stats = { totalAmount: 0, caretakerAmount: 0, maintenanceAmount: 0, utilityAmount: 0, otherAmount: 0 };

    try {
      const [resExp, resStats] = await Promise.all([
        API.get('/expenses', { params }),
        API.get('/expenses/stats', { params: this._selectedPropertyId ? { property_id: this._selectedPropertyId } : {} }).catch(() => ({ data: {} })),
      ]);
      expenses = resExp.data || [];
      stats = resStats.data || stats;
    } catch (err) {
      Toast.error(err.message || 'Erreur lors du chargement des dépenses');
    }

    const fmt = (v) => Helpers.formatMoney(v || 0);
    const propOptions = this._properties.map((p) =>
      `<option value="${p.id}" ${String(this._selectedPropertyId) === String(p.id) ? 'selected' : ''}>${p.property_name}${p.caretaker_name ? ` (Gardien: ${p.caretaker_name})` : ''}</option>`
    ).join('');

    appContent.innerHTML = `
      <div class="card" style="margin-bottom:16px;background:linear-gradient(135deg,#1e3a5f,#142a45);color:#fff">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <span class="badge" style="background:rgba(255,255,255,0.2);color:#fff">
              ${isBailleur ? '🏢 Espace Propriétaire · Transparence Totale' : '💼 Finances & Gestion des Dépenses'}
            </span>
            <h2 style="font-size:20px;font-weight:800;margin-top:6px;color:#fff">
              ${isBailleur ? 'Dépenses & Salaires Gardiens de vos Immeubles' : 'Gestion des Dépenses & Salaires des Gardiens'}
            </h2>
            <p style="font-size:13px;opacity:0.85;margin-top:4px">
              ${isBailleur
                ? 'Suivez en temps réel toutes les charges, salaires des gardiens et travaux déduits de vos loyers.'
                : 'Enregistrez les salaires des gardiens par immeuble, les factures de maintenance et les charges communes.'}
            </p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${canManage ? `
              <button class="btn btn-primary" onclick="PageExpenses.openPayCaretakerModal()" style="font-weight:700">
                🛡️ Payer Salaire Gardien
              </button>
              <button class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,0.4)" onclick="PageExpenses.openGenericExpenseModal()">
                ➕ Autre Dépense
              </button>
            ` : ''}
            ${isBailleur ? `
              <button class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,0.4)" onclick="Router.go('management-reports')">
                📈 Voir Rapport de Gestion
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-bottom:16px">
        <div class="card stat-card">
          <div class="stat-icon primary">🧾</div>
          <div class="stat-info">
            <div class="stat-value">${fmt(stats.totalAmount)}</div>
            <div class="stat-name">Total Dépenses Déclarées</div>
          </div>
        </div>
        <div class="card stat-card" style="border-left:4px solid var(--success)">
          <div class="stat-icon success">🛡️</div>
          <div class="stat-info">
            <div class="stat-value" style="color:var(--success)">${fmt(stats.caretakerAmount)}</div>
            <div class="stat-name">Salaires Gardiens Payés</div>
          </div>
        </div>
        <div class="card stat-card" style="border-left:4px solid var(--warning)">
          <div class="stat-icon warning">🔧</div>
          <div class="stat-info">
            <div class="stat-value" style="color:var(--warning)">${fmt(stats.maintenanceAmount)}</div>
            <div class="stat-name">Maintenances & Travaux</div>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon info">⚡</div>
          <div class="stat-info">
            <div class="stat-value">${fmt(stats.utilityAmount + (stats.otherAmount || 0))}</div>
            <div class="stat-name">Charges Communes & Autres</div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px">
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-sm ${this._activeFilterType === 'all' ? 'btn-primary' : 'btn-outline'}" onclick="PageExpenses.filterType('all')">Toutes (${expenses.length})</button>
            <button class="btn btn-sm ${this._activeFilterType === 'gardiennage' ? 'btn-primary' : 'btn-outline'}" onclick="PageExpenses.filterType('gardiennage')">🛡️ Salaires Gardiens</button>
            <button class="btn btn-sm ${this._activeFilterType === 'maintenance' ? 'btn-primary' : 'btn-outline'}" onclick="PageExpenses.filterType('maintenance')">🔧 Maintenances & Travaux</button>
            <button class="btn btn-sm ${this._activeFilterType === 'utility' ? 'btn-primary' : 'btn-outline'}" onclick="PageExpenses.filterType('utility')">⚡ Charges Communes</button>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="text" id="expenseSearch" class="form-control" style="width:220px;font-size:13px" placeholder="Rechercher gardien, équipement..." value="${this._searchQuery}" onkeyup="if(event.key==='Enter') PageExpenses.applySearch(this.value)">
            <button class="btn btn-sm btn-outline" onclick="PageExpenses.applySearch(document.getElementById('expenseSearch').value)">🔍</button>
          </div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding-top:10px;border-top:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:12.5px;font-weight:600;color:var(--text-muted)">🏢 Immeuble :</span>
            <select class="form-control" style="width:200px;font-size:12.5px" onchange="PageExpenses.filterProperty(this.value)">
              <option value="">Tous les immeubles</option>
              ${propOptions}
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:12.5px;font-weight:600;color:var(--text-muted)">📅 Période / Mois :</span>
            <input type="month" class="form-control" style="width:160px;font-size:12.5px" value="${this._selectedMonth}" onchange="PageExpenses.filterMonth(this.value)" />
            ${this._selectedMonth ? `<button class="btn btn-sm btn-outline" style="padding:2px 8px;font-size:11px" onclick="PageExpenses.filterMonth('')">✕ Effacer</button>` : ''}
          </div>
          ${(this._selectedPropertyId || this._selectedMonth || this._activeFilterType !== 'all' || this._searchQuery) ? `
            <button class="btn btn-sm btn-outline" style="margin-left:auto;color:var(--danger);border-color:var(--danger)" onclick="PageExpenses.resetFilters()">🔄 Réinitialiser les filtres</button>
          ` : ''}
        </div>
      </div>

      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <h3 style="font-size:15px;font-weight:700;margin:0">📋 Liste des Dépenses (${expenses.length})</h3>
          <span style="font-size:12px;color:var(--text-muted)">
            ${isBailleur ? 'Visible en toute transparence pour votre patrimoine' : 'Toutes les dépenses déductibles du bilan'}
          </span>
        </div>

        <!-- Barre d'action groupée pour dépenses -->
        ${canManage ? `
          <div id="expBulkBar" style="display:none;background:#fee2e2;border:1px solid #fca5a5;padding:10px 16px;border-radius:8px;margin:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
            <div style="font-size:13px;color:#991b1b;font-weight:600">
              <span id="expSelectedCount">0</span> dépense(s) sélectionnée(s)
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-sm btn-outline" style="border-color:#f87171;color:#991b1b" onclick="PageExpenses.clearSelection()">Annuler</button>
              <button class="btn btn-sm btn-danger" onclick="PageExpenses.bulkDelete()">🗑️ Tout supprimer la sélection</button>
            </div>
          </div>
        ` : ''}

        ${!expenses.length ? `
          <div style="text-align:center;padding:50px 20px;color:var(--text-muted)">
            <div style="font-size:40px;margin-bottom:10px">🧾</div>
            <h4>Aucune dépense trouvée</h4>
            <p style="font-size:13px;max-width:400px;margin:6px auto 16px">
              ${isBailleur ? 'Aucune charge ou dépense enregistrée pour la sélection courante.' : 'Commencez par déclarer un salaire de gardien ou une dépense de maintenance.'}
            </p>
            ${canManage ? `<button class="btn btn-primary" onclick="PageExpenses.openPayCaretakerModal()">🛡️ Payer un Salaire Gardien</button>` : ''}
          </div>
        ` : `
          <div class="table-responsive">
            <table class="table" style="margin:0;font-size:13px">
              <thead>
                <tr style="background:var(--secondary-bg, #f8f9fa)">
                  ${canManage ? '<th style="width:36px;text-align:center"><input type="checkbox" id="expSelectAll" title="Tout sélectionner" onchange="PageExpenses.toggleSelectAll(this.checked)" /></th>' : ''}
                  <th>Date & Période</th>
                  <th>Immeuble</th>
                  <th>Nature & Désignation</th>
                  <th>Bénéficiaire / Gardien</th>
                  <th style="text-align:right">Montant</th>
                  <th>Règlement</th>
                  <th>Bailleur</th>
                  <th>Justificatif</th>
                  ${canManage ? '<th style="text-align:center">Actions</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${expenses.map((e) => {
                  const isGardien = e.expense_type === 'gardiennage' || (e.category && e.category.toLowerCase().includes('gardien'));
                  const badgeClass = isGardien ? 'badge-success' : (e.expense_type === 'maintenance' ? 'badge-warning' : 'badge-info');
                  const badgeLabel = isGardien ? '🛡️ Salaire Gardien' : (e.expense_type === 'maintenance' ? '🔧 Maintenance' : (e.category || 'Dépense'));
                  const proofUrl = e.invoice_file || e.photo ? Helpers.fileUrl(e.invoice_file || e.photo) : null;
                  const payDate = e.payment_date ? Helpers.formatDate(e.payment_date) : Helpers.formatDate(e.createdAt);
                  return `
                    <tr>
                      ${canManage ? `
                        <td style="text-align:center">
                          <input type="checkbox" class="exp-row-chk" value="${e.id}" onchange="PageExpenses.onRowSelectChange()" />
                        </td>
                      ` : ''}
                      <td><b>${payDate}</b>${e.period_month ? `<br><span class="badge" style="background:#e8f4fd;color:#0b5394;font-size:10.5px">${e.period_month}</span>` : ''}</td>
                      <td><b>🏢 ${e.property?.property_name || '—'}</b>${e.property?.city ? `<br><span class="text-muted" style="font-size:11px">📍 ${e.property.city}</span>` : ''}</td>
                      <td>
                        <span class="badge ${badgeClass}" style="margin-bottom:3px;display:inline-block">${badgeLabel}</span>
                        <div style="font-weight:600;color:var(--text)">${e.item_name}</div>
                        ${e.maintenance ? `<span class="text-muted" style="font-size:11px">Sur maintenance : ${e.maintenance.title}</span>` : ''}
                      </td>
                      <td>${isGardien ? `<span style="font-weight:700;color:var(--primary)">👤 ${e.caretaker_name || e.property?.caretaker_name || 'Gardien'}</span>` : `<span>${e.supplier || '—'}</span>`}</td>
                      <td style="text-align:right;font-weight:800;font-size:13.5px">${fmt(e.total_price || (e.unit_price * (e.quantity || 1)))}</td>
                      <td><span class="badge" style="background:#f1f3f5;color:var(--text);font-size:11px">${e.payment_method || 'Espèces'}</span></td>
                      <td style="text-align:center">${e.is_landlord_expense ? '<span class="badge badge-success" style="font-size:11px">🏠 Bailleur</span>' : '<span class="text-muted" style="font-size:11px">—</span>'}</td>
                      <td>${proofUrl ? `<a href="${proofUrl}" target="_blank" class="btn btn-sm btn-outline" style="padding:2px 8px;font-size:11px">📥 Justificatif</a>` : '<span class="text-muted" style="font-size:12px">—</span>'}</td>
                      ${canManage ? `<td style="text-align:center"><div style="display:inline-flex;gap:4px"><button class="btn btn-sm btn-outline" onclick="PageExpenses.editExpense(${e.id})">✏️</button><button class="btn btn-sm btn-danger" onclick="PageExpenses.removeExpense(${e.id})">🗑</button></div></td>` : ''}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  },

  openPayCaretakerModal(defaultPropId = null, defaultCaretakerName = '', defaultSalary = 0) {
    const propsWithCaretaker = this._properties;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const today = new Date().toISOString().slice(0, 10);

    Modal.open('🛡️ Payer le Salaire du Gardien', `
      <form id="payCaretakerForm" enctype="multipart/form-data">
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px">
          Enregistrez le versement du salaire du gardien. Cette dépense sera imputée sur le bilan du propriétaire et visible en toute transparence.
        </p>
        <div class="form-group mb-3">
          <label style="font-weight:700">🏢 Sélectionner l'Immeuble *</label>
          <select id="carePropertyId" class="form-control" required onchange="PageExpenses.onCaretakerPropertyChange(this.value)">
            <option value="">-- Choisir un immeuble --</option>
            ${propsWithCaretaker.map((p) => `
              <option value="${p.id}" ${String(defaultPropId) === String(p.id) ? 'selected' : ''} data-name="${(p.caretaker_name || '').replace(/"/g, '&quot;')}" data-salary="${p.caretaker_salary || 0}">
                ${p.property_name} ${p.caretaker_name ? `(Gardien: ${p.caretaker_name} · ${Helpers.formatMoney(p.caretaker_salary || 0)})` : '(Sans gardien configuré)'}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group half">
            <label style="font-weight:600">👤 Nom du Gardien (Bénéficiaire) *</label>
            <input type="text" id="careName" class="form-control" placeholder="Nom et prénom du gardien" value="${defaultCaretakerName}" required />
          </div>
          <div class="form-group half">
            <label style="font-weight:600">💵 Montant du Salaire Versé (FCFA) *</label>
            <input type="number" id="careAmount" class="form-control" placeholder="Ex: 60000" value="${defaultSalary || ''}" required min="1" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group half">
            <label style="font-weight:600">📅 Mois Concerné *</label>
            <input type="month" id="careMonth" class="form-control" value="${currentMonth}" required />
          </div>
          <div class="form-group half">
            <label style="font-weight:600">📆 Date Effective du Paiement *</label>
            <input type="date" id="careDate" class="form-control" value="${today}" required />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group half">
            <label style="font-weight:600">💳 Mode de Règlement</label>
            <select id="careMethod" class="form-control">
              <option value="Espèces" selected>Espèces (Cash)</option>
              <option value="Orange Money">Orange Money</option>
              <option value="MTN Mobile Money">MTN Mobile Money</option>
              <option value="Virement bancaire">Virement bancaire</option>
              <option value="Chèque">Chèque</option>
            </select>
          </div>
          <div class="form-group half">
            <label style="font-weight:600">🧾 Reçu d'émargement / Justificatif</label>
            <input type="file" id="careReceipt" class="form-control" accept="image/*,application/pdf" />
          </div>
        </div>
        <div class="form-group">
          <label style="font-weight:600">📝 Observations / Notes éventuelles</label>
          <input type="text" id="careNotes" class="form-control" placeholder="Ex: Émargement signé sur fiche de présence..." />
        </div>
      </form>
    `, `
      <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
      <button class="btn btn-primary" onclick="PageExpenses.submitPayCaretaker()">Valider & Enregistrer le Paiement</button>
    `);

    if (defaultPropId) this.onCaretakerPropertyChange(defaultPropId);
  },

  onCaretakerPropertyChange(propId) {
    const sel = document.getElementById('carePropertyId');
    if (!sel) return;
    const opt = sel.options[sel.selectedIndex];
    if (opt && opt.dataset) {
      const name = opt.dataset.name || '';
      const salary = Number(opt.dataset.salary) || 0;
      const careNameInput = document.getElementById('careName');
      const careAmountInput = document.getElementById('careAmount');
      if (careNameInput && name && !careNameInput.value) careNameInput.value = name;
      if (careAmountInput && salary > 0 && !careAmountInput.value) careAmountInput.value = salary;
    }
  },

  async submitPayCaretaker() {
    const propId = document.getElementById('carePropertyId')?.value;
    const careName = document.getElementById('careName')?.value?.trim();
    const amount = Number(document.getElementById('careAmount')?.value) || 0;
    const month = document.getElementById('careMonth')?.value;
    const date = document.getElementById('careDate')?.value;
    const method = document.getElementById('careMethod')?.value || 'Espèces';
    const notes = document.getElementById('careNotes')?.value?.trim() || '';
    const file = document.getElementById('careReceipt')?.files[0];

    if (!propId) { Toast.error('Veuillez sélectionner un immeuble.'); return; }
    if (!careName) { Toast.error('Veuillez renseigner le nom du gardien.'); return; }
    if (amount <= 0) { Toast.error('Veuillez renseigner un montant de salaire valide.'); return; }

    const fd = new FormData();
    fd.append('property_id', propId);
    fd.append('expense_type', 'gardiennage');
    fd.append('category', 'Gardiennage & Sécurité');
    fd.append('caretaker_name', careName);
    fd.append('item_name', `Salaire Gardien - ${careName} (${month})`);
    fd.append('quantity', '1');
    fd.append('unit_price', String(amount));
    fd.append('total_price', String(amount));
    fd.append('period_month', month);
    fd.append('payment_date', date);
    fd.append('payment_method', method);
    fd.append('supplier', careName);
    fd.append('is_landlord_expense', '1');
    if (notes) fd.append('description', notes);
    if (file) fd.append('receipt', file);

    try {
      Modal.close();
      Toast.info('Enregistrement du paiement du salaire du gardien...');
      await API.upload('/expenses', fd);
      Toast.success(`Salaire du gardien ${careName} enregistré avec succès !`);
      this.refreshContent();
    } catch (err) {
      Toast.error(err.message || 'Échec de l\'enregistrement du salaire du gardien');
    }
  },

  payCaretaker(propId, name, salary) {
    this.openPayCaretakerModal(propId, name, salary);
  },

  openGenericExpenseModal() {
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = new Date().toISOString().slice(0, 7);

    Modal.open('➕ Enregistrer une Dépense', `
      <form id="genericExpenseForm" enctype="multipart/form-data">
        <div class="form-row">
          <div class="form-group half">
            <label style="font-weight:700">Type de Dépense *</label>
            <select id="genType" class="form-control" required onchange="PageExpenses.onGenericTypeChange(this.value)">
              <option value="maintenance">🔧 Maintenance & Réparation</option>
              <option value="utility">⚡ Charges Communes (Eau, Élec, Vidange...)</option>
              <option value="gardiennage">🛡️ Salaire Gardien</option>
              <option value="renovation">🏗️ Rénovation & Aménagement</option>
              <option value="administrative">📄 Frais Administratifs / Taxe</option>
              <option value="other">📁 Autre dépense</option>
            </select>
          </div>
          <div class="form-group half">
            <label style="font-weight:700">🏢 Immeuble Lié *</label>
            <select id="genPropertyId" class="form-control" required>
              <option value="">-- Choisir l'immeuble --</option>
              ${this._properties.map((p) => `<option value="${p.id}">${p.property_name}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group" id="genMaintGroup">
          <label style="font-weight:600">Maintenance Liée (Optionnel)</label>
          <select id="genMaintId" class="form-control">
            <option value="">-- Aucune (Dépense directe sur l'immeuble) --</option>
            ${this._maintenances.map((m) => `<option value="${m.id}">${m.title} (${m.apartment?.apartment_number || 'Immeuble'})</option>`).join('')}
          </select>
        </div>

        <div class="form-group" id="genCaretakerGroup" style="display:none">
          <label style="font-weight:700">👤 Nom du Gardien Bénéficiaire *</label>
          <input type="text" id="genCaretakerName" class="form-control" placeholder="Nom et prénom du gardien" />
        </div>

        <div class="form-group" style="background:var(--bg-surface-2,#f8f9fa);padding:10px 14px;border-radius:8px;border:1px solid var(--border);margin-bottom:4px">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600;margin:0">
            <input type="checkbox" id="genIsLandlord" style="width:16px;height:16px;accent-color:var(--primary)" />
            <span>🏠 Dépense à la charge du <strong>bailleur</strong> (déductible du loyer)</span>
          </label>
          <p style="font-size:12px;color:var(--text-muted);margin:4px 0 0 26px">
            Cochez si cette dépense doit être déduite du bilan du propriétaire et visible dans son rapport de gestion.
          </p>
        </div>

        <div class="form-row">
          <div class="form-group half">
            <label style="font-weight:600">Désignation / Matériel *</label>
            <input type="text" id="genItem" class="form-control" placeholder="Ex: Remplacement disjoncteur, Peinture..." required />
          </div>
          <div class="form-group half">
            <label style="font-weight:600">Catégorie</label>
            <input type="text" id="genCategory" class="form-control" placeholder="Plomberie, Électricité, Nettoyage..." />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group half">
            <label style="font-weight:600">Quantité</label>
            <input type="number" id="genQty" class="form-control" value="1" min="1" step="0.5" oninput="PageExpenses.updateGenTotal()" />
          </div>
          <div class="form-group half">
            <label style="font-weight:600">Prix Unitaire (FCFA) *</label>
            <input type="number" id="genUnitPrice" class="form-control" placeholder="Ex: 25000" required oninput="PageExpenses.updateGenTotal()" />
          </div>
        </div>

        <div class="form-group">
          <div style="background:var(--secondary-bg,#f8f9fa);padding:8px 12px;border-radius:6px;font-weight:700">
            Total Calculé : <span id="genTotal" style="color:var(--primary)">0 FCFA</span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group half">
            <label style="font-weight:600">Fournisseur / Prestataire</label>
            <input type="text" id="genSupplier" class="form-control" placeholder="Ex: Quincaillerie du Centre" />
          </div>
          <div class="form-group half">
            <label style="font-weight:600">Date de Règlement *</label>
            <input type="date" id="genDate" class="form-control" value="${today}" required />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group half">
            <label style="font-weight:600">Mois / Période</label>
            <input type="month" id="genMonth" class="form-control" value="${currentMonth}" />
          </div>
          <div class="form-group half">
            <label style="font-weight:600">Moyen de Règlement</label>
            <select id="genMethod" class="form-control">
              <option value="Espèces">Espèces</option>
              <option value="Orange Money">Orange Money</option>
              <option value="MTN Mobile Money">MTN Mobile Money</option>
              <option value="Virement bancaire">Virement bancaire</option>
              <option value="Chèque">Chèque</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label style="font-weight:600">🧾 Facture / Reçu justificatif</label>
          <input type="file" id="genReceipt" class="form-control" accept="image/*,application/pdf" />
        </div>
      </form>
    `, `
      <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
      <button class="btn btn-primary" onclick="PageExpenses.submitGenericExpense()">Enregistrer la Dépense</button>
    `);
  },

  updateGenTotal() {
    const qty = Number(document.getElementById('genQty')?.value) || 1;
    const pu = Number(document.getElementById('genUnitPrice')?.value) || 0;
    const totalEl = document.getElementById('genTotal');
    if (totalEl) totalEl.innerText = Helpers.formatMoney(qty * pu);
  },

  onGenericTypeChange(val) {
    const grp = document.getElementById('genMaintGroup');
    if (grp) grp.style.display = (val === 'maintenance') ? 'block' : 'none';
    const careGrp = document.getElementById('genCaretakerGroup');
    if (careGrp) careGrp.style.display = (val === 'gardiennage') ? 'block' : 'none';
    const landlordChk = document.getElementById('genIsLandlord');
    if (landlordChk) landlordChk.checked = (val === 'gardiennage');
  },

  async submitGenericExpense() {
    const propId = document.getElementById('genPropertyId')?.value;
    const maintId = document.getElementById('genMaintId')?.value;
    const type = document.getElementById('genType')?.value || 'maintenance';
    const item = document.getElementById('genItem')?.value?.trim();
    const category = document.getElementById('genCategory')?.value?.trim() || 'Maintenance';
    const qty = Number(document.getElementById('genQty')?.value) || 1;
    const pu = Number(document.getElementById('genUnitPrice')?.value) || 0;
    const supplier = document.getElementById('genSupplier')?.value?.trim() || '';
    const caretakerName = document.getElementById('genCaretakerName')?.value?.trim() || '';
    const date = document.getElementById('genDate')?.value;
    const month = document.getElementById('genMonth')?.value;
    const method = document.getElementById('genMethod')?.value || 'Espèces';
    const file = document.getElementById('genReceipt')?.files[0];
    const isLandlord = document.getElementById('genIsLandlord')?.checked ? '1' : '0';

    if (!propId && !maintId) { Toast.error('Veuillez sélectionner un immeuble.'); return; }
    if (!item) { Toast.error('Veuillez renseigner le nom de la dépense.'); return; }
    if (type === 'gardiennage' && !caretakerName) { Toast.error('Veuillez renseigner le nom du gardien.'); return; }
    if (pu <= 0) { Toast.error('Veuillez indiquer un prix valide.'); return; }

    const fd = new FormData();
    if (propId) fd.append('property_id', propId);
    if (maintId) fd.append('maintenance_id', maintId);
    fd.append('expense_type', type);
    fd.append('item_name', item);
    fd.append('category', category);
    fd.append('quantity', String(qty));
    fd.append('unit_price', String(pu));
    fd.append('total_price', String(qty * pu));
    fd.append('supplier', supplier);
    if (caretakerName) fd.append('caretaker_name', caretakerName);
    fd.append('payment_date', date);
    fd.append('period_month', month);
    fd.append('payment_method', method);
    fd.append('is_landlord_expense', isLandlord);
    if (file) fd.append('receipt', file);

    try {
      Modal.close();
      Toast.info('Enregistrement de la dépense...');
      await API.upload('/expenses', fd);
      Toast.success('Dépense enregistrée avec succès !');
      this.refreshContent();
    } catch (err) {
      Toast.error(err.message || 'Échec de l\'enregistrement');
    }
  },

  async editExpense(id) {
    try {
      const res = await API.get('/expenses/' + id);
      const e = res.data;
      const isGardien = e.expense_type === 'gardiennage';

      Modal.open('✏️ Modifier la Dépense', `
        <form id="editExpenseForm">
          <div class="form-row">
            <div class="form-group half">
              <label style="font-weight:600">Désignation *</label>
              <input type="text" id="editItem" class="form-control" value="${e.item_name || ''}" required />
            </div>
            <div class="form-group half">
              <label style="font-weight:600">${isGardien ? 'Nom du Gardien' : 'Fournisseur / Bénéficiaire'}</label>
              <input type="text" id="editBeneficiary" class="form-control" value="${isGardien ? (e.caretaker_name || '') : (e.supplier || '')}" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group half">
              <label style="font-weight:600">Montant Unitaire (FCFA) *</label>
              <input type="number" id="editPrice" class="form-control" value="${e.unit_price || e.total_price || 0}" required />
            </div>
            <div class="form-group half">
              <label style="font-weight:600">Quantité</label>
              <input type="number" id="editQty" class="form-control" value="${e.quantity || 1}" step="0.5" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group half">
              <label style="font-weight:600">Date de Règlement</label>
              <input type="date" id="editDate" class="form-control" value="${e.payment_date || (e.createdAt ? e.createdAt.slice(0, 10) : '')}" />
            </div>
            <div class="form-group half">
              <label style="font-weight:600">Mois / Période</label>
              <input type="month" id="editMonth" class="form-control" value="${e.period_month || ''}" />
            </div>
          </div>
          <div class="form-group">
            <label style="font-weight:600">Mode de Règlement</label>
            <select id="editMethod" class="form-control">
              <option value="Espèces" ${e.payment_method === 'Espèces' ? 'selected' : ''}>Espèces</option>
              <option value="Orange Money" ${e.payment_method === 'Orange Money' ? 'selected' : ''}>Orange Money</option>
              <option value="MTN Mobile Money" ${e.payment_method === 'MTN Mobile Money' ? 'selected' : ''}>MTN Mobile Money</option>
              <option value="Virement bancaire" ${e.payment_method === 'Virement bancaire' ? 'selected' : ''}>Virement bancaire</option>
              <option value="Chèque" ${e.payment_method === 'Chèque' ? 'selected' : ''}>Chèque</option>
            </select>
          </div>
          <div class="form-group" style="background:var(--bg-surface-2,#f8f9fa);padding:10px 14px;border-radius:8px;border:1px solid var(--border)">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600;margin:0">
              <input type="checkbox" id="editIsLandlord" style="width:16px;height:16px;accent-color:var(--primary)" ${e.is_landlord_expense ? 'checked' : ''} />
              <span>🏠 Dépense à la charge du <strong>bailleur</strong></span>
            </label>
          </div>
        </form>
      `, `
        <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
        <button class="btn btn-primary" onclick="PageExpenses.submitEditExpense(${e.id}, '${e.expense_type}')">Enregistrer les Modifications</button>
      `);
    } catch (err) {
      Toast.error(err.message || 'Impossible de charger la dépense');
    }
  },

  async submitEditExpense(id, type) {
    const item = document.getElementById('editItem')?.value?.trim();
    const ben = document.getElementById('editBeneficiary')?.value?.trim();
    const price = Number(document.getElementById('editPrice')?.value) || 0;
    const qty = Number(document.getElementById('editQty')?.value) || 1;
    const date = document.getElementById('editDate')?.value;
    const month = document.getElementById('editMonth')?.value;
    const method = document.getElementById('editMethod')?.value;
    const isLandlord = document.getElementById('editIsLandlord')?.checked ? true : false;

    if (!item) { Toast.error('Désignation obligatoire'); return; }
    if (price <= 0) { Toast.error('Prix obligatoire'); return; }

    const payload = {
      item_name: item,
      unit_price: price,
      quantity: qty,
      payment_date: date,
      period_month: month,
      payment_method: method,
      is_landlord_expense: isLandlord,
    };
    if (type === 'gardiennage') {
      payload.caretaker_name = ben;
      payload.supplier = ben;
    } else {
      payload.supplier = ben;
    }

    try {
      Modal.close();
      await API.put('/expenses/' + id, payload);
      Toast.success('Dépense mise à jour');
      this.refreshContent();
    } catch (err) {
      Toast.error(err.message || 'Erreur mise à jour');
    }
  },

  removeExpense(id) {
    CrudPage.confirmDelete('/expenses/' + id, () => {
      Toast.success('Dépense supprimée');
      this.refreshContent();
    });
  },

  filterType(type) { this._activeFilterType = type; this.refreshContent(); },
  filterProperty(propId) { this._selectedPropertyId = propId; this.refreshContent(); },
  filterMonth(month) { this._selectedMonth = month; this.refreshContent(); },
  applySearch(query) { this._searchQuery = (query || '').trim(); this.refreshContent(); },
  resetFilters() {
    this._activeFilterType = 'all';
    this._selectedPropertyId = '';
    this._selectedMonth = '';
    this._searchQuery = '';
    this.refreshContent();
  },

  toggleSelectAll(checked) {
    document.querySelectorAll('.exp-row-chk').forEach((c) => { c.checked = checked; });
    this.onRowSelectChange();
  },

  onRowSelectChange() {
    const checked = document.querySelectorAll('.exp-row-chk:checked');
    const bar = document.getElementById('expBulkBar');
    const cnt = document.getElementById('expSelectedCount');
    const allChk = document.getElementById('expSelectAll');
    const total = document.querySelectorAll('.exp-row-chk').length;
    if (cnt) cnt.textContent = checked.length;
    if (bar) bar.style.display = checked.length > 0 ? 'flex' : 'none';
    if (allChk) allChk.checked = total > 0 && checked.length === total;
  },

  clearSelection() {
    document.querySelectorAll('.exp-row-chk').forEach((c) => { c.checked = false; });
    const allChk = document.getElementById('expSelectAll');
    if (allChk) allChk.checked = false;
    this.onRowSelectChange();
  },

  async bulkDelete() {
    const checked = Array.from(document.querySelectorAll('.exp-row-chk:checked')).map((c) => Number(c.value));
    if (!checked.length) {
      Toast.warning('Aucune dépense sélectionnée');
      return;
    }
    if (!confirm(`Confirmez-vous la suppression groupée de ces ${checked.length} dépense(s) ? Cette action est irréversible.`)) {
      return;
    }
    try {
      Toast.info('Suppression groupée en cours...');
      const res = await API.post('/expenses/bulk-delete', { ids: checked });
      Toast.success(res.message || `${checked.length} dépense(s) supprimée(s) avec succès`);
      this.clearSelection();
      this.refreshContent();
    } catch (e) {
      Toast.error(e.message || 'Erreur lors de la suppression groupée');
    }
  },
};
