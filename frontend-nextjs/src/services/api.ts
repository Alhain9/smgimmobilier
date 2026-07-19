export const CONFIG = {
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:5000',
  TOKEN_KEY: 'smg_token',
  REFRESH_KEY: 'smg_refresh',
  USER_KEY: 'smg_user',
  THEME_KEY: 'smg_theme',
};

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Administrateur',
  manager: 'Manager',
  dir_admin: 'Directeur Administratif',
  dir_technique: 'Directeur Technique',
  gestionnaire: 'Gestionnaire',
  comptable: 'Comptable',
  technicien: 'Technicien',
  locataire: 'Locataire',
};

let refreshingPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const rt = localStorage.getItem(CONFIG.REFRESH_KEY);
  if (!rt) return false;
  try {
    const res = await fetch(`${CONFIG.API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.data?.token) {
      localStorage.setItem(CONFIG.TOKEN_KEY, data.data.token);
      return true;
    }
  } catch (_) {
    // Ignorer
  }
  return false;
}

export const API = {
  token(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(CONFIG.TOKEN_KEY);
  },

  async request(endpoint: string, options: RequestInit = {}, _retried = false): Promise<any> {
    const headers = new Headers(options.headers);
    const isFormData = options.body instanceof FormData;

    if (!isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const token = this.token();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    let body = options.body;
    if (body && !isFormData && typeof body !== 'string') {
      body = JSON.stringify(body);
    }

    try {
      const res = await fetch(`${CONFIG.API_URL}${endpoint}`, {
        ...options,
        headers,
        body,
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401 && !endpoint.includes('/auth/')) {
        if (!_retried) {
          if (!refreshingPromise) {
            refreshingPromise = doRefresh();
          }
          const ok = await refreshingPromise;
          refreshingPromise = null;
          if (ok) {
            return this.request(endpoint, options, true);
          }
        }
        if (typeof window !== 'undefined') {
          localStorage.removeItem(CONFIG.TOKEN_KEY);
          localStorage.removeItem(CONFIG.REFRESH_KEY);
          localStorage.removeItem(CONFIG.USER_KEY);
          window.dispatchEvent(new Event('auth_logout'));
        }
        throw new Error('Session expirée');
      }

      if (!res.ok) {
        throw new Error(data.message || 'Erreur serveur');
      }

      return data;
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Impossible de joindre le serveur. Vérifiez que le backend est démarré.');
      }
      throw err;
    }
  },

  get(endpoint: string) {
    return this.request(endpoint);
  },

  post(endpoint: string, body?: any) {
    return this.request(endpoint, { method: 'POST', body });
  },

  put(endpoint: string, body?: any) {
    return this.request(endpoint, { method: 'PUT', body });
  },

  patch(endpoint: string, body?: any) {
    return this.request(endpoint, { method: 'PATCH', body });
  },

  delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  },

  upload(endpoint: string, formData: FormData, method = 'POST') {
    return this.request(endpoint, { method, body: formData });
  },
};
