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
  // Téléchargement du Plan de Travail Urgent en PDF
  downloadWorkPlanPdf: async (req, res, next) => {
    try {
      const buffer = await service.generateWorkPlanPdf(req.query);
      const filename = `Plan_de_travail_${new Date().toISOString().slice(0, 10)}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (e) { next(e); }
  },
  // Alimenter avec les exemples types demandés
  seedSample: async (req, res, next) => {
    try {
      const result = await service.seedWorkPlanSample(req.user);
      return success(res, result, `${result.count} tâches du plan de travail injectées avec succès`);
    } catch (e) { next(e); }
  },
  // Suppression groupée
  bulkRemove: async (req, res, next) => {
    try {
      const ids = req.body.ids || [];
      const count = await service.bulkRemove(ids);
      return success(res, { count }, `${count} tâche(s) supprimée(s)`);
    } catch (e) { next(e); }
  },
};
