// ============ Gestion des modales ============
const Modal = {
  open(titleOrObj, bodyHtml = '', footerHtml = '') {
    let title = titleOrObj;
    let body = bodyHtml;
    let footer = footerHtml;
    let size = '';

    if (typeof titleOrObj === 'object' && titleOrObj !== null) {
      title = titleOrObj.title || '';
      body = titleOrObj.content || titleOrObj.body || '';
      footer = titleOrObj.footer || '';
      size = titleOrObj.size ? `modal-${titleOrObj.size}` : '';
    }

    let overlay = document.getElementById('app-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'app-modal';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div class="modal-content ${size}">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="Modal.close()">&times;</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>`;
    overlay.classList.add('active');
    overlay.onclick = (e) => { if (e.target === overlay) Modal.close(); };
    if (typeof Icons !== 'undefined') Icons.enhance(overlay);
  },
  close() {
    const o = document.getElementById('app-modal');
    if (o) o.classList.remove('active');
  },
  confirm(message, onConfirm) {
    this.open('Confirmation', `
      <div style="padding:10px 0;font-size:14px;color:var(--text);line-height:1.5">
        ${message}
      </div>
    `, `
      <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
      <button class="btn btn-danger" id="modalConfirmBtn" style="font-weight:600">Confirmer</button>
    `);
    const btn = document.getElementById('modalConfirmBtn');
    if (btn) {
      btn.onclick = async () => {
        Modal.close();
        if (typeof onConfirm === 'function') await onConfirm();
      };
    }
  },
};
