// Service CamPay (Mobile Money) - structure prête, activable via les variables
// CAMPAY_APP_USERNAME / CAMPAY_APP_PASSWORD dans .env
class CampayService {
  constructor() {
    this._token = null;
    this._tokenExpiry = 0;
  }

  _config() {
    const { CAMPAY_BASE_URL, CAMPAY_APP_USERNAME, CAMPAY_APP_PASSWORD } = process.env;
    if (!CAMPAY_APP_USERNAME || !CAMPAY_APP_PASSWORD) {
      throw Object.assign(new Error('CamPay non configuré'), { status: 503 });
    }
    return { baseUrl: CAMPAY_BASE_URL || 'https://demo.campay.net', username: CAMPAY_APP_USERNAME, password: CAMPAY_APP_PASSWORD };
  }

  async getToken() {
    const { baseUrl, username, password } = this._config();
    if (this._token && Date.now() < this._tokenExpiry) return this._token;
    const res = await fetch(`${baseUrl}/api/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.token) throw Object.assign(new Error('Authentification CamPay échouée'), { status: 502 });
    this._token = json.token;
    this._tokenExpiry = Date.now() + 55 * 60 * 1000;
    return this._token;
  }

  async initiateCollection({ amount, phone, externalReference, description }) {
    const { baseUrl } = this._config();
    const token = await this.getToken();
    const res = await fetch(`${baseUrl}/api/collect/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
      body: JSON.stringify({
        amount: String(amount), currency: 'XAF', from: phone,
        description: description || 'Paiement loyer SMG Immobilier',
        external_reference: externalReference,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(json.message || 'Échec de la demande de paiement CamPay'), { status: 502 });
    return { reference: json.reference, ussd_code: json.ussd_code };
  }

  async checkStatus(reference) {
    const { baseUrl } = this._config();
    const token = await this.getToken();
    const res = await fetch(`${baseUrl}/api/transaction/${reference}/`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!res.ok) throw Object.assign(new Error('Échec de vérification du statut CamPay'), { status: 502 });
    return res.json();
  }
}
module.exports = new CampayService();
