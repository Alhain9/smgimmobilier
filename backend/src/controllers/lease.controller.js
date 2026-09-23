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
      const { end_date } = req.body;
      if (!end_date) return error(res, 'La nouvelle date d\'échéance est requise', 400);
      const lease = await leaseService.renew(req.params.id, req.body);
      return success(res, lease, 'Contrat de bail renouvelé avec succès');
    } catch (err) { next(err); }
  },
  downloadDocx: async (req, res, next) => {
    try {
      const docxService = require('../services/docx-contract.service');
      const { filename, buffer } = await docxService.generateLeaseDocx(req.params.id);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (err) { next(err); }
  },
  getTags: async (req, res, next) => {
    try {
      const docxService = require('../services/docx-contract.service');
      return success(res, docxService.getAvailableTags(), 'Liste des balises disponibles');
    } catch (err) { next(err); }
  },
};
