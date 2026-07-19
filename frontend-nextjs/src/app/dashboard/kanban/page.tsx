'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import {
  Calendar,
  User,
  X,
  Play,
  Check,
  AlertCircle,
  FileText,
  Info
} from 'lucide-react';

interface Assignee {
  id: number;
  full_name: string;
}

interface Task {
  id: number;
  title: string;
  description?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'not_done' | 'cancelled' | string;
  priority: 'low' | 'medium' | 'high' | 'critical' | string;
  start_date?: string | null;
  end_date?: string | null;
  completion_note?: string | null;
  assignee?: Assignee | null;
}

interface BoardColumn {
  id: 'pending' | 'in_progress' | 'completed' | 'not_done' | 'cancelled';
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export default function KanbanPage() {
  const { showSuccess, showError } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Detail Modal states
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const COLUMNS: BoardColumn[] = [
    { id: 'pending', label: '⏳ À faire', color: '#3498DB', bgColor: 'bg-blue-500/5', borderColor: 'border-blue-500/20' },
    { id: 'in_progress', label: '⚡ En cours', color: '#F1C40F', bgColor: 'bg-amber-500/5', borderColor: 'border-amber-500/20' },
    { id: 'completed', label: '✅ Terminé', color: '#2ECC71', bgColor: 'bg-green-500/5', borderColor: 'border-green-500/20' },
    { id: 'not_done', label: '❌ Non effectué', color: '#E74C3C', bgColor: 'bg-red-500/5', borderColor: 'border-red-500/20' },
    { id: 'cancelled', label: '🚫 Annulé', color: '#95A5A6', bgColor: 'bg-slate-500/5', borderColor: 'border-slate-500/20' }
  ];

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await API.get('/tasks');
      if (res.data) setTasks(res.data);
    } catch (err: any) {
      showError(err.message || 'Erreur lors du chargement des tâches.');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMoveTask = async (id: number, newStatus: string) => {
    let completion_note = '';
    if (newStatus === 'completed' || newStatus === 'not_done') {
      const note = prompt('Note de réalisation ou justification de l\'échec (optionnel) :');
      if (note === null) return; // user cancelled the prompt
      completion_note = note.trim();
    }

    try {
      await API.put(`/tasks/${id}`, { status: newStatus, completion_note });
      showSuccess('Tâche déplacée avec succès !');
      loadData();
      // If modal is open for this task, update it
      if (selectedTask && selectedTask.id === id) {
        setSelectedTask(prev => prev ? { ...prev, status: newStatus, completion_note } : null);
      }
    } catch (err: any) {
      showError(err.message || 'Erreur lors du déplacement de la tâche.');
    }
  };

  const getPriorityBadge = (p: string) => {
    const map: Record<string, string> = {
      low: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
      medium: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      high: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      critical: 'bg-red-500/10 text-red-600 border-red-500/20 animate-pulse',
    };
    const labels: Record<string, string> = {
      low: 'Basse',
      medium: 'Moyenne',
      high: 'Haute',
      critical: 'Critique',
    };
    const cls = map[p] || 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    return (
      <span className={`border px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${cls}`}>
        {labels[p] || p}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">📋 Tableau Kanban des Tâches</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Suivi visuel des interventions de maintenance et tâches techniques
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20 bg-bg-surface border border-border-custom rounded-2xl">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-text-secondary mt-3">Chargement du tableau...</span>
        </div>
      ) : (
        /* Kanban Columns Wrapper */
        <div className="flex gap-4 overflow-x-auto pb-4 select-none no-scrollbar">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                className={`flex-1 min-w-[270px] max-w-[320px] rounded-2xl border ${col.borderColor} ${col.bgColor} p-4 flex flex-col space-y-3.5`}
              >
                {/* Column Title */}
                <div className="flex items-center justify-between pb-2 border-b border-border-custom">
                  <span className="text-xs font-extrabold tracking-wide uppercase text-text-primary">
                    {col.label}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-bg-surface text-text-secondary border border-border-custom">
                    {colTasks.length}
                  </span>
                </div>

                {/* Tasks List */}
                <div className="flex-1 overflow-y-auto max-h-[calc(100vh-270px)] min-h-[250px] space-y-3.5 pr-1 no-scrollbar">
                  {colTasks.length > 0 ? (
                    colTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTask(t)}
                        style={{ borderLeftColor: col.color }}
                        className="rounded-xl border border-border-custom bg-bg-surface p-3.5 shadow-sm hover:shadow-md cursor-pointer hover:border-text-secondary/20 transition-all space-y-2.5 border-l-4"
                      >
                        <h4 className="text-xs font-bold text-text-primary leading-snug line-clamp-2">
                          {t.title}
                        </h4>
                        <p className="text-[11px] text-text-muted font-semibold line-clamp-2 leading-relaxed">
                          {t.description || 'Aucune description...'}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-text-secondary font-bold pt-1 border-t border-border-custom/50">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-text-muted" />
                            {t.assignee?.full_name || 'Non assigné'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-text-muted" />
                            {t.end_date ? new Date(t.end_date).toLocaleDateString('fr-FR') : '—'}
                          </span>
                        </div>

                        {/* Fast Column Actions */}
                        {col.id === 'pending' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveTask(t.id, 'in_progress');
                            }}
                            className="w-full mt-2 py-1.5 rounded-lg border border-yellow-500/20 bg-yellow-500/10 hover:bg-yellow-500/15 text-yellow-600 text-[10px] font-extrabold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            <Play className="w-3 h-3" /> Démarrer ➔
                          </button>
                        )}
                        {col.id === 'in_progress' && (
                          <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleMoveTask(t.id, 'completed')}
                              className="flex-1 py-1.5 rounded-lg bg-green-500/15 text-green-500 border border-green-500/20 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer hover:bg-green-500/20"
                            >
                              <Check className="w-3 h-3" /> Fait
                            </button>
                            <button
                              onClick={() => handleMoveTask(t.id, 'not_done')}
                              className="flex-1 py-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer hover:bg-red-500/15"
                            >
                              <X className="w-3 h-3" /> Rater
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 text-text-muted text-[10px] font-bold uppercase tracking-wider">
                      Aucune tâche
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TASK DETAILS MODAL */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" /> Détails de l'intervention
              </h3>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs font-semibold text-text-secondary">
              <div>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Titre</span>
                <p className="text-sm font-extrabold text-text-primary mt-0.5 leading-snug">{selectedTask.title}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Description</span>
                <p className="mt-1 leading-relaxed text-text-primary bg-bg-surface-2 p-3 rounded-xl border border-border-custom/50 whitespace-pre-wrap">{selectedTask.description || '—'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Priorité</span>
                  <div className="mt-1">{getPriorityBadge(selectedTask.priority)}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Assigné à</span>
                  <p className="mt-1.5 font-bold text-text-primary flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-text-muted" />
                    {selectedTask.assignee?.full_name || 'Non assigné'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border-custom/50">
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Date de début</span>
                  <p className="mt-1 text-text-primary font-bold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-text-muted" />
                    {selectedTask.start_date ? new Date(selectedTask.start_date).toLocaleDateString('fr-FR') : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Échéance</span>
                  <p className="mt-1 text-text-primary font-bold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-text-muted" />
                    {selectedTask.end_date ? new Date(selectedTask.end_date).toLocaleDateString('fr-FR') : '—'}
                  </p>
                </div>
              </div>

              {selectedTask.completion_note && (
                <div className="pt-2 border-t border-border-custom/50">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Note de complétion</span>
                  <div className="mt-1 bg-yellow-500/5 text-yellow-600 border border-yellow-500/10 p-3 rounded-xl whitespace-pre-wrap">
                    {selectedTask.completion_note}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border-custom flex justify-end">
              <button
                onClick={() => setSelectedTask(null)}
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
