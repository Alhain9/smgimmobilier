const { Task, User, Maintenance, Property, Apartment, Worksite, TaskHistory } = require('../models');
const { Op } = require('sequelize');
const workPlanPdfService = require('./workplan-pdf.service');

const MGMT = ['super_admin', 'manager', 'dir_admin', 'dir_technique', 'gestionnaire', 'comptable'];
const STATUT_FR = {
  pending: 'À faire', in_progress: 'En cours', completed: 'Effectuée',
  not_done: 'Non effectuée', cancelled: 'Annulée',
};

class TaskService {
  _inc() {
    return [
      { model: User, as: 'assignee', attributes: ['id', 'full_name', 'phone'] },
      { model: User, as: 'creator', attributes: ['id', 'full_name'] },
      { model: Property, as: 'property', attributes: ['id', 'property_name', 'city', 'address'] },
      { model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number', 'apartment_type', 'property_id'] },
      { model: Worksite, as: 'worksite', attributes: ['id', 'title', 'location', 'property_id'] },
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

  async getAll(filters = {}) {
    const where = {};
    if (filters.assigned_to) where.assigned_to = filters.assigned_to;
    if (filters.status && filters.status !== 'all') where.status = filters.status;
    if (filters.priority && filters.priority !== 'all') where.priority = filters.priority;

    // Filtre par Immeuble(s) et/ou Chantier(s) sélectionnés
    const rawProps = filters.property_ids || filters.property_id;
    const rawWorks = filters.worksite_ids || filters.worksite_id;
    const pIds = (rawProps && rawProps !== 'all')
      ? (Array.isArray(rawProps) ? rawProps : String(rawProps).split(',').map((s) => Number(s.trim())).filter(Boolean))
      : [];
    const wIds = (rawWorks && rawWorks !== 'all')
      ? (Array.isArray(rawWorks) ? rawWorks : String(rawWorks).split(',').map((s) => Number(s.trim())).filter(Boolean))
      : [];

    if (pIds.length > 0 && wIds.length > 0) {
      // Les deux sont sélectionnés : Union des tâches des immeubles choisis OU des chantiers choisis
      where[Op.and] = [
        ...(where[Op.and] || []),
        {
          [Op.or]: [
            { property_id: { [Op.in]: pIds } },
            { worksite_id: { [Op.in]: wIds } },
          ],
        },
      ];
    } else if (pIds.length > 0) {
      if (pIds.length === 1) where.property_id = pIds[0];
      else where.property_id = { [Op.in]: pIds };
    } else if (wIds.length > 0) {
      if (wIds.length === 1) where.worksite_id = wIds[0];
      else where.worksite_id = { [Op.in]: wIds };
    }

    // Filtre par Appartement(s)
    if (filters.apartment_id && filters.apartment_id !== 'all') {
      where.apartment_id = filters.apartment_id;
    }

    // Filtre par Ville / Groupe (ex: Yaoundé, Douala, etc.)
    const cityGroup = (filters.city || filters.group || '').trim();
    if (cityGroup && cityGroup.toLowerCase() !== 'all' && cityGroup.toLowerCase() !== 'tous' && cityGroup.toLowerCase() !== 'global') {
      // Trouver tous les immeubles correspondant à cette ville / ce groupe
      const matchingProps = await Property.findAll({
        where: {
          [Op.or]: [
            { city: { [Op.like]: `%${cityGroup}%` } },
            { address: { [Op.like]: `%${cityGroup}%` } },
            { property_name: { [Op.like]: `%${cityGroup}%` } },
          ],
        },
        attributes: ['id'],
      }).catch(() => []);
      const pIds = matchingProps.map((p) => p.id);

      // Trouver tous les chantiers dans cette ville
      const matchingWorksites = await Worksite.findAll({
        where: {
          [Op.or]: [
            { location: { [Op.like]: `%${cityGroup}%` } },
            { title: { [Op.like]: `%${cityGroup}%` } },
            ...(pIds.length ? [{ property_id: { [Op.in]: pIds } }] : []),
          ],
        },
        attributes: ['id'],
      }).catch(() => []);
      const wIds = matchingWorksites.map((w) => w.id);

      const cityOrConditions = [
        { location_zone: { [Op.like]: `%${cityGroup}%` } },
      ];
      if (pIds.length) cityOrConditions.push({ property_id: { [Op.in]: pIds } });
      if (wIds.length) cityOrConditions.push({ worksite_id: { [Op.in]: wIds } });

      where[Op.and] = [
        ...(where[Op.and] || []),
        { [Op.or]: cityOrConditions },
      ];
    }

    if (filters.search) {
      const q = `%${filters.search.trim()}%`;
      where[Op.or] = [
        { title: { [Op.like]: q } },
        { nature_probleme: { [Op.like]: q } },
        { location_zone: { [Op.like]: q } },
        { observation: { [Op.like]: q } },
        { description: { [Op.like]: q } },
      ];
    }

    const sDate = filters.start_date || filters.period_start;
    const eDate = filters.end_date || filters.period_end;
    if (sDate && eDate) {
      where[Op.and] = [
        ...(where[Op.and] || []),
        {
          [Op.or]: [
            { start_date: { [Op.between]: [new Date(`${sDate} 00:00:00`), new Date(`${eDate} 23:59:59`)] } },
            { period_start: { [Op.between]: [sDate, eDate] } },
            { period_end: { [Op.between]: [sDate, eDate] } },
            { created_at: { [Op.between]: [new Date(`${sDate} 00:00:00`), new Date(`${eDate} 23:59:59`)] } },
          ],
        },
      ];
    }

    return Task.findAll({
      where,
      include: this._inc(),
      order: [
        [require('sequelize').literal(`CASE 
          WHEN Task.priority = 'Urgent' THEN 1 
          WHEN Task.priority = 'Rénovation complète' THEN 2 
          WHEN Task.priority = 'Maintenance' THEN 3 
          ELSE 4 END`), 'ASC'],
        ['start_date', 'ASC'],
        ['id', 'DESC'],
      ],
    });
  }

  async getById(id) {
    const t = await Task.findByPk(id, {
      include: [
        ...this._inc(),
        {
          model: TaskHistory, as: 'history',
          include: [{ model: User, as: 'changedBy', attributes: ['id', 'full_name'] }],
        },
      ],
      order: [[{ model: TaskHistory, as: 'history' }, 'created_at', 'DESC']],
    });
    if (!t) throw Object.assign(new Error('Tâche introuvable'), { status: 404 });
    return t;
  }

  _notifyChange() {
    try {
      const { emitDashboard, emit } = require('../config/socket');
      emitDashboard();
      emit('task:updated', { timestamp: new Date().toISOString() }, { global: true });
    } catch (_) {}
  }

  async create(data, user) {
    const payload = { ...data };
    if (!payload.title && payload.nature_probleme) payload.title = payload.nature_probleme;
    if (!payload.title) payload.title = 'Intervention technique';
    if (!payload.created_by && user) payload.created_by = user.id;

    // Si un appartement est sélectionné sans location_zone
    if (payload.apartment_id && !payload.location_zone) {
      const apt = await Apartment.findByPk(payload.apartment_id, { include: [{ model: Property, as: 'property' }] });
      if (apt) {
        payload.location_zone = `${apt.apartment_number}${apt.property ? ` (${apt.property.property_name})` : ''}`;
        if (!payload.property_id && apt.property_id) payload.property_id = apt.property_id;
      }
    }

    // Si un chantier est sélectionné sans location_zone
    if (payload.worksite_id && !payload.location_zone) {
      const ws = await Worksite.findByPk(payload.worksite_id);
      if (ws) {
        payload.location_zone = `Chantier: ${ws.title}${ws.location ? ` (${ws.location})` : ''}`;
        if (!payload.property_id && ws.property_id) payload.property_id = ws.property_id;
      }
    }

    const t = await Task.create(payload);
    await this._log(t.id, 'created', `Tâche créée${t.start_date ? ' (planifiée le ' + new Date(t.start_date).toLocaleString('fr-FR') + ')' : ''}`, t, user, { new_status: t.status });
    this._notifyChange();
    return this.getById(t.id);
  }

  async update(id, data, user) {
    const t = await Task.findByPk(id);
    if (!t) throw Object.assign(new Error('Tâche introuvable'), { status: 404 });
    const old = t.status;
    const payload = { ...data };

    if (payload.status === 'completed' && !payload.observation && !t.observation) {
      payload.observation = 'FAIT';
    }

    await t.update(payload);
    await this._log(id, 'updated', 'Tâche modifiée', t, user, { old_status: old, new_status: t.status });
    this._notifyChange();
    return this.getById(id);
  }

  // L'employé (ou l'encadrement) déclare le statut : en cours / effectuée / non effectuée (+ raison)
  async markStatus(id, status, note, delayJustification, user) {
    if (!['in_progress', 'completed', 'not_done', 'pending', 'cancelled'].includes(status)) {
      throw Object.assign(new Error('Statut invalide'), { status: 400 });
    }
    const t = await Task.findByPk(id);
    if (!t) throw Object.assign(new Error('Tâche introuvable'), { status: 404 });
    if (!this._canAct(t, user)) throw Object.assign(new Error('Action réservée à l\'assigné ou à l\'encadrement'), { status: 403 });
    if (status === 'not_done' && !String(note || '').trim()) {
      throw Object.assign(new Error('Indiquez pourquoi la tâche n\'a pas été effectuée.'), { status: 400 });
    }

    const old = t.status;
    const updateData = {
      status,
      done_at: status === 'completed' ? new Date() : (status === 'not_done' ? new Date() : t.done_at),
      completion_note: note != null ? note : t.completion_note,
      delay_justification: status === 'completed' ? (delayJustification || null) : t.delay_justification,
    };

    if (status === 'completed') {
      updateData.observation = note || t.observation || 'FAIT';
    } else if (note) {
      updateData.observation = note;
    }

    await t.update(updateData);
    const desc = `${STATUT_FR[old]} → ${STATUT_FR[status]}${note ? ' · ' + note : ''}${delayJustification ? ' [Retard: ' + delayJustification + ']' : ''}`;
    await this._log(id, 'status_changed', desc, t, user, { old_status: old, new_status: status });
    this._notifyChange();
    return this.getById(id);
  }

  // Reporter une tâche à une autre heure (motif obligatoire)
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
    this._notifyChange();
    return this.getById(id);
  }

  async remove(id) {
    const t = await Task.findByPk(id);
    if (!t) throw Object.assign(new Error('Tâche introuvable'), { status: 404 });
    await TaskHistory.destroy({ where: { task_id: id } }).catch(() => {});
    await t.destroy();
    this._notifyChange();
    return true;
  }

  async bulkRemove(ids) {
    if (!Array.isArray(ids) || !ids.length) return 0;
    await TaskHistory.destroy({ where: { task_id: { [Op.in]: ids } } }).catch(() => {});
    const count = await Task.destroy({ where: { id: { [Op.in]: ids } } });
    this._notifyChange();
    return count;
  }

  // Génération du Plan de Travail en PDF
  async generateWorkPlanPdf(filters = {}) {
    const tasks = await this.getAll(filters);
    return workPlanPdfService.generate(tasks, filters);
  }

  // Insère l'exemple type fourni par l'utilisateur
  async seedWorkPlanSample(user = null) {
    const samples = [
      { priority: 'Urgent', location_zone: '408', nature_probleme: 'Siphon douche', observation: '', status: 'pending' },
      { priority: 'Normal', location_zone: '517', nature_probleme: 'Electricité', observation: '', status: 'pending' },
      { priority: 'Urgent', location_zone: '514', nature_probleme: 'Climatisation', observation: 'Lui fixer une date', status: 'pending' },
      { priority: 'Normal', location_zone: '508', nature_probleme: 'Moisissures', observation: '', status: 'pending' },
      { priority: 'Normal', location_zone: '520', nature_probleme: 'Humidité', observation: '', status: 'pending' },
      { priority: 'Normal', location_zone: '106', nature_probleme: 'Peinture', observation: '', status: 'pending' },
      { priority: 'Maintenance', location_zone: '413', nature_probleme: 'Revêtement couloir', observation: '', status: 'pending' },
      { priority: 'Maintenance', location_zone: '410', nature_probleme: 'Revêtement couloir', observation: '', status: 'pending' },
      { priority: 'Maintenance', location_zone: '407', nature_probleme: 'Revêtement couloir', observation: '', status: 'pending' },
      { priority: 'Maintenance', location_zone: '404', nature_probleme: 'Revêtement couloir', observation: '', status: 'pending' },
      { priority: 'Normal', location_zone: '405', nature_probleme: 'Revêtement Plafond douche principale', observation: 'Travail inachevé', status: 'in_progress' },
      { priority: 'Normal', location_zone: '608', nature_probleme: 'Plomberie', observation: '', status: 'pending' },
      { priority: 'Urgent', location_zone: '519', nature_probleme: 'Toit est défectueux', observation: '', status: 'pending' },
      { priority: 'Urgent', location_zone: '518', nature_probleme: 'Toit est défectueux, Humidité, Plomberie et Electricité', observation: '', status: 'pending' },
      { priority: 'Maintenance', location_zone: '511', nature_probleme: 'Humidité mur du couloir', observation: '', status: 'pending' },
      { priority: 'Urgent', location_zone: '716', nature_probleme: 'Plomberie et Humidité', observation: '', status: 'pending' },
      { priority: 'Maintenance', location_zone: '611', nature_probleme: 'Plafond à revoir', observation: '', status: 'pending' },
      { priority: 'Maintenance', location_zone: '517', nature_probleme: 'Plomberie/Cadenas/serrure', observation: '', status: 'pending' },
      { priority: 'Maintenance', location_zone: '706', nature_probleme: 'Ponçage et Peinture', observation: '', status: 'pending' },
      { priority: 'Maintenance', location_zone: '102', nature_probleme: 'Humidité, plomberie, étanchéité', observation: '', status: 'pending' },
      { priority: 'Normal', location_zone: '713', nature_probleme: 'Mécanisme à changer, problème de bouton de chasse des toilettes, Serrure de la chambre', observation: '', status: 'pending' },
      { priority: 'Urgent', location_zone: '614', nature_probleme: 'Ecoulement d’eau sur le toit', observation: '', status: 'pending' },
      { priority: 'Normal', location_zone: '209', nature_probleme: 'Prise expose, bidet suinte', observation: 'Elle veut la main d’œuvre', status: 'pending' },
      { priority: 'Normal', location_zone: '503', nature_probleme: 'Peinture, Plomberie humidité sur les murs, moisissures', observation: '', status: 'pending' },
      { priority: 'Urgent', location_zone: '107', nature_probleme: 'Etanchéité et trou à combler cela dégrade la peinture a 106', observation: '', status: 'pending' },
      { priority: 'Maintenance', location_zone: '205', nature_probleme: 'Plomberie', observation: '', status: 'pending' },
      { priority: 'Normal', location_zone: 'Zone Pavés', nature_probleme: 'Pavage de roche', observation: 'Terminée de posés les paves à la roche', status: 'completed' },
      { priority: 'Rénovation complète', location_zone: '210', nature_probleme: 'Peinture, Plomberie, électricité', observation: '', status: 'pending' },
      { priority: 'Maintenance', location_zone: '204', nature_probleme: 'Electricité(Réglette, Prise)', observation: '', status: 'pending' },
      { priority: 'Maintenance', location_zone: '302', nature_probleme: 'Electricité (Prise), Tuyau de canalisation dans la douche suinte, Siphon sol de douche bouché', observation: '', status: 'pending' },
      { priority: 'Urgent', location_zone: '402', nature_probleme: 'Compteur électrique défectueux', observation: '', status: 'pending' },
      { priority: 'Urgent', location_zone: '306', nature_probleme: 'Interface de compteur pas disponible, Siphon de cuisine défectueux', observation: '', status: 'pending' },
      { priority: 'Urgent', location_zone: '720', nature_probleme: 'Interface de compteur pas défectueux', observation: '', status: 'pending' },
      { priority: 'Maintenance', location_zone: '708, 602', nature_probleme: 'Installation de porte rideaux', observation: '', status: 'pending' },
      { priority: 'Maintenance', location_zone: '413', nature_probleme: 'Vitre fenêtre de cuisine défectueux', observation: '', status: 'pending' },
      { priority: 'Rénovation complète', location_zone: '402', nature_probleme: 'Peinture, Plomberie, électricité', observation: '', status: 'pending' },
      { priority: 'Urgent', location_zone: '201', nature_probleme: 'Plomberie(tout le système de travaux à changer)', observation: '', status: 'pending' },
      { priority: 'Urgent', location_zone: 'Immeuble l’AGAPE', nature_probleme: 'Fuite d’eau excessive', observation: '', status: 'pending' },
      { priority: 'Maintenance', location_zone: 'Immeuble l’AGAPE', nature_probleme: 'Sécurisation de gaine technique pour empêches les locataires d’y accéder.', observation: '', status: 'pending' },
      { priority: 'Maintenance', location_zone: '503', nature_probleme: 'Plomberie(Robinet de lavabo défectueux)', observation: 'FAIT', status: 'completed' },
    ];

    const created = [];
    for (const s of samples) {
      const t = await Task.create({
        title: s.nature_probleme,
        nature_probleme: s.nature_probleme,
        location_zone: s.location_zone,
        priority: s.priority,
        observation: s.observation,
        status: s.status,
        created_by: user ? user.id : null,
        period_start: '2026-09-26',
        period_end: '2026-10-30',
        start_date: new Date('2026-09-26T08:00:00'),
        end_date: new Date('2026-10-30T18:00:00'),
      });
      created.push(t);
    }
    return { count: created.length, tasks: created };
  }
}

module.exports = new TaskService();
