// ============ Page Reçus de Paiement — SMG IMMOBILIER ============
const PageReceipts = {
  register() {
    Router.register('receipts', () => this.render());
  },

  _staffUsers: [],

  async render() {
    Layout.setTitle('Reçus de paiement');
    const isAdminOrManager = Auth.hasRole('super_admin', 'manager');

    if (isAdminOrManager && (!this._staffUsers || !this._staffUsers.length)) {
      try {
        const uRes = await API.get('/users');
        this._staffUsers = (uRes.data || []).filter((u) => u.status === 'active' && u.role?.name !== 'locataire');
      } catch (_) {
        this._staffUsers = [];
      }
    }

    const appContent = document.getElementById('appContent');
    appContent.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h2 style="font-size:18px;font-weight:700;color:var(--text)">🧾 Reçus et documents financiers</h2>
            <p style="font-size:13px;color:var(--text-muted);margin-top:2px">
              ${isAdminOrManager 
                ? 'Consultez l\'historique global de tous les reçus par collaborateur ou pour l\'ensemble du parc.' 
                : 'Consultez vos reçus émis et ceux des immeubles qui vous sont attribués.'}
            </p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="PageReceipts.openNewReceiptModal()"><span class="btn-icon">➕</span> Émettre un Reçu</button>
            <button class="btn btn-success" onclick="PageReceipts.openArchiveGenerator()"><span class="btn-icon">⚡</span> Générer reçus des archives</button>
            <button class="btn btn-outline" onclick="PageReceipts.loadReceipts()"><span class="btn-icon">🔄</span> Actualiser</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:16px">
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted)">Type de reçu</label>
            <select id="receiptTypeFilter" class="form-control" onchange="PageReceipts.loadReceipts()">
              <option value="">Tous les types</option>
              <option value="rent">Loyer</option>
              <option value="deposit">Caution</option>
              <option value="advance">Avance</option>
              <option value="other_income">Autre recette</option>
            </select>
          </div>
          ${isAdminOrManager ? `
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--text-muted)">👤 Historique par personne</label>
              <select id="receiptStaffFilter" class="form-control" onchange="PageReceipts.loadReceipts()">
                <option value="">👥 Tous les collaborateurs (Tous)</option>
                <option value="mine">👤 Mes propres reçus uniquement</option>
                ${(this._staffUsers || []).map((u) => `<option value="${u.id}">${Helpers.escapeHtml(u.full_name)} (${u.role?.label || u.role?.name || 'Personnel'})</option>`).join('')}
              </select>
            </div>
          ` : ''}
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted)">Date de début</label>
            <input type="date" id="receiptStartDate" class="form-control" onchange="PageReceipts.loadReceipts()" />
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted)">Date de fin</label>
            <input type="date" id="receiptEndDate" class="form-control" onchange="PageReceipts.loadReceipts()" />
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted)">Recherche</label>
            <input type="text" id="receiptSearch" class="form-control" placeholder="Numéro, locataire, immeuble..." oninput="PageReceipts.filterTable()" />
          </div>
        </div>
      </div>

      <div id="receiptsBulkBar" style="display:none;align-items:center;justify-content:space-between;background:#fef2f2;border:1px solid #fecaca;padding:10px 16px;border-radius:8px;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div style="font-weight:600;color:#991b1b;display:flex;align-items:center;gap:12px">
          <span>✓ <strong id="receiptSelectedCount">0</strong> reçu(s) sélectionné(s)</span>
          <button class="btn btn-sm btn-outline" style="border-color:#fca5a5;color:#991b1b;background:#fff" onclick="PageReceipts.deselectAll()">Tout désélectionner</button>
        </div>
        <button class="btn btn-sm btn-danger" onclick="PageReceipts.deleteSelected()" style="font-weight:700;display:inline-flex;align-items:center;gap:6px">
          🗑️ Supprimer les reçus sélectionnés
        </button>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="table" id="receiptsTable">
            <thead>
              <tr>
                <th style="width:40px;text-align:center">
                  <input type="checkbox" id="selectAllReceipts" title="Tout sélectionner" onchange="PageReceipts.toggleSelectAll(this.checked)" style="cursor:pointer;width:16px;height:16px" />
                </th>
                <th>N° Reçu</th>
                <th>Type</th>
                <th>Locataire</th>
                <th>Bien / Logement</th>
                <th>Montant</th>
                <th>Mode</th>
                <th>Date</th>
                <th>Émis par</th>
                <th>Statut</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody id="receiptsTableBody">
              <tr><td colspan="11" style="text-align:center;padding:30px"><div class="spinner"></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await this.loadReceipts();
  },

  _receipts: [],
  _selectedIds: new Set(),

  async loadReceipts() {
    this._selectedIds.clear();
    this.updateBulkBar();
    const type = document.getElementById('receiptTypeFilter')?.value || '';
    const start = document.getElementById('receiptStartDate')?.value || '';
    const end = document.getElementById('receiptEndDate')?.value || '';
    const staffFilter = document.getElementById('receiptStaffFilter')?.value || '';

    let url = '/receipts?';
    if (type) url += `type=${type}&`;
    if (start) url += `start=${start}&`;
    if (end) url += `end=${end}&`;
    if (staffFilter === 'mine') {
      url += `generated_by=${Auth.user?.id}&`;
    } else if (staffFilter) {
      url += `generated_by=${staffFilter}&`;
    }

    try {
      const res = await API.get(url);
      this._receipts = res.data || [];
      this.renderTable(this._receipts);
    } catch (err) {
      Toast.error('Erreur lors du chargement des reçus');
      document.getElementById('receiptsTableBody').innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--danger)">Échec de chargement des reçus.</td></tr>`;
    }
  },

  renderTable(receipts) {
    const tbody = document.getElementById('receiptsTableBody');
    if (!receipts.length) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:30px;color:var(--text-muted)">Aucun reçu trouvé.</td></tr>`;
      this.updateSelectAllCheckbox(false);
      return;
    }

    const typeLabels = {
      rent: 'Loyer',
      deposit: 'Caution',
      advance: 'Avance',
      other_income: 'Autre',
      expense_report: 'Dépense',
    };

    const canDelete = Auth.hasRole('super_admin', 'manager', 'dir_admin', 'gestionnaire', 'comptable');

    tbody.innerHTML = receipts.map((r) => {
      const tenantName = r.tenant?.user?.full_name || '—';
      const propName = r.property?.property_name || '—';
      const aptNum = r.apartment?.apartment_number || '—';
      const amount = Number(r.amount || 0).toLocaleString('fr-FR') + ' FCFA';
      const date = r.payment_date ? new Date(r.payment_date).toLocaleDateString('fr-FR') : '—';
      const statusBadge = r.status === 'issued'
        ? `<span class="badge badge-success">Émis</span>`
        : `<span class="badge badge-danger">Annulé</span>`;
      const isChecked = this._selectedIds.has(r.id);

      const genName = r.generator?.full_name || 'Système';
      const isMine = r.generated_by && Number(r.generated_by) === Number(Auth.user?.id);
      const genBadge = isMine
        ? `<span class="badge badge-primary" style="font-size:10.5px">Moi</span>`
        : `<small style="font-weight:600;color:var(--text)">${Helpers.escapeHtml(genName)}</small>`;

      return `
        <tr id="receipt-row-${r.id}" style="${isChecked ? 'background:rgba(239, 68, 68, 0.05)' : ''}">
          <td style="text-align:center">
            <input type="checkbox" class="receipt-select-check" data-id="${r.id}" ${isChecked ? 'checked' : ''} onchange="PageReceipts.onRowSelectChange(${r.id}, this.checked)" style="cursor:pointer;width:16px;height:16px" />
          </td>
          <td><strong style="color:var(--primary)">${r.receipt_number}</strong></td>
          <td><span class="badge badge-info">${typeLabels[r.receipt_type] || r.receipt_type}</span></td>
          <td><b>${tenantName}</b></td>
          <td>${propName} — <small>${aptNum}</small></td>
          <td><b style="color:var(--success)">${amount}</b></td>
          <td><small>${r.payment_method || '—'}</small></td>
          <td>${date}</td>
          <td>${genBadge}</td>
          <td>${statusBadge}</td>
          <td style="text-align:right;white-space:nowrap">
            <button class="btn btn-sm btn-primary" onclick="PageReceipts.openOfficial(${r.id})" title="Voir le reçu officiel" style="font-weight:600;display:inline-flex;align-items:center;gap:4px;">👁️ Voir</button>
            <a class="btn btn-sm btn-outline" href="${PageReceipts.pdfUrl(r.id)}" target="_blank" rel="noopener" title="Ouvrir le PDF dans un nouvel onglet" style="display:inline-flex;align-items:center;gap:4px;text-decoration:none">📄 PDF</a>
            ${canDelete ? `<button class="btn btn-sm btn-danger" onclick="PageReceipts.deleteSingle(${r.id}, '${r.receipt_number}')" title="Supprimer ce reçu (nettoyage test)" style="display:inline-flex;align-items:center;gap:4px">🗑️</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    this.checkIfAllVisibleSelected();
  },

  onRowSelectChange(id, checked) {
    if (checked) {
      this._selectedIds.add(id);
    } else {
      this._selectedIds.delete(id);
    }
    const row = document.getElementById(`receipt-row-${id}`);
    if (row) {
      row.style.background = checked ? 'rgba(239, 68, 68, 0.05)' : '';
    }
    this.checkIfAllVisibleSelected();
    this.updateBulkBar();
  },

  toggleSelectAll(checked) {
    const checks = document.querySelectorAll('.receipt-select-check');
    checks.forEach((chk) => {
      chk.checked = checked;
      const id = Number(chk.getAttribute('data-id'));
      if (checked) {
        this._selectedIds.add(id);
      } else {
        this._selectedIds.delete(id);
      }
      const row = document.getElementById(`receipt-row-${id}`);
      if (row) {
        row.style.background = checked ? 'rgba(239, 68, 68, 0.05)' : '';
      }
    });
    this.updateBulkBar();
  },

  deselectAll() {
    this._selectedIds.clear();
    const checks = document.querySelectorAll('.receipt-select-check');
    checks.forEach((chk) => {
      chk.checked = false;
      const id = Number(chk.getAttribute('data-id'));
      const row = document.getElementById(`receipt-row-${id}`);
      if (row) row.style.background = '';
    });
    this.updateSelectAllCheckbox(false);
    this.updateBulkBar();
  },

  checkIfAllVisibleSelected() {
    const checks = document.querySelectorAll('.receipt-select-check');
    if (!checks.length) {
      this.updateSelectAllCheckbox(false);
      return;
    }
    let allChecked = true;
    for (const chk of checks) {
      if (!chk.checked) {
        allChecked = false;
        break;
      }
    }
    this.updateSelectAllCheckbox(allChecked);
  },

  updateSelectAllCheckbox(checked) {
    const el = document.getElementById('selectAllReceipts');
    if (el) el.checked = checked;
  },

  updateBulkBar() {
    const bar = document.getElementById('receiptsBulkBar');
    const countEl = document.getElementById('receiptSelectedCount');
    const count = this._selectedIds.size;
    if (countEl) countEl.textContent = count;
    if (bar) bar.style.display = count > 0 ? 'flex' : 'none';
  },

  async deleteSingle(id, number) {
    if (!confirm(`⚠️ Êtes-vous sûr de vouloir supprimer définitivement le reçu N° ${number} ?\n\nCette action est irréversible et permettra de nettoyer vos données de test avant le passage en réel.`)) {
      return;
    }
    try {
      await API.delete('/receipts/' + id);
      this._selectedIds.delete(id);
      Toast.success(`Reçu ${number} supprimé avec succès 🗑️`);
      await this.loadReceipts();
    } catch (err) {
      console.error(err);
      Toast.error(err.message || 'Erreur lors de la suppression du reçu');
    }
  },

  async deleteSelected() {
    const ids = Array.from(this._selectedIds);
    if (!ids.length) {
      Toast.info('Aucun reçu sélectionné');
      return;
    }
    if (!confirm(`⚠️ Êtes-vous sûr de vouloir supprimer définitivement les ${ids.length} reçu(s) sélectionné(s) ?\n\nCette suppression est irréversible (idéal pour purger les tests avant passage en réel).`)) {
      return;
    }
    try {
      const res = await API.post('/receipts/bulk-delete', { ids });
      this._selectedIds.clear();
      Toast.success(`${res.data?.deletedCount || ids.length} reçu(s) supprimé(s) définitivement ! 🗑️`);
      await this.loadReceipts();
    } catch (err) {
      console.error(err);
      Toast.error(err.message || 'Erreur lors de la suppression en masse');
    }
  },

  /** Construit l'URL directe du PDF avec le token JWT dans l'en-tête (via blob) ou en paramètre de requête */
  pdfUrl(id) {
    const token = localStorage.getItem(CONFIG.TOKEN_KEY) || '';
    const base = CONFIG.API_URL || 'http://localhost:5000/api';
    // Encode le token en query param pour l'accès direct (lien <a>)
    return `${base}/receipts/${id}/pdf?token=${encodeURIComponent(token)}`;
  },

  filterTable() {
    const q = (document.getElementById('receiptSearch')?.value || '').toLowerCase().trim();
    if (!q) {
      this.renderTable(this._receipts);
      return;
    }
    const filtered = this._receipts.filter((r) => {
      const num = (r.receipt_number || '').toLowerCase();
      const tenant = (r.tenant?.user?.full_name || '').toLowerCase();
      const prop = (r.property?.property_name || '').toLowerCase();
      const apt = (r.apartment?.apartment_number || '').toLowerCase();
      return num.includes(q) || tenant.includes(q) || prop.includes(q) || apt.includes(q);
    });
    this.renderTable(filtered);
  },

  async downloadPdf(id) {
    Toast.info('Génération du PDF en cours...');
    try {
      const blob = await API.downloadBlob(`/receipts/${id}/pdf`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Recu_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      Toast.success('PDF téléchargé ✅');
    } catch (err) {
      console.error('Erreur PDF:', err);
      Toast.error(err.message || 'Impossible de télécharger le PDF');
    }
  },

  async preview(id) {
    try {
      const res = await API.get(`/receipts/${id}`);
      const r = res.data;
      const tenant = r.tenant?.user?.full_name || '—';
      const phone = r.tenant?.user?.phone || '—';
      const prop = r.property?.property_name || '—';
      const apt = r.apartment?.apartment_number || '—';
      const rent = Number(r.apartment?.rent_amount || 0).toLocaleString('fr-FR');
      const amount = Number(r.amount || 0).toLocaleString('fr-FR');
      const remaining = Number(r.remaining_balance || 0).toLocaleString('fr-FR');
      const date = r.payment_date ? new Date(r.payment_date).toLocaleDateString('fr-FR') : '—';
      const period = (r.period_start && r.period_end)
        ? `du ${new Date(r.period_start).toLocaleDateString('fr-FR')} au ${new Date(r.period_end).toLocaleDateString('fr-FR')}`
        : 'Période courante';

      const html = `
        <div style="background:#fff;border-radius:12px;padding:24px;max-width:700px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,0.08);border:1px solid #dee2e6">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2.5px solid #1a3a5c;padding-bottom:12px;margin-bottom:16px">
            <div>
              <h2 style="font-size:18px;font-weight:800;color:#1a3a5c;margin:0">SMG <span style="color:#3498db">IMMOBILIER</span></h2>
              <p style="font-size:11px;color:#6c757d;margin:2px 0 0">Yaoundé et Douala, Cameroun | smgimmobilier.infos@gmail.com</p>
            </div>
            <div style="text-align:right">
              <span style="font-size:12px;font-weight:700;color:#1a3a5c">${r.receipt_number}</span>
              <p style="font-size:11px;color:#6c757d;margin:2px 0 0">Date : ${date}</p>
            </div>
          </div>

          <div style="text-align:center;margin-bottom:14px">
            <h3 style="font-size:16px;color:#1a3a5c;letter-spacing:0.5px">REÇU DE PAIEMENT DE LOYER</h3>
            <div style="display:inline-block;background:#d4edda;color:#155724;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:600;margin-top:4px">
              📅 Période couverte : ${period}
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;background:#f0f4f8;padding:12px;border-radius:8px;margin-bottom:16px">
            <div>
              <h4 style="font-size:10px;text-transform:uppercase;color:#1a3a5c;margin-bottom:4px">📍 Locataire</h4>
              <p style="font-size:12px;font-weight:700;margin:0">${tenant}</p>
              <p style="font-size:11px;color:#6c757d;margin:2px 0 0">📞 ${phone}</p>
            </div>
            <div>
              <h4 style="font-size:10px;text-transform:uppercase;color:#1a3a5c;margin-bottom:4px">🏠 Bien loué</h4>
              <p style="font-size:12px;font-weight:700;margin:0">${prop} — ${apt}</p>
              <p style="font-size:11px;color:#6c757d;margin:2px 0 0">Loyer mensuel : ${rent} FCFA</p>
            </div>
          </div>

          <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
            <thead>
              <tr style="background:#1a3a5c;color:#fff">
                <th style="padding:6px 10px;text-align:left;font-size:11px">Désignation</th>
                <th style="padding:6px 10px;text-align:right;font-size:11px">Montant (FCFA)</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom:1px solid #dee2e6">
                <td style="padding:8px 10px;font-size:12px">Paiement effectué (${r.payment_method || 'Espèces'})</td>
                <td style="padding:8px 10px;text-align:right;font-size:12px;font-weight:700;color:#27ae60">${amount}</td>
              </tr>
              ${Number(r.remaining_balance) > 0 ? `
              <tr style="border-bottom:1px solid #dee2e6">
                <td style="padding:8px 10px;font-size:12px">Reste à payer</td>
                <td style="padding:8px 10px;text-align:right;font-size:12px;font-weight:700;color:#c0392b">${remaining}</td>
              </tr>` : ''}
            </tbody>
          </table>

          <div style="background:#fff8e7;border-left:3px solid #f1c40f;padding:8px 12px;border-radius:4px;font-size:11px;color:#856404;margin-bottom:14px">
            💳 <strong>Mode :</strong> ${r.payment_method || '—'} &nbsp;|&nbsp; <strong>Date :</strong> ${date}
            ${r.observations ? `<br>📝 <strong>Obs :</strong> ${r.observations}` : ''}
          </div>

          <div style="display:flex;justify-content:flex-end;gap:8px">
            <a class="btn btn-primary" href="${PageReceipts.pdfUrl(r.id)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none">📄 Télécharger / Imprimer PDF</a>
            <button class="btn btn-outline" onclick="Modal.close()">Fermer</button>
          </div>
        </div>
      `;

      Modal.open({ title: `Aperçu — ${r.receipt_number}`, content: html, size: 'large' });
    } catch (err) {
      Toast.error("Impossible de charger l'aperçu du reçu");
    }
  },

  async openOfficial(id) {
    try {
      Toast.info('Chargement du reçu officiel...');
      const res = await API.get(`/receipts/${id}`);
      const r = res.data;
      if (!r) return;

      const tenant = r.tenant?.user?.full_name || 'Locataire';
      const phone = r.tenant?.user?.phone || '';
      const email = r.tenant?.user?.email || '';
      const prop = r.property?.property_name || '';
      const apt = r.apartment?.apartment_number || '';
      const propAddr = prop ? `${prop} — Logement ${apt}` : (apt ? `Logement ${apt}` : 'Bien loué');

      if (window.ReceiptManager) {
        ReceiptManager.open({
          id: r.id,
          receipt_id: r.id,
          receiptId: r.id,
          payment_id: r.payment_id,
          paymentId: r.payment_id,
          receipt_type: r.receipt_type,
          receipt_number: r.receipt_number,
          payment_date: r.payment_date,
          tenant_name: tenant,
          tenant_phone: phone,
          tenant_email: email,
          property_address: propAddr,
          rent_amount: r.apartment?.rent_amount || r.amount,
          paid_amount: r.amount,
          remaining_balance: r.remaining_balance || 0,
          payment_method: r.payment_method || 'Cash',
          observations: r.observations || '',
        });
      } else {
        this.preview(id);
      }
    } catch (err) {
      console.error(err);
      Toast.error('Erreur chargement reçu');
    }
  },

  openArchiveGenerator() {
    const html = `
      <div style="padding:10px 4px">
        <p style="font-size:13px;color:var(--text);margin-bottom:14px;line-height:1.5">
          Cette action analyse tous les <strong>paiements complétés enregistrés dans vos archives</strong>.
          Elle génère automatiquement un <strong>reçu officiel numéroté</strong> pour chaque transaction passée qui n'a pas encore de reçu, avec calcul exact des périodes et arriérés.
        </p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Date de début (optionnel)</label>
            <input type="date" id="archiveStartDate" class="form-control" />
            <small style="color:var(--text-muted);font-size:11px">Laisser vide pour inclure tout l'historique</small>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Date de fin (optionnel)</label>
            <input type="date" id="archiveEndDate" class="form-control" />
            <small style="color:var(--text-muted);font-size:11px">Laisser vide pour aller jusqu'à aujourd'hui</small>
          </div>
        </div>

        <div style="background:#e8f0fe;border-left:4px solid #1a3a5c;padding:12px;border-radius:6px;font-size:12px;color:#1a3a5c;margin-bottom:18px">
          ℹ️ <strong>Complémentarité garantie :</strong> Les reçus générés sont immédiatement consultables, imprimables (21 × 14,85 cm), exportables en PDF et archivés en base de données sans altérer vos paiements actuels.
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
          <button class="btn btn-success" onclick="PageReceipts.runArchiveGenerator()">⚡ Lancer la génération</button>
        </div>
      </div>
    `;

    Modal.open({
      title: "Générateur de reçus pour l'historique et les archives",
      content: html,
      size: 'medium',
    });
  },

  async runArchiveGenerator() {
    const start = document.getElementById('archiveStartDate')?.value || '';
    const end = document.getElementById('archiveEndDate')?.value || '';

    Modal.close();
    Toast.info('Génération des reçus pour les paiements passés en cours...');

    try {
      const res = await API.post('/receipts/generate-archives', { start, end });
      const data = res.data;
      Toast.success(`Succès : ${data.generated_count} reçus générés et archivés sur ${data.total_payments} paiements vérifiés ! 🎉`);
      await this.loadReceipts();
    } catch (err) {
      console.error(err);
      Toast.error(err.message || 'Erreur lors de la génération des archives');
    }
  },

  _availableProperties: [],

  async openNewReceiptModal() {
    try {
      Toast.info('Chargement du générateur...');
      const pRes = await API.get('/properties');
      this._availableProperties = pRes.data || [];

      const todayStr = new Date().toISOString().slice(0, 10);
      const propsOptions = this._availableProperties.map((p) => `<option value="${p.id}">${Helpers.escapeHtml(p.property_name)} (${p.city || '—'})</option>`).join('');

      const html = `
        <form id="newReceiptForm" onsubmit="PageReceipts.submitNewReceipt(event)">
          <div style="background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:14px;border:1px solid #e2e8f0;">
            <div style="font-weight:700;color:var(--primary);margin-bottom:8px;font-size:12.5px;">🏢 1. LOCALISATION & BÉNÉFICIAIRE</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div>
                <label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px">Immeuble / Bien</label>
                <select id="new_rec_property" class="form-control" onchange="PageReceipts.onNewReceiptPropChange(this.value)">
                  <option value="">— Sélectionner un immeuble —</option>
                  ${propsOptions}
                </select>
              </div>
              <div>
                <label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px">Logement / Chambre</label>
                <select id="new_rec_apartment" class="form-control" onchange="PageReceipts.onNewReceiptAptChange(this.value)">
                  <option value="">— Choisir d'abord l'immeuble —</option>
                </select>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:10px;margin-top:10px">
              <div>
                <label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px">Nom du Locataire / Payeur *</label>
                <input type="text" id="new_rec_tenant_name" class="form-control" placeholder="Nom et prénom..." required />
                <input type="hidden" id="new_rec_tenant_id" />
              </div>
              <div>
                <label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px">Téléphone</label>
                <input type="text" id="new_rec_tenant_phone" class="form-control" placeholder="+237 6..." />
              </div>
            </div>
          </div>

          <div style="background:#ffffff;padding:12px;border-radius:8px;margin-bottom:14px;border:1px solid #e2e8f0;">
            <div style="font-weight:700;color:var(--primary);margin-bottom:8px;font-size:12.5px;">💰 2. DÉTAILS DU PAIEMENT</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
              <div>
                <label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px">Type de reçu *</label>
                <select id="new_rec_type" class="form-control">
                  <option value="rent">Loyer</option>
                  <option value="deposit">Caution</option>
                  <option value="advance">Avance sur loyer</option>
                  <option value="other_income">Autre recette financière</option>
                </select>
              </div>
              <div>
                <label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px">Montant versé (FCFA) *</label>
                <input type="number" id="new_rec_amount" class="form-control" min="1" placeholder="ex: 150000" required />
              </div>
              <div>
                <label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px">Date de paiement</label>
                <input type="date" id="new_rec_payment_date" class="form-control" value="${todayStr}" />
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:10px">
              <div>
                <label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px">Mode de paiement</label>
                <select id="new_rec_payment_method" class="form-control">
                  <option value="">— Aucun / Non spécifié —</option>
                  <option value="Espèces" selected>Espèces (Cash)</option>
                  <option value="Virement bancaire">Virement bancaire</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Mobile Money">Mobile Money (OM / MoMo)</option>
                </select>
              </div>
              <div>
                <label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px">Période début (Couverture)</label>
                <input type="date" id="new_rec_period_start" class="form-control" />
              </div>
              <div>
                <label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px">Période fin (Couverture)</label>
                <input type="date" id="new_rec_period_end" class="form-control" />
              </div>
            </div>

            <div style="margin-top:10px">
              <label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px">Observations / Notes sur le reçu</label>
              <input type="text" id="new_rec_observations" class="form-control" placeholder="ex: Paiement loyer complet, solde à jour..." />
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:8px">
            <button type="button" class="btn btn-outline" onclick="Modal.close()">Annuler</button>
            <button type="submit" class="btn btn-primary" id="btnSubmitNewReceipt">💾 Émettre et enregistrer le reçu</button>
          </div>
        </form>
      `;

      Modal.open({
        title: "🧾 Émission d'un Reçu de Paiement Officiel",
        content: html,
        size: 'large',
      });
    } catch (err) {
      Toast.error(err.message || 'Impossible d\'ouvrir le générateur');
    }
  },

  onNewReceiptPropChange(propId) {
    const aptSelect = document.getElementById('new_rec_apartment');
    if (!aptSelect) return;
    if (!propId) {
      aptSelect.innerHTML = '<option value="">— Choisir d\'abord l\'immeuble —</option>';
      return;
    }
    const prop = (this._availableProperties || []).find((p) => Number(p.id) === Number(propId));
    const apts = prop?.apartments || [];
    if (!apts.length) {
      aptSelect.innerHTML = '<option value="">Aucun logement dans cet immeuble</option>';
      return;
    }
    aptSelect.innerHTML = '<option value="">— Sélectionner le logement —</option>' +
      apts.map((a) => `<option value="${a.id}" data-rent="${a.rent_amount || ''}">${Helpers.escapeHtml(a.apartment_number)} (${Helpers.formatMoney(a.rent_amount || 0)})</option>`).join('');
  },

  async onNewReceiptAptChange(aptId) {
    if (!aptId) return;
    try {
      const res = await API.get(`/apartments/${aptId}`);
      const apt = res.data;
      if (apt) {
        const amtInput = document.getElementById('new_rec_amount');
        if (amtInput && !amtInput.value && apt.rent_amount) {
          amtInput.value = apt.rent_amount;
        }
        const activeTenant = (apt.tenants || []).find((t) => t.status === 'active') || (apt.tenants || [])[0];
        if (activeTenant) {
          const tNameInput = document.getElementById('new_rec_tenant_name');
          const tPhoneInput = document.getElementById('new_rec_tenant_phone');
          const tIdInput = document.getElementById('new_rec_tenant_id');
          if (tNameInput && activeTenant.user?.full_name) tNameInput.value = activeTenant.user.full_name;
          if (tPhoneInput && activeTenant.user?.phone) tPhoneInput.value = activeTenant.user.phone;
          if (tIdInput) tIdInput.value = activeTenant.id;
        }
      }
    } catch (_) {}
  },

  async submitNewReceipt(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitNewReceipt');
    if (btn) btn.disabled = true;

    const property_id = document.getElementById('new_rec_property')?.value || null;
    const apartment_id = document.getElementById('new_rec_apartment')?.value || null;
    const tenant_id = document.getElementById('new_rec_tenant_id')?.value || null;
    const tenant_name = document.getElementById('new_rec_tenant_name')?.value.trim();
    const receipt_type = document.getElementById('new_rec_type')?.value || 'rent';
    const amount = parseFloat(document.getElementById('new_rec_amount')?.value) || 0;
    const payment_date = document.getElementById('new_rec_payment_date')?.value || null;
    const payment_method = document.getElementById('new_rec_payment_method')?.value || '';
    const period_start = document.getElementById('new_rec_period_start')?.value || null;
    const period_end = document.getElementById('new_rec_period_end')?.value || null;
    const observations = document.getElementById('new_rec_observations')?.value.trim() || null;

    if (!amount || amount <= 0) {
      Toast.warning('Veuillez indiquer un montant valide');
      if (btn) btn.disabled = false;
      return;
    }

    try {
      const payload = {
        property_id: property_id ? Number(property_id) : null,
        apartment_id: apartment_id ? Number(apartment_id) : null,
        tenant_id: tenant_id ? Number(tenant_id) : null,
        tenant_name,
        receipt_type,
        amount,
        payment_date,
        payment_method,
        period_start,
        period_end,
        observations,
      };

      const res = await API.post('/receipts/custom', payload);
      const createdReceipt = res.data;

      Toast.success('Reçu émis et archivé avec succès ! 🎉');
      Modal.close();
      await this.loadReceipts();

      if (window.ReceiptManager && createdReceipt) {
        ReceiptManager.open(createdReceipt);
      }
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de l\'émission du reçu');
      if (btn) btn.disabled = false;
    }
  },
};

window.PageReceipts = PageReceipts;
