const salaryService = require('../services/salary.service');
const { createCrudController } = require('./crud.factory');
const { success, error } = require('../utils/response');

const base = createCrudController(salaryService, { created: 'Salaire enregistré', updated: 'Salaire mis à jour', deleted: 'Salaire supprimé' });

module.exports = {
  ...base,
  create: async (req, res, next) => {
    try { const data = await salaryService.create({ ...req.body, created_by: req.user.id }); return success(res, data, 'Salaire enregistré', 201); }
    catch (err) { next(err); }
  },
  mine: async (req, res, next) => {
    try { return success(res, await salaryService.getMine(req.user.id)); }
    catch (err) { next(err); }
  },
  uploadProof: async (req, res, next) => {
    try {
      if (!req.file) return error(res, 'Aucun fichier reçu', 400);
      const data = await salaryService.attachProof(req.params.id, `/uploads/payments/${req.file.filename}`);
      return success(res, data, 'Preuve enregistrée');
    } catch (err) { next(err); }
  },
};
