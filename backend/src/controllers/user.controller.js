const userService = require('../services/user.service');
const { createCrudController } = require('./crud.factory');
const { success, error } = require('../utils/response');
const { ManagerProperty, Property } = require('../models');

const base = createCrudController(userService, {
  created: 'Utilisateur créé', updated: 'Utilisateur mis à jour', deleted: 'Utilisateur supprimé',
});

module.exports = {
  ...base,
  create: async (req, res, next) => {
    try {
      const user = await userService.create(req.body, req.user.role);
      return success(res, user, 'Utilisateur créé', 201);
    } catch (err) { next(err); }
  },
  update: async (req, res, next) => {
    try {
      const user = await userService.update(req.params.id, req.body, req.user.role);
      return success(res, user, 'Utilisateur mis à jour');
    } catch (err) { next(err); }
  },
  toggleActive: async (req, res, next) => {
    try {
      const user = await userService.toggleActive(req.params.id);
      return success(res, user, 'Statut modifié');
    } catch (err) { next(err); }
  },
  toggleAttendance: async (req, res, next) => {
    try {
      const user = await userService.toggleAttendance(req.params.id, req.body.is_present);
      return success(res, user, 'Pointage mis à jour');
    } catch (err) { next(err); }
  },
  getRoles: async (req, res, next) => {
    try {
      const roles = await userService.getRoles();
      return success(res, roles);
    } catch (err) { next(err); }
  },
  getTechnicians: async (req, res, next) => {
    try {
      const techs = await userService.getTechnicians();
      return success(res, techs);
    } catch (err) { next(err); }
  },
  getPendingRegistrations: async (req, res, next) => {
    try {
      const pending = await userService.getPendingRegistrations();
      return success(res, pending);
    } catch (err) { next(err); }
  },
  approveRegistration: async (req, res, next) => {
    try {
      const user = await userService.approveRegistration(req.params.id, req.body, req.user.role);
      return success(res, user, 'Compte approuvé et configuré avec succès !');
    } catch (err) { next(err); }
  },
  rejectRegistration: async (req, res, next) => {
    try {
      const result = await userService.rejectRegistration(req.params.id, req.body ? req.body.reason : null);
      return success(res, result, 'Demande d\'inscription refusée');
    } catch (err) { next(err); }
  },

  // ===== Gestion des immeubles affectés (gestionnaire / comptable) =====
  getAssignedProperties: async (req, res, next) => {
    try {
      const userId = req.params.id;
      const links = await ManagerProperty.findAll({
        where: { user_id: userId },
        include: [{ model: Property, as: 'property', attributes: ['id', 'property_name', 'city', 'address'] }],
      });
      const properties = links.map((l) => l.property).filter(Boolean);
      return success(res, properties);
    } catch (err) { next(err); }
  },

  setAssignedProperties: async (req, res, next) => {
    try {
      const userId = req.params.id;
      // property_ids : tableau d'IDs d'immeubles à affecter (remplace la liste existante)
      const propertyIds = Array.isArray(req.body.property_ids) ? req.body.property_ids.map(Number) : [];

      // Supprimer les anciennes affectations
      await ManagerProperty.destroy({ where: { user_id: userId } });

      // Créer les nouvelles
      if (propertyIds.length > 0) {
        const rows = propertyIds.map((pid) => ({ user_id: userId, property_id: pid }));
        await ManagerProperty.bulkCreate(rows, { ignoreDuplicates: true });
      }

      // Retourner les nouvelles affectations
      const links = await ManagerProperty.findAll({
        where: { user_id: userId },
        include: [{ model: Property, as: 'property', attributes: ['id', 'property_name', 'city', 'address'] }],
      });
      const properties = links.map((l) => l.property).filter(Boolean);
      return success(res, properties, `${properties.length} immeuble(s) affecté(s) avec succès`);
    } catch (err) { next(err); }
  },
};

