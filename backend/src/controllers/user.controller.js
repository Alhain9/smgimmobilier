const userService = require('../services/user.service');
const { createCrudController } = require('./crud.factory');
const { success, error } = require('../utils/response');

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
};
