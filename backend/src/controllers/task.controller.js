const service = require('../services/task.service');
const { createCrudController } = require('./crud.factory');
const { success } = require('../utils/response');

const base = createCrudController(service, {
  created: 'Tâche créée', updated: 'Tâche mise à jour', deleted: 'Tâche supprimée',
});

module.exports = {
  ...base,
  create: async (req, res, next) => {
    try { return success(res, await service.create(req.body, req.user), 'Tâche créée', 201); } catch (e) { next(e); }
  },
  update: async (req, res, next) => {
    try { return success(res, await service.update(req.params.id, req.body, req.user), 'Tâche mise à jour'); } catch (e) { next(e); }
  },
  // L'employé déclare le statut (en cours / effectuée / non effectuée + raison)
  markStatus: async (req, res, next) => {
    try { return success(res, await service.markStatus(req.params.id, req.body.status, req.body.note, req.body.delay_justification, req.user), 'Statut mis à jour'); } catch (e) { next(e); }
  },
  // Reporter à une autre heure (motif obligatoire)
  reschedule: async (req, res, next) => {
    try { return success(res, await service.reschedule(req.params.id, req.body.start_date, req.body.reason, req.user), 'Tâche reportée'); } catch (e) { next(e); }
  },
};
