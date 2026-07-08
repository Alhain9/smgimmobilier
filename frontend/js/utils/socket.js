// ============ Client Socket.IO — gestion du temps réel ============
const SocketClient = {
  socket: null,
  listeners: {},

  init() {
    const token = API.token();
    if (!token) return;

    // Charger dynamiquement le script socket.io s'il n'est pas déjà présent
    if (typeof io === 'undefined') {
      const script = document.createElement('script');
      script.src = `${CONFIG.SERVER_URL}/socket.io/socket.io.js`;
      script.onload = () => this.connect(token);
      document.head.appendChild(script);
    } else {
      this.connect(token);
    }
  },

  connect(token) {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(CONFIG.SERVER_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('🔌 Socket.IO connecté avec succès !');
      // Re-rejoindre les rooms personnalisées si nécessaire
      const user = Auth.getUser();
      if (user && user.role) {
        this.socket.emit('join:role', user.role);
      }
    });

    this.socket.on('connect_error', (err) => {
      console.warn('⚠️ Erreur connexion socket:', err.message);
    });

    // Écouter les événements globaux et rediriger vers nos listeners enregistrés
    this.socket.onAny((event, data) => {
      console.log(`[Socket Event] ${event}:`, data);
      if (this.listeners[event]) {
        this.listeners[event].forEach(callback => callback(data));
      }
    });

    // Écouteur par défaut pour rafraîchir les dashboards automatiquement
    this.socket.on('dashboard:refresh', () => {
      // Si la page active est le dashboard ou une page de liste, on peut recharger
      const activePage = window.location.hash.replace('#', '') || 'dashboard';
      if (activePage === 'dashboard' && typeof PageDashboard !== 'undefined' && PageDashboard.load) {
        PageDashboard.load();
      }
    });

    // Écouteur pour les notifications push/toast
    this.socket.on('notification:nouvelle', (notif) => {
      if (typeof Toast !== 'undefined') {
        Toast.info(notif.title || 'Nouvelle notification');
      }
      if (typeof Notifications !== 'undefined' && Notifications.load) {
        Notifications.load();
      }
    });
  },

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  },

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  },

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
};

// Initialisation globale
document.addEventListener('DOMContentLoaded', () => {
  // Retarder légèrement pour laisser Auth s'initialiser
  setTimeout(() => SocketClient.init(), 500);
});
