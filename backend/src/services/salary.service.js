const { Salary, User, Role } = require('../models');

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

class SalaryService {
  _inc() {
    return [{ model: User, as: 'employee', attributes: ['id', 'full_name', 'email'], include: [{ model: Role, as: 'role', attributes: ['role_name'] }] }];
  }
  async getAll(filters = {}) {
    const where = {};
    if (filters.user_id) where.user_id = filters.user_id;
    if (filters.status) where.status = filters.status;
    return Salary.findAll({ where, include: this._inc(), order: [['period_year', 'DESC'], ['period_month', 'DESC']] });
  }
  // Salaires de l'utilisateur connecté (espace employé)
  getMine(userId) {
    return Salary.findAll({ where: { user_id: userId }, order: [['period_year', 'DESC'], ['period_month', 'DESC']] });
  }
  async getById(id) {
    const s = await Salary.findByPk(id, { include: this._inc() });
    if (!s) throw Object.assign(new Error('Salaire introuvable'), { status: 404 });
    return s;
  }
  create(data) {
    if (data.status === 'paid' && !data.paid_date) data.paid_date = new Date().toISOString().slice(0, 10);
    return Salary.create(data);
  }
  async update(id, data) {
    const s = await Salary.findByPk(id);
    if (!s) throw Object.assign(new Error('Salaire introuvable'), { status: 404 });
    if (data.status === 'paid' && !s.paid_date && !data.paid_date) data.paid_date = new Date().toISOString().slice(0, 10);
    await s.update(data); return this.getById(id);
  }
  async remove(id) {
    const s = await Salary.findByPk(id);
    if (!s) throw Object.assign(new Error('Salaire introuvable'), { status: 404 });
    await s.destroy(); return true;
  }
  async attachProof(id, photoPath) {
    const s = await Salary.findByPk(id);
    if (!s) throw Object.assign(new Error('Salaire introuvable'), { status: 404 });
    s.proof_photo = photoPath; await s.save(); return s;
  }
}
module.exports = new SalaryService();
