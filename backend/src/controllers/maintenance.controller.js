const maintenanceService = require('../services/maintenance.service');
const { createCrudController } = require('./crud.factory');
const { success, error } = require('../utils/response');

const base = createCrudController(maintenanceService, {
  created: 'Ticket maintenance créé', updated: 'Maintenance mise à jour', deleted: 'Maintenance supprimée',
});

module.exports = {
  ...base,
  create: async (req, res, next) => {
    try {
      if (!req.file) {
        return error(res, 'Une photo illustrant le problème est obligatoire pour créer une demande de maintenance.', 400);
      }
      const result = await maintenanceService.create(req.body);
      if (req.file) {
        await maintenanceService.addImage(result.id, `/uploads/photos/${req.file.filename}`, 'before');
      }
      const full = await maintenanceService.getById(result.id);
      return success(res, full, 'Ticket maintenance créé', 201);
    } catch (err) { next(err); }
  },
  assign: async (req, res, next) => {
    try {
      const data = await maintenanceService.assign(req.params.id, req.body.assigned_technician_id || req.body.technician_id);
      return success(res, data, 'Technicien assigné');
    } catch (err) { next(err); }
  },
  setTeam: async (req, res, next) => {
    try {
      const ids = req.body.user_ids || req.body.technician_ids || [];
      const data = await maintenanceService.setTeam(req.params.id, ids);
      return success(res, data, 'Équipe mise à jour');
    } catch (err) { next(err); }
  },
  uploadPhotos: async (req, res, next) => {
    try {
      if (!req.files || !req.files.length) return error(res, 'Aucune photo reçue', 400);
      const type = req.body.image_type || req.body.category || 'during';
      const created = [];
      for (const file of req.files) {
        created.push(await maintenanceService.addImage(req.params.id, `/uploads/photos/${file.filename}`, type));
      }
      return success(res, created, 'Photos enregistrées', 201);
    } catch (err) { next(err); }
  },
  declareMaterials: async (req, res, next) => {
    try {
      const materials = req.body.materials || [];
      const updated = await maintenanceService.declareMaterials(req.params.id, materials, req.user.id);
      return success(res, updated, 'Matériel consommé enregistré avec succès (stock déduit & dépense imputée)');
    } catch (err) { next(err); }
  },
};
