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
    if (!u || !u.role) return null;
    return u.role.name || u.role.role_name || null;
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

  // Vérifie qu'un rôle est autorisé (insensible à la casse, super_admin et manager passent toujours)
  hasRole(...roles) {
    const rawRole = this.getRole() || '';
    const r = String(rawRole).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!r) return false;
    if (r === 'superadmin' || r === 'manager') return true;
    const allowed = roles.map((x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, ''));
    return allowed.includes(r);
  },
};
