const leaseService = require('../services/lease.service');
const { createCrudController } = require('./crud.factory');
const { success, error } = require('../utils/response');

const base = createCrudController(leaseService, {
  created: 'Contrat créé', updated: 'Contrat mis à jour', deleted: 'Contrat supprimé',
});

module.exports = {
  ...base,
  uploadContract: async (req, res, next) => {
    try {
      if (!req.file) return error(res, 'Aucun fichier reçu', 400);
      const filePath = `/uploads/contracts/${req.file.filename}`;
      const lease = await leaseService.attachContract(req.params.id, filePath);
      return success(res, lease, 'Contrat PDF enregistré');
    } catch (err) { next(err); }
  },
  renew: async (req, res, next) => {
    try {
      const { end_date, monthly_rent } = req.body;
      if (!end_date) return error(res, 'La nouvelle date d\'échéance est requise', 400);
      if (!monthly_rent || Number(monthly_rent) <= 0) return error(res, 'Le loyer réajusté est requis et doit être positif', 400);
      const lease = await leaseService.renew(req.params.id, end_date, monthly_rent);
      return success(res, lease, 'Contrat de bail renouvelé avec succès');
    } catch (err) { next(err); }
  },
};
