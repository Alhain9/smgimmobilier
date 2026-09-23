const { success, error } = require('../utils/response');

// Factory CRUD pour un service exposant getAll/getById/create/update/remove/bulkRemove
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
  bulkRemove: async (req, res, next) => {
    try {
      const ids = req.body.ids || [];
      if (service.bulkRemove) {
        const count = await service.bulkRemove(ids);
        return success(res, { count }, `${count} élément(s) supprimé(s)`);
      } else {
        let count = 0;
        for (const id of ids) {
          try { await service.remove(id); count++; } catch (_) {}
        }
        return success(res, { count }, `${count} élément(s) supprimé(s)`);
      }
    } catch (err) { next(err); }
  },
});

module.exports = { createCrudController };
