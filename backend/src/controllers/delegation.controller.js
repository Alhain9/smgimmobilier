// ============ Controller Délégation de Rôle ============
const delegationService = require('../services/delegation.service');
const { success, error } = require('../utils/response');

class DelegationController {
  async list(req, res, next) {
    try {
      const delegations = await delegationService.getAll();
      return success(res, delegations, 'Liste des délégations');
    } catch (err) { next(err); }
  }

  async grant(req, res, next) {
    try {
      const { user_id, delegated_role, end_date, start_date, reason } = req.body;
      if (!user_id || !delegated_role || !end_date) {
        return error(res, 'user_id, delegated_role et end_date requis', 400);
      }
      const delegation = await delegationService.grant(req.body, req.user.id);
      return success(res, delegation, 'Délégation de rôle accordée avec succès', 201);
    } catch (err) { next(err); }
  }

  async revoke(req, res, next) {
    try {
      const delegation = await delegationService.revoke(req.params.id);
      return success(res, delegation, 'Délégation révoquée');
    } catch (err) { next(err); }
  }
}

module.exports = new DelegationController();
