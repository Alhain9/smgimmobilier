const { CalendarEvent, CalendarEventParticipant, User, Task, Role } = require('../models');
const { Op } = require('sequelize');

const EVENT_INCLUDES = [
  { model: User, as: 'creator', attributes: ['id', 'full_name'] },
  { model: Task, as: 'task', attributes: ['id', 'title'] },
  { model: User, as: 'participants', attributes: ['id', 'full_name'], through: { attributes: [] } },
];

class CalendarService {
  // Détermine les utilisateurs dont le calendrier est visible par `user`
  async _visibleOwnerIds(user) {
    // super_admin voit tout le monde (y compris le manager)
    // manager voit tout le monde (y compris lui-même)
    if (user.role === 'super_admin' || user.role === 'manager') {
      const all = await User.findAll({ attributes: ['id'] });
      return all.map((u) => u.id);
    }
    // Délégué "adjoint DG" : tout le monde sauf le manager (calendrier privé)
    if (user.can_view_all_calendars) {
      const managerRole = await Role.findOne({ where: { role_name: Role.codeToName('manager') } });
      const where = managerRole ? { role_id: { [Op.ne]: managerRole.id } } : {};
      const users = await User.findAll({ where, attributes: ['id'] });
      return users.map((u) => u.id);
    }
    // Gestionnaire / Directeur Technique : leur calendrier + ceux des techniciens
    if (user.role === 'gestionnaire' || user.role === 'dir_technique') {
      const ids = [user.id];
      const techRole = await Role.findOne({ where: { role_name: Role.codeToName('technicien') } });
      if (techRole) {
        const techs = await User.findAll({ where: { role_id: techRole.id }, attributes: ['id'] });
        ids.push(...techs.map((u) => u.id));
      }
      return ids;
    }
    // Par défaut : uniquement son propre calendrier
    return [user.id];
  }

  async _participantEventIds(userId) {
    const rows = await CalendarEventParticipant.findAll({ where: { user_id: userId }, attributes: ['event_id'] });
    return rows.map((r) => r.event_id);
  }

  async getAll(filters = {}, currentUser) {
    const ownerIds = await this._visibleOwnerIds(currentUser);
    const conditions = [];

    if (filters.owner_id) {
      const ownerId = Number(filters.owner_id);
      if (ownerId !== currentUser.id && !ownerIds.includes(ownerId)) {
        throw Object.assign(new Error('Ce calendrier n\'est pas accessible'), { status: 403 });
      }
      const or = [{ created_by: ownerId }];
      if (ownerId === currentUser.id) {
        const participantEventIds = await this._participantEventIds(currentUser.id);
        if (participantEventIds.length) or.push({ id: { [Op.in]: participantEventIds } });
      }
      conditions.push({ [Op.or]: or });
    } else {
      const or = [{ created_by: { [Op.in]: ownerIds } }];
      const participantEventIds = await this._participantEventIds(currentUser.id);
      if (participantEventIds.length) or.push({ id: { [Op.in]: participantEventIds } });
      conditions.push({ [Op.or]: or });
    }

    if (filters.start && filters.end) conditions.push({ start_datetime: { [Op.between]: [filters.start, filters.end] } });

    return CalendarEvent.findAll({
      where: conditions.length ? { [Op.and]: conditions } : {},
      include: EVENT_INCLUDES,
      order: [['start_datetime', 'ASC']],
    });
  }

  async getById(id) {
    const e = await CalendarEvent.findByPk(id, { include: EVENT_INCLUDES });
    if (!e) throw Object.assign(new Error('Événement introuvable'), { status: 404 });
    return e;
  }

  async create(data, currentUser) {
    const isMeeting = !!data.is_meeting;
    const event = await CalendarEvent.create({
      title: data.title,
      description: data.description ? data.description.trim() : null,
      start_datetime: data.start_datetime,
      end_datetime: data.end_datetime || null,
      task_id: data.task_id || null,
      created_by: currentUser.id,
      is_meeting: isMeeting,
    });
    if (isMeeting && Array.isArray(data.participant_ids) && data.participant_ids.length) {
      const rows = [...new Set(data.participant_ids.map(Number))]
        .filter((id) => id !== currentUser.id)
        .map((user_id) => ({ event_id: event.id, user_id }));
      if (rows.length) await CalendarEventParticipant.bulkCreate(rows);
    }
    return this.getById(event.id);
  }

  async update(id, data, currentUser) {
    const e = await CalendarEvent.findByPk(id);
    if (!e) throw Object.assign(new Error('Événement introuvable'), { status: 404 });
    if (e.created_by !== currentUser.id && !['manager', 'super_admin'].includes(currentUser.role)) {
      throw Object.assign(new Error('Action non autorisée'), { status: 403 });
    }
    const isMeeting = data.is_meeting !== undefined ? !!data.is_meeting : e.is_meeting;
    await e.update({
      title: data.title !== undefined ? data.title : e.title,
      description: data.description !== undefined ? (data.description ? data.description.trim() : null) : e.description,
      start_datetime: data.start_datetime !== undefined ? data.start_datetime : e.start_datetime,
      end_datetime: data.end_datetime !== undefined ? data.end_datetime : e.end_datetime,
      is_meeting: isMeeting,
    });
    if (Array.isArray(data.participant_ids)) {
      await CalendarEventParticipant.destroy({ where: { event_id: e.id } });
      const rows = [...new Set(data.participant_ids.map(Number))]
        .filter((uid) => uid !== e.created_by)
        .map((user_id) => ({ event_id: e.id, user_id }));
      if (rows.length) await CalendarEventParticipant.bulkCreate(rows);
    }
    return this.getById(e.id);
  }

  async remove(id, currentUser) {
    const e = await CalendarEvent.findByPk(id);
    if (!e) throw Object.assign(new Error('Événement introuvable'), { status: 404 });
    if (!['manager', 'super_admin'].includes(currentUser.role)) {
      throw Object.assign(new Error('Seul le manager a l\'autorisation de supprimer un événement'), { status: 403 });
    }
    await e.destroy();
    return true;
  }

  // Utilisateurs dont le calendrier peut être consulté par currentUser (sélecteur),
  // ou (forMeeting=true) tout le personnel pouvant être invité à une réunion
  async getVisibleUsers(currentUser, { forMeeting = false } = {}) {
    if (forMeeting) {
      const locataireRole = await Role.findOne({ where: { role_name: Role.codeToName('locataire') } });
      const where = { id: { [Op.ne]: currentUser.id } };
      if (locataireRole) where.role_id = { [Op.ne]: locataireRole.id };
      const users = await User.findAll({ where, attributes: ['id', 'full_name'], order: [['full_name', 'ASC']] });
      return users.map((u) => ({ id: u.id, full_name: u.full_name }));
    }
    const ownerIds = (await this._visibleOwnerIds(currentUser)).filter((id) => id !== currentUser.id);
    if (!ownerIds.length) return [];
    const users = await User.findAll({ where: { id: { [Op.in]: ownerIds } }, attributes: ['id', 'full_name'], order: [['full_name', 'ASC']] });
    return users.map((u) => ({ id: u.id, full_name: u.full_name }));
  }
}
module.exports = new CalendarService();
