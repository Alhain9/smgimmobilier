const PageReports = {
  register() { Router.register('reports', () => this.render()); },
  period: 'year',
  from: '',
  to: '',
  activeTab: 'company_balance', // 'company_balance' | 'import'
  cachedData: null,

  computeRange() {
    const now = new Date();
    let start, end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    if (this.period === 'custom' && this.from && this.to) {
      return { 
        start: this.from, 
        end: this.to 
      };
    }
    
    let startDate;
    switch (this.period) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case 'quarter':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'all':
        startDate = new Date(2020, 0, 1);
        break;
      case 'year':
      default:
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }
    return {
      start: startDate.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  },

  async render() {
    Layout.setTitle('Bilan Financier & Chantiers');
    Layout.content(`
      <div class="page-head flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2>📊 Bilan Financier & Rentabilité</h2>
          <div class="subtitle">Vue synthétique et claire des finances de l'entreprise et de la rentabilité des chantiers</div>
        </div>
        <div class="flex gap-2">
          <button class="btn ${this.activeTab === 'company_balance' ? 'btn-primary' : 'btn-outline'}" onclick="PageReports.switchTab('company_balance')">
            💰 Bilan & Chantiers
          </button>
          <button class="btn ${this.activeTab === 'import' ? 'btn-primary' : 'btn-outline'}" onclick="PageReports.switchTab('import')">
            📥 Importation de données
          </button>
        </div>
      </div>

      <div id="tabCompanyBalance" class="${this.activeTab === 'company_balance' ? '' : 'hidden'}">
        <div class="card mb-4" style="border-left: 4px solid var(--primary, #0284c7);">
          <div class="card-body" style="padding: 16px 20px;">
            <div class="flex items-center justify-between flex-wrap gap-3">
              <div class="flex items-center gap-2 flex-wrap">
                <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-muted, #64748b);">📅 Période d'analyse :</span>
                <div class="btn-group flex gap-1">
                  <button class="btn btn-sm ${this.period === 'month' ? 'btn-primary' : 'btn-outline'}" onclick="PageReports.setPeriod('month')">Ce mois</button>
                  <button class="btn btn-sm ${this.period === 'last_month' ? 'btn-primary' : 'btn-outline'}" onclick="PageReports.setPeriod('last_month')">Mois dernier</button>
                  <button class="btn btn-sm ${this.period === 'quarter' ? 'btn-primary' : 'btn-outline'}" onclick="PageReports.setPeriod('quarter')">3 derniers mois</button>
                  <button class="btn btn-sm ${this.period === 'year' ? 'btn-primary' : 'btn-outline'}" onclick="PageReports.setPeriod('year')">Cette année (${new Date().getFullYear()})</button>
                  <button class="btn btn-sm ${this.period === 'all' ? 'btn-primary' : 'btn-outline'}" onclick="PageReports.setPeriod('all')">Tout l'historique</button>
                  <button class="btn btn-sm ${this.period === 'custom' ? 'btn-primary' : 'btn-outline'}" onclick="PageReports.setPeriod('custom')">Personnalisée</button>
                </div>
              </div>
              <div id="customDatesWrap" class="${this.period === 'custom' ? 'flex' : 'hidden'} items-center gap-2">
                <input type="date" class="form-control form-control-sm" id="repFrom" value="${this.from}" onchange="PageReports.from=this.value" />
                <span>au</span>
                <input type="date" class="form-control form-control-sm" id="repTo" value="${this.to}" onchange="PageReports.to=this.value" />
                <button class="btn btn-sm btn-primary" onclick="PageReports.loadCompanyBalance()">Appliquer</button>
              </div>
              <div class="flex gap-2">
                <button class="btn btn-sm btn-outline" onclick="window.print()">🖨️ Imprimer / PDF</button>
                <button class="btn btn-sm btn-outline" onclick="PageReports.exportExcelSummary()">📊 Exporter Excel</button>
              </div>
            </div>
          </div>
        </div>

        <div id="financialBalanceContent">
          <div class="spinner" style="margin: 40px auto;"></div>
        </div>
      </div>

      <div id="tabImport" class="${this.activeTab === 'import' ? '' : 'hidden'}">
        <div id="importSection"></div>
      </div>
    `);

    if (this.activeTab === 'company_balance') {
      this.loadCompanyBalance();
    } else {
      this.renderImport();
    }
  },

  switchTab(tab) {
    this.activeTab = tab;
    this.render();
  },

  setPeriod(p) {
    this.period = p;
    const customWrap = document.getElementById('customDatesWrap');
    if (customWrap) {
      customWrap.classList.toggle('hidden', p !== 'custom');
      customWrap.classList.toggle('flex', p === 'custom');
    }
    if (p !== 'custom') {
      this.loadCompanyBalance();
    }
  },

  async loadCompanyBalance() {
    const container = document.getElementById('financialBalanceContent');
    if (!container) return;
    container.innerHTML = '<div class="spinner" style="margin: 40px auto;"></div>';

    try {
      const { start, end } = this.computeRange();
      const res = await API.get(`/reports/company-balance?start=${start}&end=${end}`);
      if (!res || !res.data) throw new Error('Données introuvables');

      const data = res.data;
      this.cachedData = data;
      this.renderFinancialBalance(container, data);
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon" style="font-size:2rem;margin-bottom:8px">⚠️</div>
          <p>Impossible de charger le bilan financier : ${err.message || err}</p>
          <button class="btn btn-primary btn-sm mt-3" onclick="PageReports.loadCompanyBalance()">Réessayer</button>
        </div>
      `;
    }
  },

  renderFinancialBalance(container, d) {
    const s = d.summary;
    const isProfit = s.net_operating_profit >= 0;
    const profitColor = isProfit ? '#16a34a' : '#dc2626';
    const profitBg = isProfit ? '#dcfce7' : '#fee2e2';

    container.innerHTML = `
      <!-- 4 CARTES KPI SYNTHÉTIQUES & SIMPLES -->
      <div class="stats-grid mb-4" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
        
        <!-- 1. RECETTES -->
        <div class="card" style="border-top: 4px solid #10b981; padding: 18px 20px;">
          <div class="flex justify-between items-start">
            <div>
              <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted, #64748b); font-weight: 600;">
                1. Chiffre d'Affaires & Recettes
              </div>
              <div style="font-size: 1.65rem; font-weight: 800; color: #0f172a; margin-top: 6px;">
                ${Helpers.formatMoney(s.total_revenue)}
              </div>
            </div>
            <div style="font-size: 1.8rem; background: #ecfdf5; padding: 10px; border-radius: 10px;">💰</div>
          </div>
          <div style="margin-top: 12px; font-size: 0.82rem; color: #475569; border-top: 1px dashed #e2e8f0; padding-top: 8px;">
            <div>🔨 Chantiers facturés : <b>${Helpers.formatMoney(s.worksites_billed_revenue)}</b></div>
            <div>🏢 Comms. gestion loyers : <b>${Helpers.formatMoney(s.agency_commission_revenue)}</b></div>
          </div>
        </div>

        <!-- 2. COUTS MATERIAUX & STOCKS -->
        <div class="card" style="border-top: 4px solid #f59e0b; padding: 18px 20px;">
          <div class="flex justify-between items-start">
            <div>
              <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted, #64748b); font-weight: 600;">
                2. Matériaux & Stocks
              </div>
              <div style="font-size: 1.65rem; font-weight: 800; color: #b45309; margin-top: 6px;">
                ${Helpers.formatMoney(s.materials_and_stock_cost)}
              </div>
            </div>
            <div style="font-size: 1.8rem; background: #fef3c7; padding: 10px; border-radius: 10px;">🧱</div>
          </div>
          <div style="margin-top: 12px; font-size: 0.82rem; color: #475569; border-top: 1px dashed #e2e8f0; padding-top: 8px;">
            <div>🧱 Matériaux chantiers : <b>${Helpers.formatMoney(s.worksites_materials_cost)}</b></div>
            <div>📦 Achats stocks période : <b>${Helpers.formatMoney(s.stock_purchases_period)}</b></div>
          </div>
        </div>

        <!-- 3. MAIN D'OEUVRE & PRESTATAIRES -->
        <div class="card" style="border-top: 4px solid #6366f1; padding: 18px 20px;">
          <div class="flex justify-between items-start">
            <div>
              <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted, #64748b); font-weight: 600;">
                3. Main d'Œuvre & Tâcherons
              </div>
              <div style="font-size: 1.65rem; font-weight: 800; color: #4338ca; margin-top: 6px;">
                ${Helpers.formatMoney(s.labor_and_payroll_cost)}
              </div>
            </div>
            <div style="font-size: 1.8rem; background: #e0e7ff; padding: 10px; border-radius: 10px;">👷</div>
          </div>
          <div style="margin-top: 12px; font-size: 0.82rem; color: #475569; border-top: 1px dashed #e2e8f0; padding-top: 8px;">
            <div>🔨 Prestataires chantiers : <b>${Helpers.formatMoney(s.worksites_labor_cost)}</b></div>
            <div>👥 Salaires fixes versés : <b>${Helpers.formatMoney(s.salaries_paid_cost)}</b></div>
          </div>
        </div>

        <!-- 4. BENEFICE NET -->
        <div class="card" style="border-top: 4px solid ${profitColor}; background: ${isProfit ? '#f0fdf4' : '#fef2f2'}; padding: 18px 20px;">
          <div class="flex justify-between items-start">
            <div>
              <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; color: ${profitColor}; font-weight: 700;">
                4. Bénéfice Net Réalisé
              </div>
              <div style="font-size: 1.65rem; font-weight: 900; color: ${profitColor}; margin-top: 6px;">
                ${Helpers.formatMoney(s.net_operating_profit)}
              </div>
            </div>
            <div style="font-size: 1.8rem; background: ${profitBg}; padding: 10px; border-radius: 10px;">
              ${isProfit ? '📈' : '📉'}
            </div>
          </div>
          <div style="margin-top: 12px; font-size: 0.85rem; font-weight: 600; color: ${profitColor}; border-top: 1px dashed ${profitColor}40; padding-top: 8px;">
            Marge d'exploitation : ${s.profit_margin_pct}%
          </div>
        </div>

      </div>

      <!-- SECTION 1 : RENTABILITÉ DÉTAILLÉE PAR CHANTIER -->
      <div class="card mb-4">
        <div class="card-header flex justify-between items-center flex-wrap gap-2">
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">🏗️ Rentabilité par Chantier</h3>
            <div class="text-muted" style="font-size: 0.85rem;">Détail de chaque chantier : recette facturée, dépenses réelles et gain net réalisé</div>
          </div>
          <div class="badge badge-info" style="font-size: 0.9rem; padding: 6px 12px;">
            ${d.worksites.length} chantier(s) répertorié(s)
          </div>
        </div>
        <div class="card-body" style="padding: 0;">
          <div class="table-wrap">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 0.85rem; color: #475569; text-align: left;">
                  <th style="padding: 12px 16px;">Chantier & Client</th>
                  <th style="padding: 12px 16px; text-align: right;">Recette / Devis</th>
                  <th style="padding: 12px 16px; text-align: right;">Matériaux</th>
                  <th style="padding: 12px 16px; text-align: right;">Main d'œuvre / Prestataire</th>
                  <th style="padding: 12px 16px; text-align: right;">Total Dépensé</th>
                  <th style="padding: 12px 16px; text-align: right;">Bénéfice Net</th>
                  <th style="padding: 12px 16px; text-align: center;">Marge %</th>
                  <th style="padding: 12px 16px; text-align: center;">Statut</th>
                </tr>
              </thead>
              <tbody>
                ${d.worksites.length === 0 ? `
                  <tr><td colspan="8" style="text-align: center; padding: 30px; color: #64748b;">Aucun chantier enregistré sur cette période.</td></tr>
                ` : d.worksites.map(w => {
                  const isWProfit = w.profit >= 0;
                  const statusMap = {
                    planning: '<span class="badge badge-warning">Planifié</span>',
                    in_progress: '<span class="badge badge-info">En cours</span>',
                    completed: '<span class="badge badge-success">Terminé</span>',
                    cancelled: '<span class="badge badge-danger">Annulé</span>'
                  };
                  return `
                    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.9rem;">
                      <td style="padding: 12px 16px;">
                        <div style="font-weight: 700; color: #0f172a;">${Helpers.escapeHtml(w.title)}</div>
                        <div style="font-size: 0.8rem; color: #64748b;">
                          Client : <b>${Helpers.escapeHtml(w.client_name || 'Non spécifié')}</b>
                          ${w.contractor ? ` · Tâcheron : ${Helpers.escapeHtml(w.contractor)}` : ''}
                        </div>
                      </td>
                      <td style="padding: 12px 16px; text-align: right; font-weight: 600; color: #047857;">
                        ${Helpers.formatMoney(w.contract_amount)}
                      </td>
                      <td style="padding: 12px 16px; text-align: right; color: #b45309;">
                        ${Helpers.formatMoney(w.material_cost)}
                      </td>
                      <td style="padding: 12px 16px; text-align: right; color: #4338ca;">
                        ${Helpers.formatMoney(w.labor_cost)}
                      </td>
                      <td style="padding: 12px 16px; text-align: right; font-weight: 600; color: #dc2626;">
                        ${Helpers.formatMoney(w.spent_amount)}
                      </td>
                      <td style="padding: 12px 16px; text-align: right; font-weight: 800; color: ${isWProfit ? '#16a34a' : '#dc2626'};">
                        ${Helpers.formatMoney(w.profit)}
                      </td>
                      <td style="padding: 12px 16px; text-align: center;">
                        <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.8rem; font-weight: 700; background: ${isWProfit ? '#dcfce7' : '#fee2e2'}; color: ${isWProfit ? '#15803d' : '#b91c1c'};">
                          ${w.margin_pct}%
                        </span>
                      </td>
                      <td style="padding: 12px 16px; text-align: center;">
                        ${statusMap[w.status] || w.status}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              ${d.worksites.length > 0 ? `
                <tfoot>
                  <tr style="background: #f1f5f9; font-weight: 800; border-top: 2px solid #cbd5e1; font-size: 0.92rem;">
                    <td style="padding: 12px 16px;">TOTAL CHANTIERS (${d.worksites.length})</td>
                    <td style="padding: 12px 16px; text-align: right; color: #047857;">${Helpers.formatMoney(s.worksites_billed_revenue)}</td>
                    <td style="padding: 12px 16px; text-align: right; color: #b45309;">${Helpers.formatMoney(s.worksites_materials_cost)}</td>
                    <td style="padding: 12px 16px; text-align: right; color: #4338ca;">${Helpers.formatMoney(s.worksites_labor_cost)}</td>
                    <td style="padding: 12px 16px; text-align: right; color: #dc2626;">${Helpers.formatMoney(s.worksites_total_spent)}</td>
                    <td style="padding: 12px 16px; text-align: right; color: ${s.worksites_net_profit >= 0 ? '#16a34a' : '#dc2626'}; font-weight: 900;">
                      ${Helpers.formatMoney(s.worksites_net_profit)}
                    </td>
                    <td style="padding: 12px 16px; text-align: center;">
                      <span style="padding: 2px 8px; border-radius: 9999px; background: ${s.worksites_net_profit >= 0 ? '#dcfce7' : '#fee2e2'}; color: ${s.worksites_net_profit >= 0 ? '#15803d' : '#b91c1c'};">
                        ${s.worksites_billed_revenue > 0 ? Math.round((s.worksites_net_profit / s.worksites_billed_revenue) * 100) : 0}%
                      </span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              ` : ''}
            </table>
          </div>
        </div>
      </div>

      <!-- SECTION 2 : STOCKS, MAGASINS & CHARGES FIXES -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
        
        <!-- CARTE ENTREPÔTS & VALORISATION STOCKS -->
        <div class="card">
          <div class="card-header flex justify-between items-center">
            <div>
              <h4 style="margin: 0; font-size: 1.05rem; font-weight: 700;">🏬 Entrepôts & Stocks Matériaux</h4>
              <div class="text-muted" style="font-size: 0.8rem;">Valorisation des stocks entreposés (Douala, Yaoundé)</div>
            </div>
            <span style="font-size: 1.5rem;">📦</span>
          </div>
          <div class="card-body">
            <div class="flex items-center justify-between p-3 mb-3" style="background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div>
                <div style="font-size: 0.82rem; color: #64748b;">Valeur marchande actuelle du stock</div>
                <div style="font-size: 1.35rem; font-weight: 800; color: #0284c7;">
                  ${Helpers.formatMoney(d.stock_valuation_total)}
                </div>
              </div>
              <div class="badge badge-info" style="font-size: 0.85rem;">${(d.warehouses || []).length || 6} entrepôts</div>
            </div>
            <div style="font-size: 0.85rem; color: #475569; line-height: 1.6;">
              <p style="margin-bottom: 6px;">
                💡 <b>Stock d'équipement et matériaux :</b> Les articles et matériels stockés dans vos entrepôts (matériel de chantier, carreaux, plomberie, électricité...) sont disponibles pour approvisionner immédiatement les chantiers sans retard.
              </p>
              <div class="flex justify-between items-center pt-2" style="border-top: 1px solid #e2e8f0;">
                <span>Total réapprovisionnements période :</span>
                <b style="color: #b45309;">${Helpers.formatMoney(s.stock_purchases_period)}</b>
              </div>
            </div>
          </div>
        </div>

        <!-- CARTE GESTION IMMOBILIERE & SALAIRES -->
        <div class="card">
          <div class="card-header flex justify-between items-center">
            <div>
              <h4 style="margin: 0; font-size: 1.05rem; font-weight: 700;">🏢 Gestion Immobilière & Frais Fixes</h4>
              <div class="text-muted" style="font-size: 0.8rem;">Commissions sur loyers et masse salariale</div>
            </div>
            <span style="font-size: 1.5rem;">📋</span>
          </div>
          <div class="card-body">
            <div class="space-y-3" style="font-size: 0.9rem;">
              <div class="flex justify-between items-center p-2" style="background: #f8fafc; border-radius: 6px;">
                <span>🏢 Loyers encaissés (propriétaires) :</span>
                <b>${Helpers.formatMoney(d.rental_management.total_collected)}</b>
              </div>
              <div class="flex justify-between items-center p-2" style="background: #ecfdf5; border-radius: 6px; color: #065f46;">
                <span>✨ Commission d'agence estimée (10%) :</span>
                <b style="font-size: 1.05rem;">${Helpers.formatMoney(s.agency_commission_revenue)}</b>
              </div>
              <div class="flex justify-between items-center p-2" style="background: #fef2f2; border-radius: 6px; color: #991b1b;">
                <span>👥 Masse salariale versée (Salaires) :</span>
                <b style="font-size: 1.05rem;">${Helpers.formatMoney(s.salaries_paid_cost)}</b>
              </div>
            </div>
            <div class="text-muted mt-3" style="font-size: 0.8rem;">
              * Les rapports détaillés par propriétaire et immeuble restent accessibles dans la rubrique dédiée <i>Rapport de gestion</i>.
            </div>
          </div>
        </div>

      </div>
    `;
  },

  exportExcelSummary() {
    if (!this.cachedData) {
      Toast.error('Veuillez patienter pendant le chargement des données');
      return;
    }
    const d = this.cachedData;
    const s = d.summary;

    const rows = [
      ['BILAN FINANCIER & RENTABILITE - SMG IMMOBILIER'],
      ['Periode', `${d.period.start} au ${d.period.end}`],
      [''],
      ['1. SYNTHESE GLOBALE'],
      ['Chiffre d affaires total', s.total_revenue],
      ['  - Recettes chantiers factures', s.worksites_billed_revenue],
      ['  - Commissions gestion loyers', s.agency_commission_revenue],
      ['Couts materiaux et stocks', s.materials_and_stock_cost],
      ['  - Depenses materiaux chantiers', s.worksites_materials_cost],
      ['  - Achats approvisionnement stocks', s.stock_purchases_period],
      ['Couts main d oeuvre et prestataires', s.labor_and_payroll_cost],
      ['  - Prestataires & tâcherons chantiers', s.worksites_labor_cost],
      ['  - Salaires internes fixes', s.salaries_paid_cost],
      ['Benefice net exploitation', s.net_operating_profit],
      ['Marge d exploitation (%)', `${s.profit_margin_pct}%`],
      ['Valeur actuelle du stock (entrepôts)', d.stock_valuation_total],
      [''],
      ['2. RENTABILITE PAR CHANTIER'],
      ['Chantier', 'Client', 'Tacheron', 'Statut', 'Recette Facturee', 'Cout Materiaux', 'Main d oeuvre', 'Total Depense', 'Benefice Net', 'Marge %'],
      ...d.worksites.map(w => [
        w.title,
        w.client_name || '',
        w.contractor || '',
        w.status,
        w.contract_amount,
        w.material_cost,
        w.labor_cost,
        w.spent_amount,
        w.profit,
        `${w.margin_pct}%`
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bilan_Financier');
    XLSX.writeFile(wb, `Bilan_Financier_${d.period.start}_au_${d.period.end}.xlsx`);
    Toast.success('Fichier Excel exporté avec succès');
  },

  // ===================== IMPORT EXCEL / CSV =====================
  importType: 'payments',
  _parsed: [],
  renderImport() {
    const el = document.getElementById('importSection');
    if (!el) return;
    el.innerHTML = `
      <div class="page-head">
        <div>
          <h2>📥 Importation de données</h2>
          <div class="subtitle">Importez vos données par fichier Excel (.xlsx) ou CSV avec aperçu préalable</div>
        </div>
      </div>
      <div class="card">
        <div class="card-body">
          <div class="toolbar flex items-center gap-2 flex-wrap">
            <select class="form-control" id="impType" style="max-width:220px" onchange="PageReports.importType=this.value">
              <option value="payments">Paiements</option>
              <option value="expenses">Dépenses (matériaux)</option>
              <option value="tenants">Locataires</option>
            </select>
            <input type="file" class="form-control" id="impFile" accept=".xlsx,.xls,.csv" style="max-width:280px" />
            <button class="btn btn-outline" onclick="PageReports.previewImport()">👁 Prévisualiser</button>
            <button class="btn btn-sm btn-outline" onclick="PageReports.downloadTemplate()">⬇ Télécharger Modèle</button>
          </div>
          <div id="importPreview" class="mt-4"></div>
        </div>
      </div>`;
  },

  TEMPLATES: {
    payments: ['tenant_id', 'apartment_id', 'amount', 'payment_method', 'payment_date', 'status'],
    expenses: ['maintenance_id', 'item_name', 'category', 'quantity', 'unit_price', 'supplier'],
    tenants: ['full_name', 'email', 'phone', 'cni', 'profession'],
  },

  downloadTemplate() {
    const cols = this.TEMPLATES[this.importType];
    const ws = XLSX.utils.aoa_to_sheet([cols]);
    const wb = XLSX.utils.book_new(); 
    XLSX.utils.book_append_sheet(wb, ws, 'Modele');
    XLSX.writeFile(wb, `modele_${this.importType}.xlsx`);
  },

  previewImport() {
    const file = document.getElementById('impFile').files[0];
    if (!file) { Toast.error('Sélectionnez un fichier'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        if (!rows.length) { Toast.error('Fichier vide'); return; }
        const seen = new Set();
        this._parsed = rows.filter((r) => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; });
        const cols = Object.keys(this._parsed[0]);
        const head = cols.map((c) => `<th>${c}</th>`).join('');
        const body = this._parsed.slice(0, 20).map((r) => `<tr>${cols.map((c) => `<td>${r[c]}</td>`).join('')}</tr>`).join('');
        document.getElementById('importPreview').innerHTML = `
          <div class="flex justify-between items-center mb-4">
            <b>${this._parsed.length} ligne(s) détectée(s)</b>
            <button class="btn btn-primary" onclick="PageReports.confirmImport()">✅ Valider l'import</button>
          </div>
          <div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
          ${this._parsed.length > 20 ? '<p class="text-muted">Aperçu des 20 premières lignes.</p>' : ''}`;
      } catch (err) { Toast.error('Erreur de lecture : ' + err.message); }
    };
    reader.readAsBinaryString(file);
  },

  async confirmImport() {
    if (!this._parsed.length) return;
    const endpoint = { payments: '/payments', expenses: '/expenses', tenants: '/tenants' }[this.importType];
    let ok = 0, fail = 0;
    Toast.info('Import en cours...');
    for (const row of this._parsed) {
      try { await API.post(endpoint, row); ok++; } catch (_) { fail++; }
    }
    Toast.success(`Import terminé : ${ok} réussi(s), ${fail} échec(s)`);
    document.getElementById('importPreview').innerHTML = `<div class="empty-state"><div class="icon">✅</div>${ok} enregistrement(s) importé(s)${fail ? `, ${fail} échec(s)` : ''}.</div>`;
    this._parsed = [];
  },
};
