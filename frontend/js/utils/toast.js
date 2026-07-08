// ============ Notifications Toast ============
const Toast = {
  container() {
    let c = document.getElementById('toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toast-container';
      document.body.appendChild(c);
    }
    return c;
  },
  show(message, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = message;
    this.container().appendChild(t);
    if (typeof Icons !== 'undefined') Icons.enhance(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(120%)';
      setTimeout(() => t.remove(), 300);
    }, 3500);
  },
  success(m) { this.show(m, 'success'); },
  error(m) { this.show(m, 'error'); },
  info(m) { this.show(m, 'info'); },
};
