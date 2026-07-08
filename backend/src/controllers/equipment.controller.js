const service = require('../services/equipment.service');
const { createCrudController } = require('./crud.factory');

module.exports = createCrudController(service, {
  created: 'Équipement créé(e)', updated: 'Équipement mis(e) à jour', deleted: 'Équipement supprimé(e)',
});
