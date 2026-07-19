'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import {
  CheckSquare,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Check,
  Clock,
  History,
  Calendar,
  MessageSquare,
  AlertTriangle,
  FileText
} from 'lucide-react';

interface UserOption {
  id: number;
  full_name: string;
}

interface MaintenanceOption {
  id: number;
  title: string;
}

interface TaskHistoryItem {
  id: number;
  action: string;
  description?: string;
  createdAt: string;
  changedBy?: {
    full_name: string;
  };
}

interface TaskRecord {
  id: number;
  title: string;
  description?: string;
  status: string;
  start_date?: string;
  end_date?: string;
  done_at?: string;
  completion_note?: string;
  delay_justification?: string;
  assigned_to?: number;
  maintenance_id?: number;
  assignee?: {
    id: number;
    full_name: string;
  };
  maintenance?: {
    id: number;
    title: string;
  };
  history?: TaskHistoryItem[];
}

export default function TasksPage() {
  const { user: currentUser, hasRole } = useAuth();
  const { showToast, showSuccess, showError } = useToast();

  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [maintenances, setMaintenances] = useState<MaintenanceOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMarkModalOpen, setIsMarkModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [maintenanceId, setMaintenanceId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');

  // Status marking states
  const [statusVal, setStatusVal] = useState('in_progress');
  const [completionNote, setCompletionNote] = useState('');
  const [delayJustification, setDelayJustification] = useState('');

  // Reschedule states
  const [newStartDate, setNewStartDate] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  const ACTION_LABELS: Record<string, string> = {
    created: '🆕 Création',
    status_changed: '🔄 Statut',
    rescheduled: '⏰ Report',
    updated: '✏️ Modification',
    note: '📝 Note',
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const taskRes = await API.get('/tasks');
      if (taskRes.data) setTasks(taskRes.data);

      const userRes = await API.get('/users');
      if (userRes.data) setUsers(userRes.data);

      const maintRes = await API.get('/maintenance');
      if (maintRes.data) setMaintenances(maintRes.data);
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la récupération des données.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshTaskDetails = async (id: number) => {
    try {
      const res = await API.get(`/tasks/${id}`);
      if (res.data) setSelectedTask(res.data);
    } catch (_) {
      showError('Impossible de recharger les détails de la tâche.');
    }
  };

  const resetForm = () => {
    setTitle('');
    setAssignedTo('');
    setMaintenanceId('');
    setStartDate('');
    setEndDate('');
    setDescription('');
    setSelectedTask(null);
  };

  const cleanPayload = (payload: any) => {
    const clean = { ...payload };
    if (!clean.assigned_to) delete clean.assigned_to;
    if (!clean.maintenance_id) delete clean.maintenance_id;
    return clean;
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showError('Le titre de la tâche est requis.');
      return;
    }

    try {
      const payload = cleanPayload({
        title: title.trim(),
        assigned_to: assignedTo ? Number(assignedTo) : null,
        maintenance_id: maintenanceId ? Number(maintenanceId) : null,
        start_date: startDate || null,
        end_date: endDate || null,
        description: description.trim() || null,
      });

      await API.post('/tasks', payload);
      showSuccess('Tâche créée avec succès.');
      setIsCreateModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur de création de la tâche.');
    }
  };

  const handleEditClick = (task: TaskRecord) => {
    setSelectedTask(task);
    setTitle(task.title);
    setAssignedTo(task.assigned_to ? String(task.assigned_to) : '');
    setMaintenanceId(task.maintenance_id ? String(task.maintenance_id) : '');
    setStartDate(task.start_date ? task.start_date.slice(0, 16) : '');
    setEndDate(task.end_date ? task.end_date.slice(0, 16) : '');
    setDescription(task.description || '');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    if (!title.trim()) {
      showError('Le titre est requis.');
      return;
    }

    try {
      const payload = cleanPayload({
        title: title.trim(),
        assigned_to: assignedTo ? Number(assignedTo) : null,
        maintenance_id: maintenanceId ? Number(maintenanceId) : null,
        start_date: startDate || null,
        end_date: endDate || null,
        description: description.trim() || null,
      });

      await API.put(`/tasks/${selectedTask.id}`, payload);
      showSuccess('Tâche modifiée avec succès.');
      setIsEditModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la mise à jour.');
    }
  };

  const handleMarkClick = (task: TaskRecord) => {
    setSelectedTask(task);
    setStatusVal(task.status);
    setCompletionNote('');
    setDelayJustification('');
    setIsMarkModalOpen(true);
  };

  const handleMarkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    const isLate = selectedTask.start_date && (new Date().getTime() - new Date(selectedTask.start_date).getTime()) > 15 * 60 * 1000;

    if (statusVal === 'not_done' && !completionNote.trim()) {
      showError('Veuillez indiquer la raison pour laquelle la tâche n\'a pas été effectuée.');
      return;
    }

    if (statusVal === 'completed' && isLate && !delayJustification.trim()) {
      showError('La justification du retard est obligatoire.');
      return;
    }

    try {
      await API.patch(`/tasks/${selectedTask.id}/status`, {
        status: statusVal,
        note: completionNote.trim() || null,
        delay_justification: delayJustification.trim() || null,
      });

      showSuccess('Statut enregistré avec succès.');
      setIsMarkModalOpen(false);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors du changement de statut.');
    }
  };

  const handleRescheduleClick = (task: TaskRecord) => {
    setSelectedTask(task);
    setNewStartDate('');
    setRescheduleReason('');
    setIsRescheduleModalOpen(true);
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    if (!newStartDate) {
      showError('Sélectionnez la nouvelle date/heure.');
      return;
    }
    if (!rescheduleReason.trim()) {
      showError('Le motif du report est obligatoire.');
      return;
    }

    try {
      await API.patch(`/tasks/${selectedTask.id}/reschedule`, {
        start_date: newStartDate,
        reason: rescheduleReason.trim(),
      });

      showSuccess('Tâche reportée avec succès.');
      setIsRescheduleModalOpen(false);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors du report.');
    }
  };

  const handleHistoryClick = (task: TaskRecord) => {
    setSelectedTask(task);
    setIsHistoryModalOpen(true);
    refreshTaskDetails(task.id);
  };

  const handleWhatsAppShare = (task: TaskRecord) => {
    const msg = `📸 Photos — Tâche : ${task.title}${
      task.assignee ? ' (réalisée par ' + task.assignee.full_name + ')' : ''
    }. Voici les photos avant / pendant / après :`;
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
  };

  const handleDeleteClick = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette tâche ?')) return;

    try {
      await API.delete(`/tasks/${id}`);
      showSuccess('Tâche supprimée avec succès.');
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la suppression.');
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const text = searchTerm.toLowerCase();
    const title = t.title.toLowerCase();
    const desc = t.description?.toLowerCase() || '';
    const name = t.assignee?.full_name.toLowerCase() || '';
    return title.includes(text) || desc.includes(text) || name.includes(text);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Tâches</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Planifiez, assignez et suivez le déroulement des tâches quotidiennes de vos équipes
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-all animate-slide-in"
        >
          <Plus className="w-4 h-4" /> Nouvelle tâche
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-text-primary">{tasks.length}</span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Tâches totales</span>
        </div>
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-amber-500">
            {tasks.filter((t) => t.status === 'pending').length}
          </span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">À faire</span>
        </div>
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-sky-500">
            {tasks.filter((t) => t.status === 'in_progress').length}
          </span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">En cours</span>
        </div>
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-green-500">
            {tasks.filter((t) => t.status === 'completed').length}
          </span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Effectuées</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher par titre de tâche, description ou assigné..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-custom bg-bg-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
        />
      </div>

      {/* Tasks Table */}
      {isLoading ? (
        <div className="flex flex-col items-center p-12 text-center text-text-muted">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs">Chargement de la liste des tâches...</span>
        </div>
      ) : filteredTasks.length > 0 ? (
        <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                  <th className="px-6 py-4">Tâche</th>
                  <th className="px-6 py-4">Assignée à</th>
                  <th className="px-6 py-4">Date de début</th>
                  <th className="px-6 py-4">Statut / Note</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom text-sm">
                {filteredTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-bg-hover/50">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-text-primary">{t.title}</span>
                        {t.description && (
                          <span className="text-xs text-text-secondary mt-0.5 leading-relaxed max-w-sm">
                            {t.description.length > 60 ? `${t.description.slice(0, 60)}...` : t.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {t.assignee ? (
                        <span className="font-semibold text-text-primary">{t.assignee.full_name}</span>
                      ) : (
                        <span className="text-text-muted italic text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {t.start_date ? Helpers.formatDateTime(t.start_date) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={Helpers.taskStatus(t.status).className}>
                          {Helpers.taskStatus(t.status).label}
                        </span>
                        {t.completion_note && (
                          <span className="text-[11px] text-text-muted italic max-w-xs mt-0.5 leading-tight">
                            {t.completion_note.length > 40 ? `${t.completion_note.slice(0, 40)}...` : t.completion_note}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleMarkClick(t)}
                          className="p-1.5 rounded-lg border border-green-200 hover:bg-green-50 text-green-600 transition-colors cursor-pointer animate-slide-in"
                          title="Déclarer statut"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRescheduleClick(t)}
                          className="p-1.5 rounded-lg border border-border-custom hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                          title="Reporter"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleHistoryClick(t)}
                          className="p-1.5 rounded-lg border border-border-custom hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                          title="Consulter le journal"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleWhatsAppShare(t)}
                          className="p-1.5 rounded-lg border border-green-200 hover:bg-green-50 text-green-600 transition-colors cursor-pointer"
                          title="Partager photos WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEditClick(t)}
                          className="p-1.5 rounded-lg border border-border-custom hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                          title="Modifier"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(t.id)}
                          className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 text-red-500 transition-colors cursor-pointer"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center p-12 text-text-muted border border-dashed border-border-custom rounded-2xl bg-bg-surface">
          <span className="text-2xl">📋</span>
          <p className="text-sm mt-2">Aucune tâche enregistrée.</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-primary" /> Nouvelle tâche
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 text-sm no-scrollbar">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Titre de la tâche *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex : Inspecter les extincteurs du rez-de-chaussée"
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Assignée à</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                >
                  <option value="">— Non assignée —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Chantier lié (optionnel)</label>
                <select
                  value={maintenanceId}
                  onChange={(e) => setMaintenanceId(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                >
                  <option value="">— Aucun —</option>
                  {maintenances.map((m) => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Heure planifiée</label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Échéance (Fin)</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ce qui doit être fait..."
                  rows={4}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-custom">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer"
                >
                  Créer la tâche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. EDIT MODAL */}
      {isEditModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" /> Modifier la tâche
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 text-sm no-scrollbar">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Titre de la tâche *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Assignée à</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                >
                  <option value="">— Non assignée —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Chantier lié (optionnel)</label>
                <select
                  value={maintenanceId}
                  onChange={(e) => setMaintenanceId(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                >
                  <option value="">— Aucun —</option>
                  {maintenances.map((m) => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Heure planifiée</label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Échéance (Fin)</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-custom">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. MARK STATUT MODAL */}
      {isMarkModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl animate-slide-in">
            <h3 className="text-base font-bold text-text-primary mb-4 pb-2 border-b border-border-custom">
              Déclarer le statut de la tâche
            </h3>
            <form onSubmit={handleMarkSubmit} className="space-y-4 text-sm">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Statut</label>
                <select
                  value={statusVal}
                  onChange={(e) => setStatusVal(e.target.value)}
                  className="w-full px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                >
                  <option value="in_progress">🔵 En cours</option>
                  <option value="completed">✅ Effectuée</option>
                  <option value="not_done">❌ Non effectuée</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">
                  Note / Résumé d'exécution {statusVal === 'not_done' && '*'}
                </label>
                <textarea
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  placeholder="Détails sur ce qui a été fait, ou pourquoi la tâche est en suspens..."
                  rows={3}
                  className="w-full px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required={statusVal === 'not_done'}
                />
              </div>

              {/* Justification of delay if start_date is older than 15 mins */}
              {statusVal === 'completed' && selectedTask.start_date && (
                (() => {
                  const isLate = (new Date().getTime() - new Date(selectedTask.start_date).getTime()) > 15 * 60 * 1000;
                  if (isLate) {
                    return (
                      <div className="p-3 border-l-4 border-l-red-500 bg-red-500/5 rounded-r-xl space-y-2">
                        <label className="text-xs font-bold text-red-500 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4" /> Retard détecté (&gt;15 min) — Justification obligatoire *
                        </label>
                        <textarea
                          value={delayJustification}
                          onChange={(e) => setDelayJustification(e.target.value)}
                          placeholder="Raison du retard (intempéries, imprévus, urgence...)"
                          rows={2}
                          className="w-full px-3 py-2 border border-red-200 focus:border-red-500 bg-bg-body rounded-xl focus:outline-none text-xs"
                          required
                        />
                      </div>
                    );
                  }
                  return null;
                })()
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsMarkModalOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. RESCHEDULE MODAL */}
      {isRescheduleModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl animate-slide-in">
            <h3 className="text-base font-bold text-text-primary mb-4 pb-2 border-b border-border-custom">
              ⏰ Reporter la tâche
            </h3>
            <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-sm">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Nouvelle date / heure *</label>
                <input
                  type="datetime-local"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Motif du report *</label>
                <textarea
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Pourquoi cette tâche doit-elle être décalée ?..."
                  rows={3}
                  className="w-full px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsRescheduleModalOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow cursor-pointer"
                >
                  Confirmer le report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. HISTORY DETAILS MODAL */}
      {isHistoryModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <History className="w-5 h-5 text-primary" /> Historique & Traçabilité
              </h3>
              <button onClick={() => setIsHistoryModalOpen(false)} className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-5 py-4 text-sm no-scrollbar">
              <div className="divide-y divide-border-custom border border-border-custom rounded-xl overflow-hidden bg-bg-body">
                <div className="p-3.5 flex justify-between items-center">
                  <span className="text-xs font-bold text-text-secondary uppercase">Assignée à</span>
                  <span className="font-bold text-text-primary">
                    {selectedTask.assignee ? selectedTask.assignee.full_name : 'Non assignée'}
                  </span>
                </div>
                <div className="p-3.5 flex justify-between items-center">
                  <span className="text-xs font-bold text-text-secondary uppercase">Heure planifiée</span>
                  <span className="font-bold text-text-primary">
                    {selectedTask.start_date ? Helpers.formatDateTime(selectedTask.start_date) : '—'}
                  </span>
                </div>
                <div className="p-3.5 flex justify-between items-center">
                  <span className="text-xs font-bold text-text-secondary uppercase">Statut actuel</span>
                  <span className={Helpers.taskStatus(selectedTask.status).className}>
                    {Helpers.taskStatus(selectedTask.status).label}
                  </span>
                </div>
                {selectedTask.done_at && (
                  <div className="p-3.5 flex justify-between items-center">
                    <span className="text-xs font-bold text-text-secondary uppercase">Réalisée le</span>
                    <span className="font-bold text-text-primary">
                      {Helpers.formatDateTime(selectedTask.done_at)}
                    </span>
                  </div>
                )}
              </div>

              {selectedTask.completion_note && (
                <div className="p-4 rounded-xl bg-bg-body border border-border-custom">
                  <div className="text-xs font-bold text-text-muted uppercase mb-1">Note de réalisation / Résumé</div>
                  <p className="text-text-secondary leading-relaxed font-semibold">{selectedTask.completion_note}</p>
                </div>
              )}

              {selectedTask.delay_justification && (
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-200/50">
                  <div className="text-xs font-bold text-red-500 uppercase mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Retard justifié
                  </div>
                  <p className="text-red-600 leading-relaxed font-semibold">{selectedTask.delay_justification}</p>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="font-bold text-text-primary uppercase text-xs tracking-wider">Journal des événements</h4>
                <div className="space-y-2.5">
                  {(selectedTask.history || []).length > 0 ? (
                    (selectedTask.history || []).map((h) => (
                      <div key={h.id} className="p-3 rounded-xl border border-border-custom bg-bg-body flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-text-primary">
                            {ACTION_LABELS[h.action] || h.action} {h.description && `— ${h.description}`}
                          </div>
                          <div className="text-[10px] text-text-muted">
                            {Helpers.formatDateTime(h.createdAt)}
                          </div>
                        </div>
                        {h.changedBy && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary uppercase">
                            🧑 {h.changedBy.full_name}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-text-muted italic text-xs">Aucun historique enregistré pour le moment.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border-custom">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-5 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
