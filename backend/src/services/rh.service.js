// ============ Service de Gestion des Ressources Humaines (RH) ============
const { Service, Equipe, Planning, Pointage, Conge, User, Role } = require('../models');
const { Op } = require('sequelize');
const { logger } = require('../config/logger');
const { emit } = require('../config/socket');

class RhService {
  // ================= SERVICES =================
  async listServices() {
    return Service.findAll({ order: [['name', 'ASC']] });
  }

  async getService(id) {
    const s = await Service.findByPk(id, { include: [{ model: Equipe, as: 'equipes' }] });
    if (!s) throw Object.assign(new Error('Service introuvable'), { status: 404 });
    return s;
  }

  async createService(data) {
    return Service.create(data);
  }

  async updateService(id, data) {
    const s = await Service.findByPk(id);
    if (!s) throw Object.assign(new Error('Service introuvable'), { status: 404 });
    return s.update(data);
  }

  async deleteService(id) {
    const s = await Service.findByPk(id);
    if (!s) throw Object.assign(new Error('Service introuvable'), { status: 404 });
    await s.destroy();
    return true;
  }

  // ================= EQUIPES =================
  async listEquipes() {
    return Equipe.findAll({ include: [{ model: Service, as: 'service', attributes: ['id', 'name'] }], order: [['name', 'ASC']] });
  }

  async getEquipe(id) {
    const eq = await Equipe.findByPk(id, {
      include: [
        { model: Service, as: 'service' },
        { model: User, as: 'users', attributes: ['id', 'full_name', 'email'] }
      ]
    });
    if (!eq) throw Object.assign(new Error('Équipe introuvable'), { status: 404 });
    return eq;
  }

  async createEquipe(data) {
    return Equipe.create(data);
  }

  async updateEquipe(id, data) {
    const eq = await Equipe.findByPk(id);
    if (!eq) throw Object.assign(new Error('Équipe introuvable'), { status: 404 });
    return eq.update(data);
  }

  async deleteEquipe(id) {
    const eq = await Equipe.findByPk(id);
    if (!eq) throw Object.assign(new Error('Équipe introuvable'), { status: 404 });
    await eq.destroy();
    return true;
  }

  // ================= PLANNINGS =================
  async listPlannings(filters = {}) {
    const where = {};
    if (filters.user_id) where.user_id = filters.user_id;
    if (filters.start && filters.end) {
      where.start_datetime = { [Op.between]: [filters.start, filters.end] };
    }
    return Planning.findAll({
      where,
      include: [
        { model: User, as: 'employee', attributes: ['id', 'full_name'] },
        { model: User, as: 'creator', attributes: ['id', 'full_name'] }
      ],
      order: [['start_datetime', 'ASC']]
    });
  }

  async createPlanning(data, creatorId) {
    const p = await Planning.create({ ...data, created_by: creatorId });
    try {
      emit('planning:nouveau', { id: p.id, title: p.title, userId: p.user_id }, { userId: p.user_id, role: ['super_admin', 'manager'] });
    } catch (_) {}
    return p;
  }

  async updatePlanning(id, data) {
    const p = await Planning.findByPk(id);
    if (!p) throw Object.assign(new Error('Planning introuvable'), { status: 404 });
    await p.update(data);
    return p;
  }

  async deletePlanning(id) {
    const p = await Planning.findByPk(id);
    if (!p) throw Object.assign(new Error('Planning introuvable'), { status: 404 });
    await p.destroy();
    return true;
  }

  async bulkDeletePlannings(ids) {
    if (!Array.isArray(ids) || !ids.length) return 0;
    return Planning.destroy({ where: { id: { [Op.in]: ids } } });
  }

  // ================= POINTAGES =================
  async listPointages(filters = {}) {
    const where = {};
    if (filters.user_id) where.user_id = filters.user_id;
    if (filters.start && filters.end) {
      where.entry_time = { [Op.between]: [`${filters.start} 00:00:00`, `${filters.end} 23:59:59`] };
    }
    return Pointage.findAll({
      where,
      include: [{ model: User, as: 'employee', attributes: ['id', 'full_name'] }],
      order: [['entry_time', 'DESC']]
    });
  }

  async pointageEntree(userId, notes = '') {
    // Vérifier si un pointage est déjà en cours
    const active = await Pointage.findOne({
      where: { user_id: userId, exit_time: null },
      order: [['entry_time', 'DESC']]
    });

    if (active) {
      throw Object.assign(new Error('Vous avez déjà pointé à l\'entrée.'), { status: 400 });
    }

    const now = new Date();
    // Déterminer le statut (ex: en retard après 9h)
    let status = 'present';
    const limit = new Date();
    limit.setHours(9, 15, 0, 0); // 9h15 max
    if (now > limit) {
      status = 'late';
    }

    const pt = await Pointage.create({
      user_id: userId,
      entry_time: now,
      status,
      notes
    });

    // Mettre à jour is_present sur l'user
    await User.update({ is_present: true, last_attendance_at: now }, { where: { id: userId } });

    try {
      emit('pointage:entree', { id: pt.id, status, userId }, { role: ['super_admin', 'manager'] });
    } catch (_) {}

    return pt;
  }

  async pointageSortie(userId, notes = '') {
    const active = await Pointage.findOne({
      where: { user_id: userId, exit_time: null },
      order: [['entry_time', 'DESC']]
    });

    if (!active) {
      throw Object.assign(new Error('Aucun pointage d\'entrée actif trouvé.'), { status: 400 });
    }

    const now = new Date();
    await active.update({
      exit_time: now,
      notes: active.notes ? `${active.notes} | Sortie: ${notes}` : notes
    });

    // Mettre à jour is_present sur l'user
    await User.update({ is_present: false }, { where: { id: userId } });

    try {
      emit('pointage:sortie', { id: active.id, userId }, { role: ['super_admin', 'manager'] });
    } catch (_) {}

    return active;
  }

  // ================= CONGES =================
  async listConges(filters = {}) {
    const where = {};
    if (filters.user_id) where.user_id = filters.user_id;
    if (filters.status) where.status = filters.status;
    return Conge.findAll({
      where,
      include: [
        { model: User, as: 'employee', attributes: ['id', 'full_name'] },
        { model: User, as: 'approver', attributes: ['id', 'full_name'] }
      ],
      order: [['created_at', 'DESC']]
    });
  }

  async createConge(data) {
    const c = await Conge.create(data);
    try {
      emit('conge:nouveau', { id: c.id, userId: c.user_id, status: c.status }, { role: ['super_admin', 'manager', 'comptable'] });
    } catch (_) {}
    return c;
  }

  async updateConge(id, data, approverId = null) {
    const c = await Conge.findByPk(id);
    if (!c) throw Object.assign(new Error('Congé introuvable'), { status: 404 });

    const patch = { ...data };
    if (data.status && data.status !== 'pending') {
      patch.approved_by = approverId;
    }

    await c.update(patch);

    try {
      emit('conge:modifie', { id: c.id, userId: c.user_id, status: c.status }, { userId: c.user_id, role: ['super_admin', 'manager'] });
    } catch (_) {}

    return c;
  }

  async deleteConge(id) {
    const c = await Conge.findByPk(id);
    if (!c) throw Object.assign(new Error('Congé introuvable'), { status: 404 });
    await c.destroy();
    return true;
  }

  async bulkDeleteConges(ids) {
    if (!Array.isArray(ids) || !ids.length) return 0;
    return Conge.destroy({ where: { id: { [Op.in]: ids } } });
  }
}

module.exports = new RhService();
