const PagePayments = {
  register() { Router.register('payments', () => this.render()); },
  _tenants: [], _apartments: [], _rows: {},

  // Construit le contexte de communication/PDF depuis un paiement
  ctxOf(p) {
    return {
      name: p.tenant?.user?.full_name,
      phone: p.tenant?.user?.phone,
      apartmentType: p.apartment?.apartment_type,
      apartmentNumber: p.apartment?.apartment_number,
      propertyName: p.apartment?.property?.property_name,
      city: p.apartment?.property?.city,
      district: p.apartment?.property?.district,
      amount: p.amount,
      dueDate: p.payment_date,
      kind: 'relance',
    };
  },
  whatsapp(id) { Communication.openWhatsApp(this.ctxOf(this._rows[id])); },
  call(id) { Communication.call(this._rows[id]?.tenant?.user?.phone); },
  pdfReceipt(id) {
    const p = this._rows[id];
    if (window.ReceiptManager) {
      ReceiptManager.open(p);
    } else {
      const pdf = window.PDF || (typeof PDF !== 'undefined' ? PDF : null);
      if (pdf && pdf.paymentReceipt) pdf.paymentReceipt(p);
    }
  },
  async downloadPdf(id) {
    Toast.info('Téléchargement du reçu officiel PDF...');
    try {
      const blob = await API.downloadBlob(`/payments/${id}/receipt-pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Recu_Paiement_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 2000);
      Toast.success('Reçu PDF officiel téléchargé ✅');
    } catch (err) {
      console.warn('Erreur download receipt-pdf backend:', err);
      const p = this._rows[id];
      if (window.PDF && p) PDF.paymentReceipt(p);
    }
  },
  pdfInvoice(id) {
    const pdf = window.PDF || (typeof PDF !== 'undefined' ? PDF : null);
    if (pdf && pdf.invoice) pdf.invoice(this._rows[id]);
  },
  pdfReminder(id) {
    const pdf = window.PDF || (typeof PDF !== 'undefined' ? PDF : null);
    if (pdf && pdf.paymentReminder) pdf.paymentReminder(this.ctxOf(this._rows[id]));
  },

  async fields() {
    this._tenants = (await API.get('/tenants')).data;
    this._apartments = (await API.get('/apartments')).data;
    return [
      { name: 'tenant_id', label: 'Locataire', type: 'select', required: true, options: this._tenants.map((t) => ({ value: t.id, label: t.user?.full_name || ('Locataire #' + t.id), apt: t.apartment_id })) },
      { name: 'apartment_id', label: 'Logement', type: 'select', options: [{ value: '', label: '— Aucun —' }].concat(this._apartments.map((a) => ({ value: a.id, label: a.apartment_number }))) },
      { name: 'amount', label: 'Montant (FCFA)', type: 'number', required: true, half: true },
      { name: 'payment_date', label: 'Date de paiement', type: 'date', required: true, half: true },
      { name: 'payment_method', label: 'Méthode', type: 'select', options: [
        { value: 'orange_money', label: 'Orange Money' }, { value: 'mtn_mobile_money', label: 'MTN MoMo' },
        { value: 'bank_transfer', label: 'Virement bancaire' }, { value: 'cash', label: 'Espèces' },
        { value: 'campay', label: 'Mobile Money (CamPay)' }] },
      { name: 'status', label: 'Statut', type: 'select', options: [
        { value: 'completed', label: 'Payé' }, { value: 'pending', label: 'En attente' },
        { value: 'awaiting_confirmation', label: 'À vérifier' },
        { value: 'failed', label: 'Échoué' }, { value: 'refunded', label: 'Remboursé' }] },
    ];
  },
  async render() {
    const canEdit = Auth.hasRole('manager', 'comptable');
    const canContact = Auth.hasRole('manager', 'comptable', 'dir_admin', 'gestionnaire');
    const data = await CrudPage.list({
      endpoint: '/payments', title: 'Paiements',
      canCreate: canEdit, onCreate: 'PagePayments.create',
      toolbar: '<div class="toolbar"><button class="btn btn-outline" onclick="Router.go(\'payments\')">Tous</button><button class="btn btn-outline" onclick="PagePayments.showDebts()">🔴 Voir les impayés</button></div>',
      columns: [
        { label: 'Locataire', render: (r) => r.tenant?.user ? r.tenant.user.full_name : '—' },
        { label: 'Immeuble', render: (r) => r.apartment?.property
          ? `${r.apartment.property.property_name}${r.apartment.property.city ? `<br><span class="text-muted" style="font-size:12px">${r.apartment.property.city}</span>` : ''}`
          : '—' },
        { label: 'Logement', render: (r) => r.apartment
          ? `${r.apartment.apartment_number}${r.apartment.apartment_type ? `<br><span class="text-muted" style="font-size:12px">${r.apartment.apartment_type}</span>` : ''}`
          : '—' },
        { label: 'Montant', render: (r) => Helpers.formatMoney(r.amount) },
        { label: 'Date', render: (r) => Helpers.formatDate(r.payment_date) },
        { label: 'Méthode', render: (r) => Helpers.methodLabel(r.payment_method) },
        { label: 'Statut', render: (r) => Helpers.statusBadge(r.status) },
        { label: 'Preuve', render: (r) => r.payment_proof ? `<a href="${Helpers.fileUrl(r.payment_proof)}" target="_blank">📎 Voir</a>` : '—' },
      ],
      rowActions: (r) => `
        ${canContact && r.status === 'awaiting_confirmation' ? `<button class="btn btn-sm btn-success" title="Valider" onclick="PagePayments.verify(${r.id},'completed')">✅</button>
        <button class="btn btn-sm btn-danger" title="Rejeter" onclick="PagePayments.verify(${r.id},'failed')">❌</button>` : ''}
        ${canContact ? `<button class="btn btn-sm btn-whatsapp" title="WhatsApp" onclick="PagePayments.whatsapp(${r.id})">🟢</button>
        <button class="btn btn-sm btn-outline" title="Appeler" onclick="PagePayments.call(${r.id})">📞</button>` : ''}
        ${r.status === 'completed' 
          ? `<button class="btn btn-sm btn-primary" title="Voir et imprimer le reçu officiel" onclick="PagePayments.pdfReceipt(${r.id})" style="font-weight:600;display:inline-flex;align-items:center;gap:4px;">👁️ Voir le reçu</button>
             <button class="btn btn-sm btn-outline" title="Télécharger le reçu officiel PDF" onclick="PagePayments.downloadPdf(${r.id})" style="font-weight:600;display:inline-flex;align-items:center;gap:4px;">📄 PDF</button>` 
          : `<button class="btn btn-sm btn-outline" title="Rappel de paiement PDF" onclick="PagePayments.pdfReminder(${r.id})">📄 Rappel</button>`}
        ${r.tenant?.id ? `<button class="btn btn-sm btn-outline" title="Relevé de compte" onclick="PageSituation.ledger(${r.tenant.id})">📋</button>` : ''}
        ${canEdit ? `<button class="btn btn-sm btn-outline" onclick="PagePayments.uploadProof(${r.id})">⬆</button>
        <button class="btn btn-sm btn-outline" onclick="PagePayments.edit(${r.id})">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="PagePayments.remove(${r.id})">🗑</button>` : ''}`,
    });
    this._rows = {}; (data || []).forEach((r) => { this._rows[r.id] = r; });
  },
  async showDebts() {
    Layout.setTitle('Impayés');
    const { data } = await API.get('/payments/debts');
    this._rows = {}; data.forEach((r) => { this._rows[r.id] = r; });
    const canContact = Auth.hasRole('manager', 'comptable', 'dir_admin', 'gestionnaire');
    const rows = data.map((p) => `<tr>
      <td>${p.tenant?.user?.full_name || '—'}</td>
      <td>${p.apartment?.property?.property_name || '—'}</td>
      <td>${p.apartment?.apartment_number || '—'}${p.apartment?.apartment_type ? ' · ' + p.apartment.apartment_type : ''}</td>
      <td>${Helpers.formatMoney(p.amount)}</td>
      <td>${Helpers.formatDate(p.payment_date)}</td>
      <td>${Helpers.statusBadge(p.status)}</td>
      <td>${canContact ? `<button class="btn btn-sm btn-whatsapp" onclick="PagePayments.whatsapp(${p.id})">🟢 Relancer</button>
        <button class="btn btn-sm btn-outline" onclick="PagePayments.call(${p.id})">📞</button>` : ''}
        <button class="btn btn-sm btn-outline" onclick="PagePayments.pdfReminder(${p.id})">📄</button></td>
    </tr>`).join('') || '<tr><td colspan="7" class="text-center text-muted">Aucun impayé 🎉</td></tr>';
    Layout.content(`<div class="page-head"><h2>🔴 Impayés & relances</h2><button class="btn btn-outline" onclick="Router.go('payments')">← Retour</button></div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Locataire</th><th>Immeuble</th><th>Logement</th><th>Montant</th><th>Date</th><th>Statut</th><th>Relance</th></tr></thead><tbody>${rows}</tbody></table></div></div>`);
  },
  async openPaymentModal(options = {}) {
    const { isEdit = false, values = {} } = options;
    const title = isEdit ? 'Modifier le paiement' : 'Nouveau paiement de loyer';

    try {
      // Charger les locataires et les logements en parallèle de façon sécurisée
      const [tenantsRes, aptsRes] = await Promise.all([
        API.get('/tenants').catch(e => { console.warn('Erreur chargement locataires:', e); return { data: [] }; }),
        API.get('/apartments').catch(e => { console.warn('Erreur chargement logements:', e); return { data: [] }; })
      ]);
      this._tenants = tenantsRes.data || [];
      this._apartments = aptsRes.data || [];
    } catch (e) {
      console.warn('Erreur globale chargement paiement:', e);
      this._tenants = this._tenants || [];
      this._apartments = this._apartments || [];
    }

    const defaultDate = values.payment_date || new Date().toISOString().slice(0, 10);
    const defaultAmount = values.amount || '';
    const defaultMethod = values.payment_method || 'orange_money';
    const defaultStatus = values.status || 'completed';
    const selectedAptId = values.apartment_id || (values.apartment ? values.apartment.id : '');

    // Options du sélecteur de logements enrichies (Immeuble + Numéro + Loyer)
    const aptOptions = [
      '<option value="">— Aucun logement (Paiement direct) —</option>',
      ...(this._apartments || []).map(a => {
        const propName = a.property?.property_name || 'Immeuble';
        const city = a.property?.city ? ` (${a.property.city})` : '';
        const assignedPfx = a.is_assigned ? '★ ' : '';
        const isSelected = String(a.id) === String(selectedAptId) ? 'selected' : '';
        const rentInfo = a.rent_amount ? ` [${Number(a.rent_amount).toLocaleString('fr-FR')} FCFA]` : '';
        return `<option value="${a.id}" ${isSelected}>${assignedPfx}Logement ${Helpers.escapeHtml(a.apartment_number)} — ${Helpers.escapeHtml(propName)}${city}${rentInfo}</option>`;
      })
    ].join('');

    const tp = window.TenantPicker || (typeof TenantPicker !== 'undefined' ? TenantPicker : null);
    const tenantSelectorHtml = (tp && typeof tp.html === 'function')
      ? tp.html({
          name: 'tenant_id',
          label: 'Locataire concerné *',
          placeholder: '🔍 Tapez le nom, téléphone, immeuble ou logement...',
          required: true
        })
      : `
        <div class="form-group" style="position:relative;">
          <label for="tp_hidden_id" style="font-weight:600;">Locataire concerné *</label>
          <select id="tp_hidden_id" class="form-control" required style="font-size:13.5px;">
            <option value="">— Sélectionner un locataire —</option>
            ${(this._tenants || []).map(t => {
              const name = t.user?.full_name || t.full_name || ('Locataire #' + t.id);
              const sel = (String(values.tenant_id) === String(t.id) || (values.tenant && String(values.tenant.id) === String(t.id))) ? 'selected' : '';
              return `<option value="${t.id}" ${sel}>${Helpers.escapeHtml(name)}</option>`;
            }).join('')}
          </select>
        </div>
      `;

    const modalBody = `
      <form id="payForm" onsubmit="return false;" style="display:flex;flex-direction:column;gap:14px;">
        
        <!-- 1. SÉLECTEUR DE LOCATAIRE INTELLIGENT (RECHERCHE + DÉFILEMENT) -->
        ${tenantSelectorHtml}
        <div id="pay_debt_info_box" style="display:none;margin-top:-6px;margin-bottom:8px;padding:8px 12px;border-radius:6px;font-size:12px;line-height:1.4"></div>

        <!-- 2. LOGEMENT ASSOCIÉ (SÉLECTION AUTOMATIQUE) -->
        <div class="form-group" style="position:relative;">
          <label for="pay_apartment_id" style="font-weight:600;display:flex;justify-content:space-between;align-items:center;">
            <span>🏢 Logement & Immeuble attribué</span>
            <span class="badge badge-info" id="pay_apt_auto_tag" style="font-size:10.5px;padding:2px 6px;">
              Auto-détecté
            </span>
          </label>
          <select class="form-control" id="pay_apartment_id" style="font-size:13.5px;">
            ${aptOptions}
          </select>
          <small id="pay_apt_hint" class="text-muted" style="font-size:11.5px;margin-top:3px;display:block;">
            💡 Dès le choix du locataire, son logement officiel est sélectionné automatiquement ici.
          </small>
        </div>

        <!-- 3. MONTANT & DATE -->
        <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group">
            <label for="pay_amount" style="font-weight:600;">Montant encaissé (FCFA) *</label>
            <input type="number" id="pay_amount" class="form-control" value="${defaultAmount}" placeholder="ex: 150000" step="500" required />
          </div>
          <div class="form-group">
            <label for="pay_date" style="font-weight:600;">Date de paiement *</label>
            <input type="date" id="pay_date" class="form-control" value="${defaultDate}" required />
          </div>
        </div>

        <!-- PÉRIODE COUVERTE PAR LE PAIEMENT -->
        <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group">
            <label for="pay_period_start" style="font-weight:600;">Période début (Couverture)</label>
            <input type="date" id="pay_period_start" class="form-control" value="${values.period_start ? values.period_start.slice(0,10) : ''}" />
          </div>
          <div class="form-group">
            <label for="pay_period_end" style="font-weight:600;">Période fin (Couverture)</label>
            <input type="date" id="pay_period_end" class="form-control" value="${values.period_end ? values.period_end.slice(0,10) : ''}" />
          </div>
        </div>

        <!-- 4. MÉTHODE & STATUT -->
        <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group">
            <label for="pay_method" style="font-weight:600;">Mode de paiement *</label>
            <select id="pay_method" class="form-control">
              <option value="orange_money" ${defaultMethod === 'orange_money' ? 'selected' : ''}>Orange Money</option>
              <option value="mtn_mobile_money" ${defaultMethod === 'mtn_mobile_money' ? 'selected' : ''}>MTN MoMo</option>
              <option value="cash" ${defaultMethod === 'cash' ? 'selected' : ''}>Espèces</option>
              <option value="bank_transfer" ${defaultMethod === 'bank_transfer' ? 'selected' : ''}>Virement bancaire</option>
              <option value="campay" ${defaultMethod === 'campay' ? 'selected' : ''}>Mobile Money (CamPay)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="pay_status" style="font-weight:600;">Statut du règlement *</label>
            <select id="pay_status" class="form-control">
              <option value="completed" ${defaultStatus === 'completed' ? 'selected' : ''}>Payé (Validé)</option>
              <option value="pending" ${defaultStatus === 'pending' ? 'selected' : ''}>En attente</option>
              <option value="awaiting_confirmation" ${defaultStatus === 'awaiting_confirmation' ? 'selected' : ''}>À vérifier</option>
              <option value="failed" ${defaultStatus === 'failed' ? 'selected' : ''}>Échoué</option>
              <option value="refunded" ${defaultStatus === 'refunded' ? 'selected' : ''}>Remboursé</option>
            </select>
          </div>
        </div>

        <!-- 5. OBSERVATIONS ARCHIVAGE & JUSTIFICATIF -->
        <div class="form-group">
          <label for="pay_observations" style="font-weight:600;">Observation libre & Modalités (Archivage)</label>
          <textarea id="pay_observations" class="form-control" rows="2" placeholder="ex: Solde partiel dette, accord paiement complément fin de mois...">${Helpers.escapeHtml(values.observations || '')}</textarea>
          <small class="text-muted" style="font-size:11px">Très important pour archiver l'historique et faire figurer les observations sur le reçu officiel.</small>
        </div>

        <div class="form-group">
          <label for="pay_proof" style="font-weight:600;">Justificatif / Reçu (Optionnel)</label>
          <input type="file" id="pay_proof" class="form-control" accept="image/*,application/pdf" />
        </div>

      </form>
    `;

    const modalFooter = `
      <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
      <button class="btn btn-primary" id="btnSubmitPayment">
        ${isEdit ? '💾 Mettre à jour' : '✅ Enregistrer le paiement'}
      </button>
    `;

    Modal.open({
      title,
      content: modalBody,
      footer: modalFooter,
      size: 'medium'
    });

    const checkTenantDebt = async (tenantId) => {
      const debtBox = document.getElementById('pay_debt_info_box');
      if (!debtBox || !tenantId) return;
      try {
        const res = await API.get('/tenants/' + tenantId);
        const t = res.data;
        if (t && t.due_info) {
          const solde = t.due_info.solde || 0;
          const months = t.due_info.mois_dus || 0;
          debtBox.style.display = 'block';
          if (solde > 0) {
            debtBox.style.background = '#fef2f2';
            debtBox.style.border = '1px solid #fecaca';
            debtBox.style.color = '#991b1b';
            debtBox.innerHTML = `⚠️ <b>Attention dette en cours :</b> Ce locataire a un arriéré de <b>${Helpers.formatMoney(solde)}</b> (${months} mois impayé(s)). Le versement sera imputé sur cette dette.`;
          } else {
            debtBox.style.background = '#f0fdf4';
            debtBox.style.border = '1px solid #bbf7d0';
            debtBox.style.color = '#166534';
            debtBox.innerHTML = `✅ <b>Situation saine :</b> Locataire à jour de ses loyers. Aucun arriéré constaté.`;
          }
          const pStart = document.getElementById('pay_period_start');
          if (pStart && !pStart.value && t.due_info.prochaine_echeance) {
            pStart.value = t.due_info.prochaine_echeance.slice(0, 10);
          }
        }
      } catch (_) {}
    };

    // Initialiser TenantPicker avec l'auto-liaison du logement et du montant
    if (tp && typeof tp.init === 'function') {
      tp.init({
        tenants: this._tenants,
        apartments: this._apartments,
        selectedTenantId: values.tenant_id || (values.tenant ? values.tenant.id : null),
        apartmentSelectId: 'pay_apartment_id',
        rentInputId: 'pay_amount',
        onSelect: (tenant, meta) => {
          const hintEl = document.getElementById('pay_apt_hint');
          if (hintEl && meta.hasApartment) {
            hintEl.innerHTML = `<span style="color:#16a34a;font-weight:600;">✓ Logement attribué à ${Helpers.escapeHtml(meta.name)} : ${Helpers.escapeHtml(meta.propertyName)} (${Helpers.escapeHtml(meta.apartmentNumber)})</span>`;
          }
          if (tenant && tenant.id) checkTenantDebt(tenant.id);
        }
      });
    } else {
      const selectEl = document.getElementById('tp_hidden_id');
      if (selectEl) {
        selectEl.addEventListener('change', () => {
          const tId = selectEl.value;
          const tenant = (this._tenants || []).find(t => String(t.id) === String(tId));
          if (tenant) {
            const aptId = tenant.apartment_id || (tenant.apartment ? tenant.apartment.id : null);
            if (aptId) {
              const aptSelect = document.getElementById('pay_apartment_id');
              if (aptSelect) aptSelect.value = String(aptId);
            }
            checkTenantDebt(tenant.id);
          }
        });
      }
    }

    if (values.tenant_id || (values.tenant && values.tenant.id)) {
      checkTenantDebt(values.tenant_id || values.tenant.id);
    }

    // Soumission du formulaire
    document.getElementById('btnSubmitPayment').onclick = async () => {
      const tenantId = document.getElementById('tp_hidden_id')?.value;
      const apartmentId = document.getElementById('pay_apartment_id')?.value;
      const amount = document.getElementById('pay_amount')?.value;
      const paymentDate = document.getElementById('pay_date')?.value;
      const paymentMethod = document.getElementById('pay_method')?.value;
      const status = document.getElementById('pay_status')?.value;
      const period_start = document.getElementById('pay_period_start')?.value || null;
      const period_end = document.getElementById('pay_period_end')?.value || null;
      const observations = document.getElementById('pay_observations')?.value.trim() || null;
      const proofFile = document.getElementById('pay_proof')?.files[0];

      if (!tenantId) {
        Toast.error('Veuillez sélectionner un locataire dans la liste');
        document.getElementById('tp_search_input')?.focus();
        return;
      }
      if (!amount || parseFloat(amount) <= 0) {
        Toast.error('Veuillez renseigner un montant valide en FCFA');
        document.getElementById('pay_amount')?.focus();
        return;
      }
      if (!paymentDate) {
        Toast.error('Veuillez indiquer la date de paiement');
        return;
      }

      const payload = {
        tenant_id: parseInt(tenantId, 10),
        amount: parseFloat(amount),
        payment_date: paymentDate,
        payment_method: paymentMethod,
        status: status,
        period_start: period_start,
        period_end: period_end,
        observations: observations,
      };
      if (apartmentId) {
        payload.apartment_id = parseInt(apartmentId, 10);
      }

      try {
        let paymentId = values.id;
        if (isEdit) {
          await API.put(`/payments/${values.id}`, payload);
          Toast.success('Paiement mis à jour avec succès');
        } else {
          const res = await API.post('/payments', payload);
          paymentId = res.data ? res.data.id : null;
          Toast.success('Paiement enregistré avec succès');
        }

        // Si justificatif fourni, l'uploader
        if (proofFile && paymentId) {
          const fd = new FormData();
          fd.append('proof', proofFile);
          try {
            await API.upload(`/payments/${paymentId}/proof`, fd);
          } catch (e) {
            console.warn('Erreur téléversement justificatif:', e);
          }
        }

        Modal.close();
        PagePayments.render();
      } catch (err) {
        Toast.error(err.message || 'Erreur lors de l’enregistrement du paiement');
      }
    };
  },

  async create() {
    try {
      await this.openPaymentModal({ isEdit: false });
    } catch (err) {
      console.error('Erreur create payment:', err);
      Toast.error('Erreur lors de l’ouverture du formulaire: ' + (err.message || err));
    }
  },

  async edit(id) {
    try {
      const r = (await API.get('/payments/' + id)).data;
      await this.openPaymentModal({ isEdit: true, values: r });
    } catch (err) {
      console.error('Erreur edit payment:', err);
      Toast.error('Erreur lors de la modification du paiement: ' + (err.message || err));
    }
  },

  uploadProof(id) {
    Modal.open('Uploader le justificatif', '<div class="form-group"><label>Reçu (image ou PDF)</label><input type="file" id="proofFile" class="form-control" accept="image/*,application/pdf"/></div>',
      `<button class="btn btn-outline" onclick="Modal.close()">Annuler</button><button class="btn btn-primary" onclick="PagePayments.submitProof(${id})">Uploader</button>`);
  },
  async submitProof(id) {
    const file = document.getElementById('proofFile').files[0];
    if (!file) { Toast.error('Sélectionnez un fichier'); return; }
    const fd = new FormData(); fd.append('proof', file);
    try { await API.upload('/payments/' + id + '/proof', fd); Modal.close(); Toast.success('Justificatif enregistré'); PagePayments.render(); } catch (e) { Toast.error(e.message); }
  },
  remove(id) { CrudPage.confirmDelete('/payments/' + id, () => PagePayments.render()); },
  async verify(id, decision) {
    try {
      await API.patch('/payments/' + id + '/verify', { decision });
      Toast.success(decision === 'completed' ? 'Paiement validé' : 'Paiement rejeté');
      PagePayments.render();
    } catch (e) { Toast.error(e.message); }
  },
};

