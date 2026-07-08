const service = require('../services/utility.service');
const { createCrudController } = require('./crud.factory');
const { success, error } = require('../utils/response');

const base = createCrudController(service, {
  created: 'Facture enregistrée', updated: 'Facture mise à jour', deleted: 'Facture supprimée',
});

module.exports = {
  ...base,
  create: async (req, res, next) => {
    try { return success(res, await service.create(req.body, req.user), 'Facture enregistrée', 201); }
    catch (e) { next(e); }
  },
  // Dernière facture d'un logement → pour reporter l'ancien index + prix/frais
  getLast: async (req, res, next) => {
    try { return success(res, await service.getLast(req.query.apartment_id, req.query.type)); }
    catch (e) { next(e); }
  },
  setPaid: async (req, res, next) => {
    try { return success(res, await service.setPaid(req.params.id, req.body.paid !== false), 'Statut mis à jour'); }
    catch (e) { next(e); }
  },
  uploadProof: async (req, res, next) => {
    try {
      if (!req.file) return error(res, 'Aucun fichier reçu', 400);
      const data = await service.setProof(req.params.id, `/uploads/payments/${req.file.filename}`);
      return success(res, data, 'Justificatif enregistré');
    } catch (e) { next(e); }
  },
  mine: async (req, res, next) => {
    try { return success(res, await service.getMine(req.user.id)); }
    catch (e) { next(e); }
  },
};
