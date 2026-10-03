const reportService = require('../services/report.service');
const { success } = require('../utils/response');

module.exports = {
  tenantsSituation: async (req, res, next) => {
    try { return success(res, await reportService.tenantsSituation(req.ownerPropertyIds)); } catch (e) { next(e); }
  },
  buildingSituation: async (req, res, next) => {
    try {
      const month = req.query.month ? parseInt(req.query.month, 10) : null;
      const year = req.query.year ? parseInt(req.query.year, 10) : null;
      const start = req.query.start || null;
      const end = req.query.end || null;
      return success(res, await reportService.buildingSituation(req.params.propertyId, req.ownerPropertyIds, month, year, start, end));
    } catch (e) { next(e); }
  },
  updateSituationLine: async (req, res, next) => {
    try {
      return success(res, await reportService.updateSituationLine(req.body));
    } catch (e) { next(e); }
  },
  resetSituationOverride: async (req, res, next) => {
    try {
      const { apartment_id, property_id, period_ym } = req.query;
      return success(res, await reportService.resetSituationOverride({ apartment_id, property_id, period_ym }));
    } catch (e) { next(e); }
  },
  periodRecap: async (req, res, next) => {
    try {
      const today = new Date();
      const end = req.query.end || today.toISOString().slice(0, 10);
      const start = req.query.start || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      // Filtre par immeubles sélectionnés dans le frontend (optionnel)
      let filterPropertyIds = null;
      if (req.query.propertyIds) {
        filterPropertyIds = String(req.query.propertyIds).split(',').map(Number).filter(Boolean);
      }
      return success(res, await reportService.periodRecap(start, end, req.ownerPropertyIds, filterPropertyIds));
    } catch (e) { next(e); }
  },
  companyBalance: async (req, res, next) => {
    try {
      const today = new Date();
      const end = req.query.end || today.toISOString().slice(0, 10);
      const start = req.query.start || new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10); // default start of year
      return success(res, await reportService.companyFinancialBalance(start, end));
    } catch (e) { next(e); }
  },
};
