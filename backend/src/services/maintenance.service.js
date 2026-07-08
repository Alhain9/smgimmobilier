const { Maintenance, Apartment, User, MaintenanceImage, Property, Tenant, Expense, Task } = require('../models');
const notificationService = require('./notification.service');
const { emitMaintenance, emitDashboard, emitNotification } = require('../config/socket');
const { logger } = require('../config/logger');

class MaintenanceService {
  _inc() {
    return [
      { model: Apartment, as: 'apartment', include: [{ model: Property, as: 'property', attributes: ['id', 'property_name', 'city', 'district'] }] },
      { model: User, as: 'technician', attributes: ['id', 'full_name'] },
      { model: User, as: 'team', attributes: ['id', 'full_name'], through: { attributes: [] } },
    ];
  }
  getAll(filters = {}) {
    const where = {};
    if (filters.status) where.status = filters.status;
    if (filters.assigned_technician_id) where.assigned_technician_id = filters.assigned_technician_id;
    return Maintenance.findAll({ where, include: this._inc(), order: [['created_at', 'DESC']] });
  }
  async getById(id) {
    const m = await Maintenance.findByPk(id, {
      include: [
        ...this._inc(),
        { model: MaintenanceImage, as: 'images', separate: true },
        { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }] },
        { model: Expense, as: 'expenses', separate: true, include: [{ model: User, as: 'creator', attributes: ['id', 'full_name'] }] },
        { model: Task, as: 'tasks', separate: true, include: [{ model: User, as: 'assignee', attributes: ['id', 'full_name'] }] },
      ],
    });
    if (!m) throw Object.assign(new Error('Maintenance introuvable'), { status: 404 });
    return m;
  }
  // Définit l'équipe de techniciens d'un chantier (remplace l'existante) + notifie
  async setTeam(id, userIds) {
    const m = await Maintenance.findByPk(id);
    if (!m) throw Object.assign(new Error('Maintenance introuvable'), { status: 404 });
    const ids = [...new Set((userIds || []).map(Number).filter(Boolean))];
    await m.setTeam(ids);
    // Si aucun technicien principal défini, prendre le premier de l'équipe
    if (!m.assigned_technician_id && ids.length) {
      m.assigned_technician_id = ids[0];
      if (m.status === 'reported') m.status = 'in_progress';
      await m.save();
    }
    for (const uid of ids) {
      try {
        await notificationService.create({
          user_id: uid,
          title: 'Affectation à un chantier',
          message: `Vous faites partie de l'équipe du chantier « ${m.title} ».`,
        });
      } catch (_) { /* non bloquant */ }
    }
    return this.getById(id);
  }
  async create(data) {
    const m = await Maintenance.create(data);
    try {
      const full = await this.getById(m.id);
      const propId = full.apartment?.property?.id;
      emitMaintenance('nouvelle', { id: m.id, title: m.title, status: m.status }, propId);
      emitDashboard();
    } catch (_) {}
    logger.info('Maintenance créée', { maintenanceId: m.id, title: m.title });
    return m;
  }
  async update(id, data) {
    const m = await Maintenance.findByPk(id);
    if (!m) throw Object.assign(new Error('Maintenance introuvable'), { status: 404 });
    if (data.status === 'completed' && !m.completed_at) data.completed_at = new Date();
    const oldStatus = m.status;
    await m.update(data);
    try {
      const full = await this.getById(id);
      const propId = full.apartment?.property?.id;
      if (data.status && data.status !== oldStatus) {
        emitMaintenance('statut_change', { id: m.id, title: m.title, oldStatus, newStatus: data.status }, propId);
      } else {
        emitMaintenance('modifiee', { id: m.id, title: m.title }, propId);
      }
      emitDashboard();
    } catch (_) {}
    logger.info('Maintenance mise à jour', { maintenanceId: id, status: m.status });
    return this.getById(id);
  }
  async assign(id, technicianId) {
    const m = await Maintenance.findByPk(id);
    if (!m) throw Object.assign(new Error('Maintenance introuvable'), { status: 404 });
    m.assigned_technician_id = technicianId;
    if (m.status === 'reported') m.status = 'in_progress';
    await m.save();
    // Notifie le technicien assigné
    try {
      await notificationService.create({
        user_id: technicianId,
        title: 'Nouvelle intervention assignée',
        message: `La maintenance « ${m.title} » vous a été assignée.`,
      });
    } catch (_) { /* non bloquant */ }
    return this.getById(id);
  }
  async remove(id) {
    const m = await Maintenance.findByPk(id);
    if (!m) throw Object.assign(new Error('Maintenance introuvable'), { status: 404 });
    await m.destroy(); return true;
  }
  addImage(maintenanceId, imageUrl, type) {
    return MaintenanceImage.create({ maintenance_id: maintenanceId, image_url: imageUrl, image_type: type });
  }
}
module.exports = new MaintenanceService();
