// ============ Gestion authentification & session ============
const Auth = {
  setSession(token, user, refreshToken) {
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
    if (refreshToken) localStorage.setItem(CONFIG.REFRESH_KEY, refreshToken);
  },
  getUser() {
    try { return JSON.parse(localStorage.getItem(CONFIG.USER_KEY)); }
    catch { return null; }
  },
  getRole() {
    const u = this.getUser();
    return u && u.role ? u.role.name : null;
  },
  isLoggedIn() { return !!localStorage.getItem(CONFIG.TOKEN_KEY); },

  logout() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
    localStorage.removeItem(CONFIG.REFRESH_KEY);
    window.location.href = '../index.html';
  },

  // Redirige vers login si non connecté
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = '../pages/login.html';
      return false;
    }
    return true;
  },

  // Vérifie qu'un rôle est autorisé
  hasRole(...roles) {
    const r = this.getRole();
    return r === 'super_admin' || roles.includes(r);
  },
};
