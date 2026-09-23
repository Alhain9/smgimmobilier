// ============ Controller Chantiers — SMG IMMOBILIER ============
const worksiteService = require('../services/worksite.service');
const worksitePdfService = require('../services/worksite-pdf.service');
const { success, error } = require('../utils/response');

class WorksiteController {
  async list(req, res, next) {
    try {
      const list = await worksiteService.getAll(req.query);
      return success(res, list, 'Liste des chantiers');
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      const ws = await worksiteService.getById(req.params.id);
      return success(res, ws, 'Détail du chantier');
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      const ws = await worksiteService.create(req.body, req.user.id);
      return success(res, ws, 'Chantier créé avec succès', 201);
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      const ws = await worksiteService.update(req.params.id, req.body);
      return success(res, ws, 'Chantier mis à jour avec succès');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await worksiteService.remove(req.params.id);
      return success(res, null, 'Chantier supprimé avec succès');
    } catch (err) { next(err); }
  }

  async addTask(req, res, next) {
    try {
      const task = await worksiteService.addTask(req.params.id, req.body);
      return success(res, task, 'Tâche de chantier ajoutée', 201);
    } catch (err) { next(err); }
  }

  async updateTask(req, res, next) {
    try {
      const task = await worksiteService.updateTask(req.params.taskId, req.body);
      return success(res, task, 'Tâche de chantier mise à jour');
    } catch (err) { next(err); }
  }

  async declareMaterials(req, res, next) {
    try {
      const materials = req.body.materials || [];
      const updated = await worksiteService.declareMaterials(req.params.id, materials, req.user.id);
      return success(res, updated, 'Matériaux déduits du stock et imputés au chantier');
    } catch (err) { next(err); }
  }

  async loanEquipment(req, res, next) {
    try {
      const updated = await worksiteService.loanEquipment(req.params.id, req.body, req.user?.id);
      return success(res, updated, 'Équipement prêté au chantier avec succès');
    } catch (err) { next(err); }
  }

  async returnEquipment(req, res, next) {
    try {
      const updated = await worksiteService.returnEquipment(req.params.id, req.params.loanId, req.body, req.user?.id);
      return success(res, updated, 'Équipement restitué à l\'entrepôt avec succès');
    } catch (err) { next(err); }
  }

  async listEquipmentLoans(req, res, next) {
    try {
      const loans = await worksiteService.getEquipmentLoans(req.params.id);
      return success(res, loans, 'Liste des équipements prêtés au chantier');
    } catch (err) { next(err); }
  }

  async addPhoto(req, res, next) {
    try {
      if (!req.file) return error(res, 'Fichier photo requis', 400);
      const photoUrl = `/uploads/photos/${req.file.filename}`;
      const phase = req.body.phase || 'during';
      const caption = req.body.caption || null;
      const photo = await worksiteService.addPhoto(req.params.id, photoUrl, phase, caption, req.user.id);
      return success(res, photo, 'Photo de chantier enregistrée', 201);
    } catch (err) { next(err); }
  }

  async downloadPdf(req, res, next) {
    try {
      const ws = await worksiteService.getById(req.params.id);
      const buffer = await worksitePdfService.generate(ws);
      const safeName = ws.title.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Rapport_Chantier_${safeName}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) { next(err); }
  }
}

module.exports = new WorksiteController();
