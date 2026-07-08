const path = require('path');
const fs = require('fs');
const { Upload, User } = require('../models');

class DocumentService {
  async getAll(filters = {}) {
    const where = {};
    if (filters.category) where.related_table = filters.category;
    return Upload.findAll({
      where,
      include: [{ model: User, as: 'uploader', attributes: ['id', 'full_name'] }],
      order: [['created_at', 'DESC']],
    });
  }

  async createFromFile(file, { category = 'document', related_id = null, uploaded_by = null }) {
    if (!file) throw Object.assign(new Error('Aucun fichier reçu'), { status: 400 });
    const subfolder = path.basename(file.destination || 'documents');
    return Upload.create({
      uploaded_by,
      file_name: file.originalname,
      file_path: `/uploads/${subfolder}/${file.filename}`,
      file_type: file.mimetype,
      related_table: category,
      related_id,
    });
  }

  async remove(id) {
    const u = await Upload.findByPk(id);
    if (!u) throw Object.assign(new Error('Document introuvable'), { status: 404 });
    // suppression physique best-effort
    try {
      const abs = path.join(__dirname, '..', u.file_path.replace('/uploads', 'uploads'));
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch (_) { /* ignore */ }
    await u.destroy();
    return true;
  }
}
module.exports = new DocumentService();
