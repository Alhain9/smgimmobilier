'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API, CONFIG } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import { io, Socket } from 'socket.io-client';
import {
  MapPin,
  Compass,
  Navigation,
  ExternalLink,
  Users
} from 'lucide-react';

interface PositionLog {
  user_id: number;
  latitude: number;
  longitude: number;
  recorded_at: string;
  user?: {
    full_name: string;
  } | null;
}

export default function GpsPage() {
  const { user } = useAuth();
  const { showError, showInfo } = useToast();

  const [positions, setPositions] = useState<PositionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await API.get('/gps/latest');
      if (res.data) setPositions(res.data);
    } catch (err: any) {
      showError(err.message || 'Impossible de charger la géolocalisation des agents.');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  // Socket.IO Real-time Connection
  useEffect(() => {
    const token = API.token();
    if (!token) return;

    // Connect to WebSocket Server
    const socket: Socket = io(CONFIG.SERVER_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('🔌 Socket.IO connecté dans GPS Page');
      if (user && user.role) {
        socket.emit('join:role', user.role);
      }
    });

    socket.on('gps:position', (data: any) => {
      console.log('📍 Reçu gps:position', data);
      showInfo(`📍 Nouvelle position signalée par l'agent #${data.userId}`);
      
      setPositions((prev) => {
        const idx = prev.findIndex(p => p.user_id === data.userId);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            latitude: data.latitude,
            longitude: data.longitude,
            recorded_at: data.recorded_at
          };
          return updated;
        } else {
          return [
            ...prev,
            {
              user_id: data.userId,
              latitude: data.latitude,
              longitude: data.longitude,
              recorded_at: data.recorded_at,
              user: data.userName ? { full_name: data.userName } : { full_name: 'Agent terrain' }
            }
          ];
        }
      });
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ Connexion socket error in GPS:', err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [user, showInfo]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">📍 Géolocalisation des Agents</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Suivi des positions GPS en direct des équipes d'intervention sur le terrain
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Real-time status badge box */}
        <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-6 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-xl animate-pulse">
            📍
          </div>
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Suivi en temps réel actif</h3>
          <p className="text-xs text-text-secondary max-w-xl mx-auto font-semibold leading-relaxed">
            Les coordonnées géographiques des agents terrain s'actualisent automatiquement à l'écran dès qu'un signal GPS est transmis par leur mobile.
          </p>
        </div>

        {/* Positions List */}
        <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4">
          <h3 className="text-base font-bold text-text-primary flex items-center gap-2 pb-2 border-b border-border-custom">
            👥 Dernières positions signalées (24h)
          </h3>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
              <span className="text-xs text-text-muted font-bold">Localisation des agents...</span>
            </div>
          ) : positions.length > 0 ? (
            <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                    <th className="px-5 py-3.5">Agent</th>
                    <th className="px-5 py-3.5">Coordonnées</th>
                    <th className="px-5 py-3.5">Dernier signalement</th>
                    <th className="px-5 py-3.5 text-right no-print">Cartographie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-custom text-xs font-semibold">
                  {positions.map((p, idx) => (
                    <tr key={idx} className="hover:bg-bg-hover/50 transition-colors">
                      <td className="px-5 py-3.5 text-text-primary font-extrabold flex items-center gap-2">
                        <Users className="w-4 h-4 text-text-muted" />
                        {p.user?.full_name || 'Agent Terrain'}
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary font-mono">
                        <code>
                          {p.latitude.toFixed(6)}, {p.longitude.toFixed(6)}
                        </code>
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary">
                        {new Date(p.recorded_at).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-5 py-3.5 text-right no-print">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border-custom bg-bg-surface hover:bg-bg-hover text-[11px] font-bold text-text-secondary hover:text-text-primary transition-all shadow-sm"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-primary" /> Voir sur Maps
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10 text-text-muted text-xs font-bold">
              Aucune position signalée récemment
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
