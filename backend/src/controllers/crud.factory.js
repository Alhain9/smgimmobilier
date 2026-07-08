const { success, error } = require('../utils/response');

// Factory CRUD pour un service exposant getAll/getById/create/update/remove
const createCrudController = (service, labels = {}) => ({
  getAll: async (req, res, next) => {
    try {
      const data = await service.getAll(req.query);
      return success(res, data);
    } catch (err) { next(err); }
  },
  getById: async (req, res, next) => {
    try {
      const data = await service.getById(req.params.id);
      return success(res, data);
    } catch (err) { next(err); }
  },
  create: async (req, res, next) => {
    try {
      const data = await service.create(req.body);
      return success(res, data, labels.created || 'Créé avec succès', 201);
    } catch (err) { next(err); }
  },
  update: async (req, res, next) => {
    try {
      const data = await service.update(req.params.id, req.body);
      return success(res, data, labels.updated || 'Mis à jour');
    } catch (err) { next(err); }
  },
  remove: async (req, res, next) => {
    try {
      await service.remove(req.params.id);
      return success(res, null, labels.deleted || 'Supprimé');
    } catch (err) { next(err); }
  },
});

module.exports = { createCrudController };
