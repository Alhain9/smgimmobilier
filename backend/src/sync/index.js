// Orchestrateur de la synchronisation. Appelé au démarrage du serveur.
// Ne bloque jamais le démarrage : si Firestore n'est pas configuré, on continue sans synchro.
const firebase = require('./firebase');
const hooks = require('./hooks');
const sync = require('./sync.service');

async function initSync() {
  try {
    if (!firebase.init()) {
      console.log('[sync] Firestore désactivé (FIREBASE_ENABLED!=true ou clé de service absente).');
      return;
    }
    hooks.attach();                                   // MySQL -> Firestore (hooks Sequelize)
    if (process.env.FIREBASE_BACKFILL === 'true') await sync.backfill();
    sync.startListeners();                             // Firestore -> MySQL (onSnapshot)
    console.log('[sync] Synchro bidirectionnelle MySQL <-> Firestore ACTIVE.');
  } catch (e) {
    console.error('[sync] Initialisation échouée (le serveur continue) : ' + e.message);
  }
}

module.exports = { initSync };
