// ============ Page Reçus de Paiement — SMG IMMOBILIER ============
const PageReceipts = {
  register() {
    Router.register('receipts', () => this.render());
  },

  async render() {
    Layout.setTitle('Reçus de paiement');
    const appContent = document.getElementById('appContent');
    appContent.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h2 style="font-size:18px;font-weight:700;color:var(--text)">🧾 Reçus et documents financiers</h2>
            <p style="font-size:13px;color:var(--text-muted);margin-top:2px">Consultez, imprimez et téléchargez les reçus officiels des paiements de loyer et cautions.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="ReceiptManager.open()"><span class="btn-icon">➕</span> Nouveau Reçu (Générateur)</button>
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

      <div class="card">
        <div class="table-responsive">
          <table class="table" id="receiptsTable">
            <thead>
              <tr>
                <th>N° Reçu</th>
                <th>Type</th>
                <th>Locataire</th>
                <th>Bien / Logement</th>
                <th>Montant</th>
                <th>Mode</th>
                <th>Date</th>
                <th>Statut</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody id="receiptsTableBody">
              <tr><td colspan="9" style="text-align:center;padding:30px"><div class="spinner"></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await this.loadReceipts();
  },

  _receipts: [],

  async loadReceipts() {
    const type = document.getElementById('receiptTypeFilter')?.value || '';
    const start = document.getElementById('receiptStartDate')?.value || '';
    const end = document.getElementById('receiptEndDate')?.value || '';

    let url = '/receipts?';
    if (type) url += `type=${type}&`;
    if (start) url += `start=${start}&`;
    if (end) url += `end=${end}&`;

    try {
      const res = await API.get(url);
      this._receipts = res.data || [];
      this.renderTable(this._receipts);
    } catch (err) {
      Toast.error('Erreur lors du chargement des reçus');
      document.getElementById('receiptsTableBody').innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--danger)">Échec de chargement des reçus.</td></tr>`;
    }
  },

  renderTable(receipts) {
    const tbody = document.getElementById('receiptsTableBody');
    if (!receipts.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-muted)">Aucun reçu trouvé.</td></tr>`;
      return;
    }

    const typeLabels = {
      rent: 'Loyer',
      deposit: 'Caution',
      advance: 'Avance',
      other_income: 'Autre',
      expense_report: 'Dépense',
    };

    tbody.innerHTML = receipts.map((r) => {
      const tenantName = r.tenant?.user?.full_name || '—';
      const propName = r.property?.property_name || '—';
      const aptNum = r.apartment?.apartment_number || '—';
      const amount = Number(r.amount || 0).toLocaleString('fr-FR') + ' FCFA';
      const date = r.payment_date ? new Date(r.payment_date).toLocaleDateString('fr-FR') : '—';
      const statusBadge = r.status === 'issued'
        ? `<span class="badge badge-success">Émis</span>`
        : `<span class="badge badge-danger">Annulé</span>`;

      return `
        <tr>
          <td><strong style="color:var(--primary)">${r.receipt_number}</strong></td>
          <td><span class="badge badge-info">${typeLabels[r.receipt_type] || r.receipt_type}</span></td>
          <td><b>${tenantName}</b></td>
          <td>${propName} — <small>${aptNum}</small></td>
          <td><b style="color:var(--success)">${amount}</b></td>
          <td><small>${r.payment_method || '—'}</small></td>
          <td>${date}</td>
          <td>${statusBadge}</td>
          <td style="text-align:right">
            <button class="btn btn-sm btn-primary" onclick="PageReceipts.openOfficial(${r.id})" title="Voir le reçu officiel" style="font-weight:600;display:inline-flex;align-items:center;gap:4px;">👁️ Voir le reçu</button>
            <a class="btn btn-sm btn-outline" href="${PageReceipts.pdfUrl(r.id)}" target="_blank" rel="noopener" title="Ouvrir le PDF dans un nouvel onglet" style="display:inline-flex;align-items:center;gap:4px;text-decoration:none">📄 PDF</a>
          </td>
        </tr>
      `;
    }).join('');
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
};

window.PageReceipts = PageReceipts;
