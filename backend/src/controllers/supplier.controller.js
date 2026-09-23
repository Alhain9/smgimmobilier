// ============ Controller Fournisseurs — SMG IMMOBILIER ============
const supplierService = require('../services/supplier.service');
const { success, error } = require('../utils/response');

class SupplierController {
  async list(req, res, next) {
    try {
      const suppliers = await supplierService.getAll(req.query);
      return success(res, suppliers, 'Liste des fournisseurs');
    } catch (err) { next(err); }
  }

  async getById(req, res, next) {
    try {
      const supplier = await supplierService.getById(req.params.id);
      return success(res, supplier, 'Détail du fournisseur');
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      const supplier = await supplierService.create(req.body);
      return success(res, supplier, 'Fournisseur créé avec succès', 201);
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      const supplier = await supplierService.update(req.params.id, req.body);
      return success(res, supplier, 'Fournisseur mis à jour avec succès');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await supplierService.remove(req.params.id);
      return success(res, null, 'Fournisseur supprimé avec succès');
    } catch (err) { next(err); }
  }
}

module.exports = new SupplierController();
