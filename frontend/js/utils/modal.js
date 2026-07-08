// ============ Gestion des modales ============
const Modal = {
  open(title, bodyHtml, footerHtml = '') {
    let overlay = document.getElementById('app-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'app-modal';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="Modal.close()">&times;</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
      </div>`;
    overlay.classList.add('active');
    overlay.onclick = (e) => { if (e.target === overlay) Modal.close(); };
    if (typeof Icons !== 'undefined') Icons.enhance(overlay);
  },
  close() {
    const o = document.getElementById('app-modal');
    if (o) o.classList.remove('active');
  },
};
