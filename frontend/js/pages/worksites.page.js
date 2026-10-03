// ============ Page Chantiers Internes & Externes — SMG IMMOBILIER ============
const PageWorksites = {
  register() {
    Router.register('worksites', () => this.render());
  },

  _worksites: [],
  _properties: [],
  _stockItems: [],
  _warehouses: [],
  _currentLoans: [],

  async render() {
    Layout.setTitle('Chantiers & Travaux');
    const appContent = document.getElementById('appContent');
    const canManage = Auth.hasRole('manager', 'dir_technique');

    appContent.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h2 style="font-size:18px;font-weight:700;color:var(--text)">🏗️ Suivi des Chantiers & Rénovations</h2>
            <p style="font-size:13px;color:var(--text-muted);margin-top:2px">Gestion des chantiers internes (immeubles gérés) et prestations externes (clients tiers), budgets, matériels prêtés, consommables et jalons.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${canManage ? `
              <button class="btn btn-primary" onclick="PageWorksites.openCreateModal()"><span class="btn-icon">➕</span> Nouveau Chantier</button>
            ` : ''}
            <button class="btn btn-outline" onclick="PageWorksites.load()"><span class="btn-icon">🔄</span> Actualiser</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-top:16px">
          <select id="wsTypeFilter" class="form-control" onchange="PageWorksites.load()">
            <option value="">Tous les types (Internes & Externes)</option>
            <option value="interne">Chantiers Internes (Patrimoine SMG)</option>
            <option value="externe">Chantiers Externes (Clients tiers)</option>
          </select>
          <select id="wsStatusFilter" class="form-control" onchange="PageWorksites.load()">
            <option value="">Tous les statuts</option>
            <option value="in_progress">En cours</option>
            <option value="planned">Planifié</option>
            <option value="on_hold">En pause</option>
            <option value="completed">Terminé</option>
          </select>
          <input type="text" id="wsSearch" class="form-control" placeholder="Rechercher par titre, client, lieu..." oninput="PageWorksites.filterTable()" />
        </div>
      </div>

      <!-- KPI Synthèse -->
      <div id="wsKpiArea" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px">
        <div class="card stat-card"><div class="spinner"></div></div>
      </div>

      <!-- Barre d'actions groupées -->
      <div id="wsBulkBar" style="display:none;background:#fef2f2;border:1px solid #fca5a5;padding:10px 16px;border-radius:8px;margin-bottom:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div style="font-weight:600;color:#991b1b;font-size:13px">
          <span id="wsBulkCount">0</span> chantier(s) sélectionné(s)
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-danger" onclick="PageWorksites.bulkDelete()">🗑️ Supprimer la sélection</button>
          <button class="btn btn-sm btn-outline" onclick="PageWorksites.onSelectAll(false)">❌ Désélectionner</button>
        </div>
      </div>

      <!-- Table des chantiers -->
      <div class="card">
        <div class="table-responsive">
          <table class="table" id="worksitesTable">
            <thead>
              <tr>
                <th style="width:38px;text-align:center">
                  <input type="checkbox" id="wsSelectAll" onchange="PageWorksites.onSelectAll(this.checked)" title="Tout sélectionner" />
                </th>
                <th>Chantier</th>
                <th>Type</th>
                <th>Lieu / Client</th>
                <th>Budget Alloué</th>
                <th>Total Dépensé</th>
                <th>Progression</th>
                <th>Statut</th>
                <th>Responsable</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody id="worksitesTableBody">
              <tr><td colspan="10" style="text-align:center;padding:30px"><div class="spinner"></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await this.loadPropertiesAndStock();
    await this.load();
  },

  async loadPropertiesAndStock() {
    try {
      const [resP, resS, resW] = await Promise.all([
        API.get('/properties'),
        API.get('/stock/items'),
        API.get('/warehouses'),
      ]);
      this._properties = resP.data || [];
      this._stockItems = resS.data || [];
      this._warehouses = resW.data || [];
    } catch (_) {}
  },

  async load() {
    const type = document.getElementById('wsTypeFilter')?.value || '';
    const status = document.getElementById('wsStatusFilter')?.value || '';

    let url = '/worksites?';
    if (type) url += `worksite_type=${type}&`;
    if (status) url += `status=${status}&`;

    try {
      const res = await API.get(url);
      this._worksites = res.data || [];
      this.renderKpi(this._worksites);
      this.renderTable(this._worksites);
    } catch (err) {
      document.getElementById('worksitesTableBody').innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--danger)">Erreur de chargement des chantiers.</td></tr>';
    }
  },

  renderKpi(list) {
    const totalBudget = list.reduce((s, w) => s + (parseFloat(w.budget) || 0), 0);
    const totalSpent = list.reduce((s, w) => s + (parseFloat(w.spent_amount) || 0), 0);
    const avgProgress = list.length ? Math.round(list.reduce((s, w) => s + (w.progress_percent || 0), 0) / list.length) : 0;
    const activeCount = list.filter((w) => w.status === 'in_progress').length;

    const fmt = (n) => Number(n || 0).toLocaleString('fr-FR') + ' FCFA';

    document.getElementById('wsKpiArea').innerHTML = `
      <div class="card stat-card">
        <div class="stat-icon primary">🏗️</div>
        <div class="stat-info">
          <div class="stat-value">${list.length} (${activeCount} en cours)</div>
          <div class="stat-name">Total Chantiers</div>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-icon info">💰</div>
        <div class="stat-info">
          <div class="stat-value">${fmt(totalBudget)}</div>
          <div class="stat-name">Enveloppe Budgétaire Globale</div>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-icon ${totalSpent > totalBudget ? 'danger' : 'success'}">📊</div>
        <div class="stat-info">
          <div class="stat-value">${fmt(totalSpent)}</div>
          <div class="stat-name">Total Dépensé (Engagé)</div>
        </div>
      </div>

      <div class="card stat-card">
        <div class="stat-icon warning">📈</div>
        <div class="stat-info">
          <div class="stat-value">${avgProgress}%</div>
          <div class="stat-name">Avancement Moyen</div>
        </div>
      </div>
    `;
  },

  renderTable(list) {
    const tbody = document.getElementById('worksitesTableBody');
    if (!tbody) return;

    const canManage = Auth.hasRole('super_admin', 'manager', 'dir_technique');

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--text-muted)">Aucun chantier correspondant.</td></tr>';
      return;
    }

    const fmt = (n) => Number(n || 0).toLocaleString('fr-FR') + ' FCFA';
    const statusBadges = {
      planned: '<span class="badge badge-secondary">Planifié</span>',
      in_progress: '<span class="badge badge-primary">En cours</span>',
      on_hold: '<span class="badge badge-warning">En pause</span>',
      completed: '<span class="badge badge-success">Terminé</span>',
      cancelled: '<span class="badge badge-danger">Annulé</span>',
    };

    tbody.innerHTML = list.map((w) => {
      const isInternal = w.worksite_type === 'interne';
      const context = isInternal
        ? (w.property ? `🏢 ${w.property.property_name}` : 'Interne')
        : (w.client_name ? `👤 ${w.client_name}` : 'Externe');
      const safeTitle = (w.title || '').replace(/'/g, "\\'");

      return `
        <tr>
          <td style="text-align:center">
            <input type="checkbox" class="ws-row-chk" value="${w.id}" onchange="PageWorksites.onRowCheck()" />
          </td>
          <td>
            <strong style="color:var(--primary);font-size:14px">${w.title}</strong>
            <br><small style="color:var(--text-muted)">Début: ${w.start_date ? new Date(w.start_date).toLocaleDateString('fr-FR') : '—'}</small>
          </td>
          <td>
            <span class="badge badge-${isInternal ? 'info' : 'warning'}">
              ${isInternal ? 'Interne (SMG)' : 'Externe (Tiers)'}
            </span>
          </td>
          <td><small>${context}</small><br><small style="color:var(--text-muted)">📍 ${w.location || '—'}</small></td>
          <td><b>${fmt(w.budget)}</b></td>
          <td><b style="color:${parseFloat(w.spent_amount) > parseFloat(w.budget) ? 'var(--danger)' : 'var(--text)'}">${fmt(w.spent_amount)}</b></td>
          <td>
            <div style="display:flex;align-items:center;gap:6px;width:120px">
              <div style="flex:1;background:var(--border);height:6px;border-radius:3px;overflow:hidden">
                <div style="background:var(--success);width:${w.progress_percent || 0}%;height:100%"></div>
              </div>
              <small><b>${w.progress_percent || 0}%</b></small>
            </div>
          </td>
          <td>${statusBadges[w.status] || w.status}</td>
          <td><small>${w.manager ? w.manager.full_name : '—'}</small></td>
          <td style="text-align:right;white-space:nowrap">
            <button class="btn btn-sm btn-outline" onclick="PageWorksites.openDetailModal(${w.id})" title="Détail & Suivi">👁️ Détail</button>
            <button class="btn btn-sm btn-success" onclick="PageWorksites.downloadPdf(${w.id})" title="Rapport PDF">📄 PDF</button>
            ${canManage ? `
              <button class="btn btn-sm btn-outline" onclick="PageWorksites.openEditModal(${w.id})" title="Modifier">✏️</button>
              <button class="btn btn-sm btn-outline" style="color:var(--danger);border-color:var(--danger)" onclick="PageWorksites.deleteWorksite(${w.id}, '${safeTitle}')" title="Supprimer définitivement">🗑️</button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  onSelectAll(checked) {
    const chks = document.querySelectorAll('.ws-row-chk');
    chks.forEach((c) => { c.checked = checked; });
    const allBox = document.getElementById('wsSelectAll');
    if (allBox) allBox.checked = checked;
    this.onRowCheck();
  },

  onRowCheck() {
    const chks = Array.from(document.querySelectorAll('.ws-row-chk:checked'));
    const bar = document.getElementById('wsBulkBar');
    const countEl = document.getElementById('wsBulkCount');
    if (bar && countEl) {
      countEl.textContent = chks.length;
      bar.style.display = chks.length > 0 ? 'flex' : 'none';
    }
  },

  getSelectedIds() {
    return Array.from(document.querySelectorAll('.ws-row-chk:checked')).map((c) => parseInt(c.value, 10)).filter(Boolean);
  },

  async bulkDelete() {
    const ids = this.getSelectedIds();
    if (!ids.length) return;
    if (!confirm(`Voulez-vous vraiment supprimer définitivement les ${ids.length} chantier(s) sélectionné(s) ?`)) return;
    try {
      await API.post('/worksites/bulk-delete', { ids });
      Toast.success(`${ids.length} chantier(s) supprimé(s) avec succès`);
      this.load();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de la suppression groupée');
    }
  },

  async deleteWorksite(id, title) {
    if (!Auth.hasRole('manager', 'super_admin', 'dir_technique')) {
      Toast.error('Permissions insuffisantes pour supprimer un chantier.');
      return;
    }
    if (!confirm(`Voulez-vous vraiment supprimer définitivement le chantier « ${title || ''} » ?`)) return;
    try {
      await API.delete(`/worksites/${id}`);
      Toast.success('Chantier supprimé avec succès');
      this.load();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de la suppression');
    }
  },

  async openEditModal(id) {
    const ws = this._worksites.find((w) => w.id === id);
    if (!ws) return;
    const propOptions = this._properties.map((p) => `<option value="${p.id}" ${ws.property_id === p.id ? 'selected' : ''}>${p.property_name} (${p.city || '—'})</option>`).join('');

    const html = `
      <form id="editWorksiteForm" onsubmit="PageWorksites.submitEdit(event, ${ws.id})">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label class="form-label">Titre du chantier / projet *</label>
            <input type="text" id="ws_edit_title" class="form-control" required value="${Helpers.escapeHtml(ws.title || '')}" />
          </div>
          <div>
            <label class="form-label">Statut *</label>
            <select id="ws_edit_status" class="form-control">
              <option value="planned" ${ws.status === 'planned' ? 'selected' : ''}>Planifié</option>
              <option value="in_progress" ${ws.status === 'in_progress' ? 'selected' : ''}>En cours</option>
              <option value="on_hold" ${ws.status === 'on_hold' ? 'selected' : ''}>En pause</option>
              <option value="completed" ${ws.status === 'completed' ? 'selected' : ''}>Terminé</option>
              <option value="cancelled" ${ws.status === 'cancelled' ? 'selected' : ''}>Annulé</option>
            </select>
          </div>

          <div id="ws_edit_prop_group" style="display:${ws.worksite_type === 'interne' ? 'block' : 'none'}">
            <label class="form-label">Immeuble concerné</label>
            <select id="ws_edit_property" class="form-control">
              <option value="">Sélectionner un immeuble...</option>
              ${propOptions}
            </select>
          </div>

          <div id="ws_edit_client_group" style="display:${ws.worksite_type === 'externe' ? 'block' : 'none'}">
            <label class="form-label">Nom du Client tiers</label>
            <input type="text" id="ws_edit_client_name" class="form-control" value="${Helpers.escapeHtml(ws.client_name || '')}" />
          </div>

          <div>
            <label class="form-label">Localisation / Adresse</label>
            <input type="text" id="ws_edit_location" class="form-control" value="${Helpers.escapeHtml(ws.location || '')}" />
          </div>

          <div>
            <label class="form-label">Budget prévisionnel global (FCFA) *</label>
            <input type="number" id="ws_edit_budget" class="form-control" required min="0" value="${ws.budget || 0}" />
          </div>

          <div>
            <label class="form-label">Date de début</label>
            <input type="date" id="ws_edit_start" class="form-control" value="${ws.start_date ? ws.start_date.slice(0, 10) : ''}" />
          </div>

          <div>
            <label class="form-label">Date de fin estimée</label>
            <input type="date" id="ws_edit_end_est" class="form-control" value="${ws.end_date_planned ? ws.end_date_planned.slice(0, 10) : ''}" />
          </div>

          <div>
            <label class="form-label">Progression (%)</label>
            <input type="number" id="ws_edit_progress" class="form-control" min="0" max="100" value="${ws.progress_percent || 0}" />
          </div>
        </div>

        <div style="margin-top:12px">
          <label class="form-label">Description des travaux</label>
          <textarea id="ws_edit_desc" class="form-control" rows="2">${Helpers.escapeHtml(ws.description || '')}</textarea>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Annuler</button>
          <button type="submit" class="btn btn-primary">Enregistrer les modifications</button>
        </div>
      </form>
    `;

    Modal.open({ title: `✏️ Modifier le Chantier #${ws.id}`, content: html, size: 'medium' });
  },

  async submitEdit(e, id) {
    e.preventDefault();
    const payload = {
      title: document.getElementById('ws_edit_title').value.trim(),
      status: document.getElementById('ws_edit_status').value,
      property_id: document.getElementById('ws_edit_property')?.value ? parseInt(document.getElementById('ws_edit_property').value, 10) : null,
      client_name: document.getElementById('ws_edit_client_name')?.value?.trim() || null,
      location: document.getElementById('ws_edit_location')?.value?.trim() || null,
      budget: parseFloat(document.getElementById('ws_edit_budget').value) || 0,
      start_date: document.getElementById('ws_edit_start')?.value || null,
      end_date_planned: document.getElementById('ws_edit_end_est')?.value || null,
      progress_percent: parseInt(document.getElementById('ws_edit_progress')?.value, 10) || 0,
      description: document.getElementById('ws_edit_desc')?.value?.trim() || null,
    };

    try {
      await API.put(`/worksites/${id}`, payload);
      Toast.success('Chantier mis à jour avec succès');
      Modal.close();
      this.load();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de la mise à jour du chantier');
    }
  },

  filterTable() {
    const q = (document.getElementById('wsSearch')?.value || '').toLowerCase().trim();
    if (!q) { this.renderTable(this._worksites); return; }
    const filtered = this._worksites.filter((w) => {
      return (w.title || '').toLowerCase().includes(q)
        || (w.client_name || '').toLowerCase().includes(q)
        || (w.location || '').toLowerCase().includes(q);
    });
    this.renderTable(filtered);
  },

  // ===== MODAL DÉTAIL COMPLET DU CHANTIER =====
  async openDetailModal(id) {
    try {
      const res = await API.get(`/worksites/${id}`);
      const ws = res.data;
      this._currentLoans = ws.equipmentLoans || [];
      const fmt = (n) => Number(n || 0).toLocaleString('fr-FR') + ' FCFA';
      const canManage = Auth.hasRole('manager', 'dir_technique');

      const loanStatusBadges = {
        loaned: '<span class="badge badge-warning">En service sur chantier</span>',
        partially_returned: '<span class="badge badge-info">Partiellement restitué</span>',
        returned: '<span class="badge badge-success">Restitué au dépôt</span>',
        damaged_lost: '<span class="badge badge-danger">Endommagé / Perdu</span>',
      };

      const html = `
        <div style="max-height:80vh;overflow-y:auto;padding-right:4px">
          <!-- En-tête -->
          <div style="background:var(--secondary-bg, #f0f4f8);padding:14px;border-radius:8px;margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
              <div>
                <span class="badge badge-${ws.worksite_type === 'interne' ? 'info' : 'warning'}">${ws.worksite_type === 'interne' ? 'Chantier Interne' : 'Chantier Externe'}</span>
                <h3 style="font-size:18px;font-weight:800;margin-top:4px;color:var(--primary)">${ws.title}</h3>
                <p style="font-size:12px;color:var(--text-muted);margin:0">
                  ${ws.worksite_type === 'interne' ? `Immeuble : ${ws.property ? ws.property.property_name : '—'}` : `Client : ${ws.client_name || '—'} (Tél: ${ws.client_phone || '—'})`} | Lieu : ${ws.location || '—'}
                </p>
              </div>
              <button class="btn btn-sm btn-success" onclick="PageWorksites.downloadPdf(${ws.id})">📄 Télécharger Rapport PDF</button>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:12px;font-size:12px">
              <div><span style="color:var(--text-muted)">Budget :</span> <b>${fmt(ws.budget)}</b></div>
              <div><span style="color:var(--text-muted)">Matériaux consommés :</span> <b>${fmt(ws.material_cost)}</b></div>
              <div><span style="color:var(--text-muted)">Main d'œuvre :</span> <b>${fmt(ws.labor_cost)}</b></div>
              <div><span style="color:var(--text-muted)">Total Dépensé :</span> <b style="color:var(--danger)">${fmt(ws.spent_amount)}</b></div>
              <div><span style="color:var(--text-muted)">Avancement :</span> <b style="color:var(--success)">${ws.progress_percent || 0}%</b></div>
            </div>
          </div>

          <!-- Section 1 : Jalons & Tâches -->
          <div style="margin-bottom:18px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <h4 style="font-size:14px;font-weight:700;margin:0">📋 Jalons & Tâches Techniques (${(ws.tasks || []).length})</h4>
              ${canManage ? `<button class="btn btn-sm btn-outline" onclick="PageWorksites.openAddTaskModal(${ws.id})">➕ Ajouter une tâche</button>` : ''}
            </div>
            <div class="table-responsive">
              <table class="table" style="font-size:12px">
                <thead>
                  <tr>
                    <th>Tâche</th>
                    <th>Assigné à</th>
                    <th>Échéance</th>
                    <th>Avancement</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  ${!(ws.tasks || []).length ? '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Aucun jalon enregistré.</td></tr>' : ws.tasks.map((t) => `
                    <tr>
                      <td><b>${t.title}</b></td>
                      <td>${t.assignee ? t.assignee.full_name : '—'}</td>
                      <td>${t.end_date ? new Date(t.end_date).toLocaleDateString('fr-FR') : '—'}</td>
                      <td><b>${t.progress_percent || 0}%</b></td>
                      <td><span class="badge badge-info">${t.status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Section 2 : Outils & Équipements Prêtés par les Entrepôts (Traçabilité & Restitution) -->
          <div style="margin-bottom:18px;border:1px solid rgba(243,156,18,0.3);border-radius:8px;padding:12px;background:rgba(243,156,18,0.02)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">
              <div>
                <h4 style="font-size:14px;font-weight:700;margin:0;color:#d35400">🛠️ Outils & Équipements Prêtés (${(ws.equipmentLoans || []).length})</h4>
                <p style="font-size:11px;color:var(--text-muted);margin:2px 0 0">Matériels réutilisables empruntés dans les entrepôts (brouettes, échelles, perceuses...) à restituer en fin de travaux.</p>
              </div>
              <button class="btn btn-sm btn-warning" onclick="PageWorksites.openLoanModal(${ws.id})">🛠️ Prêter un Outil de l'Entrepôt</button>
            </div>
            <div class="table-responsive">
              <table class="table" style="font-size:12px">
                <thead>
                  <tr>
                    <th>Équipement</th>
                    <th>Entrepôt Source</th>
                    <th>Qté Prêtée</th>
                    <th>Date de Prêt</th>
                    <th>Restitution Prévue</th>
                    <th>Statut</th>
                    <th>Retour & Constat</th>
                    <th style="text-align:right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${!(ws.equipmentLoans || []).length ? '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:14px">Aucun outil ou équipement actuellement prêté pour ce chantier.</td></tr>' : ws.equipmentLoans.map((l) => {
                    const isStillLoaned = l.status === 'loaned' || l.status === 'partially_returned';
                    const returnedQty = parseFloat(l.quantity_returned || 0);
                    return `
                      <tr>
                        <td>
                          <b>${l.stockItem ? l.stockItem.name : '—'}</b>
                          <br><small style="color:var(--text-muted)">${l.stockItem ? l.stockItem.item_code : ''}</small>
                        </td>
                        <td>
                          <span class="badge badge-light">🏢 ${l.sourceWarehouse ? `${l.sourceWarehouse.name} (${l.sourceWarehouse.city})` : 'Entrepôt principal'}</span>
                        </td>
                        <td><b>${l.quantity_loaned} ${l.stockItem ? l.stockItem.unit : ''}</b></td>
                        <td><small>${l.loan_date ? new Date(l.loan_date).toLocaleDateString('fr-FR') : '—'}</small></td>
                        <td><small>${l.expected_return_date ? new Date(l.expected_return_date).toLocaleDateString('fr-FR') : 'Non précisée'}</small></td>
                        <td>${loanStatusBadges[l.status] || l.status}</td>
                        <td>
                          ${l.actual_return_date ? `
                            <small><b>Restitué le:</b> ${new Date(l.actual_return_date).toLocaleDateString('fr-FR')}</small>
                            ${l.returnWarehouse ? `<br><small style="color:var(--text-muted)">À l'entrepôt: ${l.returnWarehouse.name}</small>` : ''}
                            ${l.condition_notes ? `<br><small style="color:var(--info)"><i>« ${l.condition_notes} »</i></small>` : ''}
                          ` : (returnedQty > 0 ? `<small>${returnedQty} rendu(s)</small>` : '<small style="color:var(--text-muted)">Sur chantier</small>')}
                        </td>
                        <td style="text-align:right;white-space:nowrap">
                          ${isStillLoaned ? `
                            <button class="btn btn-sm btn-success" onclick="PageWorksites.openReturnModal(${ws.id}, ${l.id})" title="Restituer cet équipement à l'entrepôt">
                              ↩️ Restituer
                            </button>
                          ` : '<span style="color:var(--success);font-size:11px">✅ Clôturé</span>'}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Section 3 : Matériaux consommés (déduits définitivement du stock) -->
          <div style="margin-bottom:18px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <div>
                <h4 style="font-size:14px;font-weight:700;margin:0">📦 Matériaux & Consommables Utilisés (${(ws.materialsUsed || []).length})</h4>
                <p style="font-size:11px;color:var(--text-muted);margin:2px 0 0">Matériaux consommés sur le chantier (ciment, sable, câbles...) déduits définitivement du stock.</p>
              </div>
              <button class="btn btn-sm btn-primary" onclick="PageWorksites.openDeclareMaterialModal(${ws.id})">📦 Consommer du Stock</button>
            </div>
            <div class="table-responsive">
              <table class="table" style="font-size:12px">
                <thead>
                  <tr>
                    <th>Article</th>
                    <th>Code</th>
                    <th>Quantité Prélevée</th>
                    <th>Coût Unitaire</th>
                    <th>Coût Total</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${!(ws.materialsUsed || []).length ? '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Aucun matériau consommé pour le moment.</td></tr>' : ws.materialsUsed.map((m) => `
                    <tr>
                      <td><b>${m.stockItem ? m.stockItem.name : '—'}</b></td>
                      <td><small>${m.stockItem ? m.stockItem.item_code : '—'}</small></td>
                      <td><b>${m.quantity_used} ${m.stockItem ? m.stockItem.unit : ''}</b></td>
                      <td>${fmt(m.unit_cost)}</td>
                      <td><b style="color:var(--danger)">${fmt(m.total_cost)}</b></td>
                      <td><small>${new Date(m.date_used).toLocaleDateString('fr-FR')}</small></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;margin-top:16px">
            <button class="btn btn-outline" onclick="Modal.close()">Fermer</button>
          </div>
        </div>
      `;

      Modal.open({ title: `🏗️ Fiche Chantier — ${ws.title}`, content: html, size: 'large' });
    } catch (err) {
      Toast.error('Impossible d\'ouvrir la fiche du chantier');
    }
  },

  // ===== MODAL CRÉATION CHANTIER =====
  openCreateModal() {
    const propOptions = this._properties.map((p) => `<option value="${p.id}">${p.property_name} (${p.city || '—'})</option>`).join('');

    const html = `
      <form id="createWorksiteForm" onsubmit="PageWorksites.submitCreate(event)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label class="form-label">Titre du chantier / projet *</label>
            <input type="text" id="ws_title" class="form-control" required placeholder="ex: Rénovation Façade, Réfection Plomberie..." />
          </div>
          <div>
            <label class="form-label">Type de chantier *</label>
            <select id="ws_type" class="form-control" onchange="PageWorksites.toggleTypeFields()" required>
              <option value="interne">Chantier Interne (Immeuble géré par SMG)</option>
              <option value="externe">Chantier Externe (Client tiers)</option>
            </select>
          </div>

          <div id="ws_prop_group">
            <label class="form-label">Immeuble concerné</label>
            <select id="ws_property" class="form-control">
              <option value="">Sélectionner un immeuble...</option>
              ${propOptions}
            </select>
          </div>

          <div id="ws_client_group" style="display:none">
            <label class="form-label">Nom du Client tiers</label>
            <input type="text" id="ws_client_name" class="form-control" placeholder="Nom du client" />
          </div>

          <div>
            <label class="form-label">Localisation / Adresse</label>
            <input type="text" id="ws_location" class="form-control" placeholder="ex: Quartier Bastos, Rue 123..." />
          </div>

          <div>
            <label class="form-label">Budget prévisionnel global (FCFA) *</label>
            <input type="number" id="ws_budget" class="form-control" required min="0" placeholder="Montant du budget" />
          </div>

          <div>
            <label class="form-label">Date de début</label>
            <input type="date" id="ws_start" class="form-control" value="${new Date().toISOString().slice(0, 10)}" />
          </div>

          <div>
            <label class="form-label">Date de fin estimée</label>
            <input type="date" id="ws_end_est" class="form-control" />
          </div>
        </div>

        <div style="margin-top:12px">
          <label class="form-label">Description des travaux</label>
          <textarea id="ws_desc" class="form-control" rows="2" placeholder="Cahier des charges des travaux à réaliser..."></textarea>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Annuler</button>
          <button type="submit" class="btn btn-primary">Créer le Chantier</button>
        </div>
      </form>
    `;

    Modal.open({ title: '🏗️ Nouveau Projet de Chantier', content: html, size: 'medium' });
  },

  toggleTypeFields() {
    const type = document.getElementById('ws_type')?.value;
    const propG = document.getElementById('ws_prop_group');
    const clientG = document.getElementById('ws_client_group');
    if (type === 'interne') {
      if (propG) propG.style.display = 'block';
      if (clientG) clientG.style.display = 'none';
    } else {
      if (propG) propG.style.display = 'none';
      if (clientG) clientG.style.display = 'block';
    }
  },

  async submitCreate(e) {
    e.preventDefault();
    const type = document.getElementById('ws_type').value;
    const data = {
      title: document.getElementById('ws_title').value,
      worksite_type: type,
      property_id: type === 'interne' && document.getElementById('ws_property').value ? parseInt(document.getElementById('ws_property').value, 10) : null,
      client_name: type === 'externe' ? document.getElementById('ws_client_name').value : null,
      location: document.getElementById('ws_location').value || null,
      budget: parseFloat(document.getElementById('ws_budget').value) || 0,
      start_date: document.getElementById('ws_start').value || null,
      end_date_estimated: document.getElementById('ws_end_est').value || null,
      description: document.getElementById('ws_desc').value || null,
    };

    try {
      await API.post('/worksites', data);
      Toast.success('Chantier créé avec succès');
      Modal.close();
      this.load();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de la création');
    }
  },

  // ===== MODAL PRÊT D'ÉQUIPEMENT / OUTIL D'ENTREPÔT =====
  openLoanModal(worksiteId) {
    // Filtrer ou prioriser les outils réutilisables
    const tools = this._stockItems.filter((it) => (it.available_quantity || it.quantity) > 0);
    const toolsOptions = tools.map((it) => {
      const avail = it.available_quantity !== undefined ? it.available_quantity : it.quantity;
      const whName = it.warehouse ? `${it.warehouse.name} (${it.warehouse.city})` : 'Entrepôt principal';
      const typeLabel = it.item_type === 'tool_equipment' ? '🛠️ Outil' : '📦 Matériel';
      return `<option value="${it.id}">
        ${it.name} [${it.item_code}] — ${typeLabel} — Entrepôt: ${whName} (Dispo: ${avail} ${it.unit})
      </option>`;
    }).join('');

    const html = `
      <form id="loanEquipmentForm" onsubmit="PageWorksites.submitLoan(event, ${worksiteId})">
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">
          Prêtez des outils et matériels réutilisables (brouettes, échelles, perceuses, compacteurs...) stockés dans un entrepôt pour les mettre à disposition de ce chantier. La quantité sera marquée <i>en prêt</i> sans altérer définitivement le patrimoine.
        </p>

        <div style="margin-bottom:12px">
          <label class="form-label">Outil / Équipement à prêter *</label>
          <select id="ln_item" class="form-control" required onchange="PageWorksites.onLoanItemChange()">
            <option value="">Sélectionner un équipement...</option>
            ${toolsOptions}
          </select>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <label class="form-label">Quantité à prêter *</label>
            <input type="number" id="ln_qty" class="form-control" required min="1" step="any" value="1" />
          </div>
          <div>
            <label class="form-label">Date de restitution prévue</label>
            <input type="date" id="ln_expected_date" class="form-control" />
          </div>
        </div>

        <div style="margin-bottom:12px">
          <label class="form-label">Notes & Responsable du matériel sur le chantier</label>
          <input type="text" id="ln_notes" class="form-control" placeholder="ex: Remis au chef d'équipe Paul, pour travaux de terrassement..." />
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn btn-outline" onclick="PageWorksites.openDetailModal(${worksiteId})">Retour</button>
          <button type="submit" class="btn btn-warning">Enregistrer le Prêt de Matériel</button>
        </div>
      </form>
    `;

    Modal.open({ title: '🛠️ Prêt d\'Outil ou Équipement pour Chantier', content: html, size: 'medium' });
  },

  onLoanItemChange() {
    const itemId = parseInt(document.getElementById('ln_item').value, 10);
    const item = this._stockItems.find((it) => it.id === itemId);
    if (item) {
      const avail = item.available_quantity !== undefined ? item.available_quantity : item.quantity;
      const qtyInput = document.getElementById('ln_qty');
      if (qtyInput) {
        qtyInput.max = avail;
        qtyInput.placeholder = `Max: ${avail}`;
      }
    }
  },

  async submitLoan(e, worksiteId) {
    e.preventDefault();
    const stock_item_id = parseInt(document.getElementById('ln_item').value, 10);
    const quantity = parseFloat(document.getElementById('ln_qty').value);
    const expected_return_date = document.getElementById('ln_expected_date').value || null;
    const notes = document.getElementById('ln_notes').value || null;

    if (!stock_item_id || quantity <= 0) {
      Toast.error('Veuillez sélectionner un outil et indiquer une quantité valide');
      return;
    }

    try {
      await API.post(`/worksites/${worksiteId}/equipment-loan`, {
        stock_item_id,
        quantity,
        expected_return_date,
        notes,
      });
      Toast.success('Équipement prêté avec succès au chantier ✅');
      await this.loadPropertiesAndStock();
      this.openDetailModal(worksiteId);
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de l\'enregistrement du prêt');
    }
  },

  // ===== MODAL RESTITUTION ÉQUIPEMENT À L'ENTREPÔT =====
  openReturnModal(worksiteId, loanId) {
    const loan = this._currentLoans.find((l) => l.id === loanId);
    if (!loan) return;

    const remainingQty = parseFloat(loan.quantity_loaned) - parseFloat(loan.quantity_returned || 0);
    const whOptions = this._warehouses.map((w) =>
      `<option value="${w.id}" ${loan.source_warehouse_id === w.id ? 'selected' : ''}>${w.name} (${w.city})</option>`
    ).join('');

    const html = `
      <form id="returnEquipmentForm" onsubmit="PageWorksites.submitReturn(event, ${worksiteId}, ${loan.id})">
        <div style="background:var(--secondary-bg, #f0f4f8);padding:10px;border-radius:6px;margin-bottom:14px;font-size:13px">
          <div><b>Article :</b> ${loan.stockItem ? loan.stockItem.name : '—'} (${loan.stockItem ? loan.stockItem.item_code : ''})</div>
          <div><b>Entrepôt d'origine :</b> ${loan.sourceWarehouse ? `${loan.sourceWarehouse.name} (${loan.sourceWarehouse.city})` : 'Entrepôt principal'}</div>
          <div><b>Quantité en prêt :</b> ${loan.quantity_loaned} | <b>Restant à restituer :</b> <span style="color:var(--danger);font-weight:700">${remainingQty} ${loan.stockItem ? loan.stockItem.unit : ''}</span></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <label class="form-label">Quantité restituée *</label>
            <input type="number" id="rt_qty" class="form-control" required min="1" max="${remainingQty}" step="any" value="${remainingQty}" />
          </div>
          <div>
            <label class="form-label">Entrepôt de retour *</label>
            <select id="rt_warehouse" class="form-control" required>
              ${whOptions}
            </select>
          </div>
        </div>

        <div style="margin-bottom:12px">
          <label class="form-label">Constat d'état / Remarques au retour</label>
          <textarea id="rt_notes" class="form-control" rows="2" placeholder="ex: Bon état de marche, nettoyé, aucun dommage constaté..."></textarea>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn btn-outline" onclick="PageWorksites.openDetailModal(${worksiteId})">Annuler</button>
          <button type="submit" class="btn btn-success">Valider la Restitution à l'Entrepôt</button>
        </div>
      </form>
    `;

    Modal.open({
      title: `↩️ Restitution de Matériel — ${loan.stockItem ? loan.stockItem.name : ''}`,
      content: html,
      size: 'medium',
    });
  },

  async submitReturn(e, worksiteId, loanId) {
    e.preventDefault();
    const quantity_returned = parseFloat(document.getElementById('rt_qty').value);
    const return_warehouse_id = parseInt(document.getElementById('rt_warehouse').value, 10);
    const condition_notes = document.getElementById('rt_notes').value;

    if (!quantity_returned || quantity_returned <= 0) {
      Toast.error('Veuillez indiquer une quantité valide');
      return;
    }

    try {
      await API.post(`/worksites/${worksiteId}/equipment-loans/${loanId}/return`, {
        quantity_returned,
        return_warehouse_id,
        condition_notes,
      });
      Toast.success('Équipement restitué avec succès à l\'entrepôt ✅');
      await this.loadPropertiesAndStock();
      this.openDetailModal(worksiteId);
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de la restitution');
    }
  },

  // ===== MODAL DÉCLARATION MATÉRIEL DU STOCK (CONSOMMABLE) =====
  openDeclareMaterialModal(worksiteId) {
    const itemsOptions = this._stockItems.map((it) => {
      const wh = it.warehouse ? ` [${it.warehouse.name}]` : '';
      return `<option value="${it.id}">${it.name}${wh} [${it.item_code}] (Dispo: ${it.available_quantity || it.quantity} ${it.unit})</option>`;
    }).join('');

    const html = `
      <form id="declareMaterialForm" onsubmit="PageWorksites.submitDeclareMaterial(event, ${worksiteId})">
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">
          Sélectionnez les articles consommables à consommer définitivement pour ce chantier (sacs de ciment, briques, colle, tuyauterie). Le coût sera imputé au budget matériel du chantier et le stock sera diminué.
        </p>

        <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:14px">
          <div>
            <label class="form-label">Article en stock *</label>
            <select id="dm_item" class="form-control" required>
              <option value="">Sélectionner un article...</option>
              ${itemsOptions}
            </select>
          </div>
          <div>
            <label class="form-label">Quantité prélevée *</label>
            <input type="number" id="dm_qty" class="form-control" required min="1" step="any" placeholder="Qté" />
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn btn-outline" onclick="PageWorksites.openDetailModal(${worksiteId})">Retour</button>
          <button type="submit" class="btn btn-primary">Prélever & Imputer au Chantier</button>
        </div>
      </form>
    `;

    Modal.open({ title: '📦 Consommation de Matériel de Stock', content: html, size: 'medium' });
  },

  async submitDeclareMaterial(e, worksiteId) {
    e.preventDefault();
    const stock_item_id = parseInt(document.getElementById('dm_item').value, 10);
    const quantity = parseFloat(document.getElementById('dm_qty').value);

    if (!stock_item_id || quantity <= 0) {
      Toast.error('Veuillez spécifier un article et une quantité valide');
      return;
    }

    try {
      await API.post(`/worksites/${worksiteId}/materials`, {
        materials: [{ stock_item_id, quantity }],
      });
      Toast.success('Matériel prélevé du stock avec succès ✅');
      await this.loadPropertiesAndStock();
      this.openDetailModal(worksiteId);
      this.load();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors du prélèvement');
    }
  },

  // ===== MODAL AJOUT TÂCHE / JALON =====
  openAddTaskModal(worksiteId) {
    const html = `
      <form id="addTaskForm" onsubmit="PageWorksites.submitAddTask(event, ${worksiteId})">
        <div style="margin-bottom:10px">
          <label class="form-label">Titre du jalon / tâche *</label>
          <input type="text" id="tk_title" class="form-control" required placeholder="ex: Démolition cloison, Pose carrelage..." />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>
            <label class="form-label">Date d'échéance</label>
            <input type="date" id="tk_end" class="form-control" />
          </div>
          <div>
            <label class="form-label">Avancement (%)</label>
            <input type="number" id="tk_prog" class="form-control" min="0" max="100" value="0" />
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn btn-outline" onclick="PageWorksites.openDetailModal(${worksiteId})">Retour</button>
          <button type="submit" class="btn btn-primary">Ajouter la Tâche</button>
        </div>
      </form>
    `;
    Modal.open({ title: '📋 Ajouter un Jalon de Chantier', content: html, size: 'small' });
  },

  async submitAddTask(e, worksiteId) {
    e.preventDefault();
    const data = {
      title: document.getElementById('tk_title').value,
      end_date: document.getElementById('tk_end').value || null,
      progress_percent: parseInt(document.getElementById('tk_prog').value, 10) || 0,
    };

    try {
      await API.post(`/worksites/${worksiteId}/tasks`, data);
      Toast.success('Tâche ajoutée');
      this.openDetailModal(worksiteId);
      this.load();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de l\'ajout');
    }
  },

  // ===== TÉLÉCHARGEMENT RAPPORT PDF =====
  async downloadPdf(id) {
    Toast.info('Génération du rapport de chantier en cours...');
    try {
      const blob = await API.downloadBlob(`/worksites/${id}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rapport_Chantier_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      Toast.success('Rapport de chantier téléchargé avec succès ✅');
    } catch (err) {
      Toast.error(err.message || 'Impossible de télécharger le rapport');
    }
  },
};

window.PageWorksites = PageWorksites;
