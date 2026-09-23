const { logger } = require('../config/logger');

class CampayService {
  constructor() {
    this._token = null;
    this._tokenExpiry = 0;
  }

  _config() {
    const { CAMPAY_BASE_URL, CAMPAY_API_TOKEN, CAMPAY_APP_USERNAME, CAMPAY_APP_PASSWORD, CAMPAY_WEBHOOK_KEY } = process.env;
    const baseUrl = CAMPAY_BASE_URL || 'https://demo.campay.net';

    if (CAMPAY_API_TOKEN) {
      return { baseUrl, apiToken: CAMPAY_API_TOKEN, webhookKey: CAMPAY_WEBHOOK_KEY };
    }

    if (!CAMPAY_APP_USERNAME || !CAMPAY_APP_PASSWORD) {
      throw Object.assign(new Error('CamPay non configuré. Veuillez renseigner les clés dans .env'), { status: 503 });
    }

    return { baseUrl, username: CAMPAY_APP_USERNAME, password: CAMPAY_APP_PASSWORD, webhookKey: CAMPAY_WEBHOOK_KEY };
  }

  async getToken() {
    const cfg = this._config();
    if (cfg.apiToken) return cfg.apiToken;
    if (this._token && Date.now() < this._tokenExpiry) return this._token;

    const res = await fetch(`${cfg.baseUrl}/api/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cfg.username, password: cfg.password }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.token) throw Object.assign(new Error('Authentification CamPay échouée'), { status: 502 });

    this._token = json.token;
    this._tokenExpiry = Date.now() + 55 * 60 * 1000;
    return this._token;
  }

  /**
   * Initie une collecte Mobile Money (MTN / Orange Money) via l'API CamPay.
   */
  async initiateCollection({ amount, phone, externalReference, description }) {
    const cfg = this._config();
    const token = await this.getToken();

    // Formater le numéro au format international Cameroun (237xxxxxxxxx)
    let cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length === 9) cleanPhone = '237' + cleanPhone;

    const res = await fetch(`${cfg.baseUrl}/api/collect/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`
      },
      body: JSON.stringify({
        amount: String(amount),
        currency: 'XAF',
        from: cleanPhone,
        description: description || 'Paiement Loyer SMG Immobilier',
        external_reference: String(externalReference || ''),
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      logger.error('Échec initiation CamPay', { status: res.status, error: json });
      throw Object.assign(new Error(json.message || json.detail || 'Échec de la demande de paiement CamPay'), { status: res.status || 502 });
    }

    return {
      reference: json.reference,
      ussd_code: json.ussd_code,
      operator: json.operator,
    };
  }

  /**
   * Récupère le solde réel de l'agrégateur CamPay.
   */
  async getBalance() {
    const cfg = this._config();
    const token = await this.getToken();
    const res = await fetch(`${cfg.baseUrl}/api/balance/`, {
      headers: { Authorization: `Token ${token}` },
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(json.message || 'Échec de consultation du solde CamPay'), { status: res.status || 502 });
    return json;
  }

  /**
   * Effectue un retrait / transfert d'argent (Disbursement) vers un numéro Mobile Money via l'API CamPay.
   */
  async withdraw({ amount, phone, description, externalReference }) {
    const cfg = this._config();
    const token = await this.getToken();

    let cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length === 9) cleanPhone = '237' + cleanPhone;

    const res = await fetch(`${cfg.baseUrl}/api/withdraw/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`
      },
      body: JSON.stringify({
        amount: String(amount),
        currency: 'XAF',
        to: cleanPhone,
        description: description || 'Retrait de fonds SMG Immobilier',
        external_reference: String(externalReference || ''),
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      logger.warn('Avertissement/Échec Retrait CamPay', { status: res.status, error: json });
      return {
        success: false,
        status: res.status,
        message: json.message || json.detail || 'Opération de retrait soumise',
        raw: json,
      };
    }

    return {
      success: true,
      reference: json.reference,
      status: json.status || 'PENDING',
      raw: json,
    };
  }

  /**
   * Vérifie le statut d'une transaction CamPay par sa référence.
   */
  async checkStatus(reference) {
    const cfg = this._config();
    const token = await this.getToken();
    const res = await fetch(`${cfg.baseUrl}/api/transaction/${reference}/`, {
      headers: { Authorization: `Token ${token}` },
    });

    if (!res.ok) throw Object.assign(new Error('Échec de vérification du statut CamPay'), { status: 502 });
    return res.json();
  }

  /**
   * Analyse et valide le payload du Webhook de confirmation CamPay.
   */
  parseWebhook(payload) {
    if (!payload || typeof payload !== 'object') return {};

    const reference = payload.reference || payload.id;
    const rawStatus = (payload.status || '').toUpperCase();
    const amount = parseFloat(payload.amount || 0);
    const externalReference = payload.external_reference || '';

    let status = 'pending';
    if (['SUCCESSFUL', 'SUCCESS', 'COMPLETED'].includes(rawStatus)) {
      status = 'completed';
    } else if (['FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED'].includes(rawStatus)) {
      status = 'failed';
    }

    return {
      reference,
      status,
      rawStatus,
      amount,
      externalReference,
      operator: payload.operator,
      operatorReference: payload.operator_reference,
    };
  }
}

module.exports = new CampayService();
