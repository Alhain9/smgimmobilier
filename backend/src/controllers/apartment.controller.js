const service = require('../services/apartment.service');
const { createCrudController } = require('./crud.factory');
const { success } = require('../utils/response');

const controller = createCrudController(service, {
  created: 'Appartement créé(e)', updated: 'Appartement mis(e) à jour', deleted: 'Appartement supprimé(e)',
});

controller.getAll = async (req, res, next) => {
  try {
    const data = await service.getAll(req.query, req.ownerPropertyIds);
    return success(res, data);
  } catch (err) { next(err); }
};

controller.getById = async (req, res, next) => {
  try {
    const data = await service.getById(req.params.id);
    if (req.ownerPropertyIds && !req.ownerPropertyIds.includes(Number(data.property_id))) {
      throw Object.assign(new Error('Accès non autorisé à ce logement'), { status: 403 });
    }
    return success(res, data);
  } catch (err) { next(err); }
};

module.exports = controller;
