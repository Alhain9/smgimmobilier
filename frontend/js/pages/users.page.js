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

  _properties: [],
  _pendingRegistrations: [],
  _allApartments: [],

  async render() {
    try {
      const [allUsersRes, rolesRes, propsRes, pendingRes, aptsRes] = await Promise.all([
        API.get('/users'),
        API.get('/users/roles'),
        API.get('/properties'),
        API.get('/users/pending-registrations').catch(() => ({ data: [] })),
        API.get('/apartments').catch(() => ({ data: [] })),
      ]);
      const allUsers = allUsersRes.data || [];
      this._users = allUsers.filter(u => u.status !== 'pending_approval' && u.role && u.role.name !== 'locataire' && u.role.name !== 'Locataire');
      this._roles = rolesRes.data || [];
      this._properties = propsRes.data || [];
      this._pendingRegistrations = pendingRes.data || [];
      this._allApartments = aptsRes.data || [];
      this.renderLayout();
      this.switchTab(this._activeTab || (this._pendingRegistrations.length > 0 ? 'pending' : 'list'));
    } catch (e) {
      Layout.content(`<div class="empty-state"><h3>Erreur</h3><p>${e.message}</p></div>`);
    }
  },

  renderLayout() {
    Layout.setTitle('Utilisateurs & Collaborateurs');
    const pendingCount = this._pendingRegistrations.length;
    Layout.content(`
      <div class="page-head">
        <div>
          <h2>👥 Gestion des utilisateurs & Accès</h2>
          <div class="subtitle" id="usersCount">${this._users.length} collaborateur(s) & bailleur(s) · ${pendingCount} demande(s) en attente</div>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-primary" onclick="PageUsers.openUserModal()">+ Nouvel Utilisateur</button>
        </div>
      </div>

      <div class="tabs-bar">
        <button class="tab-btn" id="tab-list" onclick="PageUsers.switchTab('list')">👥 Personnel & Bailleurs</button>
        <button class="tab-btn" id="tab-pending" onclick="PageUsers.switchTab('pending')">
          📝 Demandes d'inscription
          ${pendingCount > 0 ? `<span class="badge" style="background:#e07a5f;color:#fff;margin-left:6px;padding:2px 8px;border-radius:10px;font-size:11px">${pendingCount}</span>` : ''}
        </button>
        <button class="tab-btn" id="tab-permissions" onclick="PageUsers.switchTab('permissions')">🔑 Permissions & Rôles</button>
        <button class="tab-btn" id="tab-presence" onclick="PageUsers.switchTab('presence')">🕒 Présence</button>
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
    } else if (tab === 'pending') {
      this.renderPending(contentEl);
    } else if (tab === 'permissions') {
      this.renderPermissions(contentEl);
    } else if (tab === 'presence') {
      this.renderPresence(contentEl);
    }
  },

  renderList(container) {
    const rows = this._users.map((r) => {
      const isBailleur = r.role && (r.role.name === 'bailleur' || r.role.label === 'Bailleur');
      const isGestionnaireOrComptable = r.role && ['gestionnaire', 'comptable', 'Gestionnaire', 'Comptable'].some(x => r.role.name === x || r.role.label === x || r.role.code === x);
      const owned = r.ownedProperties || [];
      const assigned = r.assignedProperties || [];

      // Badges immeubles bailleur
      const propsBadges = isBailleur
        ? (owned.length
            ? `<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">${owned.map(p => `<span class="badge badge-info" style="font-size:11px">🏢 ${p.property_name}</span>`).join('')}</div>`
            : '<div style="margin-top:4px"><span class="badge badge-warning" style="font-size:11px">⚠️ Aucun immeuble attribué</span></div>')
        : '';

      // Badges immeubles affectés gestionnaire/comptable
      const assignedBadges = isGestionnaireOrComptable
        ? (assigned.length
            ? `<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">${assigned.map(p => `<span class="badge" style="background:#d4edda;color:#155724;font-size:11px">★ ${p.property_name}</span>`).join('')}</div>`
            : '<div style="margin-top:4px"><span class="badge badge-warning" style="font-size:11px">⚠️ Aucun immeuble affecté</span></div>')
        : '';

      return `
        <tr>
          <td>
            <div class="flex items-center gap-3">
              <div class="user-avatar" style="width:34px;height:34px;font-size:13px">${Helpers.initials(r.full_name)}</div>
              <div>
                <b>${r.full_name}</b>
                ${propsBadges}
                ${assignedBadges}
              </div>
            </div>
          </td>
          <td>${r.email}</td>
          <td><span class="badge badge-${isBailleur ? 'warning' : 'primary'}">${r.role ? r.role.label : '—'}</span></td>
          <td>${r.phone || '—'}</td>
          <td>${Helpers.statusBadge(r.status)}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="PageUsers.openUserModal(${r.id})" title="Modifier">✏️</button>
            ${isGestionnaireOrComptable ? `<button class="btn btn-sm btn-outline" onclick="PageUsers.openAssignProperties(${r.id}, '${r.full_name.replace(/'/g, "\\'")}'  )" title="Affecter des immeubles" style="color:#155724;border-color:#b7dfc2">🏢 Immeubles</button>` : ''}
            <button class="btn btn-sm btn-outline" onclick="PageUsers.toggle(${r.id})" title="Activer / Suspendre">${r.status === 'active' ? '🔒' : '🔓'}</button>
            <button class="btn btn-sm btn-danger" onclick="PageUsers.remove(${r.id})" title="Supprimer">🗑</button>
          </td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="6" class="text-center text-muted" style="padding:22px;">Aucun utilisateur</td></tr>';

    container.innerHTML = `
      <div class="toolbar">
        <input class="form-control search" id="userSearch" type="search" placeholder="🔎 Rechercher un utilisateur (nom, email, rôle)…" oninput="PageUsers.filter(this.value)" style="max-width:340px"/>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nom & Immeubles</th>
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

  renderPending(container) {
    const pending = this._pendingRegistrations || [];

    if (!pending.length) {
      container.innerHTML = `
        <div class="card" style="padding:60px 20px;text-align:center">
          <div style="font-size:48px;margin-bottom:14px">✨</div>
          <h3 style="font-size:18px;font-weight:700;margin-bottom:6px">Aucune inscription en attente</h3>
          <p class="text-muted" style="max-width:500px;margin:0 auto 20px;font-size:13.5px">
            Toutes les demandes d'accès ont été validées. Lorsqu'un nouvel utilisateur ou locataire s'inscrira depuis la page de connexion, sa fiche s'affichera directement ici pour validation et attribution de logement.
          </p>
        </div>
      `;
      return;
    }

    const rows = pending.map((p) => {
      const roleBadge = p.requested_role === 'locataire'
        ? '<span class="badge badge-primary">Locataire</span>'
        : (p.requested_role === 'bailleur'
            ? '<span class="badge badge-warning">Bailleur / Propriétaire</span>'
            : `<span class="badge badge-info">${p.requested_role ? p.requested_role.toUpperCase() : 'Non précisé'}</span>`);

      return `
        <tr>
          <td>
            <div class="flex items-center gap-3">
              <div class="user-avatar" style="width:36px;height:36px;font-size:13px;background:linear-gradient(135deg,#e07a5f,#f2cc8f);color:#fff">
                ${Helpers.initials(p.full_name)}
              </div>
              <div>
                <b>${p.full_name}</b>
                <div style="font-size:11.5px;color:var(--text-muted)">Inscrit le ${Helpers.formatDateTime(p.created_at)}</div>
              </div>
            </div>
          </td>
          <td>
            <div>${p.email}</div>
            <div style="font-size:12px;color:var(--text-muted)">${p.phone || 'Non renseigné'}</div>
          </td>
          <td>${roleBadge}</td>
          <td><span class="badge" style="background:var(--bg-surface-2);color:var(--text-primary);border:1px solid var(--border)">📍 ${p.city || 'Yaoundé'}</span></td>
          <td style="max-width:240px">
            <span style="font-size:12.5px;color:var(--text-secondary)">
              ${p.registration_note ? p.registration_note : '<span class="text-muted" style="font-style:italic">Aucune précision fournie</span>'}
            </span>
          </td>
          <td>
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm btn-primary" onclick="PageUsers.openApproveModal(${p.id})">
                ✅ Valider & Attribuer
              </button>
              <button class="btn btn-sm btn-danger" onclick="PageUsers.rejectRegistration(${p.id})" title="Refuser cette demande">
                🗑
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div class="card mb-4" style="background:linear-gradient(135deg,rgba(26,58,92,0.06),rgba(224,122,95,0.06));border-left:4px solid var(--primary);padding:14px 18px">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="font-size:22px">🛡️</span>
          <div style="font-size:13.5px;color:var(--text-secondary)">
            <strong>Contrôle des inscriptions publiques :</strong>
            Les utilisateurs inscrits n'ont aucun accès à la plateforme tant que vous n'avez pas validé leur compte et choisi leur rôle. Pour un locataire, attribuez-lui directement son logement pour synchroniser instantanément son tableau de bord et ses loyers.
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <h3>Demandes d'inscription reçues (${pending.length})</h3>
          <button class="btn btn-sm btn-outline" onclick="PageUsers.render()">🔄 Actualiser</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Demandeur</th>
                <th>Coordonnées</th>
                <th>Rôle souhaité</th>
                <th>Ville / Agence</th>
                <th>Notes & Logement précisé</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
    if (typeof Icons !== 'undefined') Icons.enhance(container);
  },

  filter(q) {
    const query = String(q || '').trim().toLowerCase();
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;
    const filtered = query ? this._users.filter(u => {
      return u.full_name.toLowerCase().includes(query) || 
             u.email.toLowerCase().includes(query) || 
             (u.role && u.role.label.toLowerCase().includes(query)) ||
             (u.ownedProperties || []).some(p => p.property_name.toLowerCase().includes(query));
    }) : this._users;

    tbody.innerHTML = filtered.map((r) => {
      const isBailleur = r.role && (r.role.name === 'bailleur' || r.role.label === 'Bailleur');
      const owned = r.ownedProperties || [];
      const propsBadges = isBailleur
        ? (owned.length
            ? `<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">${owned.map(p => `<span class="badge badge-info" style="font-size:11px">🏢 ${p.property_name}</span>`).join('')}</div>`
            : '<div style="margin-top:4px"><span class="badge badge-warning" style="font-size:11px">⚠️ Aucun immeuble attribué</span></div>')
        : '';

      return `
        <tr>
          <td>
            <div class="flex items-center gap-3">
              <div class="user-avatar" style="width:34px;height:34px;font-size:13px">${Helpers.initials(r.full_name)}</div>
              <div>
                <b>${r.full_name}</b>
                ${propsBadges}
              </div>
            </div>
          </td>
          <td>${r.email}</td>
          <td><span class="badge badge-${isBailleur ? 'warning' : 'primary'}">${r.role ? r.role.label : '—'}</span></td>
          <td>${r.phone || '—'}</td>
          <td>${Helpers.statusBadge(r.status)}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="PageUsers.openUserModal(${r.id})" title="Modifier">✏️</button>
            <button class="btn btn-sm btn-outline" onclick="PageUsers.toggle(${r.id})" title="Activer / Suspendre">${r.status === 'active' ? '🔒' : '🔓'}</button>
            <button class="btn btn-sm btn-danger" onclick="PageUsers.remove(${r.id})" title="Supprimer">🗑</button>
          </td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="6" class="text-center text-muted" style="padding:22px;">Aucun utilisateur</td></tr>';
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
      const lastTime = r.last_attendance_at ? Helpers.formatDateTime(r.last_attendance_at) : 'Aucun enregistrement';

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
          
          <!-- Présent / Absent -->
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
                <th>Dernière activité</th>
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
      Toast.success(checked ? 'Présence confirmée' : 'Statut Absent enregistré');
      this._users = (await API.get('/users')).data;
    } catch (e) {
      Toast.error(e.message);
      const sw = document.getElementById(`sw-presence-${id}`);
      if (sw) sw.checked = !checked;
    }
  },

  async openUserModal(userId = null) {
    let u = {
      full_name: '',
      email: '',
      phone: '',
      role_id: '',
      status: 'active',
      can_manage_users: false,
      can_view_all_calendars: false,
      can_manage_utilities: false,
      property_ids: [],
    };

    if (userId) {
      const res = await API.get('/users/' + userId);
      u = res.data;
      if (u.role) u.role_id = u.role.id;
    }

    const rolesOptions = this._roles
      .filter((r) => r.name !== 'locataire' && r.label !== 'Locataire')
      .map((r) => `<option value="${r.id}" ${u.role_id == r.id ? 'selected' : ''}>${r.label}</option>`)
      .join('');

    const ownedSet = new Set(u.property_ids || []);

    const propsCheckboxes = this._properties.map((p) => {
      const isChecked = ownedSet.has(p.id);
      return `
        <label class="list-item" style="cursor:pointer;padding:8px 12px;background:var(--bg-surface-2,#f8f9fa);border:1px solid var(--border,#e2e8f0);border-radius:6px;margin-bottom:6px;display:flex;align-items:center;gap:10px">
          <input type="checkbox" class="prop-bailleur-chk" value="${p.id}" ${isChecked ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer"/>
          <div style="flex:1">
            <b>🏢 ${p.property_name}</b>
            <span style="font-size:12px;color:var(--text-muted);margin-left:6px">📍 ${p.city || 'Yaoundé'}${p.district ? ` (${p.district})` : ''}</span>
          </div>
        </label>
      `;
    }).join('') || '<p class="text-muted">Aucun immeuble enregistré pour le moment.</p>';

    const html = `
      <form id="userForm" onsubmit="PageUsers.submitUser(event, ${userId})">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <label class="form-label">Nom complet *</label>
            <input type="text" id="u_full_name" class="form-control" required value="${u.full_name || ''}" placeholder="ex: Paul Biya, Jean Dupont..." />
          </div>
          <div>
            <label class="form-label">Adresse Email *</label>
            <input type="email" id="u_email" class="form-control" required value="${u.email || ''}" placeholder="email@smg.cm" />
          </div>
          <div>
            <label class="form-label">Téléphone</label>
            <input type="text" id="u_phone" class="form-control" value="${u.phone || ''}" placeholder="+237 6..." />
          </div>
          <div>
            <label class="form-label">Rôle d'accès *</label>
            <select id="u_role_id" class="form-control" required onchange="PageUsers.toggleBailleurSection()">
              <option value="">Sélectionner un rôle...</option>
              ${rolesOptions}
            </select>
          </div>
          <div>
            <label class="form-label">Statut du compte</label>
            <select id="u_status" class="form-control">
              <option value="active" ${u.status === 'active' ? 'selected' : ''}>Actif</option>
              <option value="inactive" ${u.status === 'inactive' ? 'selected' : ''}>Inactif</option>
              <option value="suspended" ${u.status === 'suspended' ? 'selected' : ''}>Suspendu</option>
            </select>
          </div>
          <div>
            <label class="form-label">${userId ? 'Mot de passe (laisser vide si inchangé)' : 'Mot de passe *'}</label>
            <input type="password" id="u_password" class="form-control" ${userId ? '' : 'required'} placeholder="${userId ? '••••••••' : 'Mot de passe de connexion'}" />
          </div>
        </div>

        <!-- SECTION SPÉCIALE BAILLEUR : ATTRIBUTION DES IMMEUBLES -->
        <div id="u_bailleur_props_box" style="display:none;background:#f0f7ff;border:1px solid #b8daff;border-radius:8px;padding:14px;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:18px">🏢</span>
            <h4 style="font-size:15px;font-weight:700;color:#004085;margin:0">Immeubles attribués à ce Bailleur</h4>
          </div>
          <p style="font-size:12px;color:#004085;margin:0 0 10px">
            Cochez les immeubles dont ce propriétaire détient les droits. Dans son espace personnel, il aura un accès en <b>consultation exclusive</b> sur ces seuls immeubles, leurs appartements, leurs locataires et leurs rapports financiers.
          </p>
          <div style="max-height:220px;overflow-y:auto;padding-right:4px">
            ${propsCheckboxes}
          </div>
        </div>

        ${Auth.hasRole('manager', 'super_admin') ? `
          <div id="u_delegated_privileges_box" style="border-top:1px solid var(--border,#e2e8f0);padding-top:10px;margin-top:10px">
            <label style="font-weight:700;font-size:13px;margin-bottom:8px;display:block">Privilèges délégués (Personnel uniquement)</label>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px">
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
                <input type="checkbox" id="u_can_manage_users" ${u.can_manage_users ? 'checked' : ''} />
                <span>Gérer les comptes utilisateurs</span>
              </label>
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
                <input type="checkbox" id="u_can_view_all_calendars" ${u.can_view_all_calendars ? 'checked' : ''} />
                <span>Voir tous les calendriers</span>
              </label>
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
                <input type="checkbox" id="u_can_manage_utilities" ${u.can_manage_utilities ? 'checked' : ''} />
                <span>Gérer les charges (eau/élec)</span>
              </label>
            </div>
          </div>
        ` : ''}

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Annuler</button>
          <button type="submit" class="btn btn-primary">${userId ? 'Mettre à jour' : 'Créer l\'utilisateur'}</button>
        </div>
      </form>
    `;

    Modal.open({
      title: userId ? '✏️ Modifier l\'Utilisateur' : '➕ Nouvel Utilisateur',
      content: html,
      size: 'medium',
    });

    this.toggleBailleurSection();
  },

  toggleBailleurSection() {
    const roleSelect = document.getElementById('u_role_id');
    const box = document.getElementById('u_bailleur_props_box');
    const privBox = document.getElementById('u_delegated_privileges_box');
    if (!roleSelect) return;

    const selectedId = roleSelect.value;
    const roleObj = this._roles.find((r) => String(r.id) === String(selectedId));
    const isBailleur = roleObj && (roleObj.name === 'bailleur' || roleObj.label === 'Bailleur');

    if (box) box.style.display = isBailleur ? 'block' : 'none';
    if (privBox) privBox.style.display = isBailleur ? 'none' : 'block';
  },

  async submitUser(e, userId) {
    e.preventDefault();
    const roleSelect = document.getElementById('u_role_id');
    const selectedId = roleSelect.value;
    const roleObj = this._roles.find((r) => String(r.id) === String(selectedId));
    const isBailleur = roleObj && (roleObj.name === 'bailleur' || roleObj.label === 'Bailleur');

    const property_ids = isBailleur
      ? Array.from(document.querySelectorAll('.prop-bailleur-chk:checked')).map((c) => Number(c.value))
      : [];

    const data = {
      full_name: document.getElementById('u_full_name').value.trim(),
      email: document.getElementById('u_email').value.trim(),
      phone: document.getElementById('u_phone').value.trim() || null,
      role_id: parseInt(selectedId, 10),
      status: document.getElementById('u_status').value,
      property_ids,
    };

    const pwd = document.getElementById('u_password').value;
    if (pwd && pwd.trim()) data.password = pwd.trim();

    const chkUsers = document.getElementById('u_can_manage_users');
    data.can_manage_users = isBailleur ? false : (chkUsers ? chkUsers.checked : false);
    const chkCal = document.getElementById('u_can_view_all_calendars');
    data.can_view_all_calendars = isBailleur ? false : (chkCal ? chkCal.checked : false);
    const chkUtil = document.getElementById('u_can_manage_utilities');
    data.can_manage_utilities = isBailleur ? false : (chkUtil ? chkUtil.checked : false);

    try {
      if (userId) {
        await API.put('/users/' + userId, data);
        Toast.success('Utilisateur mis à jour avec succès ✅');
      } else {
        await API.post('/users', data);
        Toast.success('Utilisateur créé avec succès ✅');
      }
      Modal.close();
      PageUsers.render();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de l\'enregistrement');
    }
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

  openApproveModal(userId) {
    const user = this._pendingRegistrations.find(u => u.id === userId);
    if (!user) {
      Toast.error('Demande d\'inscription introuvable');
      return;
    }

    const reqRole = (user.requested_role || '').toLowerCase();

    // Rôles complets disponibles pour attribution
    const allRolesOptions = this._roles.map((r) => {
      let isSelected = false;
      if (reqRole === 'locataire' && (r.name === 'locataire' || r.label === 'Locataire')) isSelected = true;
      else if (reqRole === 'bailleur' && (r.name === 'bailleur' || r.label === 'Bailleur')) isSelected = true;
      else if (reqRole === 'comptable' && (r.name === 'comptable' || r.label === 'Comptable')) isSelected = true;
      else if (reqRole === 'gestionnaire' && (r.name === 'gestionnaire' || r.label === 'Gestionnaire')) isSelected = true;
      else if (reqRole === 'technicien' && (r.name === 'technicien' || r.label === 'Technicien')) isSelected = true;
      return `<option value="${r.id}" ${isSelected ? 'selected' : ''}>${r.label}</option>`;
    }).join('');

    // Immeubles options
    const propsOptions = this._properties.map(p =>
      `<option value="${p.id}">🏢 ${p.property_name} (${p.city || 'Cameroun'})</option>`
    ).join('');

    // Immeubles checkboxes pour bailleur
    const bailleurPropsCheckboxes = this._properties.map(p => `
      <label class="list-item" style="cursor:pointer;padding:8px 12px;background:var(--bg-surface-2);border:1px solid var(--border);border-radius:6px;margin-bottom:6px;display:flex;align-items:center;gap:10px">
        <input type="checkbox" class="approve-bailleur-prop-chk" value="${p.id}" style="width:18px;height:18px;cursor:pointer"/>
        <div style="flex:1">
          <b>🏢 ${p.property_name}</b>
          <span style="font-size:12px;color:var(--text-muted);margin-left:6px">📍 ${p.city || ''}</span>
        </div>
      </label>
    `).join('') || '<p class="text-muted">Aucun immeuble enregistré.</p>';

    const html = `
      <form id="approveForm" onsubmit="PageUsers.submitApproveRegistration(event, ${user.id})">
        <!-- RAPPEL INFOS DEMANDEUR -->
        <div style="background:var(--bg-surface-2);border-radius:8px;padding:14px;margin-bottom:16px;border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
            <div>
              <b style="font-size:15px">${user.full_name}</b>
              <div style="font-size:13px;color:var(--text-muted)">📧 ${user.email} · 📞 ${user.phone || 'Non renseigné'}</div>
            </div>
            <div>
              <span class="badge" style="background:var(--primary);color:#fff">Rôle souhaité : ${user.requested_role || 'Non spécifié'}</span>
            </div>
          </div>
          ${user.registration_note ? `
            <div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border);font-size:12.5px;color:var(--text-secondary)">
              <strong>💬 Message / Précisions du candidat :</strong> ${user.registration_note}
            </div>` : ''}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div>
            <label class="form-label">Rôle définitif à attribuer *</label>
            <select id="app_role_id" class="form-control" required onchange="PageUsers.onApproveRoleChanged()">
              <option value="">Sélectionner un rôle...</option>
              ${allRolesOptions}
            </select>
          </div>
          <div>
            <label class="form-label">Ville / Agence SMG *</label>
            <select id="app_city" class="form-control" required>
              <option value="Douala" ${user.city === 'Douala' ? 'selected' : ''}>Douala</option>
              <option value="Yaoundé" ${user.city === 'Yaoundé' ? 'selected' : ''}>Yaoundé</option>
              <option value="Autre">Autre région</option>
            </select>
          </div>
        </div>

        <!-- SECTION AFFECTATION LOGEMENT & BAIL (SI RÔLE LOCATAIRE) -->
        <div id="approveLocataireBox" style="display:none;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:20px">🚪</span>
            <h4 style="margin:0;font-size:15px;color:#166534;font-weight:700">Attribution du logement & bail (Locataire)</h4>
          </div>
          <p style="font-size:12px;color:#166534;margin:0 0 12px">
            Sélectionnez l'immeuble et le logement du locataire. Son contrat de bail sera créé et ses accès personnels (loyers, factures, quittances) seront immédiatement configurés.
          </p>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div>
              <label class="form-label" style="color:#166534">1. Choisir l'immeuble *</label>
              <select id="app_property_id" class="form-control" onchange="PageUsers.onApprovePropertySelected(this.value)">
                <option value="">Sélectionner un immeuble...</option>
                ${propsOptions}
              </select>
            </div>
            <div>
              <label class="form-label" style="color:#166534">2. Choisir l'appartement *</label>
              <select id="app_apartment_id" class="form-control" onchange="PageUsers.onApproveApartmentSelected(this.value)">
                <option value="">Sélectionnez d'abord un immeuble</option>
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:8px">
            <div>
              <label class="form-label" style="color:#166534">Loyer mensuel (FCFA)</label>
              <input type="number" id="app_rent_amount" class="form-control" placeholder="Ex: 85000" />
            </div>
            <div>
              <label class="form-label" style="color:#166534">Caution (FCFA)</label>
              <input type="number" id="app_deposit_amount" class="form-control" placeholder="Ex: 170000" />
            </div>
            <div>
              <label class="form-label" style="color:#166534">Date d'entrée</label>
              <input type="date" id="app_start_date" class="form-control" value="${new Date().toISOString().slice(0, 10)}" />
            </div>
          </div>
        </div>

        <!-- SECTION AFFECTATION IMMEUBLES (SI RÔLE BAILLEUR) -->
        <div id="approveBailleurBox" style="display:none;background:#f0f7ff;border:1px solid #b8daff;border-radius:8px;padding:16px;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:20px">🏢</span>
            <h4 style="margin:0;font-size:15px;color:#004085;font-weight:700">Immeubles de ce Propriétaire</h4>
          </div>
          <p style="font-size:12px;color:#004085;margin:0 0 10px">
            Cochez les immeubles gérés pour ce bailleur afin de relier son espace de suivi de patrimoine.
          </p>
          <div style="max-height:180px;overflow-y:auto;padding-right:4px">
            ${bailleurPropsCheckboxes}
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Annuler</button>
          <button type="submit" class="btn btn-primary" id="btnSubmitApprove">
            ✅ Activer le compte & Valider les accès
          </button>
        </div>
      </form>
    `;

    Modal.open({
      title: `Validation d'inscription : ${user.full_name}`,
      content: html,
      size: 'medium',
    });

    this.onApproveRoleChanged();
  },

  onApproveRoleChanged() {
    const roleSelect = document.getElementById('app_role_id');
    const locBox = document.getElementById('approveLocataireBox');
    const bailleurBox = document.getElementById('approveBailleurBox');
    if (!roleSelect) return;

    const selectedId = roleSelect.value;
    const roleObj = this._roles.find(r => String(r.id) === String(selectedId));
    const isLocataire = roleObj && (roleObj.name === 'locataire' || roleObj.label === 'Locataire');
    const isBailleur = roleObj && (roleObj.name === 'bailleur' || roleObj.label === 'Bailleur');

    if (locBox) locBox.style.display = isLocataire ? 'block' : 'none';
    if (bailleurBox) bailleurBox.style.display = isBailleur ? 'block' : 'none';
  },

  onApprovePropertySelected(propId) {
    const aptSelect = document.getElementById('app_apartment_id');
    if (!aptSelect) return;
    if (!propId) {
      aptSelect.innerHTML = '<option value="">Sélectionnez d\'abord un immeuble</option>';
      return;
    }
    const filteredApts = (this._allApartments || []).filter(a => String(a.property_id) === String(propId));
    if (!filteredApts.length) {
      aptSelect.innerHTML = '<option value="">Aucun appartement dans cet immeuble</option>';
      return;
    }
    aptSelect.innerHTML = '<option value="">Choisir un logement...</option>' + filteredApts.map(a => {
      const isFree = a.status === 'free';
      const label = `${a.apartment_number} ${a.apartment_type ? '· ' + a.apartment_type : ''} (${isFree ? '🟢 Libre' : '🟠 ' + a.status}) - ${Helpers.formatMoney(a.rent_amount)}`;
      return `<option value="${a.id}" data-rent="${a.rent_amount || 0}">${label}</option>`;
    }).join('');
  },

  onApproveApartmentSelected(aptId) {
    const aptSelect = document.getElementById('app_apartment_id');
    const rentInput = document.getElementById('app_rent_amount');
    const depositInput = document.getElementById('app_deposit_amount');
    if (!aptSelect || !aptId) return;

    const opt = aptSelect.options[aptSelect.selectedIndex];
    const rent = opt ? parseFloat(opt.getAttribute('data-rent')) : 0;
    if (rentInput && rent) rentInput.value = rent;
    if (depositInput && rent && !depositInput.value) depositInput.value = rent * 2;
  },

  async submitApproveRegistration(e, userId) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitApprove');
    btn.disabled = true;
    btn.textContent = 'Validation en cours...';

    const roleSelect = document.getElementById('app_role_id');
    const selectedRoleId = parseInt(roleSelect.value, 10);
    const roleObj = this._roles.find(r => r.id === selectedRoleId);
    const isLocataire = roleObj && (roleObj.name === 'locataire' || roleObj.label === 'Locataire');
    const isBailleur = roleObj && (roleObj.name === 'bailleur' || roleObj.label === 'Bailleur');

    const payload = {
      role_id: selectedRoleId,
      city: document.getElementById('app_city')?.value || 'Yaoundé',
    };

    if (isLocataire) {
      const aptId = document.getElementById('app_apartment_id')?.value;
      if (aptId) payload.apartment_id = parseInt(aptId, 10);
      const propId = document.getElementById('app_property_id')?.value;
      if (propId) payload.property_id = parseInt(propId, 10);
      const rent = document.getElementById('app_rent_amount')?.value;
      if (rent) payload.monthly_rent = parseFloat(rent);
      const deposit = document.getElementById('app_deposit_amount')?.value;
      if (deposit) payload.deposit_amount = parseFloat(deposit);
      const sDate = document.getElementById('app_start_date')?.value;
      if (sDate) payload.start_date = sDate;
    } else if (isBailleur) {
      payload.property_id = Array.from(document.querySelectorAll('.approve-bailleur-prop-chk:checked')).map(c => Number(c.value));
    }

    try {
      await API.post(`/users/${userId}/approve`, payload);
      Toast.success('Compte validé et rôle attribué avec succès ! 🎉');
      Modal.close();
      this.render();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de la validation');
      btn.disabled = false;
      btn.textContent = '✅ Activer le compte & Valider les accès';
    }
  },

  async rejectRegistration(userId) {
    Modal.confirm('Voulez-vous vraiment refuser cette demande d\'inscription ? Le compte en attente sera définitivement supprimé.', async () => {
      try {
        await API.post(`/users/${userId}/reject`);
        Toast.success('Demande d\'inscription refusée et supprimée.');
        this.render();
      } catch (err) {
        Toast.error(err.message || 'Erreur lors du rejet');
      }
    });
  },

  // ===== Affectation d'immeubles à un gestionnaire/comptable =====
  async openAssignProperties(userId, userName) {
    try {
      Toast.info('Chargement...');
      const [propsRes, assignedRes] = await Promise.all([
        API.get('/properties'),
        API.get(`/users/${userId}/assigned-properties`),
      ]);
      const allProps = propsRes.data || [];
      const assignedIds = new Set((assignedRes.data || []).map((p) => p.id));

      const checkboxes = allProps.map((p) => `
        <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;border:1px solid ${assignedIds.has(p.id) ? '#b7dfc2' : '#e2e8f0'};background:${assignedIds.has(p.id) ? '#f0fff4' : '#fff'};margin-bottom:6px;transition:all 0.15s">
          <input type="checkbox" value="${p.id}" ${assignedIds.has(p.id) ? 'checked' : ''} style="width:16px;height:16px;accent-color:#27ae60" onchange="this.closest('label').style.background=this.checked?'#f0fff4':'#fff';this.closest('label').style.borderColor=this.checked?'#b7dfc2':'#e2e8f0'">
          <span>
            <b style="color:var(--text)">${p.property_name}</b>
            <small style="color:var(--text-muted);margin-left:6px">${p.city || ''} — ${(p.apartments || []).length} logement(s)</small>
          </span>
        </label>
      `).join('');

      const html = `
        <div style="padding:4px">
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
            Sélectionnez les immeubles <b>prioritaires</b> pour <b>${userName}</b>. 
            Ces immeubles apparaîtront en tête de liste dans son interface. 
            Il pourra toujours accéder aux autres immeubles en cas d'absence d'un collègue.
          </p>
          <div style="max-height:320px;overflow-y:auto;padding-right:4px" id="assignPropsCheckboxes">
            ${checkboxes || '<p style="color:var(--text-muted);text-align:center">Aucun immeuble disponible</p>'}
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
            <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
            <button class="btn btn-primary" onclick="PageUsers.saveAssignedProperties(${userId})">💾 Enregistrer</button>
          </div>
        </div>
      `;

      Modal.open({ title: `🏢 Immeubles affectés — ${userName}`, content: html, size: 'medium' });
    } catch (err) {
      Toast.error(err.message || 'Erreur lors du chargement');
    }
  },

  async saveAssignedProperties(userId) {
    try {
      const checkboxes = document.querySelectorAll('#assignPropsCheckboxes input[type="checkbox"]:checked');
      const property_ids = Array.from(checkboxes).map((cb) => Number(cb.value));
      await API.put(`/users/${userId}/assigned-properties`, { property_ids });
      Toast.success(`${property_ids.length} immeuble(s) affecté(s) avec succès ✅`);
      Modal.close();
      await this.render();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de l\'enregistrement');
    }
  },
};

