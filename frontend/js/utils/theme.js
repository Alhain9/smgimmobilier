// ============ Gestion thème clair / sombre ============
const Theme = {
  init() {
    const saved = localStorage.getItem(CONFIG.THEME_KEY)
      || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    this.apply(saved);
  },

  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(CONFIG.THEME_KEY, theme);
    // Met à jour toutes les icônes de bascule
    document.querySelectorAll('.theme-toggle').forEach((btn) => {
      btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
      btn.title = theme === 'dark' ? 'Mode clair' : 'Mode sombre';
    });
  },

  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    this.apply(current === 'dark' ? 'light' : 'dark');
  },

  current() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  },
};

// Applique le thème immédiatement (évite le flash)
Theme.init();
