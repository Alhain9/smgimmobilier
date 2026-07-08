const { Upload } = require('../models');

class UploadService {
  create(data) { return Upload.create(data); }
  getByRelated(table, id) {
    return Upload.findAll({ where: { related_table: table, related_id: id }, order: [['created_at', 'ASC']] });
  }
  async remove(id) {
    const u = await Upload.findByPk(id);
    if (!u) throw Object.assign(new Error('Fichier introuvable'), { status: 404 });
    await u.destroy(); return true;
  }
}
module.exports = new UploadService();
