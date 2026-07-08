const crypto = require('crypto');

// =====================================================================
// Intégration Kang Open Banking (Mobile Money - Cameroun)
// API compatible "clé secrète" (Bearer). Le CONTRAT exact (chemins +
// noms de champs) est regroupé ci-dessous : À CONFIRMER avec la doc Kang
// (les valeurs par défaut suivent le schéma le plus courant).
// =====================================================================
const CONTRACT = {
  baseUrl: () => (process.env.KANG_BASE_URL || 'https://api.kangopenbanking.com').replace(/\/$/, ''),
  initiatePath: '/v1/collections',            // POST : initier un encaissement Mobile Money
  statusPath: (ref) => `/v1/collections/${ref}`, // GET : statut d'une transaction
  // Champs de la RÉPONSE d'initiation où lire la référence et le code USSD :
  refFields: ['reference', 'id', 'transaction_id', 'transactionId'],
  ussdFields: ['ussd_code', 'ussd', 'payment_code'],
  // Champs du WEBHOOK :
  webhookRefFields: ['reference', 'external_reference', 'id', 'transaction_id'],
  webhookStatusField: 'status',
  statusSuccess: ['SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'PAID', 'success', 'completed'],
  statusFailed: ['FAILED', 'CANCELLED', 'CANCELED', 'EXPIRED', 'failed', 'cancelled'],
};

const pick = (obj, fields) => { for (const f of fields) { if (obj && obj[f] != null) return obj[f]; } return null; };

class KangService {
  _key() {
    const key = process.env.KANG_SECRET_KEY;
    if (!key) throw Object.assign(new Error('Kang Open Banking non configuré (clé KANG_SECRET_KEY manquante).'), { status: 503 });
    return key;
  }
  _headers() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${this._key()}` };
  }

  // Lance une demande de paiement Mobile Money. Renvoie { reference, ussd_code }.
  async initiateCollection({ amount, phone, externalReference, description }) {
    const body = {
      merchant_id: process.env.KANG_MERCHANT_ID,
      amount: Number(amount),
      currency: 'XAF',
      phone_number: phone,
      external_reference: externalReference,
      description: description || 'Paiement loyer SMG Immobilier',
    };
    let res;
    try {
      res = await fetch(CONTRACT.baseUrl() + CONTRACT.initiatePath, {
        method: 'POST', headers: this._headers(), body: JSON.stringify(body),
      });
    } catch (e) {
      // Réseau/hôte injoignable (ex. "fetch failed") → message clair, on ne casse rien
      throw Object.assign(new Error('Service Mobile Money (Kang) momentanément injoignable. Réessayez plus tard ou payez en espèces.'), { status: 503 });
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw Object.assign(new Error(json.message || json.error || `Échec de la demande de paiement Kang (${res.status})`), { status: 502 });
    }
    const data = json.data || json;
    return { reference: pick(data, CONTRACT.refFields), ussd_code: pick(data, CONTRACT.ussdFields), raw: json };
  }

  // Vérifie le statut d'une transaction
  async checkStatus(reference) {
    let res;
    try {
      res = await fetch(CONTRACT.baseUrl() + CONTRACT.statusPath(reference), { headers: this._headers() });
    } catch (e) {
      throw Object.assign(new Error('Service Mobile Money (Kang) injoignable.'), { status: 503 });
    }
    if (!res.ok) throw Object.assign(new Error('Échec de vérification du statut Kang'), { status: 502 });
    return res.json();
  }

  // Extrait { reference, status } d'un payload de webhook
  parseWebhook(payload) {
    const data = (payload && (payload.data || payload)) || {};
    const reference = pick(data, CONTRACT.webhookRefFields) || pick(payload, CONTRACT.webhookRefFields);
    const raw = String(data[CONTRACT.webhookStatusField] || payload[CONTRACT.webhookStatusField] || '');
    let status = 'pending';
    if (CONTRACT.statusSuccess.includes(raw)) status = 'completed';
    else if (CONTRACT.statusFailed.includes(raw)) status = 'failed';
    return { reference, status, raw };
  }

  // Vérifie la signature HMAC-SHA256 du corps brut (À CONFIRMER : nom de l'entête).
  // Tolérant si non configuré (à durcir en production avec le corps brut).
  verifyWebhook(rawBody, signature) {
    const secret = process.env.KANG_WEBHOOK_SECRET;
    if (!secret || !signature || !rawBody) return true;
    try {
      const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
    } catch (_) { return false; }
  }
}
module.exports = new KangService();
