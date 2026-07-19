const service = require('../services/property.service');
const importService = require('../services/import.service');
const { createCrudController } = require('./crud.factory');
const { success } = require('../utils/response');
const fs = require('fs');

const controller = createCrudController(service, {
  created: 'Immeuble créé(e)', updated: 'Immeuble mis(e) à jour', deleted: 'Immeuble supprimé(e)',
});

controller.importBuilding = async (req, res, next) => {
  try {
    if (!req.file) {
      throw Object.assign(new Error('Fichier Excel manquant'), { status: 400 });
    }

    const { address, city, district } = req.body;
    const stats = await importService.importBuildingSituation(req.file.path, {
      address,
      city,
      district,
    });

    // Nettoyage du fichier temporaire après import réussi
    try {
      fs.unlinkSync(req.file.path);
    } catch (_) {}

    return success(res, stats, 'Fichier situation Excel importé avec succès');
  } catch (err) {
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
    }
    next(err);
  }
};

module.exports = controller;
