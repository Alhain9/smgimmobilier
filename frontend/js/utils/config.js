// Configuration globale frontend SMG IMMOBILIER
const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location) {
    const customApi = window.ENV_SERVER_URL || localStorage.getItem('smg_custom_api_url');
    if (customApi) return customApi.replace(/\/$/, '');

    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      if (hostname.includes('vercel.app')) {
        return window.ENV_SERVER_URL || localStorage.getItem('smg_custom_api_url') || 'http://localhost:5000';
      }
      return `${protocol}//${hostname}:5000`;
    }
  }
  return 'http://localhost:5000';
};

const BASE_URL = getBaseUrl();

const CONFIG = {
  API_URL: `${BASE_URL}/api`,
  SERVER_URL: BASE_URL,
  TOKEN_KEY: 'smg_token',
  REFRESH_KEY: 'smg_refresh',
  USER_KEY: 'smg_user',
  THEME_KEY: 'smg_theme',
};

// Libellés des rôles
const ROLE_LABELS = {
  super_admin: 'Super Administrateur',
  manager: 'Manager',
  dir_admin: 'Directeur Administratif',
  dir_technique: 'Directeur Technique',
  gestionnaire: 'Gestionnaire',
  comptable: 'Comptable',
  technicien: 'Technicien',
  locataire: 'Locataire',
};
