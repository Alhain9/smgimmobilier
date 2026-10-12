// PWA désactivée — Nettoyage automatique des Service Workers et caches existants
(function () {
  if (typeof window !== 'undefined') {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister();
        }
      }).catch(() => {});
    }
    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          caches.delete(key);
        }
      }).catch(() => {});
    }
    const btn = document.getElementById('pwaInstallBtn');
    if (btn) btn.remove();
    document.body.classList.remove('pwa-standalone');
  }
})();
