'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import {
  Calendar,
  Users,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  X,
  Clock,
  User,
  Check,
  AlertCircle
} from 'lucide-react';

interface Creator {
  id: number;
  full_name: string;
}

interface Participant {
  id: number;
  full_name: string;
}

interface CalendarEvent {
  id: number;
  title: string;
  start_datetime: string;
  end_datetime?: string | null;
  is_meeting: boolean;
  created_by: number;
  creator?: Creator | null;
  participants?: Participant[];
}

interface CalendarOwner {
  id: number;
  full_name: string;
}

interface ParticipantOption {
  id: number;
  full_name: string;
}

export default function CalendarPage() {
  const { user, hasRole } = useAuth();
  const { showSuccess, showError } = useToast();

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<CalendarOwner[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>('');
  const [isLoadedCalendars, setIsLoadedCalendars] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  // Create Event Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evStart, setEvStart] = useState('');
  const [evEnd, setEvEnd] = useState('');
  const [evMeeting, setEvMeeting] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);
  const [participantOptions, setParticipantOptions] = useState<ParticipantOption[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

  // View Event Modal States
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Load Calendars List
  const loadCalendars = useCallback(async () => {
    try {
      const res = await API.get('/calendar/calendars');
      if (res.data) {
        setCalendars(res.data);
      }
    } catch (_) {
      setCalendars([]);
    } finally {
      setIsLoadedCalendars(true);
    }
  }, []);

  // Load Events on month bounds
  const loadEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const start = new Date(y, m - 1, 1).toISOString();
    const end = new Date(y, m + 2, 0).toISOString();

    let url = `/calendar?start=${start}&end=${end}`;
    if (selectedOwner && selectedOwner !== 'all') {
      url += `&owner_id=${selectedOwner}`;
    }

    try {
      const res = await API.get(url);
      if (res.data) {
        setEvents(res.data);
      }
    } catch (err: any) {
      showError(err.message || 'Impossible de charger les événements.');
      setEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [currentDate, selectedOwner, showError]);

  useEffect(() => {
    if (user) {
      if (!isLoadedCalendars) {
        loadCalendars();
      }
      loadEvents();
    }
  }, [user, currentDate, selectedOwner, isLoadedCalendars, loadCalendars, loadEvents]);

  // Load participant options when turning on meeting mode
  useEffect(() => {
    if (evMeeting && participantOptions.length === 0) {
      const fetchParticipants = async () => {
        setIsLoadingParticipants(true);
        try {
          const res = await API.get('/calendar/participant-options');
          if (res.data) {
            setParticipantOptions(res.data);
          }
        } catch (_) {
          setParticipantOptions([]);
        } finally {
          setIsLoadingParticipants(false);
        }
      };
      fetchParticipants();
    }
  }, [evMeeting, participantOptions]);

  // Calendar calculations
  const monthName = () => {
    const raw = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleOwnerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedOwner(e.target.value);
  };

  const handleOpenCreateModal = (dateStr?: string) => {
    setEvTitle('');
    setEvStart(dateStr ? `${dateStr}T09:00` : '');
    setEvEnd('');
    setEvMeeting(false);
    setSelectedParticipants([]);
    setIsCreateOpen(true);
  };

  const handleToggleParticipant = (id: number) => {
    setSelectedParticipants((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const handleSelectAllParticipants = () => {
    setSelectedParticipants(participantOptions.map((p) => p.id));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evTitle.trim() || !evStart) {
      showError('Le titre et la date de début sont obligatoires.');
      return;
    }

    const payload: any = {
      title: evTitle.trim(),
      start_datetime: evStart,
      end_datetime: evEnd || null,
      is_meeting: evMeeting,
    };

    if (evMeeting) {
      payload.participant_ids = selectedParticipants;
    }

    try {
      await API.post('/calendar', payload);
      showSuccess('Événement créé avec succès.');
      setIsCreateOpen(false);
      loadEvents();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la création de l\'événement.');
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet événement ?')) return;
    try {
      await API.delete(`/calendar/${id}`);
      showSuccess('Événement supprimé avec succès.');
      setSelectedEvent(null);
      loadEvents();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la suppression de l\'événement.');
    }
  };

  // Draw Grid helper arrays
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();
  const firstDayOfMonth = new Date(y, m, 1);
  const startDayOffset = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // Calendar cells mapping
  const cells: React.ReactNode[] = [];

  // Empty cells for the offset
  for (let i = 0; i < startDayOffset; i++) {
    cells.push(
      <div
        key={`offset-${i}`}
        className="min-h-[100px] p-2 border border-border-custom bg-bg-surface-2/40 opacity-45 select-none"
      />
    );
  }

  // Active month days
  const todayStr = new Date().toDateString();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    const isToday = date.toDateString() === todayStr;
    const isoDateStr = date.toISOString().slice(0, 10);

    const dayEvents = events.filter(
      (e) => new Date(e.start_datetime).toDateString() === date.toDateString()
    );

    cells.push(
      <div
        key={`day-${d}`}
        onClick={() => handleOpenCreateModal(isoDateStr)}
        className={`min-h-[100px] p-2 border border-border-custom bg-bg-surface hover:bg-bg-hover/30 transition-all flex flex-col justify-between cursor-pointer group rounded-xl ${
          isToday ? 'ring-2 ring-primary ring-inset bg-primary/5' : ''
        }`}
      >
        <div className="flex justify-between items-center mb-1">
          <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
            isToday ? 'bg-primary text-white' : 'text-text-secondary'
          }`}>
            {d}
          </span>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-primary font-bold">
            + Ajouter
          </span>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto no-scrollbar max-h-[75px] mt-1">
          {dayEvents.map((e) => {
            const isMine = user && e.created_by === user.id;
            const meetingTag = e.is_meeting ? '👥 ' : '';
            const ownerTag = !isMine && e.creator ? ` · ${e.creator.full_name.split(' ')[0]}` : '';
            return (
              <div
                key={e.id}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setSelectedEvent(e);
                }}
                className={`text-[10px] font-semibold p-1 rounded truncate border transition-all hover:brightness-95 select-none ${
                  e.is_meeting
                    ? 'bg-sky-500/10 text-sky-600 border-sky-500/25'
                    : 'bg-primary/10 text-primary border-primary/25'
                }`}
                title={e.title}
              >
                {meetingTag}
                {e.title}
                {ownerTag}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Determine permissions to delete
  const canDeleteEvent = (e: CalendarEvent) => {
    if (!user) return false;
    return e.created_by === user.id || hasRole('manager', 'super_admin');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            📅 Calendrier
          </h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Tâches, échéances et maintenances immobilières
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-border-custom bg-bg-surface p-1 shadow-sm">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1 rounded-lg hover:bg-bg-hover text-xs font-bold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              Aujourd'hui
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => handleOpenCreateModal()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" /> Nouvel événement
          </button>
        </div>
      </div>

      {/* Calendars Selectors (Conditional on availability) */}
      {calendars.length > 0 && (
        <div className="flex flex-col gap-1.5 max-w-[280px]">
          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Afficher le calendrier</label>
          <select
            value={selectedOwner}
            onChange={handleOwnerChange}
            className="px-3.5 py-2.5 border border-border-custom bg-bg-surface rounded-xl focus:outline-none text-xs font-semibold cursor-pointer shadow-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all text-text-primary"
          >
            <option value="">Mon calendrier</option>
            <option value="all">Tous les calendriers visibles</option>
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Calendar Grid Card */}
      <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4">
        {/* Month Header */}
        <div className="pb-3 border-b border-border-custom flex justify-between items-center">
          <h3 className="text-lg font-bold text-text-primary uppercase tracking-wide">
            {monthName()}
          </h3>
          {isLoadingEvents && (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase tracking-wider text-text-muted py-2 select-none">
          {dayNames.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Calendar Grid Cells */}
        <div className="grid grid-cols-7 gap-2.5">
          {cells}
        </div>
      </div>

      {/* CREATE EVENT MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                📅 Nouvel événement
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 text-sm font-semibold no-scrollbar">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Titre de l'événement *</label>
                <input
                  type="text"
                  value={evTitle}
                  onChange={(e) => setEvTitle(e.target.value)}
                  placeholder="Ex: Réunion de chantier"
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Date & Heure Début *</label>
                  <input
                    type="datetime-local"
                    value={evStart}
                    onChange={(e) => setEvStart(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Date & Heure Fin</label>
                  <input
                    type="datetime-local"
                    value={evEnd}
                    onChange={(e) => setEvEnd(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 text-text-primary cursor-pointer select-none font-bold text-sm">
                  <input
                    type="checkbox"
                    checked={evMeeting}
                    onChange={(e) => setEvMeeting(e.target.checked)}
                    className="w-4 h-4 text-primary rounded border-border-custom focus:ring-0"
                  />
                  <span>👥 Réunion / événement partagé</span>
                </label>
              </div>

              {evMeeting && (
                <div className="p-4 rounded-xl border border-border-custom bg-bg-surface-2 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-extrabold uppercase text-text-secondary">Participants</label>
                    <button
                      type="button"
                      onClick={handleSelectAllParticipants}
                      className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      Tout le personnel
                    </button>
                  </div>

                  {isLoadingParticipants ? (
                    <div className="flex items-center gap-2 py-3 text-xs text-text-muted justify-center">
                      <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span>Chargement du personnel...</span>
                    </div>
                  ) : (
                    <div className="max-h-[160px] overflow-y-auto border border-border-custom rounded-xl p-3 bg-bg-surface space-y-2.5 no-scrollbar">
                      {participantOptions.length > 0 ? (
                        participantOptions.map((opt) => {
                          const checked = selectedParticipants.includes(opt.id);
                          return (
                            <label
                              key={opt.id}
                              className="flex items-center gap-2.5 text-text-secondary font-medium text-xs cursor-pointer select-none"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleParticipant(opt.id)}
                                className="w-3.5 h-3.5 text-primary rounded border-border-custom"
                              />
                              <span>{opt.full_name}</span>
                            </label>
                          );
                        })
                      ) : (
                        <div className="text-xs text-text-muted italic text-center py-2">
                          Aucun autre utilisateur disponible
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-border-custom flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-colors"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW EVENT DETAIL MODAL */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                {selectedEvent.is_meeting ? '👥 ' : '📅 '} {selectedEvent.title}
              </h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-5 space-y-3.5 text-sm font-semibold">
              <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border-custom bg-bg-surface-2">
                <Clock className="w-4 h-4 text-primary" />
                <div className="flex-1">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Début</p>
                  <p className="text-text-primary font-bold mt-0.5">{Helpers.formatDateTime(selectedEvent.start_datetime)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border-custom bg-bg-surface-2">
                <Clock className="w-4 h-4 text-text-muted" />
                <div className="flex-1">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Fin</p>
                  <p className="text-text-primary font-bold mt-0.5">
                    {selectedEvent.end_datetime ? Helpers.formatDateTime(selectedEvent.end_datetime) : '—'}
                  </p>
                </div>
              </div>

              {selectedEvent.creator && (
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border-custom bg-bg-surface-2">
                  <User className="w-4 h-4 text-primary" />
                  <div className="flex-1">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Organisateur</p>
                    <p className="text-text-primary font-bold mt-0.5">{selectedEvent.creator.full_name}</p>
                  </div>
                </div>
              )}

              {selectedEvent.is_meeting && (
                <div className="p-3.5 rounded-xl border border-border-custom bg-bg-surface-2 space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wider font-bold">
                    <Users className="w-4 h-4 text-primary" />
                    <span>Participants ({selectedEvent.participants?.length || 0})</span>
                  </div>
                  <div className="text-xs text-text-secondary leading-relaxed bg-bg-surface rounded-lg p-2.5 border border-border-custom max-h-[110px] overflow-y-auto no-scrollbar font-medium">
                    {selectedEvent.participants && selectedEvent.participants.length > 0 ? (
                      selectedEvent.participants.map((p) => p.full_name).join(', ')
                    ) : (
                      <span className="italic text-text-muted">Aucun participant</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border-custom flex justify-end gap-2.5">
              {canDeleteEvent(selectedEvent) && (
                <button
                  onClick={() => handleDeleteEvent(selectedEvent.id)}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/15 border border-red-500/25 rounded-xl text-xs font-bold text-red-500 flex items-center gap-1 cursor-pointer transition-colors mr-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer
                </button>
              )}
              <button
                onClick={() => setSelectedEvent(null)}
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
