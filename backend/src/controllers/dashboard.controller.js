const dashboardService = require('../services/dashboard.service');
const { success, error } = require('../utils/response');

module.exports = {
  getStats: async (req, res, next) => {
    try {
      const data = await dashboardService.getStats();
      return success(res, data);
    } catch (err) { next(err); }
  },
  getMonthlyRevenue: async (req, res, next) => {
    try {
      const data = await dashboardService.getMonthlyRevenue();
      return success(res, data);
    } catch (err) { next(err); }
  },
  getTechnicianStats: async (req, res, next) => {
    try {
      const data = await dashboardService.getTechnicianStats(req.user.id);
      return success(res, data);
    } catch (err) { next(err); }
  },
  getDay: async (req, res, next) => {
    try {
      const scope = req.query.scope === 'team' ? 'team' : 'me';
      if (scope === 'team') {
        const oversight = ['manager', 'super_admin', 'dir_admin', 'dir_technique', 'gestionnaire'];
        if (!oversight.includes(req.user.role) && !req.user.can_view_all_calendars) {
          return error(res, "Accès non autorisé à l'activité de l'équipe", 403);
        }
      }
      const data = await dashboardService.getDayActivity(req.user, req.query.date, scope);
      return success(res, data);
    } catch (err) { next(err); }
  },
  getPeriod: async (req, res, next) => {
    try {
      // Par défaut : 30 derniers jours
      const today = new Date();
      const end = req.query.end || today.toISOString().slice(0, 10);
      const start = req.query.start || new Date(today.getTime() - 29 * 86400000).toISOString().slice(0, 10);
      const [stats, series] = await Promise.all([
        dashboardService.getPeriodStats(start, end),
        dashboardService.getRevenueSeries(start, end),
      ]);
      return success(res, { ...stats, series });
    } catch (err) { next(err); }
  },
  getWorkerPeriod: async (req, res, next) => {
    try {
      const today = new Date();
      const end = req.query.end || today.toISOString().slice(0, 10);
      const start = req.query.start || new Date(today.getTime() - 29 * 86400000).toISOString().slice(0, 10);
      const data = await dashboardService.getWorkerProductivity(req.user.id, start, end);
      return success(res, { start, end, ...data });
    } catch (err) { next(err); }
  },
  getSectorSummary: async (req, res, next) => {
    try {
      const data = await dashboardService.getSectorSummary(req.user.role);
      return success(res, data);
    } catch (err) { next(err); }
  },
  getSectorDetail: async (req, res, next) => {
    try {
      const data = await dashboardService.getSectorDetail(req.params.sector, req.user.role);
      return success(res, data);
    } catch (err) { next(err); }
  },
};
