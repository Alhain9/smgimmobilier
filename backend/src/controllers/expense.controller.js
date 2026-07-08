const service = require('../services/expense.service');
const { createCrudController } = require('./crud.factory');
const { success } = require('../utils/response');

const base = createCrudController(service, {
  created: 'Dépense créé(e)', updated: 'Dépense mis(e) à jour', deleted: 'Dépense supprimé(e)',
});

// Construit l'URL publique d'un fichier uploadé (le dossier dépend du type, cf. upload.middleware)
const fileUrl = (file) => {
  const rel = file.path.split(/uploads[\\/]/).pop().replace(/\\/g, '/');
  return `/uploads/${rel}`;
};

module.exports = {
  ...base,
  // Gère le justificatif (champ "receipt") : PDF -> invoice_file, image -> photo
  create: async (req, res, next) => {
    try {
      const data = { ...req.body };
      if (req.file) {
        const url = fileUrl(req.file);
        if (req.file.mimetype === 'application/pdf') data.invoice_file = url;
        else data.photo = url;
      }
      const expense = await service.create(data);
      return success(res, expense, 'Dépense enregistrée', 201);
    } catch (err) { next(err); }
  },
};
