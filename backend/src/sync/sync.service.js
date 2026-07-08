// Moteur de synchronisation bidirectionnelle MySQL <-> Firestore.
// - MySQL -> Firestore : via les hooks Sequelize (cf. hooks.js) qui appellent pushDoc/removeDoc.
// - Firestore -> MySQL : via des écouteurs onSnapshot (startListeners).
// Anti-boucle : chaque doc porte `sourceSystem` ; on mémorise nos propres écritures
//   (échos) pendant une courte fenêtre, et les écritures vers MySQL passent l'option
//   `_fromSync:true` pour que les hooks ne re-propagent pas.
// Conflits : `updatedAt` (dernier qui écrit gagne) + départage par `sourceSystem`.
const firebase = require('./firebase');
const { MAPPINGS, byCollection, toFirestore, toMysql, rowUpdatedAt } = require('./mapping');

const ECHO_WINDOW_MS = 15000;          // fenêtre pour ignorer l'écho de nos propres écritures
const _recent = new Map();             // `${collection}:${id}` -> timestamp de notre dernier push
const _listeners = [];

const key = (c, id) => c + ':' + String(id);
const isEcho = (c, id) => {
  const t = _recent.get(key(c, id));
  return t && (Date.now() - t) < ECHO_WINDOW_MS;
};
const markPush = (c, id) => _recent.set(key(c, id), Date.now());

// ---------- MySQL -> Firestore ----------
async function pushDoc(collection, instance) {
  if (!firebase.enabled() || !instance || instance.id == null) return;
  try {
    const id = String(instance.id);
    const data = toFirestore(instance);
    data.id = id;
    data.sourceSystem = 'mysql';
    data.updatedAt = (rowUpdatedAt(data) ? new Date(rowUpdatedAt(data)) : new Date()).toISOString();
    data.syncedAt = new Date().toISOString();
    markPush(collection, id);
    await firebase.db().collection(collection).doc(id).set(data, { merge: true });
  } catch (e) { console.error('[sync] push ' + collection + ' échec : ' + e.message); }
}

async function removeDoc(collection, id) {
  if (!firebase.enabled() || id == null) return;
  try { markPush(collection, id); await firebase.db().collection(collection).doc(String(id)).delete(); }
  catch (e) { console.error('[sync] delete ' + collection + ' échec : ' + e.message); }
}

// Réinjection initiale : MySQL -> Firestore (sur demande, FIREBASE_BACKFILL=true)
async function backfill() {
  if (!firebase.enabled()) return;
  for (const { collection, model } of MAPPINGS) {
    const rows = await model.findAll();
    for (const r of rows) await pushDoc(collection, r);
    console.log('[sync] backfill ' + collection + ' : ' + rows.length + ' doc(s).');
  }
}

// ---------- Firestore -> MySQL ----------
function firestoreWins(mysqlRow, fsData) {
  if (!mysqlRow) return true;
  const m = new Date(rowUpdatedAt(mysqlRow.toJSON ? mysqlRow.toJSON() : mysqlRow) || 0).getTime();
  const f = new Date(fsData.updatedAt || 0).getTime();
  if (f > m) return true;
  if (f < m) return false;
  return fsData.sourceSystem === 'firestore'; // égalité -> on privilégie l'origine Firestore
}

async function applyChange(collection, change) {
  const map = byCollection[collection];
  if (!map) return;
  const id = change.doc.id;
  const data = change.doc.data() || {};

  // Ignorer l'écho de nos propres écritures (MySQL -> Firestore)
  if (data.sourceSystem === 'mysql' && isEcho(collection, id)) return;

  try {
    if (change.type === 'removed') {
      const row = await map.model.findByPk(id);
      if (row) await row.destroy({ _fromSync: true });
      return;
    }
    const existing = await map.model.findByPk(id);
    if (!firestoreWins(existing, data)) return; // MySQL plus récent -> on ne touche pas

    const clean = toMysql(map.model, data);
    clean.id = id;
    if (existing) await existing.update(clean, { _fromSync: true });
    else await map.model.create(clean, { _fromSync: true });
  } catch (e) { console.error('[sync] applyChange ' + collection + '/' + id + ' : ' + e.message); }
}

function startListeners() {
  if (!firebase.enabled()) return;
  MAPPINGS.forEach(({ collection }) => {
    const unsub = firebase.db().collection(collection).onSnapshot(
      (snap) => snap.docChanges().forEach((ch) => applyChange(collection, ch)),
      (err) => console.error('[sync] écoute ' + collection + ' : ' + err.message),
    );
    _listeners.push(unsub);
  });
  console.log('[sync] Écoute Firestore active sur ' + MAPPINGS.length + ' collections.');
}

function stop() { _listeners.forEach((u) => { try { u(); } catch (_) {} }); _listeners.length = 0; }

module.exports = { pushDoc, removeDoc, backfill, startListeners, stop };
