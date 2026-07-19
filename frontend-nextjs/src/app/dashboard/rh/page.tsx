'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import {
  Calendar,
  Users,
  Clock,
  Briefcase,
  Plus,
  Trash2,
  Check,
  X,
  PlusCircle,
  FileText,
  UserCheck,
  AlertCircle
} from 'lucide-react';

interface Employee {
  id: number;
  full_name: string;
}

interface AttendanceLog {
  id: number;
  user_id: number;
  entry_time: string;
  exit_time?: string | null;
  status: string;
  notes?: string | null;
  employee?: Employee | null;
}

interface LeaveRequest {
  id: number;
  user_id: number;
  type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason?: string | null;
  employee?: Employee | null;
  approver?: {
    full_name: string;
  } | null;
}

interface Shift {
  id: number;
  user_id: number;
  title: string;
  start_datetime: string;
  end_datetime: string;
  description?: string | null;
  employee?: Employee | null;
  creator?: {
    full_name: string;
  } | null;
}

interface ServiceItem {
  id: number;
  name: string;
}

interface TeamItem {
  id: number;
  name: string;
  service_id: number;
  service?: ServiceItem | null;
}

export default function RhPage() {
  const { user, hasRole } = useAuth();
  const { showSuccess, showError } = useToast();

  const canManageRH = hasRole('super_admin', 'manager', 'comptable');

  const [activeTab, setActiveTab] = useState<'attendance' | 'leaves' | 'shifts' | 'teams'>('attendance');

  // Logs / Items States
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [allUsers, setAllUsers] = useState<Employee[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  // Leave Form modal states
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [leaveType, setLeaveType] = useState('annual');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  // Shift Form modal states
  const [isShiftOpen, setIsShiftOpen] = useState(false);
  const [shiftUserId, setShiftUserId] = useState('');
  const [shiftTitle, setShiftTitle] = useState('');
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [shiftDescription, setShiftDescription] = useState('');

  // Team Form modal states
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamServiceId, setNewTeamServiceId] = useState('');

  // Loader dispatcher
  const loadTabContent = useCallback(async (tabName: string) => {
    setIsLoading(true);
    try {
      if (tabName === 'attendance') {
        const url = canManageRH ? '/rh/pointages' : `/rh/pointages?user_id=${user?.id}`;
        const res = await API.get(url);
        if (res.data) setAttendanceLogs(res.data);
      } else if (tabName === 'leaves') {
        const url = canManageRH ? '/rh/conges' : `/rh/conges?user_id=${user?.id}`;
        const res = await API.get(url);
        if (res.data) setLeaves(res.data);
      } else if (tabName === 'shifts') {
        const url = canManageRH ? '/rh/plannings' : `/rh/plannings?user_id=${user?.id}`;
        const res = await API.get(url);
        if (res.data) setShifts(res.data);
      } else if (tabName === 'teams') {
        const [sRes, eRes] = await Promise.all([
          API.get('/rh/services'),
          API.get('/rh/equipes')
        ]);
        if (sRes.data) setServices(sRes.data);
        if (eRes.data) setTeams(eRes.data);
      }
    } catch (err: any) {
      showError(err.message || 'Erreur lors du chargement des informations RH.');
    } finally {
      setIsLoading(false);
    }
  }, [showError, canManageRH, user]);

  useEffect(() => {
    if (user) {
      loadTabContent(activeTab);
    }
  }, [user, activeTab, loadTabContent]);

  useEffect(() => {
    const handlePointageUpdate = () => {
      loadTabContent(activeTab);
    };
    window.addEventListener('pointage-updated', handlePointageUpdate);
    return () => window.removeEventListener('pointage-updated', handlePointageUpdate);
  }, [activeTab, loadTabContent]);

  // Load user list for planning dropdown
  const loadUsersList = async () => {
    try {
      const res = await API.get('/users');
      if (res.data) setAllUsers(res.data);
    } catch (_) {}
  };

  // PUNCH IN / OUT ACTIONS
  const handleCheckIn = async () => {
    const notes = prompt("Notes d'entrée (optionnel) :") || '';
    try {
      await API.post('/rh/pointages/entree', { notes });
      showSuccess("Pointage d'entrée enregistré !");
      loadTabContent('attendance');
    } catch (err: any) {
      showError(err.message || 'Erreur de pointage.');
    }
  };

  const handleCheckOut = async () => {
    const notes = prompt("Notes de sortie (optionnel) :") || '';
    try {
      await API.post('/rh/pointages/sortie', { notes });
      showSuccess("Pointage de sortie enregistré !");
      loadTabContent('attendance');
    } catch (err: any) {
      showError(err.message || 'Erreur de pointage.');
    }
  };

  // LEAVE APPLICATIONS ACTIONS
  const handleOpenLeaveModal = () => {
    setLeaveType('annual');
    setLeaveStart('');
    setLeaveEnd('');
    setLeaveReason('');
    setIsLeaveOpen(true);
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStart || !leaveEnd) {
      showError('Date de début et date de fin obligatoires.');
      return;
    }
    try {
      await API.post('/rh/conges', {
        type: leaveType,
        start_date: leaveStart,
        end_date: leaveEnd,
        reason: leaveReason.trim() || null
      });
      showSuccess('Demande de congé envoyée avec succès.');
      setIsLeaveOpen(false);
      loadTabContent('leaves');
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la soumission de la demande.');
    }
  };

  const handleVerifyLeave = async (id: number, status: 'approved' | 'rejected') => {
    if (!window.confirm(`Confirmer la décision : ${status === 'approved' ? 'Approuver' : 'Rejeter'} ?`)) return;
    try {
      await API.put(`/rh/conges/${id}`, { status });
      showSuccess('Statut du congé mis à jour.');
      loadTabContent('leaves');
    } catch (err: any) {
      showError(err.message || 'Erreur lors du traitement.');
    }
  };

  // SHIFT MANAGEMENT ACTIONS
  const handleOpenShiftModal = async () => {
    await loadUsersList();
    setShiftUserId('');
    setShiftTitle('');
    setShiftStart('');
    setShiftEnd('');
    setShiftDescription('');
    setIsShiftOpen(true);
  };

  const handleShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftUserId || !shiftTitle || !shiftStart || !shiftEnd) {
      showError('Veuillez remplir tous les champs requis.');
      return;
    }
    try {
      await API.post('/rh/plannings', {
        user_id: Number(shiftUserId),
        title: shiftTitle.trim(),
        start_datetime: shiftStart,
        end_datetime: shiftEnd,
        description: shiftDescription.trim() || null
      });
      showSuccess('Horaire planifié avec succès !');
      setIsShiftOpen(false);
      loadTabContent('shifts');
    } catch (err: any) {
      showError(err.message || 'Erreur de planification.');
    }
  };

  const handleDeleteShift = async (id: number) => {
    if (!window.confirm('Supprimer cette planification ?')) return;
    try {
      await API.delete(`/rh/plannings/${id}`);
      showSuccess('Planification supprimée.');
      loadTabContent('shifts');
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la suppression.');
    }
  };

  // SERVICES & TEAMS ACTIONS
  const handleAddService = async () => {
    const name = prompt('Nom du service :');
    if (!name || !name.trim()) return;
    try {
      await API.post('/rh/services', { name: name.trim() });
      showSuccess('Service créé !');
      loadTabContent('teams');
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la création.');
    }
  };

  const handleDeleteService = async (id: number) => {
    if (!window.confirm('Supprimer ce service ?')) return;
    try {
      await API.delete(`/rh/services/${id}`);
      showSuccess('Service supprimé.');
      loadTabContent('teams');
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la suppression.');
    }
  };

  const handleOpenTeamModal = () => {
    if (services.length === 0) {
      showError("Veuillez d'abord créer un service.");
      return;
    }
    setNewTeamName('');
    setNewTeamServiceId(String(services[0].id));
    setIsTeamModalOpen(true);
  };

  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim() || !newTeamServiceId) {
      showError('Le nom de l\'équipe et le service sont obligatoires.');
      return;
    }
    try {
      await API.post('/rh/equipes', {
        name: newTeamName.trim(),
        service_id: Number(newTeamServiceId)
      });
      showSuccess('Équipe créée !');
      setIsTeamModalOpen(false);
      loadTabContent('teams');
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la création de l\'équipe.');
    }
  };

  const handleDeleteTeam = async (id: number) => {
    if (!window.confirm('Supprimer cette équipe ?')) return;
    try {
      await API.delete(`/rh/equipes/${id}`);
      showSuccess('Équipe supprimée.');
      loadTabContent('teams');
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la suppression.');
    }
  };

  // Helper maps
  const leaveLabels: Record<string, string> = {
    annual: 'Annuel',
    sick: 'Maladie',
    maternity: 'Maternité',
    paternity: 'Paternité',
    unpaid: 'Sans solde',
    other: 'Autre'
  };

  const leaveBadgeColor = (s: string) => {
    if (s === 'approved') return 'bg-green-500/10 text-green-500 border-green-500/20';
    if (s === 'rejected') return 'bg-red-500/10 text-red-500 border-red-500/20';
    return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  };

  const activeAttendance = attendanceLogs.find(l => l.user_id === user?.id && !l.exit_time);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">👥 Ressources Humaines</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Suivi des pointages, demandes de congés, plannings et organisation des services
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border-custom gap-2 overflow-x-auto no-scrollbar py-1">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'attendance'
              ? 'bg-primary text-white shadow-sm'
              : 'border border-border-custom text-text-secondary hover:bg-bg-hover bg-bg-surface'
          }`}
        >
          📋 Pointages
        </button>
        <button
          onClick={() => setActiveTab('leaves')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'leaves'
              ? 'bg-primary text-white shadow-sm'
              : 'border border-border-custom text-text-secondary hover:bg-bg-hover bg-bg-surface'
          }`}
        >
          ✈️ Congés
        </button>
        <button
          onClick={() => setActiveTab('shifts')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'shifts'
              ? 'bg-primary text-white shadow-sm'
              : 'border border-border-custom text-text-secondary hover:bg-bg-hover bg-bg-surface'
          }`}
        >
          📅 Plannings
        </button>
        {canManageRH && (
          <button
            onClick={() => setActiveTab('teams')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'teams'
                ? 'bg-primary text-white shadow-sm'
                : 'border border-border-custom text-text-secondary hover:bg-bg-hover bg-bg-surface'
            }`}
          >
            👥 Équipes & Services
          </button>
        )}
      </div>

      {/* Loading Spinner */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20 bg-bg-surface border border-border-custom rounded-2xl shadow-sm">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-text-secondary mt-3">Chargement des données...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              {/* Checkin / Checkout Session Alert Card */}
              {activeAttendance ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h4 className="font-extrabold text-red-500 text-sm flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" /> Session active de travail
                    </h4>
                    <p className="text-xs text-text-muted mt-1 font-semibold uppercase">
                      Arrivée enregistrée le {Helpers.formatDateTime(activeAttendance.entry_time)}
                    </p>
                  </div>
                  <button
                    onClick={handleCheckOut}
                    className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-colors"
                  >
                    Dépointer / Sortie
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h4 className="font-extrabold text-green-600 text-sm flex items-center gap-1.5">
                      Prêt à commencer la journée
                    </h4>
                    <p className="text-xs text-text-muted mt-1 font-semibold uppercase">
                      Enregistrez votre heure d'arrivée ci-contre pour débuter votre service
                    </p>
                  </div>
                  <button
                    onClick={handleCheckIn}
                    className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-colors"
                  >
                    Pointer / Entrée
                  </button>
                </div>
              )}

              {/* Pointages Table */}
              <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4">
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2 pb-2 border-b border-border-custom">
                  📊 Historique des Pointages
                </h3>
                <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                        <th className="px-5 py-3.5">Employé</th>
                        <th className="px-5 py-3.5">Entrée</th>
                        <th className="px-5 py-3.5">Sortie</th>
                        <th className="px-5 py-3.5">Statut</th>
                        <th className="px-5 py-3.5">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-custom text-xs font-semibold">
                      {attendanceLogs.length > 0 ? (
                        attendanceLogs.map((l) => (
                          <tr key={l.id} className="hover:bg-bg-hover/50 transition-colors">
                            <td className="px-5 py-3.5 text-text-primary font-bold">
                              {l.employee?.full_name || '—'}
                            </td>
                            <td className="px-5 py-3.5 text-text-secondary">
                              {Helpers.formatDateTime(l.entry_time)}
                            </td>
                            <td className="px-5 py-3.5 text-text-secondary font-bold">
                              {l.exit_time ? (
                                Helpers.formatDateTime(l.exit_time)
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">En cours</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] border font-bold uppercase ${
                                l.status === 'present'
                                  ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                  : 'bg-red-500/10 text-red-500 border-red-500/20'
                              }`}>
                                {l.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-text-secondary max-w-[200px] truncate">{l.notes || '—'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-5 text-text-muted italic">
                            Aucun pointage enregistré
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LEAVES */}
          {activeTab === 'leaves' && (
            <div className="space-y-6">
              {/* Header and apply btn */}
              <div className="flex justify-between items-center pb-2 border-b border-border-custom">
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  Demandes de congés
                </h3>
                <button
                  onClick={handleOpenLeaveModal}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-sm cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4" /> Demander un congé
                </button>
              </div>

              {/* Leaves list card */}
              <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4">
                <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                        <th className="px-5 py-3.5">Employé</th>
                        <th className="px-5 py-3.5">Type</th>
                        <th className="px-5 py-3.5">Début</th>
                        <th className="px-5 py-3.5">Fin</th>
                        <th className="px-5 py-3.5">Statut</th>
                        <th className="px-5 py-3.5">Motif</th>
                        <th className="px-5 py-3.5">Validateur</th>
                        <th className="px-5 py-3.5 text-right no-print">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-custom text-xs font-semibold">
                      {leaves.length > 0 ? (
                        leaves.map((c) => {
                          const isPending = c.status === 'pending';
                          return (
                            <tr key={c.id} className="hover:bg-bg-hover/50 transition-colors">
                              <td className="px-5 py-3.5 text-text-primary font-bold">
                                {c.employee?.full_name || '—'}
                              </td>
                              <td className="px-5 py-3.5 text-text-secondary">
                                {leaveLabels[c.type] || c.type}
                              </td>
                              <td className="px-5 py-3.5 text-text-secondary">
                                {Helpers.formatDate(c.start_date)}
                              </td>
                              <td className="px-5 py-3.5 text-text-secondary font-bold">
                                {Helpers.formatDate(c.end_date)}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] border font-bold uppercase ${leaveBadgeColor(c.status)}`}>
                                  {c.status}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-text-secondary max-w-[200px] truncate">{c.reason || '—'}</td>
                              <td className="px-5 py-3.5 text-text-secondary">{c.approver?.full_name || '—'}</td>
                              <td className="px-5 py-3.5 text-right no-print">
                                {isPending && canManageRH ? (
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      onClick={() => handleVerifyLeave(c.id, 'approved')}
                                      className="p-1 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/15 border border-green-500/20 cursor-pointer"
                                      title="Approuver"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleVerifyLeave(c.id, 'rejected')}
                                      className="p-1 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/15 border border-red-500/20 cursor-pointer"
                                      title="Rejeter"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="text-center py-5 text-text-muted italic">
                            Aucune demande de congé enregistrée
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SHIFTS */}
          {activeTab === 'shifts' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-border-custom">
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  Plannings & Horaires de travail
                </h3>
                <button
                  onClick={handleOpenShiftModal}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-sm cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4" /> Planifier un horaire
                </button>
              </div>

              {/* Shifts list card */}
              <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4">
                <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                        <th className="px-5 py-3.5">Employé</th>
                        <th className="px-5 py-3.5">Tâche/Activité</th>
                        <th className="px-5 py-3.5">Début</th>
                        <th className="px-5 py-3.5">Fin</th>
                        <th className="px-5 py-3.5">Description</th>
                        <th className="px-5 py-3.5">Planifié par</th>
                        <th className="px-5 py-3.5 text-right no-print">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-custom text-xs font-semibold">
                      {shifts.length > 0 ? (
                        shifts.map((s) => (
                          <tr key={s.id} className="hover:bg-bg-hover/50 transition-colors">
                            <td className="px-5 py-3.5 text-text-primary font-bold">
                              {s.employee?.full_name || '—'}
                            </td>
                            <td className="px-5 py-3.5 text-text-secondary">
                              {s.title}
                            </td>
                            <td className="px-5 py-3.5 text-text-secondary">
                              {Helpers.formatDateTime(s.start_datetime)}
                            </td>
                            <td className="px-5 py-3.5 text-text-secondary font-bold">
                              {Helpers.formatDateTime(s.end_datetime)}
                            </td>
                            <td className="px-5 py-3.5 text-text-secondary max-w-[200px] truncate">{s.description || '—'}</td>
                            <td className="px-5 py-3.5 text-text-secondary">{s.creator?.full_name || '—'}</td>
                            <td className="px-5 py-3.5 text-right no-print">
                              <button
                                onClick={() => handleDeleteShift(s.id)}
                                className="p-1 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/15 border border-red-500/20 cursor-pointer"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center py-5 text-text-muted italic">
                            Aucune planification d'horaire disponible
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TEAMS */}
          {activeTab === 'teams' && canManageRH && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* SERVICES LIST CARD */}
              <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm p-6 space-y-4 flex flex-col justify-between min-h-[300px]">
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-border-custom">
                    <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-primary" /> Services administratives
                    </h3>
                    <button
                      onClick={handleAddService}
                      className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-hover cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" /> Ajouter
                    </button>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto no-scrollbar divide-y divide-border-custom pr-2">
                    {services.length > 0 ? (
                      services.map((s) => (
                        <div key={s.id} className="flex justify-between items-center py-3 text-xs font-semibold text-text-primary">
                          <span>{s.name}</span>
                          <button
                            onClick={() => handleDeleteService(s.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 border border-transparent hover:border-red-500/20 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-text-muted italic text-xs">
                        Aucun service enregistré
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* TEAMS LIST CARD */}
              <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm p-6 space-y-4 flex flex-col justify-between min-h-[300px]">
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-border-custom">
                    <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-primary" /> Équipes de travail
                    </h3>
                    <button
                      onClick={handleOpenTeamModal}
                      className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-hover cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" /> Ajouter
                    </button>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto no-scrollbar divide-y divide-border-custom pr-2">
                    {teams.length > 0 ? (
                      teams.map((t) => (
                        <div key={t.id} className="flex justify-between items-center py-3 text-xs font-semibold text-text-primary">
                          <div>
                            <p>{t.name}</p>
                            {t.service && <span className="text-[10px] text-text-muted font-bold">Service: {t.service.name}</span>}
                          </div>
                          <button
                            onClick={() => handleDeleteTeam(t.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 border border-transparent hover:border-red-500/20 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-text-muted italic text-xs">
                        Aucune équipe enregistrée
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* LEAVE REQUEST MODAL */}
      {isLeaveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                ✈️ Demande de Congé
              </h3>
              <button
                onClick={() => setIsLeaveOpen(false)}
                className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLeaveSubmit} className="py-4 space-y-4 text-sm font-semibold">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Type de congé *</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer"
                  required
                >
                  <option value="annual">Annuel</option>
                  <option value="sick">Maladie</option>
                  <option value="maternity">Maternité</option>
                  <option value="paternity">Paternité</option>
                  <option value="unpaid">Sans solde</option>
                  <option value="other">Autre</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Date de début *</label>
                  <input
                    type="date"
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Date de fin *</label>
                  <input
                    type="date"
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Motif</label>
                <textarea
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Expliquez brièvement le motif..."
                  rows={3}
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                />
              </div>

              <div className="pt-4 border-t border-border-custom flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsLeaveOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer"
                >
                  Envoyer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHIFT PLANNING MODAL */}
      {isShiftOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                📅 Planifier un Horaire
              </h3>
              <button
                onClick={() => setIsShiftOpen(false)}
                className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleShiftSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 text-sm font-semibold no-scrollbar">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Employé *</label>
                <select
                  value={shiftUserId}
                  onChange={(e) => setShiftUserId(e.target.value)}
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer"
                  required
                >
                  <option value="">— Sélectionner l'employé —</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Titre / Activité *</label>
                <input
                  type="text"
                  value={shiftTitle}
                  onChange={(e) => setShiftTitle(e.target.value)}
                  placeholder="Ex: Permanence, Astreinte technique"
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Début *</label>
                  <input
                    type="datetime-local"
                    value={shiftStart}
                    onChange={(e) => setShiftStart(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Fin *</label>
                  <input
                    type="datetime-local"
                    value={shiftEnd}
                    onChange={(e) => setShiftEnd(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Description</label>
                <textarea
                  value={shiftDescription}
                  onChange={(e) => setShiftDescription(e.target.value)}
                  placeholder="Détails supplémentaires du planning..."
                  rows={2}
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                />
              </div>

              <div className="pt-4 border-t border-border-custom flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsShiftOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-colors"
                >
                  Planifier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE TEAM MODAL */}
      {isTeamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                👥 Créer une Équipe
              </h3>
              <button
                onClick={() => setIsTeamModalOpen(false)}
                className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTeamSubmit} className="py-4 space-y-4 text-sm font-semibold">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Nom de l'équipe *</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Ex: Équipe technique Nord"
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Service rattaché *</label>
                <select
                  value={newTeamServiceId}
                  onChange={(e) => setNewTeamServiceId(e.target.value)}
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer"
                  required
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-border-custom flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsTeamModalOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
