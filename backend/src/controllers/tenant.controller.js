const tenantService = require('../services/tenant.service');
const { createCrudController } = require('./crud.factory');
const { success } = require('../utils/response');

const base = createCrudController(tenantService, {
  created: 'Locataire créé', updated: 'Locataire mis à jour', deleted: 'Locataire supprimé',
});

module.exports = {
  ...base,
  // Profil du locataire connecté
  myProfile: async (req, res, next) => {
    try {
      const data = await tenantService.getByUserId(req.user.id);
      return success(res, data);
    } catch (err) { next(err); }
  },
};
