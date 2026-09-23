// ============ Page Rapports de Gestion Périodiques — SMG IMMOBILIER ============
const PageManagementReports = {
  register() {
    Router.register('management-reports', () => this.render());
  },

  async render() {
    Layout.setTitle('Rapports de gestion');
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

    const isBailleur = Auth.getRole() === 'bailleur';

    const appContent = document.getElementById('appContent');
    appContent.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h2 style="font-size:18px;font-weight:700;color:var(--text)">📊 Rapports Périodiques de Gestion</h2>
            <p style="font-size:13px;color:var(--text-muted);margin-top:2px">Sélectionnez une période libre et un bien immobilier pour générer un bilan complet (revenus, dépenses, travaux, résultat net).</p>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:16px">
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted)">Immeuble / Bien</label>
            <select id="mReportPropertySelect" class="form-control">
              <option value="">Chargement des immeubles...</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted)">Date de début 📅</label>
            <input type="date" id="mReportStartDate" class="form-control" value="${firstDay}" />
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--text-muted)">Date de fin 📅</label>
            <input type="date" id="mReportEndDate" class="form-control" value="${lastDay}" />
          </div>
          <div style="display:flex;align-items:flex-end;gap:8px">
            <button class="btn btn-primary" style="flex:1" onclick="PageManagementReports.generateReport()">
              <span class="btn-icon">⚡</span> Analyser & Afficher
            </button>
            <button class="btn btn-success" id="mReportPdfBtn" style="display:none" onclick="PageManagementReports.downloadPdf()">
              <span class="btn-icon">📄</span> Exporter PDF
            </button>
          </div>
        </div>
      </div>

      <div id="mReportResultArea">
        <div class="card" style="text-align:center;padding:40px;color:var(--text-muted)">
          <span style="font-size:40px">📊</span>
          <p style="margin-top:12px;font-size:14px">Sélectionnez un immeuble et cliquez sur <b>« Analyser & Afficher »</b> pour générer le rapport.</p>
        </div>
      </div>
    `;

    await this.loadProperties();
  },

  async loadProperties() {
    try {
      const res = await API.get('/properties');
      const props = res.data || [];
      const select = document.getElementById('mReportPropertySelect');
      if (!props.length) {
        select.innerHTML = '<option value="">Aucun immeuble disponible</option>';
        return;
      }
      select.innerHTML = props.map((p) => `<option value="${p.id}">${p.property_name} (${p.city || '—'})</option>`).join('');
    } catch (err) {
      Toast.error('Impossible de charger les immeubles');
    }
  },

  _currentReport: null,

  async generateReport() {
    const propertyId = document.getElementById('mReportPropertySelect')?.value;
    const start = document.getElementById('mReportStartDate')?.value;
    const end = document.getElementById('mReportEndDate')?.value;

    if (!propertyId) { Toast.warning('Veuillez sélectionner un immeuble'); return; }
    if (!start || !end) { Toast.warning('Veuillez renseigner les dates'); return; }
    if (start > end) { Toast.error('La date de début ne peut pas être après la date de fin'); return; }

    const area = document.getElementById('mReportResultArea');
    area.innerHTML = '<div class="card" style="text-align:center;padding:40px"><div class="spinner"></div><p style="margin-top:12px;color:var(--text-muted)">Génération du rapport en cours...</p></div>';

    try {
      const res = await API.get(`/management-reports/building/${propertyId}?start=${start}&end=${end}`);
      const data = res.data;
      this._currentReport = data;

      document.getElementById('mReportPdfBtn').style.display = 'inline-flex';
      this.renderReport(data);
    } catch (err) {
      Toast.error('Erreur lors de la génération du rapport');
      area.innerHTML = `<div class="card" style="text-align:center;padding:30px;color:var(--danger)">Échec de génération du rapport.</div>`;
    }
  },

  renderReport(r) {
    const s = r.summary;
    const p = r.property;
    const fmt = (n) => Number(n || 0).toLocaleString('fr-FR') + ' FCFA';
    const area = document.getElementById('mReportResultArea');

    const netResultColor = s.net_result >= 0 ? 'var(--success)' : 'var(--danger)';
    const netResultSign = s.net_result >= 0 ? '+' : '';

    area.innerHTML = `
      <!-- EN-TÊTE DU RAPPORT -->
      <div class="card" style="margin-bottom:16px;border-left:4px solid var(--primary)">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <span class="badge badge-info" style="font-size:12px">🏢 ${p.property_name}</span>
            <h3 style="font-size:16px;font-weight:700;margin-top:4px">${p.address || ''}, ${p.city || ''}</h3>
            <p style="font-size:12px;color:var(--text-muted);margin:0">
              Propriétaire : <b>${p.owner ? p.owner.full_name : '—'}</b> | Période : <b>${r.period.start}</b> au <b>${r.period.end}</b> (${r.period.months} mois)
            </p>
          </div>
          <button class="btn btn-success" onclick="PageManagementReports.downloadPdf()">
            <span class="btn-icon">📄</span> Télécharger en PDF
          </button>
        </div>
      </div>

      <!-- 1. KPI FINANCIERS -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px">
        <div class="card stat-card">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Loyer Attendu (Théorique)</div>
          <div style="font-size:20px;font-weight:800;color:var(--primary);margin-top:4px">${fmt(s.theoretical_rent)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${r.rental_situation.occupied_apartments} logement(s) × ${r.period.months} mois</div>
        </div>

        <div class="card stat-card">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Loyer Réellement Encaissé</div>
          <div style="font-size:20px;font-weight:800;color:var(--success);margin-top:4px">${fmt(s.collected_rent)}</div>
          <div style="font-size:11px;color:var(--success);margin-top:2px">Taux d'encaissement : <b>${s.collection_rate}%</b></div>
        </div>

        <div class="card stat-card">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Reste à Encaisser / Impayés</div>
          <div style="font-size:20px;font-weight:800;color:var(--danger);margin-top:4px">${fmt(s.remaining_to_collect)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Écart sur la période</div>
        </div>

        <div class="card stat-card">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Total Dépenses Immeuble</div>
          <div style="font-size:20px;font-weight:800;color:var(--accent);margin-top:4px">${fmt(s.total_expenses)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Maint: ${fmt(s.maintenance_expenses)} | Autre: ${fmt(s.other_expenses)}</div>
        </div>
      </div>

      <!-- RÉSULTAT NET -->
      <div class="card" style="margin-bottom:16px;background:var(--secondary-bg, #f0f4f8);border:2px solid ${netResultColor}">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h4 style="font-size:14px;font-weight:700;color:var(--text);margin:0">💰 RÉSULTAT FINANCIER DE LA PÉRIODE</h4>
            <p style="font-size:12px;color:var(--text-muted);margin:2px 0 0">
              Encaissements (${fmt(s.collected_rent)}) − Dépenses (${fmt(s.total_expenses)})
            </p>
          </div>
          <div style="font-size:24px;font-weight:900;color:${netResultColor}">
            ${netResultSign}${fmt(s.net_result)}
          </div>
        </div>
      </div>

      <!-- 2. SITUATION LOCATIVE -->
      <div class="card" style="margin-bottom:16px">
        <h4 style="font-size:15px;font-weight:700;margin-bottom:12px">🏠 2. Situation Locative par Logement (${r.rental_situation.occupied_apartments}/${r.rental_situation.total_apartments} occupés)</h4>
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Logement</th>
                <th>Type / Description</th>
                <th>Loyer</th>
                <th>Statut</th>
                <th>Locataire</th>
                <th>Téléphone</th>
                <th>Fin de bail</th>
              </tr>
            </thead>
            <tbody>
              ${(r.rental_situation.apartments || []).map((a) => `
                <tr>
                  <td><b>${a.apartment_number}</b></td>
                  <td>${a.description || a.apartment_type || '—'}</td>
                  <td><b>${fmt(a.rent_amount)}</b></td>
                  <td><span class="badge badge-${a.status === 'occupied' ? 'success' : 'warning'}">${a.status === 'occupied' ? 'Occupé' : 'Libre'}</span></td>
                  <td>${a.tenant_name || '—'}</td>
                  <td><small>${a.tenant_phone || '—'}</small></td>
                  <td><small>${a.lease_end ? new Date(a.lease_end).toLocaleDateString('fr-FR') : '—'}</small></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 3. ENCAISSEMENTS RÉALISÉS (SYNTHÈSE AGRÉGÉE PAR LOGEMENT / LOCATAIRE) -->
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <h4 style="font-size:15px;font-weight:700;margin:0">💳 3. Encaissements Réalisés (${(r.aggregated_collections || []).length} logements réglés — Total : ${fmt(s.collected_rent)})</h4>
          <span class="badge badge-success" style="font-size:12px">Total Encaissé : ${fmt(s.collected_rent)}</span>
        </div>
        ${!(r.aggregated_collections || []).length ? '<p style="color:var(--text-muted);font-size:13px">Aucun encaissement sur cette période.</p>' : `
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Logement</th>
                  <th>Locataire</th>
                  <th>Période / Nature du règlement</th>
                  <th>Mode(s)</th>
                  <th>N° Reçus</th>
                  <th style="text-align:right">Total Encaissé</th>
                </tr>
              </thead>
              <tbody>
                ${(r.aggregated_collections || []).map((c) => `
                  <tr>
                    <td><b>${c.apartment_number}</b></td>
                    <td><b>${c.tenant_name}</b></td>
                    <td>
                      <span style="font-weight:600">${c.nature}</span>
                      ${c.transaction_count > 1 ? `<span class="badge badge-info" style="margin-left:6px;font-size:10px">${c.transaction_count} versements</span>` : ''}
                      <br><small style="color:var(--text-muted)">Période : ${c.date_range}</small>
                    </td>
                    <td><small>${c.methods}</small></td>
                    <td>${(c.receipt_numbers || '—').split(/,\n|, /).map(rn => `<span class="badge badge-outline" style="display:inline-block;margin:2px 0;font-size:10.5px;font-weight:600;color:var(--primary)">${rn.trim()}</span>`).join('<br>')}</td>
                    <td style="text-align:right"><b style="color:var(--success);font-size:13px">${fmt(c.total_collected)}</b></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}

        <!-- DÉTAIL DES TRANSACTIONS INDIVIDUELLES -->
        ${(r.transactions || []).length ? `
          <div style="margin-top:16px;border-top:1px dashed var(--border);padding-top:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <h5 style="font-size:13px;font-weight:700;color:var(--text-muted);margin:0">
                🔍 Historique Détaillé des Transactions (${r.transactions.length} opération(s))
              </h5>
              <button class="btn btn-sm btn-outline" style="font-size:11px" onclick="
                const el = document.getElementById('reportTxDetailBox');
                if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
              ">Afficher / Masquer le détail</button>
            </div>
            <div id="reportTxDetailBox" class="table-responsive" style="max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:6px">
              <table class="table table-sm">
                <thead>
                  <tr style="background:var(--secondary-bg)">
                    <th>Date</th>
                    <th>Locataire</th>
                    <th>Logement</th>
                    <th>Mode</th>
                    <th>N° Reçu</th>
                    <th style="text-align:right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  ${r.transactions.map((t) => `
                    <tr>
                      <td><small>${new Date(t.date).toLocaleDateString('fr-FR')}</small></td>
                      <td><b>${t.tenant_name}</b></td>
                      <td>${t.apartment_number}</td>
                      <td><small>${t.payment_method || '—'}</small></td>
                      <td><small style="color:var(--primary)">${t.receipt_number || '—'}</small></td>
                      <td style="text-align:right"><b style="color:var(--success)">${fmt(t.amount)}</b></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- 4. TRAVAUX & INTERVENTIONS TECHNIQUES -->
      <div class="card" style="margin-bottom:16px">
        <h4 style="font-size:15px;font-weight:700;margin-bottom:12px">🔧 4. Travaux & Interventions Techniques (${(r.works_done || []).length})</h4>
        ${!(r.works_done || []).length ? '<p style="color:var(--text-muted);font-size:13px">Aucun travail de maintenance sur cette période.</p>' : `
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Intervention</th>
                  <th>Logement</th>
                  <th>Technicien</th>
                  <th>Statut</th>
                  <th>Coût</th>
                </tr>
              </thead>
              <tbody>
                ${r.works_done.map((w) => `
                  <tr>
                    <td><small>${new Date(w.date).toLocaleDateString('fr-FR')}</small></td>
                    <td><b>${w.title}</b><br><small style="color:var(--text-muted)">${w.description || ''}</small></td>
                    <td>${w.apartment_number}</td>
                    <td>${w.technician}</td>
                    <td><span class="badge badge-info">${w.status}</span></td>
                    <td><b style="color:var(--danger)">${fmt(w.cost)}</b></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <!-- 5. DÉPENSES DÉTAILLÉES -->
      <div class="card" style="margin-bottom:16px">
        <h4 style="font-size:15px;font-weight:700;margin-bottom:12px">🧾 5. Dépenses Détaillées (Total : ${fmt(s.total_expenses)})</h4>
        ${!(r.expenses_detail || []).length ? '<p style="color:var(--text-muted);font-size:13px">Aucune dépense sur cette période.</p>' : `
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Désignation</th>
                  <th>Catégorie</th>
                  <th>Contexte / Logement</th>
                  <th>Qté</th>
                  <th>Prix Unitaire</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${r.expenses_detail.map((e) => `
                  <tr>
                    <td><small>${new Date(e.date).toLocaleDateString('fr-FR')}</small></td>
                    <td><b>${e.item_name}</b></td>
                    <td><span class="badge badge-secondary">${e.category}</span></td>
                    <td><small>${e.apartment_number} (${e.maintenance_title || '—'})</small></td>
                    <td>${e.quantity}</td>
                    <td>${Number(e.unit_price).toLocaleString('fr-FR')}</td>
                    <td><b style="color:var(--danger)">${fmt(e.total_price)}</b></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <!-- 6. BILAN ET RÉSULTAT DE LA PÉRIODE -->
      <div class="card" style="background:var(--secondary-bg, #f0f4f8);border:2px solid ${netResultColor}">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h4 style="font-size:15px;font-weight:700;color:var(--text);margin:0">📊 6. BILAN ET RÉSULTAT NET DE LA PÉRIODE</h4>
            <p style="font-size:13px;color:var(--text-muted);margin:4px 0 0">
              Total Encaissements (${fmt(s.collected_rent)}) − Total Dépenses (${fmt(s.total_expenses)})
            </p>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:${netResultColor}">Montant Net à Reverser</div>
            <div style="font-size:24px;font-weight:900;color:${netResultColor}">
              ${netResultSign}${fmt(s.net_result)}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async downloadPdf() {
    if (!this._currentReport) return;
    const propertyId = this._currentReport.property.id;
    const start = this._currentReport.period.start;
    const end = this._currentReport.period.end;

    Toast.info('Génération du rapport PDF en cours...');
    try {
      const blob = await API.downloadBlob(`/management-reports/building/${propertyId}/pdf?start=${start}&end=${end}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = String(this._currentReport.property.property_name || 'Immeuble').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Rapport_${safeName}_${start}_${end}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      Toast.success('Rapport PDF téléchargé avec succès ✅');
    } catch (err) {
      console.error('Erreur PDF:', err);
      Toast.error(err.message || 'Impossible de télécharger le rapport PDF');
    }
  },
};

window.PageManagementReports = PageManagementReports;
