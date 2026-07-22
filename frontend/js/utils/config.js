// Configuration globale frontend SMG IMMOBILIER
const RENDER_SERVER_URL = 'https://smg-a5e3.onrender.com';

const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location) {
    // 1. URL personnalisée (variable globale ou localStorage, ignorée si localhost sur Vercel)
    const customApi = window.ENV_SERVER_URL || localStorage.getItem('smg_custom_api_url');
    if (customApi && (!window.location.hostname.includes('vercel.app') || !customApi.includes('localhost'))) {
      return customApi.replace(/\/$/, '');
    }

    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    // 2. Déploiement Vercel → pointer vers Render
    if (hostname.includes('vercel.app')) {
      return RENDER_SERVER_URL;
    }

    // 3. Autre domaine personnalisé (VPS, réseau local)
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}:5000`;
    }
  }
  // 4. Développement local
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
