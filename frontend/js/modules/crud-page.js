// ============ Helper générique de page CRUD ============
// Usage: CrudPage.build({ endpoint, title, columns, fields, ... })
const CrudPage = {
  _current: null,

  // Texte recherchable d'une ligne (concatène les colonnes, sans HTML)
  _rowText(row) {
    const { columns } = this._current;
    return columns.map((c) => (c.render ? c.render(row) : (row[c.key] ?? '')))
      .join(' ').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').toLowerCase();
  },

  // Construit le corps du tableau (réutilisé au rendu initial et à la recherche)
  _renderBody(rows) {
    const { columns, rowActions } = this._current;
    if (!rows.length) {
      return `<tr><td colspan="${columns.length + (rowActions ? 1 : 0)}" class="text-center text-muted" style="padding:36px">Aucun résultat</td></tr>`;
    }
    return rows.map((row) => {
      const cells = columns.map((c) => `<td>${c.render ? c.render(row) : (row[c.key] ?? '—')}</td>`).join('');
      const actions = rowActions ? `<td>${rowActions(row)}</td>` : '';
      return `<tr>${cells}${actions}</tr>`;
    }).join('');
  },

  // Filtre instantané (appelé depuis le champ de recherche)
  filter(q) {
    if (!this._current) return;
    const query = String(q || '').trim().toLowerCase();
    const tbody = document.getElementById('crudTbody');
    if (!tbody) return;
    const rows = query ? this._current.data.filter((r) => this._rowText(r).includes(query)) : this._current.data;
    tbody.innerHTML = this._renderBody(rows);
    const count = document.getElementById('crudCount');
    if (count) count.textContent = `${rows.length} élément(s)`;
    if (typeof Icons !== 'undefined') Icons.enhance(tbody);
  },

  // Construit la barre + tableau (avec recherche intégrée)
  async list({ endpoint, title, columns, rowActions, canCreate, onCreate, toolbar = '', mapData, searchable = true }) {
    Layout.setTitle(title);
    const res = await API.get(endpoint);
    let data = res.data || [];
    if (mapData) data = mapData(data);

    this._current = { data, columns, rowActions };
    const head = columns.map((c) => `<th>${c.label}</th>`).join('') + (rowActions ? '<th>Actions</th>' : '');

    const search = searchable
      ? `<div class="toolbar"><input class="form-control search" id="crudSearch" type="search" placeholder="🔎 Rechercher dans ${title.toLowerCase()}…" oninput="CrudPage.filter(this.value)" style="max-width:340px"/></div>`
      : '';

    Layout.content(`
      <div class="page-head">
        <div><h2>${title}</h2><div class="subtitle" id="crudCount">${data.length} élément(s)</div></div>
        ${canCreate ? `<button class="btn btn-primary" onclick="(${onCreate})()">+ Ajouter</button>` : ''}
      </div>
      ${search}
      ${toolbar}
      <div class="card"><div class="table-wrap"><table>
        <thead><tr>${head}</tr></thead><tbody id="crudTbody">${this._renderBody(data)}</tbody>
      </table></div></div>
    `);
    return data;
  },

  // Génère les champs d'un formulaire
  formFields(fields, values = {}) {
    return fields.map((f) => {
      const val = values[f.name] ?? f.default ?? '';
      if (f.type === 'select') {
        const opts = f.options.map((o) =>
          `<option value="${o.value}" ${String(val) === String(o.value) ? 'selected' : ''}>${o.label}</option>`).join('');
        return `<div class="form-group ${f.half ? 'half' : ''}"><label>${f.label}</label>
          <select class="form-control" id="f_${f.name}" ${f.required ? 'required' : ''}>${opts}</select></div>`;
      }
      if (f.type === 'textarea') {
        return `<div class="form-group"><label>${f.label}</label>
          <textarea class="form-control" id="f_${f.name}" rows="3">${val}</textarea></div>`;
      }
      if (f.type === 'file') {
        return `<div class="form-group"><label>${f.label}</label>
          <input type="file" class="form-control" id="f_${f.name}" accept="${f.accept || ''}"/></div>`;
      }
      if (f.type === 'checkbox') {
        return `<div class="form-group"><label class="flex items-center gap-2" style="cursor:pointer;font-weight:400">
          <input type="checkbox" id="f_${f.name}" ${val ? 'checked' : ''} style="width:auto"/> ${f.label}</label></div>`;
      }
      return `<div class="form-group ${f.half ? 'half' : ''}"><label>${f.label}</label>
        <input type="${f.type || 'text'}" class="form-control" id="f_${f.name}" value="${val}" ${f.required ? 'required' : ''} placeholder="${f.placeholder || ''}"/></div>`;
    }).join('');
  },

  collectForm(fields) {
    const data = {};
    fields.forEach((f) => {
      if (f.type === 'file') return;
      const el = document.getElementById('f_' + f.name);
      if (!el) return;
      data[f.name] = f.type === 'checkbox' ? el.checked : el.value;
    });
    return data;
  },

  // Modale d'édition/création générique
  openForm({ title, fields, values = {}, onSubmit }) {
    Modal.open(title,
      `<form id="crudForm">${this.formFields(fields, values)}</form>`,
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
       <button class="btn btn-primary" id="crudSubmit">Enregistrer</button>`);
    document.getElementById('crudSubmit').onclick = async () => {
      try { await onSubmit(this.collectForm(fields)); Modal.close(); }
      catch (e) { Toast.error(e.message); }
    };
  },

  async confirmDelete(endpoint, onDone) {
    if (!confirm('Confirmer la suppression ?')) return;
    try { await API.delete(endpoint); Toast.success('Supprimé'); onDone(); }
    catch (e) { Toast.error(e.message); }
  },
};
