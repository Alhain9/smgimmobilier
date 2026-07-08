const service = require('../services/property.service');
const { createCrudController } = require('./crud.factory');

module.exports = createCrudController(service, {
  created: 'Immeuble créé(e)', updated: 'Immeuble mis(e) à jour', deleted: 'Immeuble supprimé(e)',
});
