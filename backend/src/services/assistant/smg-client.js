// Client HTTP minimal vers l'API SMG, porté par le JWT de l'utilisateur connecté.
// => le RBAC existant s'applique automatiquement (l'assistant n'a aucun privilège propre).
const BASE = process.env.SMG_API_URL || 'http://localhost:5000/api';

async function call(method, path, token, { query, body } = {}) {
  const url = new URL(BASE.replace(/\/$/, '') + path);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }
  const headers = { Authorization: `Bearer ${token}` };
  let payload;
  if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  const res = await fetch(url, { method, headers, body: payload });
  let json = null;
  try { json = await res.json(); } catch { /* réponse sans corps */ }

  if (!res.ok) {
    const message = (json && json.message) || `Erreur API (${res.status})`;
    throw Object.assign(new Error(message), { status: res.status });
  }
  // Enveloppe standard SMG : { success, message, data }
  return json && 'data' in json ? json.data : json;
}

module.exports = {
  get: (path, token, query) => call('GET', path, token, { query }),
  post: (path, token, body) => call('POST', path, token, { body }),
  put: (path, token, body) => call('PUT', path, token, { body }),
};
