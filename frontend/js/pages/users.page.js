const PageUsers = {
  register() { Router.register('users', () => this.render()); },
  _roles: [],
  _users: [],
  _activeTab: 'list',

  async fields(isEdit = false) {
    if (!this._roles.length) this._roles = (await API.get('/users/roles')).data;
    const fields = [
      { name: 'full_name', label: 'Nom complet', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true, half: true },
      { name: 'phone', label: 'Téléphone', half: true },
      { name: 'role_id', label: 'Rôle', type: 'select', required: true, options: this._roles.filter(r => r.name !== 'locataire').map((r) => ({ value: r.id, label: r.label })) },
      { name: 'status', label: 'Statut', type: 'select', options: [
        { value: 'active', label: 'Actif' }, { value: 'inactive', label: 'Inactif' }, { value: 'suspended', label: 'Suspendu' }] },
      { name: 'password', label: isEdit ? 'Nouveau mot de passe (laisser vide)' : 'Mot de passe', type: 'password', required: !isEdit },
    ];
    if (Auth.hasRole('manager', 'super_admin')) {
      fields.push(
        { name: 'can_manage_users', label: 'Peut gérer les comptes (déléguer l\'inscription)', type: 'checkbox' },
        { name: 'can_view_all_calendars', label: 'Peut voir tous les calendriers', type: 'checkbox' },
        { name: 'can_manage_utilities', label: 'Peut générer les factures de charges (eau/électricité)', type: 'checkbox' },
      );
    }
    return fields;
  },

  async render() {
    try {
      const allUsers = (await API.get('/users')).data || [];
      this._users = allUsers.filter(u => u.role && u.role.name !== 'locataire' && u.role.name !== 'Locataire');
      this._roles = (await API.get('/users/roles')).data;
      this.renderLayout();
      this.switchTab(this._activeTab || 'list');
    } catch (e) {
      Layout.content(`<div class="empty-state"><h3>Erreur</h3><p>${e.message}</p></div>`);
    }
  },

  renderLayout() {
    Layout.setTitle('Utilisateurs');
    Layout.content(`
      <div class="page-head">
        <div>
          <h2>👥 Gestion des utilisateurs</h2>
          <div class="subtitle" id="usersCount">${this._users.length} collaborateur(s)</div>
        </div>
        <button class="btn btn-primary" onclick="PageUsers.create()">+ Ajouter</button>
      </div>

      <div class="tabs-bar">
        <button class="tab-btn" id="tab-list" onclick="PageUsers.switchTab('list')">👥 Liste du personnel</button>
        <button class="tab-btn" id="tab-permissions" onclick="PageUsers.switchTab('permissions')">🔑 Permissions & Rôles</button>
        <button class="tab-btn" id="tab-presence" onclick="PageUsers.switchTab('presence')">🕒 Présence & Pointage</button>
      </div>

      <div id="usersTabContent"></div>
    `);
  },

  switchTab(tab) {
    this._activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.id === `tab-${tab}`);
    });

    const contentEl = document.getElementById('usersTabContent');
    if (!contentEl) return;

    if (tab === 'list') {
      this.renderList(contentEl);
    } else if (tab === 'permissions') {
      this.renderPermissions(contentEl);
    } else if (tab === 'presence') {
      this.renderPresence(contentEl);
    }
  },

  renderList(container) {
    const rows = this._users.map((r) => `
      <tr>
        <td><div class="flex items-center gap-3"><div class="user-avatar" style="width:34px;height:34px;font-size:13px">${Helpers.initials(r.full_name)}</div><b>${r.full_name}</b></div></td>
        <td>${r.email}</td>
        <td><span class="badge badge-primary">${r.role ? r.role.label : '—'}</span></td>
        <td>${r.phone || '—'}</td>
        <td>${Helpers.statusBadge(r.status)}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="PageUsers.edit(${r.id})">✏️</button>
          <button class="btn btn-sm btn-outline" onclick="PageUsers.toggle(${r.id})">${r.status === 'active' ? '🔒' : '🔓'}</button>
          <button class="btn btn-sm btn-danger" onclick="PageUsers.remove(${r.id})">🗑</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted" style="padding:22px;">Aucun utilisateur</td></tr>';

    container.innerHTML = `
      <div class="toolbar">
        <input class="form-control search" id="userSearch" type="search" placeholder="🔎 Rechercher un utilisateur (nom, email, rôle)…" oninput="PageUsers.filter(this.value)" style="max-width:340px"/>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Téléphone</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="userTableBody">
              ${rows}
            </tbody>
          </table>
        </div>
      </div>`;
    if (typeof Icons !== 'undefined') Icons.enhance(container);
  },

  filter(q) {
    const query = String(q || '').trim().toLowerCase();
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;
    const filtered = query ? this._users.filter(u => {
      return u.full_name.toLowerCase().includes(query) || 
             u.email.toLowerCase().includes(query) || 
             (u.role && u.role.label.toLowerCase().includes(query));
    }) : this._users;

    tbody.innerHTML = filtered.map((r) => `
      <tr>
        <td><div class="flex items-center gap-3"><div class="user-avatar" style="width:34px;height:34px;font-size:13px">${Helpers.initials(r.full_name)}</div><b>${r.full_name}</b></div></td>
        <td>${r.email}</td>
        <td><span class="badge badge-primary">${r.role ? r.role.label : '—'}</span></td>
        <td>${r.phone || '—'}</td>
        <td>${Helpers.statusBadge(r.status)}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="PageUsers.edit(${r.id})">✏️</button>
          <button class="btn btn-sm btn-outline" onclick="PageUsers.toggle(${r.id})">${r.status === 'active' ? '🔒' : '🔓'}</button>
          <button class="btn btn-sm btn-danger" onclick="PageUsers.remove(${r.id})">🗑</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted" style="padding:22px;">Aucun utilisateur</td></tr>';
    if (typeof Icons !== 'undefined') Icons.enhance(tbody);
  },

  renderPermissions(container) {
    container.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><h3>⚙️ Rôles & Privilèges</h3></div>
          <div class="card-body" style="padding: 10px 0;">
            <div class="list-item" style="cursor:pointer; padding: 12px 20px;" onclick="PageUsers.showRoleDetail('super_admin')"><b>Super Administrateur (super_admin)</b></div>
            <div class="list-item" style="cursor:pointer; padding: 12px 20px;" onclick="PageUsers.showRoleDetail('manager')"><b>Manager / DG (manager)</b></div>
            <div class="list-item" style="cursor:pointer; padding: 12px 20px;" onclick="PageUsers.showRoleDetail('dir_admin')"><b>Directeur Administratif (dir_admin)</b></div>
            <div class="list-item" style="cursor:pointer; padding: 12px 20px;" onclick="PageUsers.showRoleDetail('dir_technique')"><b>Directeur Technique (dir_technique)</b></div>
            <div class="list-item" style="cursor:pointer; padding: 12px 20px;" onclick="PageUsers.showRoleDetail('gestionnaire')"><b>Gestionnaire (gestionnaire)</b></div>
            <div class="list-item" style="cursor:pointer; padding: 12px 20px;" onclick="PageUsers.showRoleDetail('comptable')"><b>Comptable (comptable)</b></div>
            <div class="list-item" style="cursor:pointer; padding: 12px 20px;" onclick="PageUsers.showRoleDetail('technicien')"><b>Technicien (technicien)</b></div>
            <div class="list-item" style="cursor:pointer; padding: 12px 20px;" onclick="PageUsers.showRoleDetail('locataire')"><b>Locataire (locataire)</b></div>
          </div>
        </div>

        <div class="card" id="roleDetailCard">
          <div class="card-header"><h3 id="detailRoleTitle">Sélectionnez un rôle</h3></div>
          <div class="card-body" id="detailRoleBody">
            <p class="text-muted">Cliquez sur un rôle à gauche pour inspecter ses permissions système interactives.</p>
          </div>
        </div>
      </div>

      <div class="card mt-4">
        <div class="card-header"><h3>💡 À propos des privilèges délégués</h3></div>
        <div class="card-body">
          <div class="list-item">
            <div style="flex:1">
              <b>👥 Gestion des comptes (can_manage_users)</b><br>
              <span class="text-muted" style="font-size: 13px;">Permet de créer, éditer et suspendre des comptes du personnel.</span>
            </div>
          </div>
          <div class="list-item">
            <div style="flex:1">
              <b>📅 Accès aux Calendriers (can_view_all_calendars)</b><br>
              <span class="text-muted" style="font-size: 13px;">Permet de voir tous les agendas de la journée et le calendrier global sans restriction.</span>
            </div>
          </div>
          <div class="list-item">
            <div style="flex:1">
              <b>⚡ Redistribution des charges (can_manage_utilities)</b><br>
              <span class="text-muted" style="font-size: 13px;">Permet de saisir les index de compteurs et éditer les factures de charges d'eau/électricité.</span>
            </div>
          </div>
        </div>
      </div>`;
    this.showRoleDetail('manager');
  },

  showRoleDetail(role) {
    const elTitle = document.getElementById('detailRoleTitle');
    const elBody = document.getElementById('detailRoleBody');
    if (!elTitle || !elBody) return;

    const details = {
      super_admin: {
        title: "👑 Super Administrateur",
        desc: "Bénéficie de tous les droits et accès sur le système. Peut tout modifier et contourner les restrictions RBAC.",
        rights: ["Accès total sans restriction", "Configuration et maintenance système", "Délégation de permissions"]
      },
      manager: {
        title: "👔 Manager / DG",
        desc: "Droits maximaux sur la gestion locative, les finances et la technique. Pilote l'entreprise.",
        rights: ["Gestion complète des immeubles, locataires, baux", "Gestion financière complète (salaires, paiements, dépenses)", "Attribution de délégations de permissions", "Planification des tâches"]
      },
      dir_admin: {
        title: "📄 Directeur Administratif",
        desc: "Prend en charge la gestion administrative, les contrats, le suivi de situation financière et le personnel.",
        rights: ["Création et édition des locataires et baux", "Suivi des paiements de loyers", "Consultation des rapports d'activité", "Lecture des documents et pièces administratives"]
      },
      dir_technique: {
        title: "🔧 Directeur Technique",
        desc: "Pilote les chantiers de maintenance, les stocks d'équipements et l'activité des techniciens.",
        rights: ["Création, assignation et suivi des chantiers de maintenance", "Gestion de l'inventaire des équipements et stocks", "Planification des tâches des techniciens", "Suivi d'activité des techniciens"]
      },
      gestionnaire: {
        title: "🏢 Gestionnaire",
        desc: "Gère au quotidien les entrées/sorties de locataires, l'état des logements et les charges.",
        rights: ["Création de biens et logements", "Suivi des locataires et baux", "Saisie et suivi des demandes de maintenance simples"]
      },
      comptable: {
        title: "💰 Comptable",
        desc: "Responsable des encaissements, de la validation des paiements et de la facturation.",
        rights: ["Validation des paiements de loyers et charges", "Calcul et saisie des salaires et primes", "Gestion des dépenses et budgets de fonctionnement"]
      },
      technicien: {
        title: "🛠 Technicien",
        desc: "Rôle de terrain. Réalise les chantiers de maintenance et valide les tâches planifiées.",
        rights: ["Accès à l'agenda de travail quotidien", "Déclaration de début / fin d'intervention", "Saisie des rapports d'exécution", "Prise de photos avant/après (via WhatsApp)"]
      },
      locataire: {
        title: "👤 Locataire",
        desc: "Espace client réduit pour le suivi de son bail, le paiement de son loyer et de ses charges.",
        rights: ["Consultation de son contrat de bail actif", "Déclaration de paiement avec téléversement de preuve", "Saisie de demandes de maintenance technique pour son logement"]
      }
    };

    const info = details[role];
    if (!info) return;

    elTitle.textContent = info.title;
    const rightsList = info.rights.map(r => `<li>✔️ ${r}</li>`).join('');
    elBody.innerHTML = `
      <p style="font-size: 14px; margin-bottom: 16px; color: var(--text-secondary); line-height: 1.5; text-align: left;">${info.desc}</p>
      <h4 style="margin-bottom: 8px; text-align: left;">Droits clés de ce rôle :</h4>
      <ul style="padding-left: 0; list-style-type: none; line-height: 2; text-align: left;">
        ${rightsList}
      </ul>
    `;
  },

  renderPresence(container) {
    const rows = this._users.map((r) => {
      const isActive = r.status === 'active';
      const isPresent = r.is_present || false;
      const lastTime = r.last_attendance_at ? Helpers.formatDateTime(r.last_attendance_at) : 'Aucun pointage';

      return `
        <tr>
          <td><b>${r.full_name}</b></td>
          <td><span class="badge badge-primary">${r.role ? r.role.label : '—'}</span></td>
          
          <!-- Activation / Désactivation -->
          <td>
            <div class="switch-container">
              <label class="switch">
                <input type="checkbox" id="sw-status-${r.id}" ${isActive ? 'checked' : ''} onchange="PageUsers.handleStatusSwitch(${r.id}, this.checked)">
                <span class="slider"></span>
              </label>
              <span id="txt-status-${r.id}" style="font-weight:600; font-size:13px; color: ${isActive ? 'var(--success)' : 'var(--text-muted)'}">${isActive ? 'Actif' : 'Inactif'}</span>
            </div>
          </td>
          
          <!-- Pointage Présent / Absent -->
          <td>
            <div class="switch-container">
              <label class="switch">
                <input type="checkbox" id="sw-presence-${r.id}" ${isPresent ? 'checked' : ''} onchange="PageUsers.handlePresenceSwitch(${r.id}, this.checked)">
                <span class="slider"></span>
              </label>
              <span id="txt-presence-${r.id}" style="font-weight:600; font-size:13px; color: ${isPresent ? 'var(--success)' : 'var(--danger)'}">${isPresent ? 'Présent' : 'Absent'}</span>
            </div>
          </td>
          
          <td id="time-presence-${r.id}" class="text-muted" style="font-size:13px;">${lastTime}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="5" class="text-center text-muted" style="padding:22px;">Aucun personnel enregistré</td></tr>';

    container.innerHTML = `
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Collaborateur</th>
                <th>Rôle</th>
                <th>Statut Compte</th>
                <th>Présence</th>
                <th>Dernier Pointage</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  async handleStatusSwitch(id, checked) {
    try {
      await API.patch(`/users/${id}/toggle`);
      const textEl = document.getElementById(`txt-status-${id}`);
      if (textEl) {
        textEl.textContent = checked ? 'Actif' : 'Inactif';
        textEl.style.color = checked ? 'var(--success)' : 'var(--text-muted)';
      }
      Toast.success('Statut du compte mis à jour');
      this._users = (await API.get('/users')).data;
    } catch (e) {
      Toast.error(e.message);
      const sw = document.getElementById(`sw-status-${id}`);
      if (sw) sw.checked = !checked;
    }
  },

  async handlePresenceSwitch(id, checked) {
    try {
      const res = await API.patch(`/users/${id}/attendance`, { is_present: checked });
      const textEl = document.getElementById(`txt-presence-${id}`);
      if (textEl) {
        textEl.textContent = checked ? 'Présent' : 'Absent';
        textEl.style.color = checked ? 'var(--success)' : 'var(--danger)';
      }
      const timeEl = document.getElementById(`time-presence-${id}`);
      if (timeEl && res.data && res.data.last_attendance_at) {
        timeEl.textContent = Helpers.formatDateTime(res.data.last_attendance_at);
      }
      Toast.success(checked ? 'Pointage Présent enregistré' : 'Pointage Absent enregistré');
      this._users = (await API.get('/users')).data;
    } catch (e) {
      Toast.error(e.message);
      const sw = document.getElementById(`sw-presence-${id}`);
      if (sw) sw.checked = !checked;
    }
  },

  async create() {
    CrudPage.openForm({
      title: 'Nouvel utilisateur',
      fields: await this.fields(false),
      onSubmit: async (d) => {
        await API.post('/users', d);
        Toast.success('Utilisateur créé');
        PageUsers.render();
      }
    });
  },

  async edit(id) {
    const r = (await API.get('/users/' + id)).data;
    CrudPage.openForm({
      title: 'Modifier utilisateur',
      fields: await this.fields(true),
      values: r,
      onSubmit: async (d) => {
        if (!d.password) delete d.password;
        await API.put('/users/' + id, d);
        Toast.success('Mis à jour');
        PageUsers.render();
      }
    });
  },

  async toggle(id) {
    try {
      await API.patch('/users/' + id + '/toggle');
      Toast.success('Statut modifié');
      PageUsers.render();
    } catch (e) {
      Toast.error(e.message);
    }
  },

  remove(id) {
    CrudPage.confirmDelete('/users/' + id, () => PageUsers.render());
  },
};
