// URL de base du backend Render (utilisé en production sur Vercel si NEXT_PUBLIC_API_URL n'est pas défini)
const RENDER_API_URL = 'https://smg-a5e3.onrender.com/api';
const RENDER_SERVER_URL = 'https://smg-a5e3.onrender.com';

const getBaseApiUrl = (): string => {
  // 1. Variable d'environnement Vercel (prioritaire)
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined' && window.location) {
    // 2. URL personnalisée stockée dans localStorage
    const custom = localStorage.getItem('smg_custom_api_url');
    if (custom) return custom.endsWith('/api') ? custom : `${custom.replace(/\/$/, '')}/api`;
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    // 3. Déploiement Vercel → pointer vers Render
    if (hostname.includes('vercel.app')) {
      return RENDER_API_URL;
    }
    // 4. Autre domaine personnalisé (ex: VPS, réseau local)
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}:5000/api`;
    }
  }
  // 5. Développement local
  return 'http://localhost:5000/api';
};

const getBaseServerUrl = (): string => {
  // 1. Variable d'environnement Vercel (prioritaire)
  if (process.env.NEXT_PUBLIC_SERVER_URL) return process.env.NEXT_PUBLIC_SERVER_URL;
  if (typeof window !== 'undefined' && window.location) {
    // 2. URL personnalisée stockée dans localStorage
    const custom = localStorage.getItem('smg_custom_api_url');
    if (custom) return custom.replace(/\/api$/, '').replace(/\/$/, '');
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    // 3. Déploiement Vercel → pointer vers Render
    if (hostname.includes('vercel.app')) {
      return RENDER_SERVER_URL;
    }
    // 4. Autre domaine personnalisé
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}:5000`;
    }
  }
  // 5. Développement local
  return 'http://localhost:5000';
};

export const CONFIG = {
  get API_URL() { return getBaseApiUrl(); },
  get SERVER_URL() { return getBaseServerUrl(); },
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
