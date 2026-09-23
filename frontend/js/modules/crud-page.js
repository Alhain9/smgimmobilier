// ============ Helper générique de page CRUD (avec sélection multiple & suppression par lot) ============
const CrudPage = {
  _current: null,

  _rowText(row) {
    const { columns } = this._current;
    return columns.map((c) => (c.render ? c.render(row) : (row[c.key] ?? '')))
      .join(' ').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').toLowerCase();
  },

  _renderBody(rows) {
    const { columns, rowActions, selectable } = this._current;
    const colCount = columns.length + (rowActions ? 1 : 0) + (selectable ? 1 : 0);
    if (!rows.length) {
      return `<tr><td colspan="${colCount}" class="text-center text-muted" style="padding:36px">Aucun résultat</td></tr>`;
    }
    return rows.map((row) => {
      const selectCell = selectable
        ? `<td style="width:36px;text-align:center"><input type="checkbox" class="row-select" value="${row.id}" onchange="CrudPage.updateBulkBar()"/></td>`
        : '';
      const cells = columns.map((c) => `<td>${c.render ? c.render(row) : (row[c.key] ?? '—')}</td>`).join('');
      const actions = rowActions ? `<td>${rowActions(row)}</td>` : '';
      return `<tr>${selectCell}${cells}${actions}</tr>`;
    }).join('');
  },

  filter(q) {
    if (!this._current) return;
    const query = String(q || '').trim().toLowerCase();
    const tbody = document.getElementById('crudTbody');
    if (!tbody) return;
    const rows = query ? this._current.data.filter((r) => this._rowText(r).includes(query)) : this._current.data;
    tbody.innerHTML = this._renderBody(rows);
    const count = document.getElementById('crudCount');
    if (count) count.textContent = `${rows.length} élément(s)`;
    this.updateBulkBar();
    if (typeof Icons !== 'undefined') Icons.enhance(tbody);
  },

  toggleSelectAll(master) {
    const checked = master.checked;
    document.querySelectorAll('.row-select').forEach((chk) => {
      chk.checked = checked;
    });
    this.updateBulkBar();
  },

  getSelectedIds() {
    const ids = [];
    document.querySelectorAll('.row-select:checked').forEach((chk) => {
      const val = Number(chk.value) || chk.value;
      if (val) ids.push(val);
    });
    return ids;
  },

  updateBulkBar() {
    const ids = this.getSelectedIds();
    const bar = document.getElementById('bulkBar');
    const cnt = document.getElementById('bulkCount');
    const master = document.getElementById('selectAllRows');

    if (cnt) cnt.textContent = ids.length;
    if (bar) {
      bar.style.display = ids.length > 0 ? 'flex' : 'none';
    }

    if (master) {
      const allBoxes = document.querySelectorAll('.row-select');
      if (allBoxes.length > 0 && ids.length === allBoxes.length) {
        master.checked = true;
        master.indeterminate = false;
      } else if (ids.length > 0) {
        master.checked = false;
        master.indeterminate = true;
      } else {
        master.checked = false;
        master.indeterminate = false;
      }
    }
  },

  async deleteSelected() {
    const ids = this.getSelectedIds();
    if (!ids.length) return;
    if (!confirm(`Voulez-vous vraiment supprimer les ${ids.length} élément(s) sélectionné(s) ?`)) return;

    try {
      const { endpoint, reloadFn } = this._current;
      await API.post(`${endpoint}/bulk-delete`, { ids });
      Toast.success(`${ids.length} élément(s) supprimé(s) avec succès`);
      if (reloadFn) {
        reloadFn();
      } else if (this._current.onReload) {
        this._current.onReload();
      } else {
        this.list(this._current.options);
      }
    } catch (err) {
      // Fallback si bulk-delete n'est pas supporté sur la route
      try {
        let count = 0;
        for (const id of ids) {
          await API.delete(`${this._current.endpoint}/${id}`);
          count++;
        }
        Toast.success(`${count} élément(s) supprimé(s) avec succès`);
        if (this._current.onReload) this._current.onReload();
        else this.list(this._current.options);
      } catch (e) {
        Toast.error(e.message || 'Erreur lors de la suppression par lot');
      }
    }
  },

  async list(options) {
    const { endpoint, title, columns, rowActions, canCreate, onCreate, toolbar = '', mapData, searchable = true, selectable = true, onReload } = options;
    Layout.setTitle(title);
    const res = await API.get(endpoint);
    let data = res.data || [];
    if (mapData) data = mapData(data);

    // Seul le Manager (et super_admin) a le droit de supprimer des éléments par lot
    const canSelect = selectable && Auth.hasRole('manager', 'super_admin');

    this._current = { data, columns, rowActions, endpoint, selectable: canSelect, onReload, options };

    const selectHead = canSelect
      ? `<th style="width:36px;text-align:center"><input type="checkbox" id="selectAllRows" onclick="CrudPage.toggleSelectAll(this)" title="Tout sélectionner / désélectionner"/></th>`
      : '';
    const head = selectHead + columns.map((c) => `<th>${c.label}</th>`).join('') + (rowActions ? '<th>Actions</th>' : '');

    const search = searchable
      ? `<div class="toolbar"><input class="form-control search" id="crudSearch" type="search" placeholder="🔎 Rechercher dans ${title.toLowerCase()}…" oninput="CrudPage.filter(this.value)" style="max-width:340px"/></div>`
      : '';

    const bulkBar = canSelect
      ? `<div id="bulkBar" style="display:none; background:var(--bg-surface-2); padding:10px 16px; border-radius:var(--radius-sm); margin-bottom:14px; align-items:center; justify-content:space-between; border:1px solid var(--border);">
          <div style="font-weight:600; font-size:13.5px;"><span id="bulkCount">0</span> élément(s) sélectionné(s)</div>
          <button class="btn btn-sm btn-danger" onclick="CrudPage.deleteSelected()">🗑 Supprimer la sélection</button>
        </div>`
      : '';

    Layout.content(`
      <div class="page-head">
        <div><h2>${title}</h2><div class="subtitle" id="crudCount">${data.length} élément(s)</div></div>
        ${canCreate ? `<button class="btn btn-primary" onclick="(${onCreate})()">+ Ajouter</button>` : ''}
      </div>
      ${search}
      ${toolbar}
      ${bulkBar}
      <div class="card"><div class="table-wrap"><table>
        <thead><tr>${head}</tr></thead><tbody id="crudTbody">${this._renderBody(data)}</tbody>
      </table></div></div>
    `);
    return data;
  },

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
    try { await API.delete(endpoint); Toast.success('Supprimé avec succès'); onDone(); }
    catch (e) { Toast.error(e.message); }
  },
};
