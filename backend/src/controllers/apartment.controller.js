const service = require('../services/apartment.service');
const { createCrudController } = require('./crud.factory');

module.exports = createCrudController(service, {
  created: 'Appartement créé(e)', updated: 'Appartement mis(e) à jour', deleted: 'Appartement supprimé(e)',
});
