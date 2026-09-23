const withdrawalService = require('../services/withdrawal.service');
const { success } = require('../utils/response');

module.exports = {
  getBalance: async (req, res, next) => {
    try {
      return success(res, await withdrawalService.getBalance());
    } catch (err) { next(err); }
  },
  create: async (req, res, next) => {
    try {
      const result = await withdrawalService.create(req.body, req.user);
      return success(res, result, result.message, 201);
    } catch (err) { next(err); }
  },
  getAll: async (req, res, next) => {
    try {
      return success(res, await withdrawalService.getAll(req.query));
    } catch (err) { next(err); }
  },
  getById: async (req, res, next) => {
    try {
      return success(res, await withdrawalService.getById(req.params.id));
    } catch (err) { next(err); }
  },
};
