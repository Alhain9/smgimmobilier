// Hooks Sequelize : toute écriture MySQL sur les 6 modèles synchronisés est poussée
// vers Firestore. Les écritures venant de la synchro (option `_fromSync`) sont ignorées
// pour éviter les boucles infinies.
const { MAPPINGS } = require('./mapping');
const sync = require('./sync.service');

function attach() {
  MAPPINGS.forEach(({ model, collection }) => {
    const push = (inst, opts) => { if (!opts || !opts._fromSync) sync.pushDoc(collection, inst).catch(() => {}); };
    model.addHook('afterCreate', push);
    model.addHook('afterUpdate', push);
    model.addHook('afterSave', push); // couvre upsert/save
    model.addHook('afterDestroy', (inst, opts) => { if (!opts || !opts._fromSync) sync.removeDoc(collection, inst.id).catch(() => {}); });
  });
  console.log('[sync] Hooks MySQL -> Firestore attachés (' + MAPPINGS.length + ' modèles).');
}

module.exports = { attach };
