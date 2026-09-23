// ============ Client API (Fetch + JWT + auto-refresh) ============
const API = {
  token() { return localStorage.getItem(CONFIG.TOKEN_KEY); },
  refreshToken() { return localStorage.getItem(CONFIG.REFRESH_KEY); },
  _refreshing: null,

  async _doRefresh() {
    const rt = this.refreshToken();
    if (!rt) return false;
    try {
      const res = await fetch(`${CONFIG.API_URL}/auth/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.data && data.data.token) {
        localStorage.setItem(CONFIG.TOKEN_KEY, data.data.token);
        if (data.data.refreshToken) {
          localStorage.setItem(CONFIG.REFRESH_KEY, data.data.refreshToken);
        }
        return true;
      }
    } catch (_) { /* ignore */ }
    return false;
  },

  async request(endpoint, options = {}, _retried = false) {
    const headers = { ...options.headers };
    const isFormData = options.body instanceof FormData;
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const token = this.token();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let body = options.body;
    if (body && !isFormData && typeof body !== 'string') body = JSON.stringify(body);

    try {
      const fetchOpts = {
        method: options.method || 'GET',
        mode: 'cors',
        headers,
      };
      if (body && options.method !== 'GET' && options.method !== 'HEAD') {
        fetchOpts.body = body;
      }
      const res = await fetch(`${CONFIG.API_URL}${endpoint}`, fetchOpts);
      const data = await res.json().catch(() => ({}));

      if (res.status === 401 && !endpoint.includes('/auth/')) {
        // Tente un refresh une seule fois
        if (!_retried) {
          if (!this._refreshing) this._refreshing = this._doRefresh();
          const ok = await this._refreshing;
          this._refreshing = null;
          if (ok) return this.request(endpoint, options, true);
        }
        Auth.logout();
        return Promise.reject(new Error('Session expirée'));
      }
      if (!res.ok) {
        let msg = data.message || 'Erreur serveur';
        if (Array.isArray(data.errors) && data.errors.length) {
          const details = data.errors.map((e) => e.message || (e.field ? `${e.field} invalide` : '')).filter(Boolean).join(', ');
          if (details && !msg.includes(details)) msg += ` (${details})`;
        }
        throw new Error(msg);
      }
      return data;
    } catch (err) {
      console.error(`[API Error] Request to ${CONFIG.API_URL}${endpoint} failed:`, err);
      if (err.message === 'Failed to fetch') {
        throw new Error(`Impossible de joindre le serveur (${CONFIG.API_URL}). Vérifiez que le backend est démarré.`);
      }
      throw err;
    }
  },

  get(e) { return this.request(e); },
  post(e, body) { return this.request(e, { method: 'POST', body }); },
  put(e, body) { return this.request(e, { method: 'PUT', body }); },
  patch(e, body) { return this.request(e, { method: 'PATCH', body }); },
  delete(e) { return this.request(e, { method: 'DELETE' }); },
  upload(e, formData, method = 'POST') { return this.request(e, { method, body: formData }); },
  async downloadBlob(endpoint) {
    const headers = {};
    const token = this.token();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${CONFIG.API_URL}${endpoint}`, { headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Erreur lors du téléchargement');
    }
    return res.blob();
  },
};
