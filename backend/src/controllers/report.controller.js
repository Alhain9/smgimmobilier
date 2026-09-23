const reportService = require('../services/report.service');
const { success } = require('../utils/response');

module.exports = {
  tenantsSituation: async (req, res, next) => {
    try { return success(res, await reportService.tenantsSituation(req.ownerPropertyIds)); } catch (e) { next(e); }
  },
  buildingSituation: async (req, res, next) => {
    try { return success(res, await reportService.buildingSituation(req.params.propertyId, req.ownerPropertyIds)); } catch (e) { next(e); }
  },
  periodRecap: async (req, res, next) => {
    try {
      const today = new Date();
      const end = req.query.end || today.toISOString().slice(0, 10);
      const start = req.query.start || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      return success(res, await reportService.periodRecap(start, end, req.ownerPropertyIds));
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
