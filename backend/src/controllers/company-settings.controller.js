// ============ Controller Paramètres Entreprise ============
const companyService = require('../services/company-settings.service');
const { success, error } = require('../utils/response');

class CompanySettingsController {
  get(req, res, next) {
    try {
      const settings = companyService.getSettings();
      return success(res, settings, 'Paramètres entreprise');
    } catch (err) { next(err); }
  }

  update(req, res, next) {
    try {
      const updated = companyService.updateSettings(req.body, req.file);
      return success(res, updated, 'Paramètres entreprise mis à jour avec succès');
    } catch (err) { next(err); }
  }
}

module.exports = new CompanySettingsController();
