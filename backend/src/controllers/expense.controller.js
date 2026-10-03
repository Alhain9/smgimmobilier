const service = require('../services/expense.service');
const { success } = require('../utils/response');

// Construit l'URL publique d'un fichier uploadé
const fileUrl = (file) => {
  const rel = file.path.split(/uploads[\\/]/).pop().replace(/\\/g, '/');
  return `/uploads/${rel}`;
};

module.exports = {
  getAll: async (req, res, next) => {
    try {
      const data = await service.getAll(req.query, req.ownerPropertyIds, req.assignedPropertyIds, req.user);
      return success(res, data);
    } catch (err) { next(err); }
  },

  getStats: async (req, res, next) => {
    try {
      const data = await service.getStats(req.query, req.ownerPropertyIds, req.assignedPropertyIds);
      return success(res, data);
    } catch (err) { next(err); }
  },

  getById: async (req, res, next) => {
    try {
      const data = await service.getById(req.params.id, req.ownerPropertyIds);
      return success(res, data);
    } catch (err) { next(err); }
  },

  // Gère le justificatif (champ "receipt" ou "invoice_file") : PDF -> invoice_file, image -> photo
  create: async (req, res, next) => {
    try {
      const data = { ...req.body };
      if (req.file) {
        const url = fileUrl(req.file);
        if (req.file.mimetype === 'application/pdf') data.invoice_file = url;
        else data.photo = url;
      }
      const expense = await service.create(data, req.user?.id);
      return success(res, expense, 'Dépense enregistrée avec succès', 201);
    } catch (err) { next(err); }
  },

  update: async (req, res, next) => {
    try {
      const data = { ...req.body };
      if (req.file) {
        const url = fileUrl(req.file);
        if (req.file.mimetype === 'application/pdf') data.invoice_file = url;
        else data.photo = url;
      }
      const expense = await service.update(req.params.id, data, req.ownerPropertyIds);
      return success(res, expense, 'Dépense mise à jour avec succès');
    } catch (err) { next(err); }
  },

  remove: async (req, res, next) => {
    try {
      await service.remove(req.params.id, req.ownerPropertyIds);
      return success(res, null, 'Dépense supprimée');
    } catch (err) { next(err); }
  },

  bulkRemove: async (req, res, next) => {
    try {
      const ids = req.body.ids || [];
      const count = await service.bulkRemove(ids, req.ownerPropertyIds);
      return success(res, { count }, `${count} dépense(s) supprimée(s)`);
    } catch (err) { next(err); }
  },
};
