const { Expense, Maintenance, User } = require('../models');

class ExpenseService {
  getAll() {
    return Expense.findAll({
      include: [
        { model: Maintenance, as: 'maintenance', attributes: ['id', 'title'] },
        { model: User, as: 'creator', attributes: ['id', 'full_name'] },
      ],
      order: [['created_at', 'DESC']],
    });
  }
  async getById(id) {
    const e = await Expense.findByPk(id, { include: [{ model: Maintenance, as: 'maintenance' }] });
    if (!e) throw Object.assign(new Error('Dépense introuvable'), { status: 404 });
    return e;
  }
  async create(data) {
    const e = await Expense.create(data);
    await e.reload(); // recharge la colonne générée total_price
    return e;
  }
  async update(id, data) {
    const e = await Expense.findByPk(id);
    if (!e) throw Object.assign(new Error('Dépense introuvable'), { status: 404 });
    delete data.total_price;
    await e.update(data); return this.getById(id);
  }
  async remove(id) {
    const e = await Expense.findByPk(id);
    if (!e) throw Object.assign(new Error('Dépense introuvable'), { status: 404 });
    await e.destroy(); return true;
  }
}
module.exports = new ExpenseService();
