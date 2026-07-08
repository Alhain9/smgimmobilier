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
    const isPdf = (t) => (t || '').includes('pdf');
    const rows = data.length ? data.map((d) => `<tr>
      <td>${isPdf(d.file_type) ? '📕' : '🖼'} <b>${d.file_name}</b></td>
      <td><span class="badge badge-primary">${this.catLabel(d.related_table)}</span></td>
      <td>${d.uploader ? d.uploader.full_name : '—'}</td>
      <td>${Helpers.formatDate(d.created_at)}</td>
      <td>
        <a class="btn btn-sm btn-outline" href="${Helpers.fileUrl(d.file_path)}" target="_blank">👁 Aperçu</a>
        <a class="btn btn-sm btn-outline" href="${Helpers.fileUrl(d.file_path)}" download>⬇</a>
        ${Auth.hasRole('manager','dir_admin') ? `<button class="btn btn-sm btn-danger" onclick="PageDocuments.remove(${d.id})">🗑</button>` : ''}
      </td></tr>`).join('') : '<tr><td colspan="5" class="text-center text-muted" style="padding:36px">Aucun document</td></tr>';

    Layout.content(`
      <div class="page-head">
        <div><h2>Gestion documentaire</h2><div class="subtitle">${data.length} document(s)</div></div>
        <button class="btn btn-primary" onclick="PageDocuments.openUpload()">⬆ Téléverser</button>
      </div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Fichier</th><th>Catégorie</th><th>Ajouté par</th><th>Date</th><th>Actions</th></tr></thead>
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
};
