'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API, ROLE_LABELS } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import {
  ClipboardList,
  Calendar,
  Target,
  Clock,
  CheckCircle2,
  Eye,
  X,
  Users,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

interface Maintenance {
  title: string;
}

interface Task {
  id: number;
  title: string;
  maintenance?: Maintenance;
}

interface EventItem {
  id: number;
  title: string;
  is_meeting?: boolean;
  start_datetime: string;
}

interface DayCounts {
  todo: number;
  doing: number;
  done: number;
  events: number;
}

interface DayData {
  counts: DayCounts;
  todo: Task[];
  doing: Task[];
  doneToday: Task[];
  events: EventItem[];
}

interface ProductivityStats {
  week: {
    tasksCompleted: number;
  };
  month: {
    tasksCompleted: number;
    maintenancesCompleted: number;
    completionRate: number;
  };
}

interface DayResponse {
  day: DayData;
  productivity?: ProductivityStats;
}

interface TeamMember {
  user: {
    id: number;
    full_name: string;
    role: string;
  };
  counts: DayCounts;
  todo: Task[];
  doing: Task[];
  doneToday: Task[];
  events: EventItem[];
}

interface TeamResponse {
  members: TeamMember[];
}

export default function ActivityPage() {
  const { user, hasRole } = useAuth();
  const { showError } = useToast();

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [myDay, setMyDay] = useState<DayResponse | null>(null);
  const [teamDay, setTeamDay] = useState<TeamResponse | null>(null);
  const [isLoadingMine, setIsLoadingMine] = useState(true);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const canTeam = useCallback(() => {
    if (!user) return false;
    return (
      hasRole('manager', 'super_admin', 'dir_admin', 'dir_technique', 'gestionnaire') ||
      !!user.can_view_all_calendars
    );
  }, [user, hasRole]);

  const loadMine = useCallback(async (dateStr: string) => {
    setIsLoadingMine(true);
    try {
      const res = await API.get(`/dashboard/day?scope=me&date=${dateStr}`);
      if (res.data) {
        setMyDay(res.data);
      }
    } catch (err: any) {
      showError(err.message || "Impossible de charger votre activité de la journée.");
    } finally {
      setIsLoadingMine(false);
    }
  }, [showError]);

  const loadTeam = useCallback(async (dateStr: string) => {
    setIsLoadingTeam(true);
    try {
      const res = await API.get(`/dashboard/day?scope=team&date=${dateStr}`);
      if (res.data) {
        setTeamDay(res.data);
      }
    } catch (err: any) {
      showError(err.message || "Impossible de charger l'activité de l'équipe.");
    } finally {
      setIsLoadingTeam(false);
    }
  }, [showError]);

  useEffect(() => {
    if (user) {
      loadMine(selectedDate);
      if (canTeam()) {
        loadTeam(selectedDate);
      }
    }
  }, [user, selectedDate, loadMine, loadTeam, canTeam]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const statCard = (icon: React.ReactNode, color: string, value: number, name: string) => {
    const bgColors: Record<string, string> = {
      sky: 'bg-sky-500/10 text-sky-500',
      green: 'bg-green-500/10 text-green-500',
      orange: 'bg-amber-500/10 text-amber-500',
    };
    return (
      <div className="flex items-center gap-4 p-5 rounded-2xl border border-border-custom bg-bg-surface shadow-sm transition-all duration-200 hover:shadow-md">
        <div className={`w-12 h-12 flex items-center justify-center rounded-xl text-lg font-bold ${bgColors[color] || 'bg-slate-500/10 text-slate-500'}`}>
          {icon}
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-bold text-text-primary tracking-tight leading-tight">{value}</span>
          <span className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">{name}</span>
        </div>
      </div>
    );
  };

  const renderColumn = (title: string, items: Task[], emptyMsg: string, badgeColor: string) => {
    const bgColors: Record<string, string> = {
      orange: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      sky: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
      green: 'bg-green-500/10 text-green-500 border-green-500/20',
    };
    return (
      <div className="rounded-2xl border border-border-custom bg-bg-surface p-5 shadow-sm space-y-4 flex flex-col min-h-[300px]">
        <h3 className="text-sm font-bold text-text-primary flex items-center justify-between border-b border-border-custom pb-3">
          <span>{title}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-bold ${bgColors[badgeColor] || 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
            {items.length}
          </span>
        </h3>
        <div className="flex-1 space-y-3 overflow-y-auto max-h-[400px] no-scrollbar">
          {items.length > 0 ? (
            items.map((t) => (
              <div key={t.id} className="p-3.5 rounded-xl border border-border-custom bg-bg-surface-2 hover:bg-bg-hover transition-colors">
                <p className="text-sm font-semibold text-text-primary leading-snug">{t.title}</p>
                {t.maintenance && (
                  <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                    🔧 {t.maintenance.title}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[150px] text-center text-text-muted">
              <span className="text-2xl mb-1">🎉</span>
              <p className="text-xs font-semibold">{emptyMsg}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const hasTeamAccess = canTeam();
  const counts = myDay?.day?.counts || { todo: 0, doing: 0, done: 0, events: 0 };
  const prod = myDay?.productivity;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            📋 Activité du jour
          </h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Organisez votre journée et suivez la productivité de l'équipe
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="px-3.5 py-2 border border-border-custom bg-bg-surface rounded-xl focus:outline-none text-sm font-semibold max-w-[185px] cursor-pointer shadow-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all"
          />
        </div>
      </div>

      {isLoadingMine ? (
        <div className="flex flex-col items-center justify-center p-20">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-text-secondary mt-3">Chargement de votre journée...</span>
        </div>
      ) : (
        <>
          {/* Stats KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCard(<Target className="w-5 h-5" />, 'orange', counts.todo, 'À faire')}
            {statCard(<Clock className="w-5 h-5" />, 'sky', counts.doing, 'En cours')}
            {statCard(<CheckCircle2 className="w-5 h-5" />, 'green', counts.done, 'Fait aujourd\'hui')}
            {statCard(<Calendar className="w-5 h-5" />, 'sky', counts.events, 'Événements')}
          </div>

          {/* Activity Tasks Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {renderColumn('🎯 Objectifs', myDay?.day?.todo || [], 'Rien à faire 🎉', 'orange')}
            {renderColumn('⏳ En cours', myDay?.day?.doing || [], 'Rien en cours', 'sky')}
            {renderColumn('✅ Fait aujourd\'hui', myDay?.day?.doneToday || [], 'Rien de terminé', 'green')}
          </div>

          {/* Agenda & Productivity Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Agenda Card */}
            <div className="rounded-2xl border border-border-custom bg-bg-surface p-5 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2 border-b border-border-custom pb-3">
                <Calendar className="w-5 h-5 text-primary" /> Mon agenda du jour
              </h3>
              {myDay?.day?.events && myDay.day.events.length > 0 ? (
                <div className="space-y-3">
                  {myDay.day.events.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-border-custom bg-bg-surface hover:bg-bg-hover transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0 animate-pulse" />
                        <p className="text-sm font-semibold text-text-primary truncate">
                          {e.is_meeting ? '👥 ' : ''}{e.title}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-text-secondary whitespace-nowrap bg-bg-surface-2 px-2.5 py-1 rounded-lg border border-border-custom">
                        {Helpers.formatDateTime(e.start_datetime)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted">
                  <span className="text-3xl mb-2">📅</span>
                  <p className="text-xs font-bold uppercase tracking-wider">Aucun événement aujourd'hui</p>
                </div>
              )}
            </div>

            {/* Productivity Card */}
            <div className="rounded-2xl border border-border-custom bg-bg-surface p-5 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2 border-b border-border-custom pb-3">
                <TrendingUp className="w-5 h-5 text-primary" /> Ma productivité
              </h3>
              {prod ? (
                <div className="space-y-3 text-sm font-semibold">
                  <div className="flex justify-between items-center p-3 rounded-xl border border-border-custom bg-bg-surface-2">
                    <span className="text-text-secondary">Tâches terminées (7 derniers jours)</span>
                    <span className="font-extrabold text-text-primary text-base">{prod.week?.tasksCompleted ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-xl border border-border-custom bg-bg-surface-2">
                    <span className="text-text-secondary">Tâches terminées (30 derniers jours)</span>
                    <span className="font-extrabold text-text-primary text-base">{prod.month?.tasksCompleted ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-xl border border-border-custom bg-bg-surface-2">
                    <span className="text-text-secondary">Interventions terminées (30 j)</span>
                    <span className="font-extrabold text-text-primary text-base">{prod.month?.maintenancesCompleted ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-xl border border-border-custom bg-bg-surface-2">
                    <span className="text-text-secondary">Taux de complétion</span>
                    <span className="font-extrabold text-green-500 text-base">{prod.month?.completionRate ?? 0}%</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted">
                  <span className="text-3xl mb-2">📈</span>
                  <p className="text-xs font-bold uppercase tracking-wider">Aucune statistique disponible</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Team Activity Section */}
      {hasTeamAccess && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-text-primary flex items-center gap-2 mt-8">
            <Users className="w-5 h-5 text-primary" /> Activité de l'équipe
          </h3>

          {isLoadingTeam ? (
            <div className="flex flex-col items-center justify-center p-12 bg-bg-surface border border-border-custom rounded-2xl shadow-sm">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
              <span className="text-xs font-semibold text-text-secondary">Chargement de l'activité de l'équipe...</span>
            </div>
          ) : teamDay?.members && teamDay.members.length > 0 ? (
            <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                      <th className="px-6 py-4">Collaborateur</th>
                      <th className="px-6 py-4">Rôle</th>
                      <th className="px-6 py-4 text-center">À faire</th>
                      <th className="px-6 py-4 text-center">En cours</th>
                      <th className="px-6 py-4 text-center">Fait auj.</th>
                      <th className="px-6 py-4 text-center">Agenda</th>
                      <th className="px-6 py-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-custom text-sm font-semibold">
                    {teamDay.members.map((m) => (
                      <tr key={m.user.id} className="hover:bg-bg-hover/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-white text-xs font-extrabold tracking-wide uppercase select-none">
                              {Helpers.initials(m.user.full_name)}
                            </div>
                            <span className="font-extrabold text-text-primary">{m.user.full_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-text-secondary font-medium">
                          {ROLE_LABELS[m.user.role] || m.user.role || '—'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            {m.counts.todo}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/10 text-sky-500 border border-sky-500/20">
                            {m.counts.doing}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-500/10 text-green-500 border border-green-500/20">
                            {m.counts.done}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-text-secondary">
                          {m.counts.events}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedMember(m)}
                            className="flex items-center gap-1 ml-auto px-3 py-1.5 rounded-xl border border-border-custom bg-bg-surface hover:bg-bg-hover text-xs font-bold text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> Détail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted bg-bg-surface border border-border-custom rounded-2xl shadow-sm">
              <AlertCircle className="w-8 h-8 text-text-muted mb-2" />
              <p className="text-xs font-bold uppercase tracking-wider">Aucun collaborateur visible</p>
            </div>
          )}
        </div>
      )}

      {/* Member Activity Detail Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                📋 Journée de {selectedMember.user.full_name}
              </h3>
              <button
                onClick={() => setSelectedMember(null)}
                className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-5 py-4 text-sm font-semibold no-scrollbar">
              {/* Objectifs à faire */}
              <div>
                <h4 className="font-bold text-text-primary flex items-center gap-1.5 mb-2.5">
                  <span>🎯 Objectifs (à faire)</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    {selectedMember.todo.length}
                  </span>
                </h4>
                {selectedMember.todo.length > 0 ? (
                  <div className="space-y-2">
                    {selectedMember.todo.map((t) => (
                      <div key={t.id} className="p-3.5 rounded-xl border border-border-custom bg-bg-surface-2 text-text-primary font-semibold leading-snug">
                        {t.title}
                        {t.maintenance && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-text-muted font-bold uppercase tracking-wider block">
                            🔧 {t.maintenance.title}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">Rien à faire</p>
                )}
              </div>

              {/* En cours */}
              <div>
                <h4 className="font-bold text-text-primary flex items-center gap-1.5 mb-2.5">
                  <span>⏳ En cours</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500 border border-sky-500/20">
                    {selectedMember.doing.length}
                  </span>
                </h4>
                {selectedMember.doing.length > 0 ? (
                  <div className="space-y-2">
                    {selectedMember.doing.map((t) => (
                      <div key={t.id} className="p-3.5 rounded-xl border border-border-custom bg-bg-surface-2 text-text-primary font-semibold leading-snug">
                        {t.title}
                        {t.maintenance && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-text-muted font-bold uppercase tracking-wider block">
                            🔧 {t.maintenance.title}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">Rien en cours</p>
                )}
              </div>

              {/* Fait aujourd'hui */}
              <div>
                <h4 className="font-bold text-text-primary flex items-center gap-1.5 mb-2.5">
                  <span>✅ Fait aujourd'hui</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                    {selectedMember.doneToday.length}
                  </span>
                </h4>
                {selectedMember.doneToday.length > 0 ? (
                  <div className="space-y-2">
                    {selectedMember.doneToday.map((t) => (
                      <div key={t.id} className="p-3.5 rounded-xl border border-border-custom bg-bg-surface-2 text-text-primary font-semibold leading-snug">
                        {t.title}
                        {t.maintenance && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-text-muted font-bold uppercase tracking-wider block">
                            🔧 {t.maintenance.title}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">Rien de terminé</p>
                )}
              </div>

              {/* Agenda */}
              <div>
                <h4 className="font-bold text-text-primary flex items-center gap-1.5 mb-2.5">
                  <span>📅 Agenda du jour</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {selectedMember.events.length}
                  </span>
                </h4>
                {selectedMember.events.length > 0 ? (
                  <div className="space-y-2">
                    {selectedMember.events.map((e) => (
                      <div key={e.id} className="flex justify-between items-center p-3 rounded-xl border border-border-custom bg-bg-surface-2 text-text-primary">
                        <span>{e.is_meeting ? '👥 ' : ''}{e.title}</span>
                        <span className="text-xs font-semibold text-text-muted">{Helpers.formatDateTime(e.start_datetime)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">Aucun événement aujourd'hui</p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-border-custom flex justify-end">
              <button
                onClick={() => setSelectedMember(null)}
                className="px-5 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer transition-colors"
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
