// ============ Service Worker — SMG IMMOBILIER PWA ============
const CACHE_NAME = 'smg-pwa-v2.0';
const STATIC_ASSETS = [
  './pages/dashboard.html',
  './pages/login.html',
  './index.html',
  './css/theme.css',
  './css/style.css',
  './css/responsive.css',
  './css/receipt-generator.css',
  './js/utils/config.js',
  './js/utils/helpers.js',
  './js/utils/icons.js',
  './js/utils/modal.js',
  './js/utils/theme.js',
  './js/modules/api.js',
  './js/modules/auth.js',
  './js/modules/router.js',
  './js/modules/layout.js',
  './js/modules/crud-page.js',
  './js/modules/notifications.js',
  './js/modules/communication.js',
  './js/modules/pdf.js',
  './js/modules/receipt-manager.js',
  './js/modules/tenant-picker.js',
  './js/app.js',
  './assets/images/logo.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-192-maskable.png',
  './assets/icons/icon-512-maskable.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png',
  './manifest.json'
];

// 1. Installation : pré-mise en cache des fichiers essentiels
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SMG PWA] Mise en cache des ressources de base...');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SMG PWA] Avertissement pré-cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activation : nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SMG PWA] Suppression ancien cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Interception réseau
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignorer les requêtes non GET (POST, PUT, DELETE pour l'API)
  if (req.method !== 'GET') return;

  // Stratégie pour les appels API : Réseau en priorité absolue (Network Only / First)
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(JSON.stringify({ error: 'Connexion réseau indisponible', offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Stratégie pour les ressources statiques et pages : Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Si réseau échoue et pas de cache, fallback page dashboard si HTML
        if (req.headers.get('accept')?.includes('text/html')) {
          return caches.match('./pages/dashboard.html');
        }
      });

      return cachedResponse || fetchPromise;
    })
  );
});
