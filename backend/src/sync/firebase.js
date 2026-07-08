// Initialisation du Firebase Admin SDK (chargement paresseux, robuste).
// Reste INACTIF tant que FIREBASE_ENABLED!=='true' ou que la clé de service est absente.
const fs = require('fs');
const path = require('path');

let _admin = null;
let _db = null;
let _enabled = false;
let _tried = false;

function loadAdmin() {
  if (_admin) return _admin;
  try { _admin = require('firebase-admin'); } catch (_) { _admin = null; }
  return _admin;
}

function init() {
  if (_tried) return _enabled;
  _tried = true;

  if (process.env.FIREBASE_ENABLED !== 'true') return false;
  const admin = loadAdmin();
  if (!admin) { console.warn('[sync] firebase-admin non installé (npm i firebase-admin). Synchro désactivée.'); return false; }

  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!saPath) { console.warn('[sync] FIREBASE_SERVICE_ACCOUNT manquant. Synchro désactivée.'); return false; }
  const abs = path.isAbsolute(saPath) ? saPath : path.join(__dirname, '..', '..', saPath);
  if (!fs.existsSync(abs)) { console.warn('[sync] Clé de service Firebase introuvable : ' + abs); return false; }

  try {
    const sa = require(abs);
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
    _db = admin.firestore();
    _db.settings({ ignoreUndefinedProperties: true });
    _enabled = true;
    console.log('[sync] Firebase Admin initialisé (projet ' + sa.project_id + ').');
  } catch (e) {
    console.error('[sync] Échec init Firebase : ' + e.message);
    _enabled = false;
  }
  return _enabled;
}

module.exports = {
  init,
  enabled: () => _enabled,
  db: () => _db,
  admin: () => loadAdmin(),
  FieldValue: () => (loadAdmin() ? loadAdmin().firestore.FieldValue : null),
};
