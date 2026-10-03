const PageDocuments = {
  register() { Router.register('documents', () => this.render()); },

  CATS: [
    { value: 'contract', label: '📄 Contrat' },
    { value: 'cni', label: '🪪 CNI' },
    { value: 'invoice', label: '🧾 Facture' },
    { value: 'report', label: '📋 Rapport' },
    { value: 'justificatif', label: '💳 Justificatif' },
    { value: 'document', label: '📁 Document administratif' },
  ],
  catLabel(v) { const c = this.CATS.find((x) => x.value === v); return c ? c.label : (v || 'Document'); },

  async render() {
    Layout.setTitle('Documents');
    const { data } = await API.get('/documents');
    const canManage = Auth.hasRole('manager', 'dir_admin', 'super_admin') || Auth.hasPermission('can_manage_documents');
    const isPdf = (t) => (t || '').includes('pdf');
    const rows = data.length ? data.map((d) => `<tr>
      ${canManage ? `<td style="text-align:center"><input type="checkbox" class="doc-row-chk" value="${d.id}" onchange="PageDocuments.onRowSelectChange()" /></td>` : ''}
      <td>${isPdf(d.file_type) ? '📕' : '🖼'} <b>${d.file_name}</b></td>
      <td><span class="badge badge-primary">${this.catLabel(d.related_table)}</span></td>
      <td>${d.uploader ? d.uploader.full_name : '—'}</td>
      <td>${Helpers.formatDate(d.created_at)}</td>
      <td>
        <a class="btn btn-sm btn-outline" href="${Helpers.fileUrl(d.file_path)}" target="_blank">👁 Aperçu</a>
        <a class="btn btn-sm btn-outline" href="${Helpers.fileUrl(d.file_path)}" download>⬇</a>
        ${canManage ? `<button class="btn btn-sm btn-danger" onclick="PageDocuments.remove(${d.id})">🗑</button>` : ''}
      </td></tr>`).join('') : `<tr><td colspan="${canManage ? 6 : 5}" class="text-center text-muted" style="padding:36px">Aucun document</td></tr>`;

    Layout.content(`
      <div class="page-head">
        <div><h2>Gestion documentaire</h2><div class="subtitle">${data.length} document(s)</div></div>
        <button class="btn btn-primary" onclick="PageDocuments.openUpload()">⬆ Téléverser</button>
      </div>

      <!-- Barre d'action groupée pour documents -->
      ${canManage ? `
        <div id="docBulkBar" style="display:none;background:#fee2e2;border:1px solid #fca5a5;padding:10px 16px;border-radius:8px;margin-bottom:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div style="font-size:13px;color:#991b1b;font-weight:600">
            <span id="docSelectedCount">0</span> document(s) sélectionné(s)
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm btn-outline" style="border-color:#f87171;color:#991b1b" onclick="PageDocuments.clearSelection()">Annuler</button>
            <button class="btn btn-sm btn-danger" onclick="PageDocuments.bulkDelete()">🗑️ Tout supprimer la sélection</button>
          </div>
        </div>
      ` : ''}

      <div class="card"><div class="table-wrap"><table>
        <thead><tr>
          ${canManage ? '<th style="width:36px;text-align:center"><input type="checkbox" id="docSelectAll" title="Tout sélectionner" onchange="PageDocuments.toggleSelectAll(this.checked)" /></th>' : ''}
          <th>Fichier</th><th>Catégorie</th><th>Ajouté par</th><th>Date</th><th>Actions</th>
        </tr></thead>
        <tbody>${rows}</tbody></table></div></div>`);
  },

  openUpload() {
    const opts = this.CATS.map((c) => `<option value="${c.value}">${c.label}</option>`).join('');
    Modal.open('Téléverser un document', `
      <div class="form-group"><label>Catégorie</label><select class="form-control" id="docCat">${opts}</select></div>
      <div class="form-group"><label>Fichier (PDF ou image)</label>
        <input type="file" class="form-control" id="docFile" accept="image/*,application/pdf"/></div>`,
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
       <button class="btn btn-primary" onclick="PageDocuments.submit()">Téléverser</button>`);
  },
  async submit() {
    const file = document.getElementById('docFile').files[0];
    if (!file) { Toast.error('Sélectionnez un fichier'); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', document.getElementById('docCat').value);
    try { await API.upload('/documents', fd); Modal.close(); Toast.success('Document téléversé'); PageDocuments.render(); }
    catch (e) { Toast.error(e.message); }
  },
  remove(id) { CrudPage.confirmDelete('/documents/' + id, () => PageDocuments.render()); },

  toggleSelectAll(checked) {
    document.querySelectorAll('.doc-row-chk').forEach((c) => { c.checked = checked; });
    this.onRowSelectChange();
  },

  onRowSelectChange() {
    const checked = document.querySelectorAll('.doc-row-chk:checked');
    const bar = document.getElementById('docBulkBar');
    const cnt = document.getElementById('docSelectedCount');
    const allChk = document.getElementById('docSelectAll');
    const total = document.querySelectorAll('.doc-row-chk').length;
    if (cnt) cnt.textContent = checked.length;
    if (bar) bar.style.display = checked.length > 0 ? 'flex' : 'none';
    if (allChk) allChk.checked = total > 0 && checked.length === total;
  },

  clearSelection() {
    document.querySelectorAll('.doc-row-chk').forEach((c) => { c.checked = false; });
    const allChk = document.getElementById('docSelectAll');
    if (allChk) allChk.checked = false;
    this.onRowSelectChange();
  },

  async bulkDelete() {
    const checked = Array.from(document.querySelectorAll('.doc-row-chk:checked')).map((c) => Number(c.value));
    if (!checked.length) {
      Toast.warning('Aucun document sélectionné');
      return;
    }
    if (!confirm(`Confirmez-vous la suppression groupée de ces ${checked.length} document(s) ? Cette action est irréversible.`)) {
      return;
    }
    try {
      Toast.info('Suppression groupée en cours...');
      const res = await API.post('/documents/bulk-delete', { ids: checked });
      Toast.success(res.message || `${checked.length} document(s) supprimé(s) avec succès`);
      this.clearSelection();
      this.render();
    } catch (e) {
      Toast.error(e.message || 'Erreur lors de la suppression groupée');
    }
  },
};
