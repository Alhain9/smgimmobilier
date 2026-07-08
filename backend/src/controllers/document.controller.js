const documentService = require('../services/document.service');
const { success, error } = require('../utils/response');

exports.getAll = async (req, res, next) => {
  try { return success(res, await documentService.getAll(req.query)); }
  catch (err) { next(err); }
};
exports.upload = async (req, res, next) => {
  try {
    if (!req.file) return error(res, 'Aucun fichier reçu', 400);
    const doc = await documentService.createFromFile(req.file, {
      category: req.body.category || 'document',
      related_id: req.body.related_id || null,
      uploaded_by: req.user.id,
    });
    return success(res, doc, 'Document téléversé', 201);
  } catch (err) { next(err); }
};
exports.remove = async (req, res, next) => {
  try { await documentService.remove(req.params.id); return success(res, null, 'Document supprimé'); }
  catch (err) { next(err); }
};
