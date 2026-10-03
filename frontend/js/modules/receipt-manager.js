// ================================================================
// SMG IMMOBILIERE — GESTIONNAIRE & GÉNÉRATEUR DE REÇUS DE LOYER
// Format Paysage Officiel : 21 x 14,85 cm (A5)
// Conforme au modèle de référence avec html2pdf.js & impression directe
// ================================================================

class ReceiptStorageManager {
  constructor() {
    this.configKey = 'smg_receipt_app_config';
    this.historyKey = 'smg_receipt_app_history';
    this.maxHistory = 50;
  }

  saveConfig(config) {
    try {
      localStorage.setItem(this.configKey, JSON.stringify({ config, updatedAt: new Date().toISOString() }));
      return true;
    } catch (e) {
      console.error('saveConfig error:', e);
      return false;
    }
  }

  loadConfig() {
    try {
      const raw = localStorage.getItem(this.configKey);
      if (!raw) return null;
      return JSON.parse(raw).config || null;
    } catch (e) {
      console.error('loadConfig error:', e);
      return null;
    }
  }

  getHistory() {
    try {
      const raw = localStorage.getItem(this.historyKey);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      console.error('getHistory error:', e);
      return [];
    }
  }

  saveInvoice(invoice) {
    try {
      const history = this.getHistory();
      invoice.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
      invoice.savedAt = new Date().toISOString();
      history.unshift(invoice);
      if (history.length > this.maxHistory) history.length = this.maxHistory;
      localStorage.setItem(this.historyKey, JSON.stringify(history));
      return invoice.id;
    } catch (e) {
      console.error('saveInvoice error:', e);
      return null;
    }
  }

  clearHistory() {
    try {
      localStorage.removeItem(this.historyKey);
      return true;
    } catch (e) {
      return false;
    }
  }
}

class ReceiptHtmlGenerator {
  constructor() {
    this.defaults = {
      companyName: 'SMG IMMOBILIERE',
      companyAddress: 'Yaoundé et Douala, Cameroun',
      companyPhone: '+237 6 699 03 07 71, 670 56 16 12',
      companyEmail: 'smgimmobilier.infos@gmail.com',
      logo: '../assets/images/logo.png',
      primaryColor: '#1a3a5c',
      secondaryColor: '#f0f4f8',
      accentColor: '#c0392b',
      invoiceNumber: 'R-LOYER-2026-001',
      paymentDate: '',
      entryDate: '',
      clientName: 'M. Jean Dupont',
      clientAddress: 'Yaoundé, Cameroun',
      clientPhone: '+237 6 98 76 54 32',
      clientEmail: 'locataire@email.cm',
      propertyAddress: 'Immeuble SMG, Douala, Cameroun',
      rentAmount: 180000,
      debtAmount: 0,
      paidAmount: 180000,
      paymentMethod: 'Cash',
      observations: '',
      currency: 'FCFA',
    };
  }

  generate(config) {
    const cfg = { ...this.defaults, ...config };
    const currency = cfg.currency || 'FCFA';

    const fmtDate = (d) => {
      if (!d) return '—';
      const parts = String(d).split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return d;
    };

    const fmtAmount = (amount) => Math.round(Number(amount) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    const rent = Number(cfg.rentAmount) || 0;
    const debt = Number(cfg.debtAmount) || 0;
    const paid = Number(cfg.paidAmount) || 0;
    const remainingDebt = Math.max(0, debt - paid);
    const isDebtPaid = remainingDebt <= 0 && debt > 0;
    const hasDebt = debt > 0;

    let periodText = '';
    let periodClass = '';

    if (paid > 0 && rent > 0) {
      const today = cfg.paymentDate ? new Date(cfg.paymentDate) : new Date();
      const paidMonths = Math.max(1, Math.floor(paid / rent));
      const startDate = cfg.periodStart ? new Date(cfg.periodStart) : new Date(today);
      const endDate = cfg.periodEnd ? new Date(cfg.periodEnd) : new Date(startDate);
      if (!cfg.periodEnd) {
        endDate.setMonth(endDate.getMonth() + paidMonths);
      }

      const startStr = startDate.toLocaleDateString('fr-FR');
      const endStr = endDate.toLocaleDateString('fr-FR');

      const MONTH_NAMES_FR = [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
      ];

      const ref = cfg.paymentDate ? new Date(cfg.paymentDate) : new Date();
      const now = new Date();
      const activeRef = ref > now ? ref : now;
      const refYear = activeRef.getFullYear();
      const refMonth = activeRef.getMonth();

      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth();
      const endDay = endDate.getDate();

      let unpaidFromMonthIndex = endMonth;
      let unpaidFromYear = endYear;
      if (endDay <= 5) {
        unpaidFromMonthIndex = endMonth;
      } else if (endDay >= 25) {
        const nextM = new Date(endYear, endMonth + 1, 1);
        unpaidFromMonthIndex = nextM.getMonth();
        unpaidFromYear = nextM.getFullYear();
      }

      let monthsGap = (refYear - unpaidFromYear) * 12 + (refMonth - unpaidFromMonthIndex);
      let isOverdue = false;
      let overdueMonths = 0;
      if (monthsGap > 0) {
        isOverdue = true;
        overdueMonths = monthsGap;
      } else if (monthsGap === 0 && endDay <= 5) {
        isOverdue = true;
        overdueMonths = 1;
      }

      const overdueMonthName = MONTH_NAMES_FR[unpaidFromMonthIndex];
      if (isOverdue) {
        const autoDebt = Math.round(overdueMonths * rent);
        if (autoDebt > remainingDebt) {
          remainingDebt = autoDebt;
        }
        hasDebt = true;
      }

      if (isOverdue) {
        periodClass = 'dette';
        periodText = `Paiement couvrant ${paidMonths} mois (du ${startStr} au ${endStr})`;
      } else if (hasDebt) {
        periodClass = 'dette';
        periodText = `Paiement couvrant ${paidMonths} mois (du ${startStr} au ${endStr})`;
      } else {
        periodText = `Paiement couvrant ${paidMonths} mois de loyer (du ${startStr} au ${endStr})`;
        periodClass = '';
      }

      if (cfg.entryDate && cfg.entryDate > cfg.paymentDate) {
        const entry = new Date(cfg.entryDate);
        periodText += ` | Entrée effective le ${entry.toLocaleDateString('fr-FR')}`;
      }
    } else {
      periodText = 'Règlement de loyer';
    }

    let logoHtml = '';
    if (cfg.logo) {
      logoHtml = `<div class="logo-container"><img src="${cfg.logo}" alt="Logo" /></div>`;
    } else {
      logoHtml = `<div class="logo-container logo-placeholder"><i class="fas fa-building"></i> SMG</div>`;
    }

    let statusHtml = '';
    if (typeof isOverdue !== 'undefined' && isOverdue) {
      statusHtml = `<div class="debt-indicator danger" style="padding:4px 8px;border-radius:4px;font-weight:700;font-size:10px;text-align:center;margin-bottom:3px;background:#f8d7da;color:#721c24;border:1px solid #f5c6cb">Impayé à partir du mois de ${overdueMonthName} ${unpaidFromYear}</div>`;
    } else if (hasDebt && remainingDebt > 0) {
      statusHtml = `<div class="debt-indicator danger" style="padding:4px 8px;border-radius:4px;font-weight:700;font-size:10px;text-align:center;margin-bottom:3px;background:#f8d7da;color:#721c24;border:1px solid #f5c6cb">Dette restante</div>`;
    } else if (hasDebt && remainingDebt === 0) {
      statusHtml = `<div class="debt-indicator success" style="padding:4px 8px;border-radius:4px;font-weight:700;font-size:10px;text-align:center;margin-bottom:3px;background:#d4edda;color:#155724;border:1px solid #c3e6cb">Dette totalement soldée</div>`;
    } else if (paid > 0 && !hasDebt) {
      statusHtml = `<div class="debt-indicator success" style="padding:4px 8px;border-radius:4px;font-weight:700;font-size:10px;text-align:center;margin-bottom:3px;background:#d4edda;color:#155724;border:1px solid #c3e6cb">Locataire à jour de ses paiements</div>`;
    }

    let periodHtml = '';
    if (periodText) {
      const cls = periodClass ? `period-paid ${periodClass}` : 'period-paid';
      periodHtml = `<div class="${cls}">${periodText}</div>`;
    }

    return `
      <div class="invoice-container" id="printableInvoiceContainer"
           style="--primary-color: ${cfg.primaryColor};
                  --secondary-color: ${cfg.secondaryColor};
                  --accent-color: ${cfg.accentColor};">

        <div class="invoice-header">
          ${logoHtml}
          <div class="company-info">
            <h1>${this._escape(cfg.companyName)}</h1>
            <p>${this._escape(cfg.companyAddress)}</p>
            <p>📞 ${this._escape(cfg.companyPhone)} &nbsp;|&nbsp; ✉️ ${this._escape(cfg.companyEmail)}</p>
          </div>
        </div>

        <div class="invoice-body">
          <div class="invoice-title">
            <h2>REÇU DE PAIEMENT DE LOYER</h2>
            <span class="sub">N° ${this._escape(cfg.invoiceNumber)} - Date : ${fmtDate(cfg.paymentDate)}</span>
          </div>

          ${statusHtml}

          ${periodHtml}

          <div class="info-grid">
            <div class="block">
              <h4>📍 Locataire</h4>
              <p><strong>${this._escape(cfg.clientName)}</strong></p>
              <p>${this._escape(cfg.clientAddress || '—')}</p>
              <p>📞 ${this._escape(cfg.clientPhone || '—')}</p>
              ${cfg.clientEmail ? `<p>✉️ ${this._escape(cfg.clientEmail)}</p>` : ''}
            </div>
            <div class="block" style="display:flex;flex-direction:column;justify-content:space-between">
              <div>
                <h4>🏠 Bien loué</h4>
                <p style="font-weight:700;color:var(--primary-color,#1a3a5c);margin-bottom:8px">${this._escape(cfg.propertyAddress || '—')}</p>
              </div>
              <div style="background:#fff;padding:5px 8px;border-radius:4px;border:1px solid #dee2e6;font-size:10.5px;display:flex;justify-content:space-between;align-items:center">
                <span style="color:#6c757d">Loyer mensuel :</span>
                <strong style="color:var(--primary-color,#1a3a5c)">${fmtAmount(cfg.rentAmount)} ${currency}</strong>
              </div>
              ${cfg.entryDate && cfg.entryDate > cfg.paymentDate ? `<p class="small" style="margin-top:4px;font-size:9.5px;color:#6c757d">📅 Entrée effective : ${fmtDate(cfg.entryDate)}</p>` : ''}
            </div>
          </div>

          <table class="invoice-table">
            <thead>
              <tr><th>Désignation</th><th class="text-right">Montant (${currency})</th></tr>
            </thead>
            <tbody>
              ${hasDebt ? `<tr><td>Arriérés de loyer</td><td class="text-right">${fmtAmount(cfg.debtAmount)}</td></tr>` : ''}
              <tr><td>Paiement effectué</td><td class="text-right"><strong>${fmtAmount(cfg.paidAmount)}</strong></td></tr>
              ${remainingDebt > 0 ? `<tr><td>Reste à payer (Arriérés)</td><td class="text-right" style="color:var(--accent-color,#c0392b);font-weight:700;">${fmtAmount(remainingDebt)}</td></tr>` : ''}
              ${isDebtPaid ? `<tr><td>Dette soldée</td><td class="text-right" style="color:#27ae60;font-weight:700;">0</td></tr>` : ''}
            </tbody>
            <tfoot>
              <tr>
                <td><strong>STATUT DU COMPTE</strong></td>
                <td class="text-right total">
                  <strong style="color:${typeof isOverdue !== 'undefined' && isOverdue ? 'var(--accent-color,#c0392b)' : (remainingDebt > 0 ? 'var(--accent-color,#c0392b)' : '#27ae60')}">${typeof isOverdue !== 'undefined' && isOverdue ? `Impayé à partir du mois de ${overdueMonthName} ${unpaidFromYear}` : (remainingDebt > 0 ? 'Dette restante' : 'À jour')}</strong>
                </td>
              </tr>
            </tfoot>
          </table>

          <div class="payment-info">
            <p><strong>💳 Mode de paiement :</strong> ${this._escape(cfg.paymentMethod)}</p>
            <p>📅 Paiement effectué le ${fmtDate(cfg.paymentDate)}</p>
            ${cfg.entryDate && cfg.entryDate > cfg.paymentDate ? `<p>🏠 Entrée effective le ${fmtDate(cfg.entryDate)}</p>` : ''}
          </div>

          ${cfg.observations ? `
            <div class="observations">
              <strong>Observations :</strong>
              <p>${this._escape(cfg.observations)}</p>
            </div>
          ` : ''}
        </div>

        <div class="stamp-signature-row" style="display:flex;justify-content:space-between;align-items:center;margin:12px 0;padding:8px 12px;background:#f8fafc;border-radius:8px;border:1px dashed #cbd5e1;">
          <div style="font-size:11px;color:#64748b;line-height:1.4;max-width:55%;">
            <b>Quittance libératoire délivrée sous réserve d'encaissement.</b><br>
            Fait foi du règlement effectif pour la période indiquée. Document certifié par le système de gestion SMG IMMOBILIER.
          </div>
          <div style="border:2px solid #1a3a5c;border-radius:6px;padding:6px 14px;text-align:center;background:#ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.06);min-width:180px;">
            <div style="font-size:10px;font-weight:800;color:#1a3a5c;text-transform:uppercase;letter-spacing:0.5px;">★ SMG IMMOBILIER ★</div>
            <div style="font-size:9.5px;color:#1e293b;font-weight:700;">Direction de la Gestion</div>
            <div style="font-size:10px;color:#16a34a;font-weight:800;margin:2px 0;">✓ PAYÉ & CERTIFIÉ</div>
            <div style="font-size:8.5px;color:#64748b;font-style:italic;">Signé électroniquement · ${fmtDate(cfg.paymentDate)}</div>
          </div>
        </div>

        <div class="currency-note">
          Les montants sont exprimés en Francs CFA (${currency}). Document délivré à titre de quittance libératoire de loyer pour la période susmentionnée.
        </div>

        <div class="invoice-footer">
          <div class="footer-text">
            <strong>${this._escape(cfg.companyName)}</strong> — Gestion Immobilière & Promotion Foncinière<br>
            Direction administrative : ${this._escape(cfg.companyAddress)} | Contact : ${this._escape(cfg.companyPhone)}
          </div>
        </div>

        <div class="legal">
          Document généré informatiquement par SMG IMMOBILIER · Le présent reçu fait foi du règlement effectif du montant indiqué sous réserve d'encaissement.
        </div>

      </div>
    `;
  }

  _escape(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

const ReceiptManager = {
  storage: new ReceiptStorageManager(),
  generator: new ReceiptHtmlGenerator(),
  _currentConfig: null,
  _companySettings: null,

  async initData() {
    // Charger les paramètres officiels de l'entreprise s'ils ne sont pas encore en mémoire
    if (!this._companySettings) {
      try {
        const csRes = await API.get('/company-settings');
        if (csRes && csRes.data) {
          const cs = csRes.data;
          this._companySettings = cs;
          if (cs.name) this.generator.defaults.companyName = cs.name;
          if (cs.address) this.generator.defaults.companyAddress = cs.address;
          if (cs.phone) this.generator.defaults.companyPhone = cs.phone;
          if (cs.email) this.generator.defaults.companyEmail = cs.email;
          if (cs.primary_color) this.generator.defaults.primaryColor = cs.primary_color;
          if (cs.secondary_color) this.generator.defaults.secondaryColor = cs.secondary_color;
          if (cs.accent_color) this.generator.defaults.accentColor = cs.accent_color;
          if (cs.logo_url) {
            this.generator.defaults.logo = cs.logo_url.startsWith('http') ? cs.logo_url : `http://localhost:5000${cs.logo_url}`;
          } else {
            this.generator.defaults.logo = '../assets/images/logo.png';
          }
        }
      } catch (_) {}
    }
  },

  /**
   * Ouvre directement la vue officielle du reçu (format A5 paysage) avec bouton d'impression
   * et de téléchargement PDF, sans afficher de formulaire de saisie superflu.
   * @param {Object|number} options - Données du paiement
   */
  async open(options = {}) {
    await this.initData();

    let p = options;
    if (typeof options === 'number' || typeof options === 'string') {
      try {
        const res = await API.get(`/payments/${options}`);
        p = res.data || {};
      } catch (_) {}
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const defaults = this.generator.defaults;

    // Récupération des données du paiement existant en base
    const tenantUser = p.tenant?.user || p.tenant || {};
    const apt = p.apartment || {};
    const prop = apt.property || {};

    const clientName = tenantUser.full_name || p.tenant_name || p.clientName || 'Locataire';
    const clientPhone = tenantUser.phone || p.tenant_phone || p.clientPhone || '';
    const clientEmail = tenantUser.email || p.tenant_email || p.clientEmail || '';
    const clientAddress = prop.city ? `${prop.city}, Cameroun` : 'Cameroun';

    let propertyAddress = 'Logement SMG';
    if (prop.property_name || apt.apartment_number) {
      propertyAddress = `${prop.property_name || 'Immeuble'} — Logement ${apt.apartment_number || '—'}`;
      if (prop.city) propertyAddress += ` (${prop.city})`;
    } else if (p.property_address) {
      propertyAddress = p.property_address;
    }

    const paidAmount = Number(p.amount != null ? p.amount : (p.paid_amount || 0));
    const rentAmount = Number(apt.rent_amount != null ? apt.rent_amount : (p.rent_amount || paidAmount));
    const paymentDate = p.payment_date || todayStr;
    const entryDate = p.entry_date || p.payment_date || todayStr;

    // Méthode de paiement lisible
    let paymentMethod = p.payment_method || 'Espèces';
    if (typeof Helpers !== 'undefined' && Helpers.methodLabel) {
      paymentMethod = Helpers.methodLabel(p.payment_method) || paymentMethod;
    }

    const invoiceNumber = p.receipt_number || `R-LOYER-${new Date().getFullYear()}-${String(p.id || Math.floor(Math.random() * 90000) + 10000).padStart(5, '0')}`;

    const isReceipt = Boolean(p.receipt_type || (p.receipt_number && p.amount != null && !p.user_id));
    const receiptId = p.receipt_id || (isReceipt ? p.id : null);
    const paymentId = p.payment_id || (!isReceipt ? p.id : null);

    this._currentConfig = {
      ...defaults,
      receiptId,
      paymentId,
      invoiceNumber,
      paymentDate,
      entryDate,
      clientName,
      clientPhone,
      clientEmail,
      clientAddress,
      propertyAddress,
      rentAmount,
      debtAmount: Number(p.debt_amount || 0),
      paidAmount,
      paymentMethod,
      periodStart: p.period_start || null,
      periodEnd: p.period_end || null,
      observations: p.observations || '',
      currency: 'FCFA',
    };

    // Rendu HTML du reçu
    const receiptHtml = this.generator.generate(this._currentConfig);

    // Modal épurée : vue directe du reçu avec boutons d'impression et d'exportation
    const html = `
      <div class="receipt-viewer-modal" style="display:flex;flex-direction:column;width:100%;max-width:1020px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.2);">
        
        <!-- EN-TÊTE DIRECT AVEC BOUTON IMPRESSION ET PDF -->
        <div class="receipt-modal-header" style="background:linear-gradient(135deg, #0f172a, #1e293b);color:#ffffff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:1px solid rgba(255,255,255,0.1);">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:22px;">🧾</span>
            <div>
              <h2 style="font-size:16px;font-weight:700;color:#ffffff;margin:0;">Reçu Officiel de Loyer — SMG IMMOBILIER</h2>
              <small style="color:#94a3b8;font-size:12px;">N° ${this.generator._escape(this._currentConfig.invoiceNumber)} · Format Officiel A5 Paysage (21 × 14,85 cm)</small>
            </div>
          </div>
          
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn btn-primary" onclick="ReceiptManager.print()" style="font-weight:700;background:#0284c7;border-color:#0284c7;display:inline-flex;align-items:center;gap:6px;">
              🖨️ Imprimer le reçu
            </button>
            <button class="btn btn-outline" onclick="ReceiptManager.exportPdf()" style="font-weight:600;color:#f8fafc;border-color:#475569;display:inline-flex;align-items:center;gap:6px;">
              📥 Télécharger PDF
            </button>
            <button class="btn btn-danger" onclick="Modal.close()" style="font-weight:600;">
              ✕ Fermer
            </button>
          </div>
        </div>

        <!-- ZONE CENTRÉE D'AFFICHAGE DU REÇU OFFICIEL -->
        <div style="background:#f1f5f9;padding:24px 16px;display:flex;justify-content:center;align-items:center;overflow-x:auto;">
          <div id="rmInvoiceRenderContainer" style="display:flex;justify-content:center;width:100%;">
            ${receiptHtml}
          </div>
        </div>

        <!-- PIED DE MODAL -->
        <div style="padding:10px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#64748b;">
          <span>💡 Cliquez sur <b>Imprimer le reçu</b> pour imprimer ou enregistrer en version papier.</span>
          <span>SMG IMMOBILIER · Gestion Locative</span>
        </div>

      </div>
    `;

    Modal.open({
      title: null,
      content: html,
      size: 'large',
    });
  },

  /**
   * Imprime immédiatement le reçu officiel (même document que le bouton 📄 PDF)
   */
  async print() {
    const cfg = this._currentConfig || {};
    Toast.info('Préparation de l’impression du reçu officiel...');

    // 1. Tenter d'imprimer directement le PDF officiel backend (même lien que le bouton 📄 PDF)
    try {
      let endpoint = null;
      if (cfg.receiptId) {
        endpoint = `/receipts/${cfg.receiptId}/pdf`;
      } else if (cfg.paymentId) {
        endpoint = `/payments/${cfg.paymentId}/receipt-pdf`;
      }

      if (endpoint) {
        const blob = await API.downloadBlob(endpoint).catch(() => null);
        if (blob && blob.size > 100) {
          const blobUrl = window.URL.createObjectURL(blob);

          let printFrame = document.getElementById('smg_pdf_print_frame');
          if (printFrame) printFrame.remove();

          printFrame = document.createElement('iframe');
          printFrame.id = 'smg_pdf_print_frame';
          printFrame.style.position = 'fixed';
          printFrame.style.right = '0';
          printFrame.style.bottom = '0';
          printFrame.style.width = '0';
          printFrame.style.height = '0';
          printFrame.style.border = '0';
          printFrame.src = blobUrl;
          document.body.appendChild(printFrame);

          printFrame.onload = () => {
            setTimeout(() => {
              try {
                printFrame.contentWindow.focus();
                printFrame.contentWindow.print();
              } catch (_) {
                window.open(blobUrl, '_blank');
              }
            }, 300);
          };
          return;
        }
      }
    } catch (e) {
      console.warn('Erreur impression PDF blob backend, bascule sur impression DOM:', e);
    }

    // 2. Fallback impression DOM isolée
    this._printDomFallback();
  },

  _printDomFallback() {
    const el = document.getElementById('printableInvoiceContainer');
    if (!el) {
      Toast.error('Contenu du reçu non trouvé');
      return;
    }

    try {
      let oldFrame = document.getElementById('smg_receipt_print_frame');
      if (oldFrame) oldFrame.remove();

      const printFrame = document.createElement('iframe');
      printFrame.id = 'smg_receipt_print_frame';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      printFrame.style.visibility = 'hidden';
      document.body.appendChild(printFrame);

      const frameDoc = printFrame.contentWindow.document;
      const clone = el.cloneNode(true);

      frameDoc.open();
      frameDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Reçu - ${this.generator._escape(this._currentConfig?.invoiceNumber || 'SMG')}</title>
          <link rel="stylesheet" href="../css/receipt-generator.css?v=3.5">
          <style>
            @page { size: 210mm 148.5mm landscape; margin: 0 !important; }
            html, body {
              margin: 0 !important; padding: 0 !important; background: #ffffff !important;
              width: 210mm !important; height: 148.5mm !important;
              -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
            }
            .invoice-container {
              width: 210mm !important; height: 148.5mm !important; box-shadow: none !important;
              border: none !important; margin: 0 !important; padding: 6mm 10mm !important; box-sizing: border-box !important;
            }
          </style>
        </head>
        <body>${clone.outerHTML}</body>
        </html>
      `);
      frameDoc.close();

      setTimeout(() => {
        try {
          printFrame.contentWindow.focus();
          printFrame.contentWindow.print();
        } catch (_) {
          window.print();
        }
      }, 300);
    } catch (e) {
      console.error('Erreur impression DOM:', e);
      window.print();
    }
  },

  /**
   * Exporte le reçu officiel en PDF (utilise exactement le même lien et moteur que le bouton 📄 PDF)
   */
  async exportPdf() {
    const cfg = this._currentConfig || {};
    const fileName = `Recu_${cfg.invoiceNumber || 'SMG'}_${new Date().toISOString().slice(0, 10)}.pdf`;

    Toast.info('Téléchargement du reçu officiel PDF...');

    // 1. Appel du même lien officiel backend que le bouton "📄 PDF"
    try {
      let endpoint = null;
      if (cfg.receiptId) {
        endpoint = `/receipts/${cfg.receiptId}/pdf`;
      } else if (cfg.paymentId) {
        endpoint = `/payments/${cfg.paymentId}/receipt-pdf`;
      }

      if (endpoint) {
        const blob = await API.downloadBlob(endpoint).catch((e) => {
          console.warn('Erreur downloadBlob backend:', e);
          return null;
        });

        if (blob && blob.size > 100) {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => window.URL.revokeObjectURL(url), 2500);
          Toast.success('Reçu PDF officiel téléchargé avec succès ✅');
          return;
        }
      }
    } catch (backendErr) {
      console.warn('Backend PDF non disponible, bascule sur générateur vectoriel:', backendErr);
    }

    // 2. Fallback : Générateur vectoriel jsPDF haute définition (ultra-rapide si offline)
    try {
      const jsPdfClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (jsPdfClass) {
        const doc = new jsPdfClass({ unit: 'mm', format: [210, 148.5], orientation: 'landscape' });

        // En-tête bleu SMG
        doc.setFillColor(26, 58, 92);
        doc.rect(0, 0, 210, 24, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(15);
        doc.setFont(undefined, 'bold');
        doc.text(cfg.companyName || 'SMG IMMOBILIERE', 12, 10);
        doc.setFontSize(8.5);
        doc.setFont(undefined, 'normal');
        doc.text(`${cfg.companyAddress || 'Yaoundé et Douala'} | Tél: ${cfg.companyPhone || '+237 6 699 03 07 71'}`, 12, 16);
        doc.text(cfg.companyEmail || 'smgimmobilier.infos@gmail.com', 12, 20);

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('REÇU DE LOYER', 198, 11, { align: 'right' });
        doc.setFontSize(8.5);
        doc.setFont(undefined, 'normal');
        doc.text(`N° ${cfg.invoiceNumber || ''} · Date : ${cfg.paymentDate || ''}`, 198, 17, { align: 'right' });

        // Bandeau statut
        doc.setFillColor(220, 252, 231);
        doc.rect(12, 28, 186, 8, 'F');
        doc.setTextColor(22, 101, 52);
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text(`✅ Reçu libératoire de loyer — Règlement validé (${cfg.paymentMethod || 'Espèces'})`, 16, 33.5);

        // Blocs locataire et bien loué
        doc.setFillColor(241, 245, 249);
        doc.rect(12, 39, 90, 32, 'F');
        doc.rect(108, 39, 90, 32, 'F');

        doc.setTextColor(26, 58, 92);
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text('📍 LOCATAIRE', 16, 45);
        doc.text('🏠 BIEN LOUÉ & LOGEMENT', 112, 45);

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(9.5);
        doc.text(cfg.clientName || 'Locataire', 16, 52);
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(cfg.clientAddress || 'Cameroun', 16, 57);
        doc.text(`Tél: ${cfg.clientPhone || '—'}`, 16, 62);
        if (cfg.clientEmail) doc.text(cfg.clientEmail, 16, 67);

        doc.setFont(undefined, 'bold');
        doc.setFontSize(9);
        doc.text(cfg.propertyAddress || 'Logement', 112, 52);
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(`Loyer mensuel : ${Math.round(cfg.rentAmount || 0).toLocaleString('fr-FR')} FCFA`, 112, 58);
        doc.text(`Date de paiement : ${cfg.paymentDate || '—'}`, 112, 64);

        // Tableau règlement
        doc.setFillColor(26, 58, 92);
        doc.rect(12, 75, 186, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8.5);
        doc.setFont(undefined, 'bold');
        doc.text('DÉSIGNATION', 16, 80);
        doc.text('MONTANT (FCFA)', 194, 80, { align: 'right' });

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(`Règlement de loyer (${cfg.paymentMethod || 'Paiement'})`, 16, 89);
        doc.setFont(undefined, 'bold');
        doc.text(`${Math.round(cfg.paidAmount || 0).toLocaleString('fr-FR')} FCFA`, 194, 89, { align: 'right' });

        let currentY = 94;
        if (cfg.debtAmount && cfg.debtAmount > 0) {
          currentY += 8;
          doc.setFont(undefined, 'normal');
          doc.text('Arriérés antérieurs', 16, currentY);
          doc.text(`${Math.round(cfg.debtAmount).toLocaleString('fr-FR')} FCFA`, 194, currentY, { align: 'right' });
        }

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.line(12, currentY + 5, 198, currentY + 5);

        // Total
        doc.setFillColor(248, 250, 252);
        doc.rect(12, currentY + 7, 186, 9, 'F');
        doc.setFontSize(9.5);
        doc.setFont(undefined, 'bold');
        doc.text('TOTAL ENCAISSÉ', 16, currentY + 13);
        doc.setTextColor(22, 163, 74);
        doc.text(`${Math.round(cfg.paidAmount || 0).toLocaleString('fr-FR')} FCFA`, 194, currentY + 13, { align: 'right' });

        // Pied de page
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(7.5);
        doc.setFont(undefined, 'normal');
        doc.text('Document officiel généré par SMG IMMOBILIER · Fait foi de quittance libératoire sous réserve d\'encaissement.', 12, 134);
        doc.text(`Édité le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 198, 134, { align: 'right' });

        doc.save(fileName);
        Toast.success('PDF officiel téléchargé avec succès ✅');
        return;
      }
    } catch (vectorErr) {
      console.warn('Erreur jsPDF vectoriel:', vectorErr);
    }

    Toast.error('Impossible de générer le PDF officiel.');
  },
};

window.ReceiptManager = ReceiptManager;

