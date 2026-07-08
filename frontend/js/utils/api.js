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
      const res = await fetch(`${CONFIG.API_URL}${endpoint}`, { ...options, headers, body });
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
      if (!res.ok) throw new Error(data.message || 'Erreur serveur');
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Impossible de joindre le serveur. Vérifiez que le backend est démarré.');
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
};
