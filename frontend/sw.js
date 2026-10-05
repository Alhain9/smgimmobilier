// ============ Service Worker — SMG IMMOBILIER PWA (Network-First Zero Cache Stale) ============
const CACHE_NAME = 'smg-pwa-v3.0';

// Fichiers de secours pré-enregistrés pour le mode hors-ligne
const OFFLINE_FALLBACKS = [
  './pages/dashboard.html',
  './pages/login.html',
  './index.html',
  './css/theme.css',
  './css/style.css',
  './css/dashboard.css',
  './css/responsive.css',
  './manifest.json',
  './assets/images/logo.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

// 1. Installation : mise en cache initiale et prise de contrôle immédiate
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_FALLBACKS).catch((err) => {
        console.warn('[SMG PWA] Avertissement pré-cache:', err);
      });
    })
  );
  // Ne pas attendre la fermeture des onglets : activation immédiate
  self.skipWaiting();
});

// 2. Activation : purge complète de tous les anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SMG PWA] Nettoyage ancien cache obsolète:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Messages reçus depuis l'application cliente
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});

// 4. Stratégie réseau : NETWORK-FIRST pour tous les fichiers de code (Zero Cache Stale)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignorer les requêtes non-GET (POST, PUT, DELETE, etc.)
  if (req.method !== 'GET') return;

  // Ignorer les protocoles tiers ou extensions navigateur
  if (!url.protocol.startsWith('http')) return;

  // Appels API : Réseau exclusif
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(JSON.stringify({ error: 'Connexion réseau indisponible', offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // Fichiers de code (HTML, JS, CSS, JSON) et navigations : NETWORK-FIRST
  // On interroge toujours le serveur en priorité pour avoir la version en direct.
  // Le cache ne sert que de filet de sécurité en cas de panne de connexion (hors-ligne).
  const isCode = req.mode === 'navigate' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('.js') ||
                 url.pathname.endsWith('.css') ||
                 url.pathname.endsWith('.json') ||
                 url.pathname.endsWith('manifest.json') ||
                 req.headers.get('accept')?.includes('text/html');

  if (isCode) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback hors-ligne uniquement si le réseau est totalement inaccessible
          return caches.match(req).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
              return caches.match('./pages/dashboard.html');
            }
          });
        })
    );
    return;
  }

  // Autres ressources (Images, Polices, Icônes lourdes) : Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return networkResponse;
      }).catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});
