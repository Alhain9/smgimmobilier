// ============ Layout : sidebar, menu par rôle, routeur ============
const Layout = {
  // Définition complète du menu avec rôles autorisés
  menu: [
    { section: 'Principal' },
    { id: 'dashboard', label: 'Tableau de bord', icon: '📊', roles: ['*'] },
    { id: 'activity', label: 'Activité du jour', icon: '📋', roles: ['super_admin','manager','dir_admin','dir_technique','gestionnaire','comptable','technicien'] },
    { id: 'calendar', label: 'Calendrier', icon: '📅', roles: ['*'] },

    { section: 'Immobilier' },
    { id: 'properties', label: 'Immeubles', icon: '🏢', roles: ['super_admin','manager','dir_admin','gestionnaire'] },
    { id: 'apartments', label: 'Logements', icon: '🚪', roles: ['super_admin','manager','dir_admin','gestionnaire'] },
    { id: 'tenants', label: 'Locataires', icon: '👤', roles: ['super_admin','manager','dir_admin','gestionnaire'] },
    { id: 'leases', label: 'Contrats de bail', icon: '📄', roles: ['super_admin','manager','dir_admin','gestionnaire'] },
    { id: 'situation', label: 'Situation & rapports', icon: '📋', roles: ['super_admin','manager','dir_admin','gestionnaire'] },

    { section: 'Finance' },
    { id: 'payments', label: 'Paiements', icon: '💰', roles: ['super_admin','manager','comptable','dir_admin','gestionnaire'] },
    { id: 'utilities', label: 'Charges & compteurs', icon: '⚡', roles: ['super_admin','manager','comptable','dir_admin','gestionnaire'] },
    { id: 'expenses', label: 'Dépenses', icon: '🧾', roles: ['super_admin','manager','comptable','dir_technique'] },
    { id: 'salaries', label: 'Salaires & paie', icon: '💵', roles: ['super_admin','manager','comptable'] },
    { id: 'my-salary', label: 'Mon salaire', icon: '🪙', roles: ['manager','dir_admin','dir_technique','gestionnaire','comptable','technicien'] },
    { id: 'rh', label: 'Ressources Humaines', icon: '👥', roles: ['super_admin','manager','comptable'] },

    { section: 'Technique' },
    { id: 'maintenance', label: 'Maintenances', icon: '🔧', roles: ['super_admin','manager','dir_technique','gestionnaire','technicien'] },
    { id: 'equipment', label: 'Équipements', icon: '🛠', roles: ['super_admin','manager','dir_technique','comptable'] },
    { id: 'tasks', label: 'Tâches', icon: '✅', roles: ['*'] },
    { id: 'kanban', label: 'Kanban tâches', icon: '📋', roles: ['*'] },

    { section: 'Administration' },
    { id: 'documents', label: 'Documents', icon: '📂', roles: ['super_admin','manager','dir_admin','gestionnaire','comptable'] },
    { id: 'reports', label: 'Rapports', icon: '📈', roles: ['super_admin','manager','dir_admin','dir_technique','comptable'] },
    { id: 'users', label: 'Utilisateurs', icon: '👥', roles: ['super_admin','manager'] },
    { id: 'workflows', label: 'Circuit Validation', icon: '🔄', roles: ['super_admin','manager'] },
    { id: 'gps', label: 'Géolocalisation', icon: '📍', roles: ['super_admin','manager','dir_technique'] },

    { section: 'Collaboration' },
    { id: 'messages', label: 'Messagerie', icon: '💬', roles: ['*'] },

    { section: 'Compte' },
    { id: 'profile', label: 'Mon profil', icon: '👤', roles: ['*'] },
  ],

  // Espace locataire : menu réduit
  tenantMenu: [
    { section: 'Mon espace' },
    { id: 'dashboard', label: 'Accueil', icon: '🏠', roles: ['*'] },
    { id: 'my-lease', label: 'Mon bail', icon: '📄', roles: ['*'] },
    { id: 'my-payments', label: 'Mes paiements', icon: '💰', roles: ['*'] },
    { id: 'my-utilities', label: 'Mes charges', icon: '⚡', roles: ['*'] },
    { id: 'my-maintenance', label: 'Mes demandes', icon: '🔧', roles: ['*'] },
    { section: 'Compte' },
    { id: 'profile', label: 'Mon profil', icon: '👤', roles: ['*'] },
  ],

  canAccess(item) {
    if (item.roles.includes('*')) return true;
    return Auth.hasRole(...item.roles);
  },

  renderSidebar() {
    const role = Auth.getRole();
    const items = role === 'locataire' ? this.tenantMenu : this.menu;
    const nav = document.getElementById('sidebarNav');
    let html = '';
    items.forEach((item) => {
      if (item.section) { html += `<div class="nav-section-title">${item.section}</div>`; return; }
      if (!this.canAccess(item)) return;
      html += `<div class="nav-item" data-page="${item.id}" onclick="Router.go('${item.id}')">
        <span class="nav-icon">${item.icon}</span> ${item.label}</div>`;
    });
    nav.innerHTML = html;
    if (typeof Icons !== 'undefined') Icons.enhance(nav);
  },

  setActive(pageId) {
    document.querySelectorAll('.nav-item[data-page]').forEach((el) => {
      el.classList.toggle('active', el.dataset.page === pageId);
    });
  },

  setTitle(title) {
    document.getElementById('pageTitle').textContent = title;
  },

  renderUser() {
    const u = Auth.getUser();
    if (!u) return;
    document.getElementById('userName').textContent = u.full_name;
    document.getElementById('userRole').textContent = ROLE_LABELS[Auth.getRole()] || '';
    document.getElementById('userAvatar').textContent = Helpers.initials(u.full_name);
  },

  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
  },

  closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
  },

  content(html) {
    const el = document.getElementById('appContent');
    el.innerHTML = html;
    if (typeof Icons !== 'undefined') Icons.enhance(el);
  },

  loading() {
    this.content('<div class="spinner"></div>');
  },
};

// ============ Routeur SPA ============
const Router = {
  routes: {},
  register(id, handler) { this.routes[id] = handler; },

  async go(pageId) {
    Layout.setActive(pageId);
    Layout.closeSidebar();
    Layout.loading();
    const handler = this.routes[pageId];
    if (!handler) {
      Layout.content('<div class="empty-state"><div class="icon">🚧</div><h3>Page en construction</h3></div>');
      return;
    }
    try {
      await handler();
    } catch (err) {
      Layout.content(`<div class="empty-state"><div class="icon">⚠️</div><h3>Erreur de chargement</h3><p>${err.message}</p></div>`);
    }
    window.location.hash = pageId;
  },
};
