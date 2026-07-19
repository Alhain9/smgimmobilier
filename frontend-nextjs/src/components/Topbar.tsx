'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { API } from '../services/api';
import { Helpers } from '../utils/helpers';
import { Menu, Bell, Sun, Moon, CheckCheck, Clock } from 'lucide-react';
import Link from 'next/link';

interface TopbarProps {
  title: string;
  onToggleSidebar: () => void;
}

interface NotificationItem {
  id: number;
  title: string;
  message?: string;
  is_read: boolean;
  created_at: string;
}

export default function Topbar({ title, onToggleSidebar }: TopbarProps) {
  const { user, getRoleLabel } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showSuccess, showError } = useToast();
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const [activePointage, setActivePointage] = useState<any>(null);
  const [loadingPointage, setLoadingPointage] = useState(false);

  const fetchActivePointage = async () => {
    if (!user || user.role?.name === 'locataire') return;
    try {
      const res = await API.get(`/rh/pointages?user_id=${user.id}`);
      if (res.data && Array.isArray(res.data)) {
        const active = res.data.find((l: any) => l.user_id === user.id && !l.exit_time);
        setActivePointage(active || null);
      }
    } catch (_) {
      // Ignorer
    }
  };

  useEffect(() => {
    fetchActivePointage();
    const handlePointageUpdate = () => {
      fetchActivePointage();
    };
    window.addEventListener('pointage-updated', handlePointageUpdate);
    return () => window.removeEventListener('pointage-updated', handlePointageUpdate);
  }, [user]);

  const handleQuickPointage = async () => {
    if (loadingPointage) return;
    setLoadingPointage(true);
    try {
      if (activePointage) {
        const notes = prompt("Notes de sortie (optionnel) :") || '';
        await API.post('/rh/pointages/sortie', { notes });
        showSuccess("Pointage de sortie enregistré !");
        setActivePointage(null);
      } else {
        const notes = prompt("Notes d'entrée (optionnel) :") || '';
        await API.post('/rh/pointages/entree', { notes });
        showSuccess("Pointage d'entrée enregistré !");
      }
      await fetchActivePointage();
      window.dispatchEvent(new Event('pointage-updated'));
    } catch (err: any) {
      showError(err.message || 'Erreur de pointage.');
    } finally {
      setLoadingPointage(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const res = await API.get('/notifications');
      if (res.data) {
        setNotifications(res.data.items || []);
        setUnreadCount(res.data.unread || 0);
      }
    } catch (_) {
      // Ignorer
    }
  };

  useEffect(() => {
    loadNotifications();
    // Rafraîchir toutes les 30s
    const timer = setInterval(loadNotifications, 30000);
    return () => clearInterval(timer);
  }, []);

  // Fermer le panneau si on clique à l'extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await API.patch(`/notifications/${id}/read`);
      loadNotifications();
    } catch (_) {
      // Ignorer
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await API.patch('/notifications/read-all');
      loadNotifications();
      showSuccess('Toutes les notifications sont marquées comme lues');
      setIsNotifOpen(false);
    } catch (_) {
      // Ignorer
    }
  };

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-border-custom bg-bg-surface select-none">
      {/* Left section: Toggle Menu & Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary lg:hidden cursor-pointer"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold text-text-primary tracking-tight">{title}</h1>
      </div>

      {/* Right section: Actions (Notifs, Theme, Profile) */}
      <div className="flex items-center gap-4">
        {/* Notifications Center */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative p-2 rounded-xl text-text-secondary hover:bg-bg-hover hover:text-text-primary cursor-pointer transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-extrabold bg-red-500 text-white animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {isNotifOpen && (
            <div className="absolute right-0 mt-2 z-50 w-80 max-h-[400px] flex flex-col rounded-2xl border border-border-custom bg-bg-surface shadow-lg overflow-hidden animate-slide-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-custom bg-bg-surface-2">
                <span className="font-semibold text-sm text-text-primary">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Tout lire
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar max-h-72">
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleMarkRead(n.id)}
                      className={`px-4 py-3 border-b border-border-custom last:border-0 hover:bg-bg-hover cursor-pointer transition-colors ${
                        n.is_read ? 'opacity-70' : 'bg-primary/5 font-medium'
                      }`}
                    >
                      <div className="text-sm text-text-primary font-bold">{n.title}</div>
                      <div className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.message}</div>
                      <div className="text-[10px] text-text-muted mt-1">
                        {Helpers.formatDateTime(n.created_at)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted">
                    <span className="text-2xl mb-2">🔔</span>
                    <span className="text-sm">Aucune notification</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Attendance / Pointage button */}
        {user && user.role?.name !== 'locataire' && (
          <button
            onClick={handleQuickPointage}
            disabled={loadingPointage}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
              activePointage
                ? 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/15'
                : 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/15'
            }`}
            title={activePointage ? "Session active : cliquer pour dépointer" : "Cliquer pour pointer l'entrée"}
          >
            <Clock className={`w-4 h-4 ${activePointage ? 'animate-pulse' : ''}`} />
            <span className="hidden md:inline">
              {activePointage ? 'En service' : 'Pointer entrée'}
            </span>
            {activePointage && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block md:hidden" />
            )}
            {!activePointage && (
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block md:hidden" />
            )}
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-text-secondary hover:bg-bg-hover hover:text-text-primary cursor-pointer transition-colors"
          title="Changer de thème"
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>

        {/* User Chip */}
        {user && (
          <Link
            href="/dashboard/profile"
            className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-full border border-border-custom bg-bg-surface-2 hover:bg-bg-hover cursor-pointer transition-colors select-none"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-xs font-extrabold tracking-wider">
              {Helpers.initials(user.full_name)}
            </div>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-xs font-bold text-text-primary line-clamp-1">{user.full_name}</div>
              <div className="text-[10px] text-text-muted">{getRoleLabel()}</div>
            </div>
          </Link>
        )}
      </div>
    </header>
  );
}
