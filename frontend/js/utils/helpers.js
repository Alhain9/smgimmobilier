const Helpers = {
  formatMoney(amount) { return new Intl.NumberFormat('fr-FR').format(parseFloat(amount) || 0) + ' FCFA'; },
  formatDate(date) { if (!date) return '—'; return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); },
  formatDateTime(date) { if (!date) return '—'; return new Date(date).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); },
  initials(name) { if (!name) return '?'; return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase(); },
  statusBadge(status) {
    const map = {
      // appartements
      free: ['badge-success', 'Libre'], occupied: ['badge-info', 'Occupé'],
      reserved: ['badge-warning', 'Réservé'],
      // paiements
      completed: ['badge-success', 'Payé'], pending: ['badge-warning', 'En attente'],
      awaiting_confirmation: ['badge-info', 'À vérifier'],
      failed: ['badge-danger', 'Échoué'], refunded: ['badge-muted', 'Remboursé'],
      // maintenance
      reported: ['badge-warning', 'Signalé'], in_progress: ['badge-info', 'En cours'],
      // général / utilisateurs / baux / tenants
      active: ['badge-success', 'Actif'], inactive: ['badge-muted', 'Inactif'],
      suspended: ['badge-danger', 'Suspendu'], terminated: ['badge-danger', 'Résilié'],
      expired: ['badge-muted', 'Expiré'], cancelled: ['badge-muted', 'Annulé'],
      // tâches
      // equipment
      available: ['badge-success', 'Disponible'], in_use: ['badge-info', 'Utilisé'],
      out_of_stock: ['badge-danger', 'Rupture'], maintenance: ['badge-warning', 'Maintenance'],
    };
    // 'completed' partagé maintenance/tâche -> 'Terminé' si contexte maintenance? on garde 'Payé' pour paiement.
    const [cls, label] = map[status] || ['badge-muted', status];
    return `<span class="badge ${cls}">${label}</span>`;
  },
  // libellé spécifique maintenance/tâche pour 'completed'
  maintStatus(status) {
    const map = { reported: ['badge-warning','Signalé'], validated: ['badge-primary','Validé'], in_progress: ['badge-info','En cours'], completed: ['badge-success','Terminé'], cancelled: ['badge-muted','Annulé'] };
    const [cls, label] = map[status] || ['badge-muted', status];
    return `<span class="badge ${cls}">${label}</span>`;
  },
  propertyType(t) {
    const map = { immeuble: '🏢 Immeuble', maison: '🏠 Maison', terrain: '🌍 Terrain' };
    return map[t] || t;
  },
  taskStatus(status) {
    const map = { pending: ['badge-warning','À faire'], in_progress: ['badge-info','En cours'], completed: ['badge-success','Effectuée'], not_done: ['badge-danger','Non effectuée'], cancelled: ['badge-muted','Annulé'] };
    const [cls, label] = map[status] || ['badge-muted', status];
    return `<span class="badge ${cls}">${label}</span>`;
  },
  priorityBadge(p) {
    const map = { low: ['badge-muted','Basse'], medium: ['badge-info','Normale'], high: ['badge-warning','Haute'], urgent: ['badge-danger','Urgente'] };
    const [cls, label] = map[p] || ['badge-muted', p];
    return `<span class="badge ${cls}">${label}</span>`;
  },
  methodLabel(m) {
    const map = { orange_money: 'Orange Money', mtn_mobile_money: 'MTN MoMo', bank_transfer: 'Virement', cash: 'Espèces', campay: 'Mobile Money', kang: 'Mobile Money (Kang)' };
    return map[m] || m;
  },
  fileUrl(path) { if (!path) return ''; return path.startsWith('http') ? path : CONFIG.SERVER_URL + path; },
  debounce(fn, delay = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); }; },
};
