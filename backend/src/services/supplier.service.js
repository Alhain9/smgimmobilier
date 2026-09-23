// ============ Service Fournisseurs — SMG IMMOBILIER ============
const { Supplier, StockPurchase } = require('../models');

class SupplierService {
  async getAll(filters = {}) {
    const where = {};
    if (filters.category) where.category = filters.category;
    if (filters.is_active != null) where.is_active = filters.is_active;

    return Supplier.findAll({
      where,
      include: [{
        model: StockPurchase, as: 'purchases',
        attributes: ['id', 'purchase_number', 'total_amount', 'purchase_date', 'status'],
      }],
      order: [['name', 'ASC']],
    });
  }

  async getById(id) {
    const supplier = await Supplier.findByPk(id, {
      include: [{
        model: StockPurchase, as: 'purchases',
        attributes: ['id', 'purchase_number', 'total_amount', 'purchase_date', 'status', 'invoice_number'],
      }],
    });
    if (!supplier) throw Object.assign(new Error('Fournisseur introuvable'), { status: 404 });
    return supplier;
  }

  async create(data) {
    return Supplier.create(data);
  }

  async update(id, data) {
    const supplier = await this.getById(id);
    await supplier.update(data);
    return supplier;
  }

  async remove(id) {
    const supplier = await this.getById(id);
    await supplier.destroy();
    return true;
  }
}

module.exports = new SupplierService();
