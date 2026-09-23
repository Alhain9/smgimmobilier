// ============ Gestionnaire PWA & Installation Mobile — SMG IMMOBILIER ============
const PWA = {
  deferredPrompt: null,
  isInstalled: false,

  init() {
    // 1. Détection si déjà lancé en mode application autonome (standalone)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      this.isInstalled = true;
      document.body.classList.add('pwa-standalone');
      console.log('[SMG PWA] Application lancée en mode autonome (Mobile App).');
    }

    // 2. Enregistrement du Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        // Détecter si on est dans /pages/ ou à la racine
        const swPath = window.location.pathname.includes('/pages/') ? '../sw.js' : './sw.js';
        navigator.serviceWorker.register(swPath)
          .then((reg) => {
            console.log('[SMG PWA] Service Worker actif, scope:', reg.scope);
            reg.update();
          })
          .catch((err) => {
            console.warn('[SMG PWA] Échec enregistrement Service Worker:', err);
          });
      });
    }

    // 3. Capture de l'événement d'installation mobile (Android / Chrome)
    window.addEventListener('beforeinstallprompt', (e) => {
      // Empêcher l'affichage de la mini-barre par défaut
      e.preventDefault();
      this.deferredPrompt = e;
      console.log('[SMG PWA] Événement d’installation mobile capturé.');
      this.showInstallButton();
    });

    // 4. Confirmation de l'installation terminée
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.isInstalled = true;
      console.log('[SMG PWA] Application SMG IMMOBILIER installée avec succès sur le smartphone.');
      if (typeof Toast !== 'undefined') {
        Toast.success('SMG IMMOBILIER a été installé avec succès sur votre écran d’accueil ! 🎉');
      }
      const btn = document.getElementById('pwaInstallBtn');
      if (btn) btn.style.display = 'none';
    });
  },

  // Affiche un bouton d'installation élégant dans l'application
  showInstallButton() {
    let btn = document.getElementById('pwaInstallBtn');
    if (!btn) {
      // Tenter d'insérer dans la sidebar sous le profil ou en haut de la page
      const sidebarBottom = document.querySelector('.sidebar-footer') || document.querySelector('.sidebar');
      if (sidebarBottom) {
        btn = document.createElement('button');
        btn.id = 'pwaInstallBtn';
        btn.className = 'btn btn-primary';
        btn.style.cssText = 'width:calc(100% - 24px);margin:12px;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg, #0284c7, #0369a1);border:none;font-weight:700;font-size:12.5px;padding:9px 12px;border-radius:8px;box-shadow:0 4px 12px rgba(2,132,199,0.35);cursor:pointer;color:#ffffff;animation:pwaPulse 2.5s infinite;';
        btn.innerHTML = '<span>📲</span> <span>Installer l’App Mobile</span>';
        btn.onclick = () => this.install();
        sidebarBottom.appendChild(btn);

        // Animation d'attention discrète
        if (!document.getElementById('pwa_keyframes')) {
          const style = document.createElement('style');
          style.id = 'pwa_keyframes';
          style.innerHTML = `
            @keyframes pwaPulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.02); }
            }
          `;
          document.head.appendChild(style);
        }
      }
    } else {
      btn.style.display = 'flex';
    }
  },

  // Déclenche l'invite d'installation native
  async install() {
    if (!this.deferredPrompt) {
      if (typeof Toast !== 'undefined') {
        Toast.info('Pour installer sur iPhone/iPad : appuyez sur le bouton Partager dans Safari puis « Sur l’écran d’accueil ».');
      } else {
        alert('Pour installer sur iPhone/iPad : appuyez sur Partager dans Safari puis « Sur l’écran d’accueil ».');
      }
      return;
    }

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    console.log('[SMG PWA] Choix utilisateur:', outcome);
    if (outcome === 'accepted') {
      this.deferredPrompt = null;
    }
  }
};

// Initialisation automatique dès le chargement du script
PWA.init();
window.PWA = PWA;
