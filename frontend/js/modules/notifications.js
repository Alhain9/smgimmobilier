// ============ Centre de notifications (cloche topbar) ============
const Notifications = {
  timer: null,

  async load() {
    try {
      const { data } = await API.get('/notifications');
      this.render(data.items || [], data.unread || 0);
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
    list.innerHTML = items.length ? items.map((n) => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="Notifications.markRead(${n.id})">
        <div class="notif-title">${n.title}</div>
        <div class="notif-msg">${n.message || ''}</div>
        <div class="notif-time">${Helpers.formatDateTime(n.created_at)}</div>
      </div>`).join('') : '<div class="empty-state" style="padding:24px"><div class="icon">🔔</div>Aucune notification</div>';
  },

  toggle() {
    const dd = document.getElementById('notifDropdown');
    if (dd) dd.classList.toggle('open');
  },

  async markRead(id) {
    try { await API.patch(`/notifications/${id}/read`); this.load(); } catch (_) {}
  },
  async markAllRead() {
    try { await API.patch('/notifications/read-all'); this.load(); Toast.success('Tout marqué comme lu'); } catch (_) {}
  },

  start() {
    this.load();
    this.timer = setInterval(() => this.load(), 30000); // refresh toutes les 30s
  },
};
