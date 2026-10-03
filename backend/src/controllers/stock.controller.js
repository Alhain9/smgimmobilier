// ============ Controller Stock & Consommables ============
const stockService = require('../services/stock.service');
const { success, error } = require('../utils/response');

class StockController {
  // Articles
  async listItems(req, res, next) {
    try {
      const items = await stockService.getAllItems(req.query);
      return success(res, items, 'Liste des articles en stock');
    } catch (err) { next(err); }
  }

  async getItemById(req, res, next) {
    try {
      const item = await stockService.getItemById(req.params.id);
      return success(res, item, 'Détail de l\'article');
    } catch (err) { next(err); }
  }

  async createItem(req, res, next) {
    try {
      const data = { ...req.body };
      if (req.file) {
        data.photo = `/uploads/${req.file.filename}`;
      }
      const item = await stockService.createItem(data);
      return success(res, item, 'Article créé avec succès', 201);
    } catch (err) { next(err); }
  }

  async updateItem(req, res, next) {
    try {
      const data = { ...req.body };
      if (req.file) {
        data.photo = `/uploads/${req.file.filename}`;
      }
      const item = await stockService.updateItem(req.params.id, data);
      return success(res, item, 'Article mis à jour avec succès');
    } catch (err) { next(err); }
  }

  async removeItem(req, res, next) {
    try {
      await stockService.removeItem(req.params.id);
      return success(res, null, 'Article supprimé avec succès');
    } catch (err) { next(err); }
  }

  async bulkRemoveItems(req, res, next) {
    try {
      const ids = req.body.ids || [];
      await stockService.bulkRemoveItems(ids);
      return success(res, null, 'Articles sélectionnés supprimés avec succès');
    } catch (err) { next(err); }
  }

  // Achats & Réceptions
  async recordPurchase(req, res, next) {
    try {
      const purchase = await stockService.recordPurchase(req.body, req.user.id);
      return success(res, purchase, 'Achat et réception de stock enregistrés avec succès', 201);
    } catch (err) { next(err); }
  }

  async listPurchases(req, res, next) {
    try {
      const purchases = await stockService.getPurchases(req.query);
      return success(res, purchases, 'Historique des achats');
    } catch (err) { next(err); }
  }

  async getPurchaseById(req, res, next) {
    try {
      const purchase = await stockService.getPurchaseById(req.params.id);
      return success(res, purchase, 'Détail du bon d\'achat');
    } catch (err) { next(err); }
  }

  // Mouvements & Alertes & Synthèse
  async listMovements(req, res, next) {
    try {
      const movements = await stockService.getMovements(req.query);
      return success(res, movements, 'Journal des mouvements de stock');
    } catch (err) { next(err); }
  }

  async getAlerts(req, res, next) {
    try {
      const alerts = await stockService.getLowStockAlerts();
      return success(res, alerts, 'Alertes de stock bas');
    } catch (err) { next(err); }
  }

  async getSummary(req, res, next) {
    try {
      const summary = await stockService.getStockSummary();
      return success(res, summary, 'Synthèse financière et état du stock');
    } catch (err) { next(err); }
  }

  async transfer(req, res, next) {
    try {
      const result = await stockService.transferStock(req.body, req.user?.id);
      return success(res, result, result.message);
    } catch (err) { next(err); }
  }
}

module.exports = new StockController();
