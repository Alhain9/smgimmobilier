// Correspondance collections Firestore (FR) <-> modèles Sequelize (MySQL).
const { Tenant, Property, Lease, Payment, Expense, Notification } = require('../models');

const MAPPINGS = [
  { collection: 'locataires', model: Tenant },
  { collection: 'proprietes', model: Property },
  { collection: 'contrats', model: Lease },
  { collection: 'paiements', model: Payment },
  { collection: 'depenses', model: Expense },
  { collection: 'notifications', model: Notification },
];

const byCollection = {};
const byModelName = {};
MAPPINGS.forEach((m) => { byCollection[m.collection] = m; byModelName[m.model.name] = m; });

// Horodatage de référence d'une ligne (pour la résolution de conflits)
function rowUpdatedAt(o) {
  return o.updated_at || o.updatedAt || o.created_at || o.createdAt || null;
}

// MySQL -> objet Firestore (dates en ISO, undefined -> null)
function toFirestore(instance) {
  const o = instance.toJSON ? instance.toJSON() : instance;
  const data = {};
  for (const [k, v] of Object.entries(o)) {
    if (v instanceof Date) data[k] = v.toISOString();
    else data[k] = v === undefined ? null : v;
  }
  return data;
}

// objet Firestore -> champs MySQL (on ne garde que les colonnes réelles du modèle)
function toMysql(model, data) {
  const attrs = Object.keys(model.rawAttributes);
  const clean = {};
  for (const k of attrs) if (k in data && data[k] !== undefined) clean[k] = data[k];
  return clean;
}

module.exports = { MAPPINGS, byCollection, byModelName, toFirestore, toMysql, rowUpdatedAt };
