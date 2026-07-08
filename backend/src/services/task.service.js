const { Task, User, Maintenance, TaskHistory } = require('../models');

const MGMT = ['super_admin', 'manager', 'dir_admin', 'dir_technique', 'gestionnaire'];
const STATUT_FR = {
  pending: 'À faire', in_progress: 'En cours', completed: 'Effectuée',
  not_done: 'Non effectuée', cancelled: 'Annulée',
};

class TaskService {
  _inc() {
    return [
      { model: User, as: 'assignee', attributes: ['id', 'full_name', 'phone'] },
      { model: User, as: 'creator', attributes: ['id', 'full_name'] },
      { model: Maintenance, as: 'maintenance', attributes: ['id', 'title'] },
    ];
  }

  // L'assigné OU un rôle d'encadrement peut agir sur une tâche
  _canAct(task, user) {
    if (!user) return false;
    return MGMT.includes(user.role) || String(task.assigned_to) === String(user.id);
  }
  async _log(taskId, action, description, task, user, extra = {}) {
    try {
      await TaskHistory.create({
        task_id: taskId, action, description,
        old_status: extra.old_status || null, new_status: extra.new_status || (task ? task.status : null),
        scheduled_at: task ? task.start_date : null, changed_by: user ? user.id : null,
      });
    } catch (_) { /* non bloquant */ }
  }

  getAll(filters = {}) {
    const where = {};
    if (filters.assigned_to) where.assigned_to = filters.assigned_to;
    if (filters.status) where.status = filters.status;
    return Task.findAll({ where, include: this._inc(), order: [['start_date', 'ASC']] });
  }
  async getById(id) {
    const t = await Task.findByPk(id, {
      include: [...this._inc(), { model: TaskHistory, as: 'history', include: [{ model: User, as: 'changedBy', attributes: ['id', 'full_name'] }] }],
      order: [[{ model: TaskHistory, as: 'history' }, 'created_at', 'DESC']],
    });
    if (!t) throw Object.assign(new Error('Tâche introuvable'), { status: 404 });
    return t;
  }

  async create(data, user) {
    const t = await Task.create(data);
    await this._log(t.id, 'created', `Tâche créée${t.start_date ? ' (planifiée le ' + new Date(t.start_date).toLocaleString('fr-FR') + ')' : ''}`, t, user, { new_status: t.status });
    return this.getById(t.id);
  }
  async update(id, data, user) {
    const t = await Task.findByPk(id);
    if (!t) throw Object.assign(new Error('Tâche introuvable'), { status: 404 });
    const old = t.status;
    await t.update(data);
    await this._log(id, 'updated', 'Tâche modifiée', t, user, { old_status: old, new_status: t.status });
    return this.getById(id);
  }

  // L'employé (ou l'encadrement) déclare le statut : en cours / effectuée / non effectuée (+ raison)
  async markStatus(id, status, note, delayJustification, user) {
    if (!['in_progress', 'completed', 'not_done', 'pending'].includes(status)) {
      throw Object.assign(new Error('Statut invalide'), { status: 400 });
    }
    const t = await Task.findByPk(id);
    if (!t) throw Object.assign(new Error('Tâche introuvable'), { status: 404 });
    if (!this._canAct(t, user)) throw Object.assign(new Error('Action réservée à l\'assigné ou à l\'encadrement'), { status: 403 });
    if (status === 'not_done' && !String(note || '').trim()) {
      throw Object.assign(new Error('Indiquez pourquoi la tâche n\'a pas été effectuée.'), { status: 400 });
    }
    
    // Justification de retard obligatoire (> 15 minutes)
    if (status === 'completed') {
      const scheduled = t.start_date ? new Date(t.start_date) : null;
      const now = new Date();
      if (scheduled && (now - scheduled) > 15 * 60 * 1000) {
        if (!delayJustification || !String(delayJustification).trim()) {
          throw Object.assign(new Error('La justification du retard est obligatoire (retard supérieur à 15 minutes).'), { status: 400 });
        }
      }
    }

    const old = t.status;
    await t.update({
      status,
      done_at: status === 'completed' ? new Date() : (status === 'not_done' ? new Date() : t.done_at),
      completion_note: note != null ? note : t.completion_note,
      delay_justification: status === 'completed' ? (delayJustification || null) : t.delay_justification,
    });
    const desc = `${STATUT_FR[old]} → ${STATUT_FR[status]}${note ? ' · ' + note : ''}${delayJustification ? ' [Retard: ' + delayJustification + ']' : ''}`;
    await this._log(id, 'status_changed', desc, t, user, { old_status: old, new_status: status });
    return this.getById(id);
  }

  // Reporter une tâche à une autre heure (motif obligatoire) — traçabilité du décalage
  async reschedule(id, newStart, reason, user) {
    if (!newStart) throw Object.assign(new Error('Nouvelle date/heure requise'), { status: 400 });
    if (!String(reason || '').trim()) throw Object.assign(new Error('Le motif du report est obligatoire.'), { status: 400 });
    const t = await Task.findByPk(id);
    if (!t) throw Object.assign(new Error('Tâche introuvable'), { status: 404 });
    if (!this._canAct(t, user)) throw Object.assign(new Error('Action réservée à l\'assigné ou à l\'encadrement'), { status: 403 });
    const oldStart = t.start_date ? new Date(t.start_date).toLocaleString('fr-FR') : '—';
    await t.update({ start_date: newStart, status: t.status === 'completed' ? t.status : 'pending' });
    const desc = `Reporté de ${oldStart} à ${new Date(newStart).toLocaleString('fr-FR')} · Motif : ${reason}`;
    await this._log(id, 'rescheduled', desc, t, user, { old_status: t.status, new_status: t.status });
    return this.getById(id);
  }

  async remove(id) {
    const t = await Task.findByPk(id);
    if (!t) throw Object.assign(new Error('Tâche introuvable'), { status: 404 });
    await t.destroy(); return true;
  }
}
module.exports = new TaskService();
