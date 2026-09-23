// ============ Centre de notifications (cloche topbar) ============
const Notifications = {
  timer: null,
  _items: [],

  async load() {
    try {
      const res = await API.get('/notifications');
      const items = (res.data && res.data.items) || [];
      const unread = (res.data && typeof res.data.unread === 'number') ? res.data.unread : items.filter((n) => !n.is_read).length;
      this._items = items;
      this.render(items, unread);
    } catch (_) { /* silencieux */ }
  },

  render(items, unread) {
    const badge = document.getElementById('notifBadge');
    if (badge) {
      badge.textContent = unread > 9 ? '9+' : unread;
      badge.style.display = unread > 0 ? 'flex' : 'none';
    }
    const list = document.getElementById('notifList');
    if (!list) return;

    if (!items.length) {
      list.innerHTML = `
        <div class="empty-state" style="padding:24px;text-align:center;color:var(--text-muted)">
          <div style="font-size:24px;margin-bottom:6px">🔔</div>
          <div>Aucune notification</div>
        </div>`;
      return;
    }

    list.innerHTML = items.map((n) => {
      const icon = this.getNotifIcon(n);
      return `
        <div class="notif-item ${n.is_read ? '' : 'unread'}" style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.15s" onclick="Notifications.handleClick(${n.id})">
          <div style="font-size:18px;line-height:1;margin-top:2px">${icon}</div>
          <div style="flex:1;min-width:0">
            <div class="notif-title" style="font-weight:600;font-size:13px;color:var(--text);margin-bottom:2px">${Helpers.escapeHtml(n.title)}</div>
            <div class="notif-msg" style="font-size:12px;color:var(--text-muted);line-height:1.3">${Helpers.escapeHtml(n.message || '')}</div>
            <div class="notif-time" style="font-size:10px;color:var(--text-muted);margin-top:4px;opacity:0.8">${Helpers.formatDateTime(n.created_at)}</div>
          </div>
          <button class="btn-icon" onclick="event.stopPropagation(); Notifications.deleteItem(${n.id})" title="Supprimer" style="background:transparent;border:none;color:var(--text-muted);font-size:12px;cursor:pointer;padding:2px 4px;border-radius:4px">✕</button>
        </div>
      `;
    }).join('');
  },

  getNotifIcon(n) {
    const text = `${n.title || ''} ${n.message || ''} ${n.type || ''}`.toLowerCase();
    if (text.includes('loyer') || text.includes('paiement') || text.includes('payé') || text.includes('impayé')) return '💰';
    if (text.includes('rappel') || text.includes('retard') || text.includes('échéance')) return '⏰';
    if (text.includes('charge') || text.includes('électricité') || text.includes('eau') || text.includes('compteur')) return '⚡';
    if (text.includes('panne') || text.includes('maintenance') || text.includes('réparation')) return '🔧';
    if (text.includes('chantier') || text.includes('travaux')) return '🏗️';
    if (text.includes('stock') || text.includes('entrepôt') || text.includes('matériel')) return '📦';
    if (text.includes('bail') || text.includes('contrat')) return '📄';
    if (text.includes('locataire')) return '👤';
    if (text.includes('immeuble')) return '🏢';
    return '🔔';
  },

  async handleClick(id) {
    const n = this._items.find((x) => x.id === id);
    // 1. Marquer comme lue
    try {
      await API.patch(`/notifications/${id}/read`);
    } catch (_) {}

    // 2. Fermer le volet de notification
    const dd = document.getElementById('notifDropdown');
    if (dd) dd.classList.remove('open');

    // 3. Rafraîchir les notifications en arrière-plan
    this.load();

    // 4. Redirection vers la page / tâche associée
    if (!n) return;
    const target = this.resolveRoute(n);
    if (target) {
      if (window.Router && Router.go) {
        Router.go(target);
      } else {
        window.location.hash = `#${target}`;
      }
    }
  },

  resolveRoute(n) {
    if (n.link) {
      return n.link.replace(/^#\/?/, '').replace(/^\//, '');
    }
    const text = `${n.title || ''} ${n.message || ''} ${n.type || ''}`.toLowerCase();
    const role = (window.Auth && Auth.getRole) ? Auth.getRole() : '';

    if (role === 'locataire') {
      if (text.includes('loyer') || text.includes('paiement') || text.includes('payé') || text.includes('impayé') || text.includes('rappel') || text.includes('échéance')) return 'my-payments';
      if (text.includes('charge') || text.includes('électricité') || text.includes('eau') || text.includes('compteur')) return 'my-utilities';
      if (text.includes('panne') || text.includes('maintenance') || text.includes('réparation')) return 'my-maintenance';
      if (text.includes('bail') || text.includes('contrat')) return 'my-lease';
      return 'dashboard';
    }

    if (text.includes('loyer') || text.includes('paiement') || text.includes('payé') || text.includes('impayé') || text.includes('rappel') || text.includes('échéance')) return 'payments';
    if (text.includes('charge') || text.includes('électricité') || text.includes('eau') || text.includes('compteur')) return 'utilities';
    if (text.includes('panne') || text.includes('maintenance') || text.includes('réparation')) return 'maintenance';
    if (text.includes('chantier') || text.includes('travaux')) return 'worksites';
    if (text.includes('stock') || text.includes('entrepôt') || text.includes('matériel') || text.includes('réception')) return 'stock';
    if (text.includes('équipement') || text.includes('outillage')) return 'equipment';
    if (text.includes('bail') || text.includes('contrat')) return 'leases';
    if (text.includes('locataire')) return 'tenants';
    if (text.includes('immeuble')) return 'properties';
    if (text.includes('tâche') || text.includes('task')) return 'tasks';
    if (text.includes('salaire') || text.includes('paie')) return 'salaries';

    return 'activity';
  },

  toggle() {
    const dd = document.getElementById('notifDropdown');
    if (dd) dd.classList.toggle('open');
  },

  async markRead(id) {
    try {
      await API.patch(`/notifications/${id}/read`);
      this.load();
    } catch (_) {}
  },

  async markAllRead() {
    try {
      await API.patch('/notifications/read-all');
      this.load();
      Toast.success('Toutes les notifications ont été marquées comme lues');
    } catch (_) {}
  },

  async deleteItem(id) {
    try {
      await API.delete(`/notifications/${id}`);
      this.load();
      Toast.info('Notification supprimée');
    } catch (err) {
      Toast.error('Erreur lors de la suppression');
    }
  },

  async deleteAll() {
    Modal.confirm('Voulez-vous vraiment supprimer toutes les notifications ?', async () => {
      try {
        await API.delete('/notifications/clear');
        this.load();
        Toast.success('Toutes les notifications ont été supprimées');
      } catch (err) {
        Toast.error('Erreur lors de la suppression des notifications');
      }
    });
  },

  start() {
    this.load();
    this.timer = setInterval(() => this.load(), 30000);
  },
};
