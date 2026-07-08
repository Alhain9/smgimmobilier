const relanceService = require('../services/relance.service');
const { success } = require('../utils/response');

module.exports = {
  create: async (req, res, next) => {
    try {
      const data = await relanceService.create(req.body, req.user);
      return success(res, data, 'Relance envoyée', 201);
    } catch (err) { next(err); }
  },
};
