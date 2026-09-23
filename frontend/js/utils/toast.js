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
    let text = message;
    if (text instanceof Error) {
      text = text.message;
    } else if (typeof text === 'object' && text !== null) {
      text = text.message || text.error || text.msg || JSON.stringify(text);
    }
    if (text === undefined || text === null || text === 'undefined' || text === '[object Object]') {
      text = type === 'error' ? 'Une erreur est survenue' : '';
    }
    if (!text) return;

    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `
      <div style="flex:1">${text}</div>
      <button style="background:none;border:none;color:inherit;font-size:16px;cursor:pointer;opacity:0.7;margin-left:8px" onclick="this.parentElement.remove()">✕</button>
    `;
    this.container().appendChild(t);
    if (typeof Icons !== 'undefined') Icons.enhance(t);
    setTimeout(() => {
      if (t.parentElement) {
        t.style.opacity = '0';
        t.style.transform = 'translateX(120%)';
        setTimeout(() => t.remove(), 300);
      }
    }, 4500);
  },
  success(m) { this.show(m, 'success'); },
  error(m) { this.show(m, 'error'); },
  info(m) { this.show(m, 'info'); },
};
