// ============ Page Stock, Consommables & Entrepôts Multi-Sites — SMG IMMOBILIER ============
const PageStock = {
  register() {
    Router.register('stock', () => this.render());
  },

  _activeTab: 'items',
  _items: [],
  _warehouses: [],
  _properties: [],
  _cities: [],
  _users: [],
  _selectedWarehouseFilter: '',
  _warehouseTypeFilter: '',
  _warehouseCityFilter: '',
  _warehouseSearchFilter: '',

  async render() {
    Layout.setTitle('Entrepôts & Stocks');
    const appContent = document.getElementById('appContent');

    const canManage = Auth.hasRole('manager', 'comptable', 'dir_technique', 'gestionnaire');

    appContent.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h2 style="font-size:18px;font-weight:700;color:var(--text)">📦 Gestion des Entrepôts & Stocks</h2>
            <p style="font-size:13px;color:var(--text-muted);margin-top:2px">Gestion des entrepôts par ville et immeuble, matériaux consommables avec photos, transferts inter-entrepôts et réceptions.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${canManage ? `
              <button class="btn btn-primary" onclick="PageStock.openPurchaseModal()"><span class="btn-icon">🛒</span> Réception d'Achat</button>
              <button class="btn btn-outline" onclick="PageStock.openTransferModal()"><span class="btn-icon">🔄</span> Transfert entre Entrepôts</button>
              <button class="btn btn-outline" onclick="PageStock.openCreateItemModal()"><span class="btn-icon">➕</span> Nouvel Article</button>
              <button class="btn btn-outline" onclick="PageStock.openWarehouseModal()"><span class="btn-icon">🏢</span> Nouvel Entrepôt</button>
            ` : ''}
            <button class="btn btn-outline" onclick="PageStock.loadCurrentTab()"><span class="btn-icon">🔄</span> Actualiser</button>
          </div>
        </div>

        <!-- Onglets -->
        <div style="display:flex;gap:8px;margin-top:16px;border-bottom:1px solid var(--border);padding-bottom:8px;overflow-x:auto">
          <button class="btn btn-sm ${this._activeTab === 'items' ? 'btn-primary' : 'btn-outline'}" onclick="PageStock.setTab('items')">📦 Catalogue & Niveaux</button>
          <button class="btn btn-sm ${this._activeTab === 'warehouses' ? 'btn-primary' : 'btn-outline'}" onclick="PageStock.setTab('warehouses')">🏢 Entrepôts & Sites</button>
          <button class="btn btn-sm ${this._activeTab === 'purchases' ? 'btn-primary' : 'btn-outline'}" onclick="PageStock.setTab('purchases')">🛒 Réceptions & Achats</button>
          <button class="btn btn-sm ${this._activeTab === 'movements' ? 'btn-primary' : 'btn-outline'}" onclick="PageStock.setTab('movements')">📜 Journal des Mouvements</button>
          <button class="btn btn-sm ${this._activeTab === 'summary' ? 'btn-primary' : 'btn-outline'}" onclick="PageStock.setTab('summary')">📊 Synthèse & Valeur</button>
        </div>
      </div>

      <div id="stockTabContent">
        <div class="spinner"></div>
      </div>
    `;

    await Promise.all([
      this.loadWarehouses(),
      this.loadUsers(),
      this.loadProperties(),
    ]);
    await this.loadCurrentTab();
  },

  async setTab(tab, presetFilter = null) {
    this._activeTab = tab;
    if (presetFilter && presetFilter.warehouse_id) {
      this._selectedWarehouseFilter = String(presetFilter.warehouse_id);
    }
    this.render();
  },

  async loadWarehouses() {
    try {
      const res = await API.get('/warehouses');
      this._warehouses = res.data || [];
      this._cities = res.cities || [...new Set(this._warehouses.map((w) => w.city).filter(Boolean))];
    } catch (_) {
      this._warehouses = [];
      this._cities = [];
    }
  },

  async loadProperties() {
    try {
      const res = await API.get('/properties');
      this._properties = res.data || res || [];
    } catch (_) { this._properties = []; }
  },

  async loadUsers() {
    try {
      const res = await API.get('/users');
      this._users = res.data || [];
    } catch (_) { this._users = []; }
  },

  async loadCurrentTab() {
    const area = document.getElementById('stockTabContent');
    if (!area) return;

    if (this._activeTab === 'items') await this.renderItemsTab(area);
    else if (this._activeTab === 'warehouses') await this.renderWarehousesTab(area);
    else if (this._activeTab === 'purchases') await this.renderPurchasesTab(area);
    else if (this._activeTab === 'movements') await this.renderMovementsTab(area);
    else if (this._activeTab === 'summary') await this.renderSummaryTab(area);
  },

  // ===== 1. ONGLET CATALOGUE & NIVEAUX DE STOCK =====
  async renderItemsTab(area) {
    area.innerHTML = '<div class="spinner"></div>';
    try {
      const res = await API.get('/stock/items');
      this._items = res.data || [];

      const lowCount = this._items.filter((it) => it.is_low_stock).length;
      const warehousesOptions = this._warehouses.map((w) =>
        `<option value="${w.id}" ${this._selectedWarehouseFilter === String(w.id) ? 'selected' : ''}>${w.name} (${w.city})</option>`
      ).join('');

      const citiesOptions = this._cities.map((c) => `<option value="${c}">${c}</option>`).join('');

      let html = `
        ${lowCount > 0 ? `
          <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px 16px;border-radius:6px;margin-bottom:16px;color:#856404;font-size:13px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <span>⚠️ <b>${lowCount} article(s)</b> ont atteint ou dépassé leur seuil d'alerte de stock minimum.</span>
            <button class="btn btn-sm btn-outline" style="color:#856404;border-color:#ffc107" onclick="PageStock.filterLowStock()">Filtrer les ruptures</button>
          </div>
        ` : ''}

        <div class="card" style="margin-bottom:16px">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
            <input type="text" id="stockSearch" class="form-control" placeholder="Rechercher nom, code..." oninput="PageStock.filterItemsTable()" />
            <select id="stockCityFilter" class="form-control" onchange="PageStock.onCityFilterChange()">
              <option value="">Toutes les villes</option>
              ${citiesOptions}
            </select>
            <select id="stockWarehouseFilter" class="form-control" onchange="PageStock.filterItemsTable()">
              <option value="">Tous les entrepôts</option>
              ${warehousesOptions}
            </select>
            <select id="stockTypeFilter" class="form-control" onchange="PageStock.filterItemsTable()">
              <option value="">Tous les types</option>
              <option value="consumable">📦 Consommables (matériaux)</option>
              <option value="tool_equipment">🛠️ Outils & Équipements</option>
            </select>
            <select id="stockCategoryFilter" class="form-control" onchange="PageStock.filterItemsTable()">
              <option value="">Toutes les catégories</option>
              <option value="Plomberie">Plomberie</option>
              <option value="Électricité">Électricité</option>
              <option value="Peinture & Enduit">Peinture & Enduit</option>
              <option value="Maçonnerie & Gros œuvre">Maçonnerie & Gros œuvre</option>
              <option value="Quincaillerie & Visserie">Quincaillerie & Visserie</option>
              <option value="Menuiserie & Bois">Menuiserie & Bois</option>
              <option value="Carrelage & Revêtement">Carrelage & Revêtement</option>
              <option value="Étanchéité & Toiture">Étanchéité & Toiture</option>
              <option value="Sanitaire & Robinetterie">Sanitaire & Robinetterie</option>
              <option value="Outillage consommable">Outillage consommable</option>
            </select>
          </div>
        </div>

        <div id="stockBulkBar" style="display:none;background:#fef2f2;border:1px solid #fca5a5;padding:10px 16px;border-radius:8px;margin-bottom:14px;display:none;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div style="font-weight:600;color:#991b1b;font-size:13px">
            <span id="stockBulkCount">0</span> article(s) sélectionné(s)
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm btn-danger" onclick="PageStock.bulkDeleteItems()">🗑️ Supprimer la sélection</button>
            <button class="btn btn-sm btn-outline" onclick="PageStock.onSelectAll(false)">❌ Désélectionner</button>
          </div>
        </div>

        <div class="card">
          <div class="table-responsive">
            <table class="table" id="stockItemsTable">
              <thead>
                <tr>
                  <th style="width:38px;text-align:center">
                    <input type="checkbox" id="stockSelectAll" onchange="PageStock.onSelectAll(this.checked)" title="Tout sélectionner" />
                  </th>
                  <th>Code</th>
                  <th>Article</th>
                  <th>Type</th>
                  <th>Entrepôt</th>
                  <th>Quantité</th>
                  <th>Seuil Min</th>
                  <th>PUMP (Coût moyen)</th>
                  <th>Valeur Stock</th>
                  <th>Statut</th>
                  <th style="text-align:right">Actions</th>
                </tr>
              </thead>
              <tbody id="stockItemsTableBody">
                ${this._buildItemsRows(this._items)}
              </tbody>
            </table>
          </div>
        </div>
      `;
      area.innerHTML = html;
      if (this._selectedWarehouseFilter) {
        this.filterItemsTable();
      }
    } catch (err) {
      area.innerHTML = '<div class="card" style="color:var(--danger)">Erreur lors du chargement des articles de stock.</div>';
    }
  },

  onCityFilterChange() {
    const city = document.getElementById('stockCityFilter')?.value || '';
    const whSelect = document.getElementById('stockWarehouseFilter');
    if (whSelect) {
      let filteredWh = this._warehouses;
      if (city) filteredWh = filteredWh.filter((w) => w.city === city);
      whSelect.innerHTML = '<option value="">Tous les entrepôts</option>' +
        filteredWh.map((w) => `<option value="${w.id}">${w.name} (${w.city})</option>`).join('');
    }
    this.filterItemsTable();
  },

  _buildItemsRows(items) {
    if (!items.length) return '<tr><td colspan="11" style="text-align:center;padding:30px;color:var(--text-muted)">Aucun article trouvé.</td></tr>';
    const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
    const canManage = Auth.hasRole('manager', 'comptable', 'dir_technique', 'gestionnaire');
    const canDelete = Auth.hasRole('manager', 'super_admin');

    return items.map((it) => {
      const isTool = it.item_type === 'tool_equipment';
      const whName = it.warehouse ? `${it.warehouse.name} (${it.warehouse.city})` : 'Entrepôt Principal';
      const loanedQty = parseFloat(it.quantity_loaned || 0);
      const safeName = (it.name || '').replace(/'/g, "\\'");

      return `
        <tr style="${it.is_low_stock ? 'background:rgba(231,76,60,0.04)' : ''}">
          <td style="text-align:center">
            <input type="checkbox" class="stock-row-chk" value="${it.id}" onchange="PageStock.onRowCheck()" />
          </td>
          <td><strong style="color:var(--primary)">${it.item_code}</strong></td>
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              ${it.photo
                ? `<img src="${Helpers.fileUrl(it.photo)}" alt="${it.name}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid var(--border);flex-shrink:0" />`
                : `<div style="width:40px;height:40px;border-radius:6px;background:var(--secondary-bg, #f1f5f9);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${isTool ? '🛠️' : '📦'}</div>`}
              <div>
                <b>${it.name}</b>
                ${it.location ? `<br><small style="color:var(--text-muted)">📍 Emplacement: ${it.location}</small>` : ''}
                <br><small style="color:var(--text-muted);font-size:11px">${it.category}</small>
              </div>
            </div>
          </td>
          <td>
            ${isTool
              ? '<span class="badge badge-info" style="font-size:11px">🛠️ Outil / Matériel</span>'
              : '<span class="badge badge-secondary" style="font-size:11px">📦 Consommable</span>'}
          </td>
          <td>
            <span class="badge badge-light" style="border:1px solid var(--border)">🏢 ${whName}</span>
          </td>
          <td>
            <b style="font-size:14px;color:${it.is_low_stock ? 'var(--danger)' : 'var(--text)'}">
              ${fmt(it.quantity)} ${it.unit}
            </b>
            ${loanedQty > 0 ? `
              <br><small style="color:#d35400;font-weight:600">dont ${fmt(loanedQty)} prêté(s) chantier</small>
            ` : ''}
          </td>
          <td><small style="color:var(--text-muted)">${fmt(it.min_alert_threshold)} ${it.unit}</small></td>
          <td>${fmt(it.unit_price_avg)} FCFA</td>
          <td><b>${fmt(it.stock_value)} FCFA</b></td>
          <td>
            ${it.quantity <= 0
              ? '<span class="badge badge-danger">Rupture</span>'
              : (it.is_low_stock ? '<span class="badge badge-warning">Stock faible</span>' : '<span class="badge badge-success">En stock</span>')}
          </td>
          <td style="text-align:right;white-space:nowrap">
            ${canManage ? `
              <button class="btn btn-sm btn-outline" onclick="PageStock.openTransferModal(${it.id})" title="Transférer vers un autre entrepôt">🔄</button>
              <button class="btn btn-sm btn-outline" onclick="PageStock.openEditItemModal(${it.id})" title="Modifier">✏️</button>
            ` : ''}
            ${canDelete ? `
              <button class="btn btn-sm btn-outline" style="color:var(--danger);border-color:var(--danger)" onclick="PageStock.deleteItem(${it.id}, '${safeName}')" title="Supprimer définitivement (Manager uniquement)">🗑️</button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  onSelectAll(checked) {
    const chks = document.querySelectorAll('.stock-row-chk');
    chks.forEach((c) => { c.checked = checked; });
    const allBox = document.getElementById('stockSelectAll');
    if (allBox) allBox.checked = checked;
    this.onRowCheck();
  },

  onRowCheck() {
    const chks = Array.from(document.querySelectorAll('.stock-row-chk:checked'));
    const bar = document.getElementById('stockBulkBar');
    const countEl = document.getElementById('stockBulkCount');
    if (bar && countEl) {
      countEl.textContent = chks.length;
      bar.style.display = chks.length > 0 ? 'flex' : 'none';
    }
  },

  getSelectedIds() {
    return Array.from(document.querySelectorAll('.stock-row-chk:checked')).map((c) => parseInt(c.value, 10)).filter(Boolean);
  },

  async bulkDeleteItems() {
    const ids = this.getSelectedIds();
    if (!ids.length) return;
    if (!confirm(`Voulez-vous vraiment supprimer définitivement les ${ids.length} article(s) sélectionné(s) du stock ?`)) return;
    try {
      await API.post('/stock/items/bulk-delete', { ids });
      Toast.success(`${ids.length} article(s) supprimé(s) avec succès`);
      this.loadCurrentTab();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de la suppression groupée');
    }
  },

  async deleteItem(id, name) {
    if (!Auth.hasRole('manager', 'super_admin')) {
      Toast.error('Seul le Manager a le droit de supprimer un article.');
      return;
    }
    if (!confirm(`Voulez-vous vraiment supprimer définitivement l'article « ${name || ''} » du stock ?`)) return;
    try {
      await API.delete(`/stock/items/${id}`);
      Toast.success('Article supprimé avec succès');
      this.loadCurrentTab();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de la suppression');
    }
  },

  filterItemsTable() {
    const q = (document.getElementById('stockSearch')?.value || '').toLowerCase().trim();
    const city = document.getElementById('stockCityFilter')?.value || '';
    const whId = document.getElementById('stockWarehouseFilter')?.value || '';
    const type = document.getElementById('stockTypeFilter')?.value || '';
    const cat = document.getElementById('stockCategoryFilter')?.value || '';

    const filtered = this._items.filter((it) => {
      const matchQ = !q || (it.name.toLowerCase().includes(q) || it.item_code.toLowerCase().includes(q));
      const matchCity = !city || (it.warehouse && it.warehouse.city === city);
      const matchWh = !whId || (it.warehouse_id === parseInt(whId, 10));
      const matchType = !type || it.item_type === type;
      const matchCat = !cat || it.category === cat;
      return matchQ && matchCity && matchWh && matchType && matchCat;
    });
    const tbody = document.getElementById('stockItemsTableBody');
    if (tbody) tbody.innerHTML = this._buildItemsRows(filtered);
  },

  filterLowStock() {
    const filtered = this._items.filter((it) => it.is_low_stock);
    const tbody = document.getElementById('stockItemsTableBody');
    if (tbody) tbody.innerHTML = this._buildItemsRows(filtered);
  },

  // ===== 2. ONGLET MAGASINS & DÉPÔTS (MULTI-VILLES) =====
  async renderWarehousesTab(area) {
    area.innerHTML = '<div class="spinner"></div>';
    try {
      await this.loadWarehouses();
      const whList = this._warehouses || [];
      const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
      const canManage = Auth.hasRole('manager', 'comptable', 'dir_technique', 'gestionnaire');

      const totalVal = whList.reduce((s, w) => s + (w.stats?.total_value || 0), 0);
      const totalArticles = whList.reduce((s, w) => s + (w.stats?.items_count || 0), 0);
      const totalCities = this._cities.length || 1;

      const citiesOptions = this._cities.map((c) =>
        `<option value="${c}" ${this._warehouseCityFilter === c ? 'selected' : ''}>${c}</option>`
      ).join('');

      area.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px">
          <div class="card stat-card">
            <div class="stat-icon primary">🏢</div>
            <div class="stat-info">
              <div class="stat-value">${whList.length}</div>
              <div class="stat-name">Entrepôts Actifs</div>
            </div>
          </div>
          <div class="card stat-card">
            <div class="stat-icon info">🌍</div>
            <div class="stat-info">
              <div class="stat-value">${totalCities}</div>
              <div class="stat-name">Villes Desservies (Douala, Yaoundé...)</div>
            </div>
          </div>
          <div class="card stat-card">
            <div class="stat-icon success">📦</div>
            <div class="stat-info">
              <div class="stat-value">${totalArticles}</div>
              <div class="stat-name">Lignes d'Articles en Stock</div>
            </div>
          </div>
          <div class="card stat-card">
            <div class="stat-icon warning">💰</div>
            <div class="stat-info">
              <div class="stat-value">${fmt(totalVal)} FCFA</div>
              <div class="stat-name">Valeur Globale Immobilisée</div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;align-items:center">
            <input type="text" id="whFilterSearch" class="form-control" placeholder="Rechercher entrepôt, adresse..." value="${this._warehouseSearchFilter || ''}" oninput="PageStock.filterWarehousesTable()" />
            <select id="whFilterCity" class="form-control" onchange="PageStock.filterWarehousesTable()">
              <option value="">Toutes les villes (Douala, Yaoundé...)</option>
              ${citiesOptions}
            </select>
            <select id="whFilterType" class="form-control" onchange="PageStock.filterWarehousesTable()">
              <option value="">Toutes les vocations / types</option>
              <option value="stocks" ${this._warehouseTypeFilter === 'stocks' ? 'selected' : ''}>📦 Stocks & Matériaux de construction</option>
              <option value="equipment" ${this._warehouseTypeFilter === 'equipment' ? 'selected' : ''}>🛠️ Équipements & Outillage chantier</option>
              <option value="mixed" ${this._warehouseTypeFilter === 'mixed' ? 'selected' : ''}>🔄 Mixte (Stocks & Équipements)</option>
            </select>
          </div>
        </div>

        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
            <div>
              <h3 style="font-size:16px;font-weight:700">Réseau des Entrepôts Logistiques</h3>
              <p style="font-size:12px;color:var(--text-muted);margin:0">Suivi des points de stockage par ville et par immeuble, affectation (stocks matériaux / équipements chantier) et valorisation.</p>
            </div>
            ${canManage ? `
              <button class="btn btn-primary btn-sm" onclick="PageStock.openWarehouseModal()">
                <span class="btn-icon">➕</span> Ajouter un Entrepôt
              </button>
            ` : ''}
          </div>

          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Nom de l'Entrepôt</th>
                  <th>Ville</th>
                  <th>Vocation / Type</th>
                  <th>Adresse & Contact</th>
                  <th>Responsable</th>
                  <th>Articles</th>
                  <th>Matériels Prêtés</th>
                  <th>Valeur du Stock</th>
                  <th>Statut</th>
                  <th style="text-align:right">Actions</th>
                </tr>
              </thead>
              <tbody id="warehousesTableBody">
                ${this._buildWarehousesRows(this._warehouses)}
              </tbody>
            </table>
          </div>
        </div>
      `;
      this.filterWarehousesTable();
    } catch (err) {
      area.innerHTML = '<div class="card" style="color:var(--danger)">Erreur de chargement des entrepôts.</div>';
    }
  },

  _buildWarehousesRows(list) {
    if (!list.length) return '<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--text-muted)">Aucun entrepôt trouvé.</td></tr>';
    const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');
    const canManage = Auth.hasRole('manager', 'comptable', 'dir_technique', 'gestionnaire');
    const canDelete = Auth.hasRole('manager', 'super_admin');

    const typeBadges = {
      stocks: '<span class="badge badge-secondary" style="font-size:11px">📦 Stocks Matériaux</span>',
      equipment: '<span class="badge badge-info" style="font-size:11px">🛠️ Équipements Chantier</span>',
      mixed: '<span class="badge badge-warning" style="font-size:11px">🔄 Mixte</span>',
    };

    return list.map((w) => {
      const safeName = (w.name || '').replace(/'/g, "\\'");
      return `
        <tr>
          <td>
            <strong style="color:var(--primary);font-size:14px">${w.name}</strong>
            ${w.property ? `<br><small style="color:var(--info);font-weight:600">🏢 ${w.property.property_name}</small>` : '<br><small style="color:var(--text-muted)">🏢 Entrepôt central</small>'}
            ${w.description ? `<br><small style="color:var(--text-muted)">📝 ${w.description}</small>` : ''}
          </td>
          <td>
            <span class="badge badge-info" style="font-size:12px;font-weight:600">${w.city}</span>
          </td>
          <td>
            ${typeBadges[w.warehouse_type] || typeBadges.mixed}
          </td>
          <td>
            <small>📍 ${w.address || '—'}</small>
            ${w.phone ? `<br><small style="color:var(--text-muted)">📞 ${w.phone}</small>` : ''}
          </td>
          <td>
            <b>${w.manager ? w.manager.full_name : '—'}</b>
            ${w.manager?.phone ? `<br><small style="color:var(--text-muted)">${w.manager.phone}</small>` : ''}
          </td>
          <td><b>${w.stats?.items_count || 0}</b> réf.</td>
          <td>
            ${(w.stats?.loaned_quantity || 0) > 0
              ? `<span class="badge badge-warning">${w.stats.loaned_quantity} unité(s)</span>`
              : '<small style="color:var(--text-muted)">0</small>'}
          </td>
          <td><b style="color:var(--success)">${fmt(w.stats?.total_value || 0)} FCFA</b></td>
          <td>
            ${w.is_active ? '<span class="badge badge-success">Opérationnel</span>' : '<span class="badge badge-danger">Inactif</span>'}
          </td>
          <td style="text-align:right;white-space:nowrap">
            <button class="btn btn-sm btn-outline" onclick="PageStock.viewWarehouseStock(${w.id})" title="Voir les articles de ce magasin">📦 Stock</button>
            ${canManage ? `
              <button class="btn btn-sm btn-outline" onclick="PageStock.openWarehouseModal(${w.id})" title="Modifier">✏️</button>
            ` : ''}
            ${canDelete ? `
              <button class="btn btn-sm btn-outline" style="color:var(--danger);border-color:var(--danger)" onclick="PageStock.deleteWarehouse(${w.id}, '${safeName}')" title="Supprimer définitivement (Manager uniquement)">🗑️</button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  filterWarehousesTable() {
    const q = (document.getElementById('whFilterSearch')?.value || '').toLowerCase().trim();
    const city = document.getElementById('whFilterCity')?.value || '';
    const type = document.getElementById('whFilterType')?.value || '';

    this._warehouseSearchFilter = q;
    this._warehouseCityFilter = city;
    this._warehouseTypeFilter = type;

    const filtered = (this._warehouses || []).filter((w) => {
      const matchQ = !q || (w.name.toLowerCase().includes(q) || (w.address && w.address.toLowerCase().includes(q)) || (w.description && w.description.toLowerCase().includes(q)));
      const matchCity = !city || w.city === city;
      const matchType = !type || (w.warehouse_type || 'mixed') === type;
      return matchQ && matchCity && matchType;
    });

    const tbody = document.getElementById('warehousesTableBody');
    if (tbody) tbody.innerHTML = this._buildWarehousesRows(filtered);
  },

  async deleteWarehouse(id, name) {
    if (!Auth.hasRole('manager', 'super_admin')) {
      Toast.error('Seul le Manager a le droit de supprimer un magasin.');
      return;
    }
    if (!confirm(`Voulez-vous vraiment supprimer ou désactiver le magasin « ${name} » ?`)) return;
    try {
      const res = await API.delete(`/warehouses/${id}`);
      Toast.success(res.message || 'Magasin supprimé/désactivé avec succès');
      await this.loadWarehouses();
      this.loadCurrentTab();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de la suppression');
    }
  },

  viewWarehouseStock(warehouseId) {
    this._selectedWarehouseFilter = String(warehouseId);
    this._activeTab = 'items';
    this.render();
  },

  // ===== 3. ONGLET ACHATS & RÉCEPTIONS =====
  async renderPurchasesTab(area) {
    area.innerHTML = '<div class="spinner"></div>';
    try {
      const res = await API.get('/stock/purchases');
      const purchases = res.data || [];
      const fmt = (n) => Number(n || 0).toLocaleString('fr-FR') + ' FCFA';

      area.innerHTML = `
        <div class="card">
          <h3 style="font-size:16px;font-weight:700;margin-bottom:14px">🛒 Historique des Réceptions d'Achats</h3>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>N° Bon / Réception</th>
                  <th>Date</th>
                  <th>Origine / Référence</th>
                  <th>N° Facture</th>
                  <th>Montant Total</th>
                  <th>Articles</th>
                  <th>Enregistré par</th>
                </tr>
              </thead>
              <tbody>
                ${!purchases.length ? '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted)">Aucun achat enregistré.</td></tr>' : purchases.map((p) => `
                  <tr>
                    <td><strong style="color:var(--primary)">${p.purchase_number}</strong></td>
                    <td>${new Date(p.purchase_date).toLocaleDateString('fr-FR')}</td>
                    <td><b>${p.supplier ? p.supplier.name : (p.notes || 'Achat direct')}</b></td>
                    <td><small>${p.invoice_number || '—'}</small></td>
                    <td><b style="color:var(--success)">${fmt(p.total_amount)}</b></td>
                    <td><small>${(p.items || []).length} article(s)</small></td>
                    <td><small>${p.creator ? p.creator.full_name : '—'}</small></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      area.innerHTML = '<div class="card" style="color:var(--danger)">Erreur de chargement des achats.</div>';
    }
  },

  // ===== 4. ONGLET JOURNAL DES MOUVEMENTS =====
  async renderMovementsTab(area) {
    area.innerHTML = '<div class="spinner"></div>';
    try {
      const res = await API.get('/stock/movements');
      const movements = res.data || [];
      const typeLabels = {
        in_purchase: '📦 Entrée (Achat)',
        out_maintenance: '🔧 Sortie (Maintenance)',
        out_worksite: '🏗️ Sortie (Chantier)',
        return_maintenance: '↩️ Retour (Surplus)',
        return_worksite: '↩️ Retour (Chantier)',
        transfer_out: '📤 Transfert Sortant',
        transfer_in: '📥 Transfert Entrant',
        adjustment_in: '➕ Ajustement (+)',
        adjustment_out: '➖ Ajustement (-)',
      };

      area.innerHTML = `
        <div class="card">
          <h3 style="font-size:16px;font-weight:700;margin-bottom:14px">📜 Journal Immuable des Mouvements & Transferts</h3>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Article</th>
                  <th>Type de Mouvement</th>
                  <th>Quantité</th>
                  <th>Stock Avant</th>
                  <th>Stock Après</th>
                  <th>Coût Total</th>
                  <th>Motif / Dépôt</th>
                  <th>Auteur</th>
                </tr>
              </thead>
              <tbody>
                ${!movements.length ? '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-muted)">Aucun mouvement enregistré.</td></tr>' : movements.map((m) => `
                  <tr>
                    <td><small>${new Date(m.created_at).toLocaleString('fr-FR')}</small></td>
                    <td><b>${m.stockItem ? m.stockItem.name : '—'}</b> (${m.stockItem ? m.stockItem.item_code : ''})</td>
                    <td><span class="badge ${m.movement_type.includes('transfer') ? 'badge-warning' : 'badge-info'}">${typeLabels[m.movement_type] || m.movement_type}</span></td>
                    <td><b>${m.movement_type.startsWith('out') || m.movement_type === 'transfer_out' ? '-' : '+'}${m.quantity} ${m.stockItem ? m.stockItem.unit : ''}</b></td>
                    <td><small>${m.stock_before}</small></td>
                    <td><b>${m.stock_after}</b></td>
                    <td><small>${Number(m.total_cost || 0).toLocaleString('fr-FR')} FCFA</small></td>
                    <td><small>${m.notes || '—'}</small></td>
                    <td><small>${m.author ? m.author.full_name : '—'}</small></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      area.innerHTML = '<div class="card" style="color:var(--danger)">Erreur de chargement du journal.</div>';
    }
  },

  // ===== 5. ONGLET SYNTHÈSE & VALEUR FINANCIÈRE =====
  async renderSummaryTab(area) {
    area.innerHTML = '<div class="spinner"></div>';
    try {
      const res = await API.get('/stock/summary');
      const s = res.data;
      const fmt = (n) => Number(n || 0).toLocaleString('fr-FR') + ' FCFA';

      area.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px">
          <div class="card stat-card">
            <div class="stat-icon primary">📦</div>
            <div class="stat-info">
              <div class="stat-value">${s.total_articles}</div>
              <div class="stat-name">Articles Référencés</div>
            </div>
          </div>

          <div class="card stat-card">
            <div class="stat-icon success">💰</div>
            <div class="stat-info">
              <div class="stat-value">${fmt(s.total_stock_value)}</div>
              <div class="stat-name">Valeur Totale du Stock (PUMP)</div>
            </div>
          </div>

          <div class="card stat-card">
            <div class="stat-icon warning">⚠️</div>
            <div class="stat-info">
              <div class="stat-value">${s.low_stock_count}</div>
              <div class="stat-name">Articles en Stock Faible</div>
            </div>
          </div>

          <div class="card stat-card">
            <div class="stat-icon danger">🚫</div>
            <div class="stat-info">
              <div class="stat-value">${s.out_of_stock_count}</div>
              <div class="stat-name">Articles en Rupture Totale</div>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 style="font-size:16px;font-weight:700;margin-bottom:14px">📊 Valorisation par Catégorie de Matériaux</h3>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>Nombre d'Articles</th>
                  <th>Valeur Financière</th>
                  <th>% du Stock Global</th>
                </tr>
              </thead>
              <tbody>
                ${(s.by_category || []).map((c) => {
                  const pct = s.total_stock_value > 0 ? Math.round((c.total_value / s.total_stock_value) * 100) : 0;
                  return `
                    <tr>
                      <td><b>${c.category}</b></td>
                      <td>${c.count} article(s)</td>
                      <td><b style="color:var(--primary)">${fmt(c.total_value)}</b></td>
                      <td>
                        <div style="display:flex;align-items:center;gap:8px">
                          <div style="flex:1;background:var(--border);height:8px;border-radius:4px;overflow:hidden">
                            <div style="background:var(--primary);width:${pct}%;height:100%"></div>
                          </div>
                          <span>${pct}%</span>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      area.innerHTML = '<div class="card" style="color:var(--danger)">Erreur de calcul de la synthèse.</div>';
    }
  },

  // ===== MODAL CRÉATION / ÉDITION ARTICLE =====
  openCreateItemModal() {
    const whOptions = this._warehouses.map((w) => `<option value="${w.id}">${w.name} (${w.city})</option>`).join('');

    const html = `
      <form id="createItemForm" onsubmit="PageStock.submitCreateItem(event)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label class="form-label">Nom de l'article *</label>
            <input type="text" id="m_name" class="form-control" required placeholder="ex: Brouette Pro, Sac Ciment 50kg, Tuyau PVC..." />
          </div>
          <div>
            <label class="form-label">Type d'article *</label>
            <select id="m_item_type" class="form-control" required>
              <option value="consumable">📦 Consommable (matériaux consommés)</option>
              <option value="tool_equipment">🛠️ Outil / Équipement (réutilisable / prêté)</option>
            </select>
          </div>
          <div>
            <label class="form-label">Entrepôt de rattachement *</label>
            <select id="m_warehouse_id" class="form-control" required>
              ${whOptions}
            </select>
          </div>
          <div>
            <label class="form-label">Catégorie *</label>
            <select id="m_category" class="form-control" required>
              <option value="Maçonnerie & Gros œuvre">Maçonnerie & Gros œuvre</option>
              <option value="Plomberie">Plomberie</option>
              <option value="Électricité">Électricité</option>
              <option value="Peinture & Enduit">Peinture & Enduit</option>
              <option value="Quincaillerie & Visserie">Quincaillerie & Visserie</option>
              <option value="Menuiserie & Bois">Menuiserie & Bois</option>
              <option value="Carrelage & Revêtement">Carrelage & Revêtement</option>
              <option value="Étanchéité & Toiture">Étanchéité & Toiture</option>
              <option value="Sanitaire & Robinetterie">Sanitaire & Robinetterie</option>
              <option value="Outillage consommable">Outillage consommable</option>
            </select>
          </div>
          <div>
            <label class="form-label">Unité de mesure *</label>
            <input type="text" id="m_unit" class="form-control" required placeholder="pièce, sac, mètre, kg, litre..." value="pièce" />
          </div>
          <div>
            <label class="form-label">Seuil d'alerte minimum</label>
            <input type="number" id="m_min_alert" class="form-control" value="5" min="0" />
          </div>
          <div>
            <label class="form-label">Emplacement précis</label>
            <input type="text" id="m_location" class="form-control" placeholder="Allée 2, Bac 14..." />
          </div>
          <div>
            <label class="form-label">Code article (laisser vide pour auto)</label>
            <input type="text" id="m_code" class="form-control" placeholder="Génération automatique si vide" />
          </div>
          <div style="grid-column:1/-1">
            <label class="form-label">Photo / Image de l'article (Optionnel)</label>
            <input type="file" id="m_photo" class="form-control" accept="image/*" />
          </div>
        </div>
        <div style="margin-top:12px">
          <label class="form-label">Description / Détails techniques</label>
          <textarea id="m_desc" class="form-control" rows="2" placeholder="Spécifications, marque, référence constructeur..."></textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Annuler</button>
          <button type="submit" class="btn btn-primary">Enregistrer l'Article</button>
        </div>
      </form>
    `;
    Modal.open({ title: '📦 Nouvel Article de Stock', content: html, size: 'medium' });
  },

  async submitCreateItem(e) {
    e.preventDefault();
    const data = {
      name: document.getElementById('m_name').value,
      item_type: document.getElementById('m_item_type').value,
      warehouse_id: parseInt(document.getElementById('m_warehouse_id').value, 10),
      category: document.getElementById('m_category').value,
      unit: document.getElementById('m_unit').value,
      min_alert_threshold: parseFloat(document.getElementById('m_min_alert').value) || 5,
      location: document.getElementById('m_location').value || null,
      item_code: document.getElementById('m_code').value.trim() || undefined,
      description: document.getElementById('m_desc').value || null,
    };

    try {
      const photoFile = document.getElementById('m_photo')?.files[0];
      if (photoFile) {
        const fd = new FormData();
        Object.entries(data).forEach(([k, v]) => {
          if (v !== undefined && v !== null) fd.append(k, v);
        });
        fd.append('photo', photoFile);
        await API.upload('/stock/items', fd, 'POST');
      } else {
        await API.post('/stock/items', data);
      }
      Toast.success('Article créé avec succès');
      Modal.close();
      this.loadCurrentTab();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de la création');
    }
  },

  async openEditItemModal(id) {
    const item = this._items.find((it) => it.id === id);
    if (!item) return;

    const whOptions = this._warehouses.map((w) =>
      `<option value="${w.id}" ${item.warehouse_id === w.id ? 'selected' : ''}>${w.name} (${w.city})</option>`
    ).join('');

    const html = `
      <form id="editItemForm" onsubmit="PageStock.submitEditItem(event, ${item.id})">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label class="form-label">Nom de l'article *</label>
            <input type="text" id="ed_name" class="form-control" required value="${item.name}" />
          </div>
          <div>
            <label class="form-label">Type d'article *</label>
            <select id="ed_item_type" class="form-control" required>
              <option value="consumable" ${item.item_type === 'consumable' ? 'selected' : ''}>📦 Consommable (matériaux consommés)</option>
              <option value="tool_equipment" ${item.item_type === 'tool_equipment' ? 'selected' : ''}>🛠️ Outil / Équipement (réutilisable / prêté)</option>
            </select>
          </div>
          <div>
            <label class="form-label">Entrepôt de rattachement *</label>
            <select id="ed_warehouse_id" class="form-control" required>
              ${whOptions}
            </select>
          </div>
          <div>
            <label class="form-label">Catégorie *</label>
            <select id="ed_category" class="form-control" required>
              <option value="${item.category}" selected>${item.category}</option>
              <option value="Maçonnerie & Gros œuvre">Maçonnerie & Gros œuvre</option>
              <option value="Plomberie">Plomberie</option>
              <option value="Électricité">Électricité</option>
              <option value="Peinture & Enduit">Peinture & Enduit</option>
              <option value="Quincaillerie & Visserie">Quincaillerie & Visserie</option>
              <option value="Menuiserie & Bois">Menuiserie & Bois</option>
              <option value="Carrelage & Revêtement">Carrelage & Revêtement</option>
              <option value="Étanchéité & Toiture">Étanchéité & Toiture</option>
              <option value="Sanitaire & Robinetterie">Sanitaire & Robinetterie</option>
              <option value="Outillage consommable">Outillage consommable</option>
            </select>
          </div>
          <div>
            <label class="form-label">Unité de mesure</label>
            <input type="text" id="ed_unit" class="form-control" required value="${item.unit}" />
          </div>
          <div>
            <label class="form-label">Seuil d'alerte minimum</label>
            <input type="number" id="ed_min_alert" class="form-control" value="${item.min_alert_threshold}" min="0" />
          </div>
          <div>
            <label class="form-label">Emplacement précis</label>
            <input type="text" id="ed_location" class="form-control" value="${item.location || ''}" />
          </div>
          <div>
            <label class="form-label">Code article</label>
            <input type="text" id="ed_code" class="form-control" value="${item.item_code}" readonly />
          </div>
          <div style="grid-column:1/-1">
            <label class="form-label">Photo de l'article</label>
            ${item.photo ? `
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
                <img src="${Helpers.fileUrl(item.photo)}" alt="${item.name}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;border:1px solid var(--border)" />
                <span style="font-size:12px;color:var(--text-muted)">Photo actuelle (sélectionnez un nouveau fichier pour remplacer)</span>
              </div>
            ` : ''}
            <input type="file" id="ed_photo" class="form-control" accept="image/*" />
          </div>
        </div>
        <div style="margin-top:12px">
          <label class="form-label">Description / Détails techniques</label>
          <textarea id="ed_desc" class="form-control" rows="2">${item.description || ''}</textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Annuler</button>
          <button type="submit" class="btn btn-primary">Mettre à jour</button>
        </div>
      </form>
    `;

    Modal.open({ title: `✏️ Modifier l'Article — ${item.name}`, content: html, size: 'medium' });
  },

  async submitEditItem(e, id) {
    e.preventDefault();
    const data = {
      name: document.getElementById('ed_name').value,
      item_type: document.getElementById('ed_item_type').value,
      warehouse_id: parseInt(document.getElementById('ed_warehouse_id').value, 10),
      category: document.getElementById('ed_category').value,
      unit: document.getElementById('ed_unit').value,
      min_alert_threshold: parseFloat(document.getElementById('ed_min_alert').value) || 0,
      location: document.getElementById('ed_location').value || null,
      description: document.getElementById('ed_desc').value || null,
    };

    try {
      const photoFile = document.getElementById('ed_photo')?.files[0];
      if (photoFile) {
        const fd = new FormData();
        Object.entries(data).forEach(([k, v]) => {
          if (v !== undefined && v !== null) fd.append(k, v);
        });
        fd.append('photo', photoFile);
        await API.upload(`/stock/items/${id}`, fd, 'PUT');
      } else {
        await API.put(`/stock/items/${id}`, data);
      }
      Toast.success('Article mis à jour avec succès');
      Modal.close();
      this.loadCurrentTab();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de la mise à jour');
    }
  },

  // ===== MODAL CRÉATION / ÉDITION ENTREPÔT =====
  async openWarehouseModal(warehouseId = null) {
    let w = null;
    if (warehouseId) {
      w = this._warehouses.find((item) => item.id === warehouseId);
    }

    const mgrOptions = '<option value="">Aucun responsable désigné</option>' +
      this._users.map((u) =>
        `<option value="${u.id}" ${w && w.manager?.id === u.id ? 'selected' : ''}>${u.full_name} (${u.role?.name || 'Collaborateur'})</option>`
      ).join('');

    const propOptions = '<option value="">— Entrepôt central indépendant (Aucun immeuble) —</option>' +
      (this._properties || []).map((p) =>
        `<option value="${p.id}" ${w && (w.property_id === p.id || w.property?.id === p.id) ? 'selected' : ''}>🏢 ${p.property_name} (${p.city})</option>`
      ).join('');

    const html = `
      <form id="warehouseForm" onsubmit="PageStock.submitWarehouse(event, ${warehouseId || 'null'})">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div style="grid-column:1/-1">
            <label class="form-label">Nom de l'Entrepôt *</label>
            <input type="text" id="wh_name" class="form-control" required placeholder="ex: Entrepôt Central Bastos, Dépôt Matériaux Akwa..." value="${w ? w.name : ''}" />
          </div>
          <div style="grid-column:1/-1">
            <label class="form-label">Immeuble rattaché (Optionnel)</label>
            <select id="wh_property" class="form-control">
              ${propOptions}
            </select>
          </div>
          <div>
            <label class="form-label">Ville *</label>
            <input type="text" id="wh_city" class="form-control" required placeholder="ex: Yaoundé, Douala, Kribi, Bafoussam..." value="${w ? w.city : 'Yaoundé'}" />
          </div>
          <div>
            <label class="form-label">Vocation / Type d'Entrepôt *</label>
            <select id="wh_type" class="form-control" required>
              <option value="stocks" ${w && w.warehouse_type === 'stocks' ? 'selected' : ''}>📦 Stocks & Matériaux (Consommables, plomberie, ciment...)</option>
              <option value="equipment" ${w && w.warehouse_type === 'equipment' ? 'selected' : ''}>🛠️ Équipements de chantier (Bétonnières, échafaudages, outillage...)</option>
              <option value="mixed" ${!w || w.warehouse_type === 'mixed' ? 'selected' : ''}>🔄 Mixte (Stocks de matériaux & Équipements combinés)</option>
            </select>
          </div>
          <div>
            <label class="form-label">Numéro de téléphone / Contact</label>
            <input type="text" id="wh_phone" class="form-control" placeholder="+237 6XX XX XX XX" value="${w ? (w.phone || '') : ''}" />
          </div>
          <div>
            <label class="form-label">Responsable Délégué de l'Entrepôt</label>
            <select id="wh_manager" class="form-control">
              ${mgrOptions}
            </select>
          </div>
          <div style="grid-column:1/-1">
            <label class="form-label">Adresse / Localisation précise</label>
            <input type="text" id="wh_address" class="form-control" placeholder="Quartier, rue, repère..." value="${w ? (w.address || '') : ''}" />
          </div>
          <div style="grid-column:1/-1">
            <label class="form-label">Description / Détails de stockage & consignes</label>
            <textarea id="wh_desc" class="form-control" rows="2" placeholder="Précisez les types de matériels entreposés, accès chantier...">${w ? (w.description || '') : ''}</textarea>
          </div>
          ${w ? `
            <div style="grid-column:1/-1;margin-top:6px">
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
                <input type="checkbox" id="wh_active" ${w.is_active ? 'checked' : ''} />
                Entrepôt actif et opérationnel
              </label>
            </div>
          ` : ''}
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Annuler</button>
          <button type="submit" class="btn btn-primary">${w ? 'Enregistrer les Modifications' : 'Créer l\'Entrepôt'}</button>
        </div>
      </form>
    `;

    Modal.open({
      title: w ? `🏢 Modifier l'Entrepôt — ${w.name}` : '🏢 Nouvel Entrepôt Logistique',
      content: html,
      size: 'medium',
    });
  },

  async submitWarehouse(e, warehouseId) {
    e.preventDefault();
    const data = {
      name: document.getElementById('wh_name').value,
      city: document.getElementById('wh_city').value,
      warehouse_type: document.getElementById('wh_type').value,
      property_id: document.getElementById('wh_property').value ? parseInt(document.getElementById('wh_property').value, 10) : null,
      description: document.getElementById('wh_desc').value || null,
      phone: document.getElementById('wh_phone').value || null,
      address: document.getElementById('wh_address').value || null,
      manager_id: document.getElementById('wh_manager').value ? parseInt(document.getElementById('wh_manager').value, 10) : null,
    };

    const activeEl = document.getElementById('wh_active');
    if (activeEl) data.is_active = activeEl.checked;

    try {
      if (warehouseId) {
        await API.put(`/warehouses/${warehouseId}`, data);
        Toast.success('Entrepôt mis à jour avec succès');
      } else {
        await API.post('/warehouses', data);
        Toast.success('Entrepôt créé avec succès ✅');
      }
      Modal.close();
      await this.loadWarehouses();
      this.loadCurrentTab();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de l\'enregistrement');
    }
  },

  // ===== MODAL TRANSFERT INTER-MAGASINS =====
  openTransferModal(preselectedItemId = null) {
    const itemsOptions = this._items.map((it) => {
      const avail = Math.max(0, parseFloat(it.quantity || 0) - parseFloat(it.quantity_loaned || 0));
      const wh = it.warehouse ? `${it.warehouse.name} (${it.warehouse.city})` : 'Dépôt principal';
      return `<option value="${it.id}" ${preselectedItemId === it.id ? 'selected' : ''}>
        ${it.name} [${it.item_code}] — Dépôt Source: ${wh} (Dispo: ${avail} ${it.unit})
      </option>`;
    }).join('');

    const targetWhOptions = this._warehouses.map((w) =>
      `<option value="${w.id}">${w.name} (${w.city})</option>`
    ).join('');

    const html = `
      <form id="transferStockForm" onsubmit="PageStock.submitTransfer(event)">
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px">
          Transférez des matériaux ou des équipements réutilisables d'un magasin vers un autre dépôt situé dans la même ville ou une autre ville (ex: de Yaoundé vers Douala).
        </p>

        <div style="margin-bottom:12px">
          <label class="form-label">Article à transférer *</label>
          <select id="tr_item" class="form-control" required onchange="PageStock.onTransferItemChange()">
            <option value="">Sélectionner un article...</option>
            ${itemsOptions}
          </select>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <label class="form-label">Magasin de Destination *</label>
            <select id="tr_target_warehouse" class="form-control" required>
              <option value="">Sélectionner le dépôt destinataire...</option>
              ${targetWhOptions}
            </select>
          </div>
          <div>
            <label class="form-label">Quantité à transférer *</label>
            <input type="number" id="tr_qty" class="form-control" required min="1" step="any" placeholder="Qté" />
          </div>
        </div>

        <div style="margin-bottom:12px">
          <label class="form-label">Motif / Bon de transfert</label>
          <input type="text" id="tr_notes" class="form-control" placeholder="ex: Réapprovisionnement chantier Douala, Bon n° BT-2026-004..." />
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Annuler</button>
          <button type="submit" class="btn btn-primary">Valider le Transfert Inter-Magasins</button>
        </div>
      </form>
    `;

    Modal.open({ title: '🔄 Transfert de Stock Inter-Magasins', content: html, size: 'medium' });
  },

  onTransferItemChange() {
    const itemId = parseInt(document.getElementById('tr_item').value, 10);
    const item = this._items.find((it) => it.id === itemId);
    if (item) {
      const avail = Math.max(0, parseFloat(item.quantity || 0) - parseFloat(item.quantity_loaned || 0));
      const qtyInput = document.getElementById('tr_qty');
      if (qtyInput) {
        qtyInput.max = avail;
        qtyInput.placeholder = `Max: ${avail} ${item.unit}`;
      }
    }
  },

  async submitTransfer(e) {
    e.preventDefault();
    const stock_item_id = parseInt(document.getElementById('tr_item').value, 10);
    const target_warehouse_id = parseInt(document.getElementById('tr_target_warehouse').value, 10);
    const quantity = parseFloat(document.getElementById('tr_qty').value);
    const notes = document.getElementById('tr_notes').value;

    if (!stock_item_id || !target_warehouse_id || quantity <= 0) {
      Toast.error('Veuillez renseigner tous les champs obligatoires');
      return;
    }

    try {
      await API.post('/stock/transfer', {
        stock_item_id,
        target_warehouse_id,
        quantity,
        notes,
      });
      Toast.success('Transfert de stock effectué avec succès ✅');
      Modal.close();
      this.loadCurrentTab();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors du transfert');
    }
  },

  // ===== MODAL ACHAT / RÉCEPTION DE STOCK =====
  openPurchaseModal() {
    const itemsOptions = this._items.map((it) => {
      const wh = it.warehouse ? ` [${it.warehouse.name}]` : '';
      return `<option value="${it.id}">${it.name}${wh} (${it.unit})</option>`;
    }).join('');

    const html = `
      <form id="purchaseForm" onsubmit="PageStock.submitPurchase(event)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div>
            <label class="form-label">Origine / Lieu d'achat (Optionnel)</label>
            <input type="text" id="p_origin" class="form-control" placeholder="ex: Quincaillerie Centrale, Marché, Achat direct..." />
          </div>
          <div>
            <label class="form-label">Date d'achat / réception *</label>
            <input type="date" id="p_date" class="form-control" required value="${new Date().toISOString().slice(0, 10)}" />
          </div>
          <div>
            <label class="form-label">N° Facture / Bon de livraison</label>
            <input type="text" id="p_invoice_num" class="form-control" placeholder="ex: FAC-2026-088" />
          </div>
          <div>
            <label class="form-label">Notes / Observations</label>
            <input type="text" id="p_notes" class="form-control" placeholder="ex: Approvisionnement chantier..." />
          </div>
        </div>

        <h4 style="font-size:14px;font-weight:700;margin:16px 0 8px;border-top:1px solid var(--border);padding-top:12px">
          📦 Articles Réceptionnés
        </h4>

        <div id="purchaseLinesContainer">
          <div class="purchase-line" style="display:grid;grid-template-columns:2fr 1fr 1.2fr auto;gap:8px;margin-bottom:8px;align-items:center">
            <select class="form-control p_item_select" required>
              <option value="">Choisir un article...</option>
              ${itemsOptions}
            </select>
            <input type="number" class="form-control p_item_qty" placeholder="Qté" required min="1" step="any" />
            <input type="number" class="form-control p_item_price" placeholder="Prix Unit. (FCFA)" required min="0" />
            <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">✕</button>
          </div>
        </div>

        <button type="button" class="btn btn-sm btn-outline" style="margin-top:6px" onclick="PageStock.addPurchaseLine()">
          ➕ Ajouter une autre ligne
        </button>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Annuler</button>
          <button type="submit" class="btn btn-primary">Valider la Réception & Mettre à Jour le Stock</button>
        </div>
      </form>
    `;

    Modal.open({ title: '🛒 Enregistrer un Achat / Réception de Stock', content: html, size: 'large' });
  },

  addPurchaseLine() {
    const itemsOptions = this._items.map((it) => {
      const wh = it.warehouse ? ` [${it.warehouse.name}]` : '';
      return `<option value="${it.id}">${it.name}${wh} (${it.unit})</option>`;
    }).join('');

    const div = document.createElement('div');
    div.className = 'purchase-line';
    div.style = 'display:grid;grid-template-columns:2fr 1fr 1.2fr auto;gap:8px;margin-bottom:8px;align-items:center';
    div.innerHTML = `
      <select class="form-control p_item_select" required>
        <option value="">Choisir un article...</option>
        ${itemsOptions}
      </select>
      <input type="number" class="form-control p_item_qty" placeholder="Qté" required min="1" step="any" />
      <input type="number" class="form-control p_item_price" placeholder="Prix Unit. (FCFA)" required min="0" />
      <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">✕</button>
    `;
    document.getElementById('purchaseLinesContainer').appendChild(div);
  },

  async submitPurchase(e) {
    e.preventDefault();
    const lines = document.querySelectorAll('.purchase-line');
    const items = [];
    lines.forEach((line) => {
      const stock_item_id = line.querySelector('.p_item_select').value;
      const quantity = parseFloat(line.querySelector('.p_item_qty').value);
      const unit_price = parseFloat(line.querySelector('.p_item_price').value);
      if (stock_item_id && quantity > 0) {
        items.push({ stock_item_id: parseInt(stock_item_id, 10), quantity, unit_price });
      }
    });

    if (!items.length) {
      Toast.error('Veuillez ajouter au moins un article valide');
      return;
    }

    const origin = (document.getElementById('p_origin')?.value || '').trim();
    const rawNotes = (document.getElementById('p_notes')?.value || '').trim();
    const finalNotes = [origin ? `Origine: ${origin}` : '', rawNotes].filter(Boolean).join(' — ') || null;

    const payload = {
      supplier_id: null,
      purchase_date: document.getElementById('p_date').value,
      invoice_number: document.getElementById('p_invoice_num').value || null,
      notes: finalNotes,
      items,
    };

    try {
      await API.post('/stock/purchases', payload);
      Toast.success('Achat réceptionné et stock mis à jour avec succès ✅');
      Modal.close();
      this.loadCurrentTab();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de la réception');
    }
  },
};

window.PageStock = PageStock;
