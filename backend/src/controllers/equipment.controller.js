const service = require('../services/equipment.service');
const { createCrudController } = require('./crud.factory');
const { success, error } = require('../utils/response');

const base = createCrudController(service, {
  created: 'Équipement créé(e)', updated: 'Équipement mis(e) à jour', deleted: 'Équipement supprimé(e)',
});

module.exports = {
  ...base,
  create: async (req, res, next) => {
    try {
      if (!req.file) {
        return error(res, 'Une photo de l\'équipement est obligatoire pour créer une fiche matériel.', 400);
      }
      const data = { ...req.body };
      data.photo = `/uploads/photos/${req.file.filename}`;
      const result = await service.create(data);
      return success(res, result, 'Équipement créé avec succès', 201);
    } catch (err) { next(err); }
  },
  update: async (req, res, next) => {
    try {
      const data = { ...req.body };
      if (req.file) {
        data.photo = `/uploads/photos/${req.file.filename}`;
      }
      const result = await service.update(req.params.id, data);
      return success(res, result, 'Équipement mis à jour avec succès');
    } catch (err) { next(err); }
  },
  allocate: async (req, res, next) => {
    try {
      const alloc = await service.allocate(req.params.id, req.body, req.user.id);
      return success(res, alloc, 'Équipement affecté avec succès', 201);
    } catch (err) { next(err); }
  },
  returnEquipment: async (req, res, next) => {
    try {
      const alloc = await service.returnEquipment(req.params.allocationId, req.body);
      return success(res, alloc, 'Équipement retourné avec succès');
    } catch (err) { next(err); }
  },
  checkAvailability: async (req, res, next) => {
    try {
      const { required_items, required_equipments } = req.body;
      const result = await service.checkCrossAvailability(required_items || [], required_equipments || []);
      return success(res, result, 'Vérification de disponibilité');
    } catch (err) { next(err); }
  },
};
