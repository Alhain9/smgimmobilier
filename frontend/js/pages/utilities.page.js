// ============ Charges & compteurs : refacturation électricité / eau ============
const PageUtilities = {
  register() {
    Router.register('utilities', () => this.render());
    Router.register('my-utilities', () => this.renderMine());
  },
  _apts: [], _rows: {},
  MONTHS: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  monthLabel(m) { return this.MONTHS[m - 1] || m; },
  typeLabel(t) { return t === 'water' ? '💧 Eau' : '⚡ Électricité'; },
  conso(b) { return Math.max(0, Number(b.current_index) - Number(b.previous_index)); },

  // Logements des immeubles où la redistribution est activée (avec les prix/frais par défaut de l'immeuble)
  async loadBillable() {
    const props = (await API.get('/properties')).data || [];
    this._apts = [];
    props.filter((p) => p.utilities_enabled).forEach((p) => {
      (p.apartments || []).forEach((a) => {
        this._apts.push({
          id: a.id, label: `${a.apartment_number} — ${p.property_name}`,
          electricity_price: p.electricity_price, water_price: p.water_price,
          garbage_fee: p.garbage_fee, transport_fee: p.transport_fee,
        });
      });
    });
    return this._apts;
  },

  async render() {
    const canEdit = Auth.hasRole('manager', 'comptable', 'dir_admin', 'gestionnaire');
    const data = await CrudPage.list({
      endpoint: '/utility-bills', title: 'Charges & compteurs',
      canCreate: canEdit, onCreate: 'PageUtilities.create',
      columns: [
        { label: 'Logement', render: (r) => r.apartment ? `<b>${r.apartment.apartment_number}</b><br><span class="text-muted" style="font-size:12px">${r.apartment.property ? r.apartment.property.property_name : ''}</span>` : '—' },
        { label: 'Locataire', render: (r) => (r.apartment && r.apartment.tenants && r.apartment.tenants[0] && r.apartment.tenants[0].user) ? r.apartment.tenants[0].user.full_name : '—' },
        { label: 'Type', render: (r) => this.typeLabel(r.type) },
        { label: 'Période', render: (r) => `${this.monthLabel(r.period_month)} ${r.period_year}` },
        { label: 'Index', render: (r) => `${r.previous_index} → ${r.current_index}<br><span class="text-muted" style="font-size:12px">conso ${this.conso(r)}</span>` },
        { label: 'Total', render: (r) => `<b>${Helpers.formatMoney(r.total_amount)}</b>` },
        { label: 'Statut', render: (r) => Helpers.statusBadge(r.status === 'paid' ? 'completed' : 'pending') },
        { label: 'Justif.', render: (r) => r.payment_proof ? `<a href="${Helpers.fileUrl(r.payment_proof)}" target="_blank">📎 Reçu</a>` : '—' },
      ],
      rowActions: (r) => `
        <button class="btn btn-sm btn-outline" title="Facture PDF" onclick="PageUtilities.pdf(${r.id})">📄</button>
        ${canEdit ? `<button class="btn btn-sm ${r.status === 'paid' ? 'btn-outline' : 'btn-success'}" title="${r.status === 'paid' ? 'Marquer en attente' : 'Marquer payé'}" onclick="PageUtilities.togglePaid(${r.id}, ${r.status !== 'paid'})">${r.status === 'paid' ? '↩' : '✅'}</button>
        <button class="btn btn-sm btn-outline" title="Joindre un justificatif" onclick="PageUtilities.uploadProof(${r.id})">⬆</button>
        <button class="btn btn-sm btn-outline" onclick="PageUtilities.edit(${r.id})">✏️</button>` : ''}
        ${Auth.hasRole('manager', 'comptable') ? `<button class="btn btn-sm btn-danger" onclick="PageUtilities.remove(${r.id})">🗑</button>` : ''}`,
    });
    this._rows = {}; (data || []).forEach((r) => { this._rows[r.id] = r; });
  },

  // ----- Création / édition : modale avec report d'index + total en direct -----
  async openForm(existing) {
    await this.loadBillable();
    const now = new Date();
    const v = existing || {};
    const aptOptions = this._apts.map((a) => `<option value="${a.id}" ${v.apartment_id == a.id ? 'selected' : ''}>${a.label}</option>`).join('')
      || '<option value="">— Aucun immeuble avec redistribution activée —</option>';
    const yearOpts = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]
      .map((y) => `<option value="${y}" ${(v.period_year || now.getFullYear()) === y ? 'selected' : ''}>${y}</option>`).join('');
    const monthOpts = this.MONTHS.map((m, i) => `<option value="${i + 1}" ${(v.period_month || (now.getMonth() + 1)) === i + 1 ? 'selected' : ''}>${m}</option>`).join('');

    Modal.open(existing ? 'Modifier la facture de charges' : 'Nouvelle facture de charges', `
      <div class="form-row">
        <div class="form-group" style="flex:2"><label>Logement</label>
          <select class="form-control" id="uApt" ${existing ? 'disabled' : ''} onchange="PageUtilities.prefill()">${aptOptions}</select></div>
        <div class="form-group" style="flex:1"><label>Type</label>
          <select class="form-control" id="uType" onchange="PageUtilities.prefill()">
            <option value="electricity" ${v.type !== 'water' ? 'selected' : ''}>⚡ Électricité</option>
            <option value="water" ${v.type === 'water' ? 'selected' : ''}>💧 Eau</option>
          </select></div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1"><label>Mois</label><select class="form-control" id="uMonth">${monthOpts}</select></div>
        <div class="form-group" style="flex:1"><label>Année</label><select class="form-control" id="uYear">${yearOpts}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1"><label>Ancien index</label><input type="number" step="0.01" class="form-control" id="uPrev" value="${v.previous_index ?? 0}" oninput="PageUtilities.updateTotal()"/></div>
        <div class="form-group" style="flex:1"><label>Nouvel index</label><input type="number" step="0.01" class="form-control" id="uCurr" value="${v.current_index ?? ''}" oninput="PageUtilities.updateTotal()"/></div>
        <div class="form-group" style="flex:1"><label>Prix unité (FCFA)</label><input type="number" step="0.01" class="form-control" id="uPrice" value="${v.unit_price ?? ''}" oninput="PageUtilities.updateTotal()"/></div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1"><label>Poubelle (FCFA)</label><input type="number" class="form-control" id="uGarbage" value="${v.garbage_fee ?? 0}" oninput="PageUtilities.updateTotal()"/></div>
        <div class="form-group" style="flex:1"><label>Transport (FCFA)</label><input type="number" class="form-control" id="uTransport" value="${v.transport_fee ?? 0}" oninput="PageUtilities.updateTotal()"/></div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1"><label>Autre frais (FCFA)</label><input type="number" class="form-control" id="uOther" value="${v.other_fee ?? 0}" oninput="PageUtilities.updateTotal()"/></div>
        <div class="form-group" style="flex:2"><label>Libellé autre frais</label><input class="form-control" id="uOtherLabel" value="${v.other_label || ''}"/></div>
      </div>
      <div class="form-group"><label>Statut</label><select class="form-control" id="uStatus">
        <option value="pending" ${v.status !== 'paid' ? 'selected' : ''}>En attente</option>
        <option value="paid" ${v.status === 'paid' ? 'selected' : ''}>Payé</option>
      </select></div>
      <div class="list-item" style="background:var(--bg-surface-2);border-radius:8px;padding:10px 12px">
        <div style="flex:1">Consommation : <b id="uConso">0</b> · Total à payer</div><b id="uTotal" style="font-size:1.1rem">0 FCFA</b></div>`,
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
       <button class="btn btn-primary" id="uSubmit">Enregistrer</button>`);

    if (!existing) await this.prefill();
    else this.updateTotal();
    document.getElementById('uSubmit').onclick = () => this.submit(existing ? existing.id : null);
  },

  // Reporte l'ancien index + prix/frais depuis la dernière facture (ou les défauts de l'immeuble)
  async prefill() {
    const aptId = document.getElementById('uApt').value;
    const type = document.getElementById('uType').value;
    if (!aptId) return;
    const apt = this._apts.find((a) => String(a.id) === String(aptId)) || {};
    let last = null;
    try { last = (await API.get(`/utility-bills/last?apartment_id=${aptId}&type=${type}`)).data; } catch (_) { last = null; }
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    if (last) {
      set('uPrev', last.current_index);
      set('uPrice', last.unit_price);
      set('uGarbage', last.garbage_fee);
      set('uTransport', last.transport_fee);
    } else {
      set('uPrev', 0);
      set('uPrice', type === 'water' ? (apt.water_price || 0) : (apt.electricity_price || 0));
      set('uGarbage', apt.garbage_fee || 0);
      set('uTransport', apt.transport_fee || 0);
    }
    this.updateTotal();
  },
  updateTotal() {
    const n = (id) => Number(document.getElementById(id) ? document.getElementById(id).value : 0) || 0;
    const conso = Math.max(0, n('uCurr') - n('uPrev'));
    const total = conso * n('uPrice') + n('uGarbage') + n('uTransport') + n('uOther');
    const c = document.getElementById('uConso'); if (c) c.textContent = conso;
    const t = document.getElementById('uTotal'); if (t) t.textContent = Helpers.formatMoney(total);
  },
  async submit(id) {
    const val = (x) => document.getElementById(x).value;
    const payload = {
      apartment_id: val('uApt'), type: val('uType'),
      period_month: Number(val('uMonth')), period_year: Number(val('uYear')),
      previous_index: Number(val('uPrev')) || 0, current_index: Number(val('uCurr')) || 0,
      unit_price: Number(val('uPrice')) || 0,
      garbage_fee: Number(val('uGarbage')) || 0, transport_fee: Number(val('uTransport')) || 0,
      other_fee: Number(val('uOther')) || 0, other_label: val('uOtherLabel'),
      status: val('uStatus'),
    };
    if (!payload.apartment_id) { Toast.error('Sélectionnez un logement'); return; }
    if (!payload.current_index) { Toast.error('Saisissez le nouvel index'); return; }
    try {
      if (id) await API.put('/utility-bills/' + id, payload);
      else await API.post('/utility-bills', payload);
      Modal.close(); Toast.success('Facture enregistrée'); PageUtilities.render();
    } catch (e) { Toast.error(e.message); }
  },
  create() { this.openForm(null); },
  async edit(id) { const r = (await API.get('/utility-bills/' + id)).data; this.openForm(r); },
  async togglePaid(id, paid) {
    try { await API.patch('/utility-bills/' + id + '/paid', { paid }); Toast.success('Statut mis à jour'); PageUtilities.render(); }
    catch (e) { Toast.error(e.message); }
  },
  remove(id) { CrudPage.confirmDelete('/utility-bills/' + id, () => PageUtilities.render()); },

  uploadProof(id) {
    Modal.open('Justificatif de paiement',
      '<div class="form-group"><label>Reçu (image ou PDF)</label><input type="file" id="uProof" class="form-control" accept="image/*,application/pdf"/></div>',
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button><button class="btn btn-primary" onclick="PageUtilities.submitProof(${id})">Enregistrer</button>`);
  },
  async submitProof(id) {
    const file = document.getElementById('uProof').files[0];
    if (!file) { Toast.error('Sélectionnez un fichier'); return; }
    const fd = new FormData(); fd.append('proof', file);
    try { await API.upload('/utility-bills/' + id + '/proof', fd); Modal.close(); Toast.success('Justificatif enregistré'); PageUtilities.render(); }
    catch (e) { Toast.error(e.message); }
  },

  pdf(id) {
    const b = this._rows[id]; if (!b) return;
    const loc = b.apartment ? `${b.apartment.apartment_number} (${b.apartment.property ? b.apartment.property.property_name : ''})` : '—';
    const nom = (b.apartment && b.apartment.tenants && b.apartment.tenants[0] && b.apartment.tenants[0].user) ? b.apartment.tenants[0].user.full_name : '—';
    const conso = this.conso(b);
    const txt = `FACTURE DE CHARGES — ${this.typeLabel(b.type)}\n`
      + `Période : ${this.monthLabel(b.period_month)} ${b.period_year}\n`
      + `Logement : ${loc}\nLocataire : ${nom}\n\n`
      + `Ancien index : ${b.previous_index}\nNouvel index : ${b.current_index}\nConsommation : ${conso}\n`
      + `Prix unitaire : ${Helpers.formatMoney(b.unit_price)}\nMontant consommation : ${Helpers.formatMoney(conso * Number(b.unit_price))}\n`
      + `Poubelle : ${Helpers.formatMoney(b.garbage_fee)}\nTransport : ${Helpers.formatMoney(b.transport_fee)}\n`
      + (Number(b.other_fee) ? `${b.other_label || 'Autre'} : ${Helpers.formatMoney(b.other_fee)}\n` : '')
      + `\nTOTAL À PAYER : ${Helpers.formatMoney(b.total_amount)}\nStatut : ${b.status === 'paid' ? 'PAYÉ' : 'EN ATTENTE'}`;
    if (window.PDF && PDF.document) PDF.document('Facture de charges', txt);
    else { Modal.open('Facture de charges', `<pre style="white-space:pre-wrap;font-family:inherit">${txt}</pre>`, '<button class="btn btn-outline" onclick="Modal.close()">Fermer</button>'); }
  },

  // ----- Espace locataire : mes charges -----
  async renderMine() {
    Layout.setTitle('Mes charges');
    const { data } = await API.get('/utility-bills/mine');
    const rows = (data || []).map((b) => `<tr>
      <td>${this.typeLabel(b.type)}</td>
      <td>${this.monthLabel(b.period_month)} ${b.period_year}</td>
      <td>${b.previous_index} → ${b.current_index} <span class="text-muted">(${this.conso(b)})</span></td>
      <td>${Helpers.formatMoney(b.total_amount)}</td>
      <td>${Helpers.statusBadge(b.status === 'paid' ? 'completed' : 'pending')}</td>
      <td>${b.payment_proof ? `<a class="btn btn-sm btn-outline" href="${Helpers.fileUrl(b.payment_proof)}" target="_blank">Reçu</a>` : '—'}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted">Aucune facture de charges</td></tr>';
    Layout.content(`<div class="page-head"><h2>Mes charges</h2><div class="subtitle">Électricité / eau refacturées par compteur</div></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Type</th><th>Période</th><th>Index (conso)</th><th>Total</th><th>Statut</th><th>Justif.</th></tr></thead>
        <tbody>${rows}</tbody></table></div></div>`);
  },
};
