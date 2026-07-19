'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { API } from '../../services/api';
import { Helpers } from '../../utils/helpers';
import {
  Building2,
  DoorClosed,
  Users,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  Zap,
  Wrench,
  FolderOpen,
  Hammer,
  CheckSquare,
  Banknote,
  Activity,
  Calendar,
  CheckCircle,
  FileText,
  Clock,
  Printer,
  ChevronRight,
  Plus
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, hasRole, getRoleLabel } = useAuth();
  const { showSuccess, showError } = useToast();

  const [isLoading, setIsLoading] = useState(true);

  // Admin states
  const [adminStats, setAdminStats] = useState<any>(null);
  const [revenueStats, setRevenueStats] = useState<number[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [myDay, setMyDay] = useState<any>(null);

  // Period performance states
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [periodData, setPeriodData] = useState<any>(null);
  const [isPeriodLoading, setIsPeriodLoading] = useState(false);

  // Technician states
  const [techStats, setTechStats] = useState<any>(null);
  const [techInterventions, setTechInterventions] = useState<any[]>([]);
  const [techPeriodData, setTechPeriodData] = useState<any>(null);

  // Tenant states
  const [tenantProfile, setTenantProfile] = useState<any>(null);
  const [tenantLedger, setTenantLedger] = useState<any>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isMaintModalOpen, setIsMaintModalOpen] = useState(false);

  // Tenant actions inputs
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('orange_money');
  const [maintTitle, setMaintTitle] = useState('');
  const [maintDesc, setMaintDesc] = useState('');
  const [maintPriority, setMaintPriority] = useState('medium');

  // Pointage states & functions
  const [activeAttendance, setActiveAttendance] = useState<any>(null);

  const fetchActiveAttendance = async () => {
    if (!user || user.role?.name === 'locataire') return;
    try {
      const res = await API.get(`/rh/pointages?user_id=${user.id}`);
      if (res.data && Array.isArray(res.data)) {
        const active = res.data.find((l: any) => l.user_id === user.id && !l.exit_time);
        setActiveAttendance(active || null);
      }
    } catch (_) {}
  };

  const handleCheckIn = async () => {
    const notes = prompt("Notes d'entrée (optionnel) :") || '';
    try {
      await API.post('/rh/pointages/entree', { notes });
      showSuccess("Pointage d'entrée enregistré !");
      fetchActiveAttendance();
      window.dispatchEvent(new Event('pointage-updated'));
    } catch (err: any) {
      showError(err.message || 'Erreur de pointage.');
    }
  };

  const handleCheckOut = async () => {
    const notes = prompt("Notes de sortie (optionnel) :") || '';
    try {
      await API.post('/rh/pointages/sortie', { notes });
      showSuccess("Pointage de sortie enregistré !");
      setActiveAttendance(null);
      window.dispatchEvent(new Event('pointage-updated'));
    } catch (err: any) {
      showError(err.message || 'Erreur de pointage.');
    }
  };

  // Charge initial dashboard data based on role
  const loadDashboard = async () => {
    setIsLoading(true);
    const role = user?.role?.name;

    if (role && role !== 'locataire') {
      fetchActiveAttendance();
    }

    try {
      if (role === 'locataire') {
        // Tenant view
        const profRes = await API.get('/tenants/me/profile');
        if (profRes.data) {
          setTenantProfile(profRes.data);
          const lease = profRes.data.leases?.[0];
          if (lease) setPayAmount(String(lease.monthly_rent));
        }
        try {
          const ledgerRes = await API.get('/payments/me/ledger');
          if (ledgerRes.data) setTenantLedger(ledgerRes.data);
        } catch (_) {}
      } else if (role === 'technicien') {
        // Technician view
        const statRes = await API.get('/dashboard/technician');
        if (statRes.data) setTechStats(statRes.data);
        const maintRes = await API.get(`/maintenance?technician_id=${user?.id}`);
        if (maintRes.data) setTechInterventions(maintRes.data.slice(0, 8));
        
        // Load default period 30 days
        const end = new Date();
        const start = new Date(end.getTime() - 29 * 86400000);
        const startStr = start.toISOString().slice(0, 10);
        const endStr = end.toISOString().slice(0, 10);
        const perRes = await API.get(`/dashboard/worker-period?start=${startStr}&end=${endStr}`);
        if (perRes.data) setTechPeriodData(perRes.data);

        // Load day scope
        const dayRes = await API.get('/dashboard/day?scope=me');
        if (dayRes.data) setMyDay(dayRes.data.day?.counts);
      } else {
        // Admin / Staff view
        const statsRes = await API.get('/dashboard/stats');
        if (statsRes.data) setAdminStats(statsRes.data);
        const revRes = await API.get('/dashboard/revenue');
        if (revRes.data) setRevenueStats(revRes.data);
        const secRes = await API.get('/dashboard/sector-summary');
        if (secRes.data) setSectors(secRes.data);
        const dayRes = await API.get('/dashboard/day?scope=me');
        if (dayRes.data) setMyDay(dayRes.data.day?.counts);

        // Load performance statistics
        if (hasRole('manager', 'super_admin', 'dir_admin', 'comptable')) {
          const end = new Date();
          const start = new Date(end.getTime() - 29 * 86400000);
          const startStr = start.toISOString().slice(0, 10);
          const endStr = end.toISOString().slice(0, 10);
          setPeriodStart(startStr);
          setPeriodEnd(endStr);
          loadPeriodPerformance(startStr, endStr);
        }
      }
    } catch (err: any) {
      showError(err.message || 'Erreur lors du chargement des données.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPeriodPerformance = async (start: string, end: string) => {
    setIsPeriodLoading(true);
    try {
      const res = await API.get(`/dashboard/period?start=${start}&end=${end}`);
      if (res.data) setPeriodData(res.data);
    } catch (_) {
      showError('Impossible de charger les performances sur la période.');
    } finally {
      setIsPeriodLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDashboard();
    }
  }, [user]);

  useEffect(() => {
    const handlePointageUpdate = () => {
      fetchActiveAttendance();
    };
    window.addEventListener('pointage-updated', handlePointageUpdate);
    return () => window.removeEventListener('pointage-updated', handlePointageUpdate);
  }, []);

  const handlePeriodPreset = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 86400000);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    setPeriodStart(startStr);
    setPeriodEnd(endStr);
    loadPeriodPerformance(startStr, endStr);
  };

  const handlePeriodApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodStart || !periodEnd) {
      showError('Veuillez renseigner les deux dates.');
      return;
    }
    if (periodStart > periodEnd) {
      showError('La date de début doit précéder la date de fin.');
      return;
    }
    loadPeriodPerformance(periodStart, periodEnd);
  };

  // Declare Tenant Payment
  const handleDeclarePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount || parseFloat(payAmount) <= 0) {
      showError('Veuillez saisir un montant valide.');
      return;
    }
    try {
      await API.post('/payments', {
        amount: parseFloat(payAmount),
        payment_method: payMethod,
        payment_date: new Date().toISOString().slice(0, 10),
      });
      showSuccess('Déclaration de paiement soumise avec succès.');
      setIsPayModalOpen(false);
      loadDashboard();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la déclaration du paiement.');
    }
  };

  // Request Maintenance
  const handleRequestMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintTitle.trim() || !maintDesc.trim()) {
      showError('Veuillez remplir le titre et la description.');
      return;
    }
    try {
      await API.post('/maintenance', {
        title: maintTitle.trim(),
        description: maintDesc.trim(),
        priority: maintPriority,
      });
      showSuccess('Demande de maintenance envoyée.');
      setIsMaintModalOpen(false);
      setMaintTitle('');
      setMaintDesc('');
      loadDashboard();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la création de la demande.');
    }
  };

  const statCard = (icon: React.ReactNode, color: string, value: any, name: string) => {
    const bgColors: Record<string, string> = {
      sky: 'bg-sky-500/10 text-sky-500',
      green: 'bg-green-500/10 text-green-500',
      orange: 'bg-amber-500/10 text-amber-500',
      red: 'bg-red-500/10 text-red-500',
    };
    return (
      <div className="flex items-center gap-4 p-5 rounded-2xl border border-border-custom bg-bg-surface shadow-sm transition-all duration-200">
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold text-text-secondary mt-3">Chargement des indicateurs...</span>
      </div>
    );
  }

  const role = user?.role?.name;

  return (
    <div className="space-y-6">
      {/* Hello bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Bonjour, {user?.full_name.split(' ')[0]} 👋</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            {role === 'locataire'
              ? 'Votre espace locataire SMG IMMOBILIER'
              : role === 'technicien'
              ? 'Vos interventions techniques'
              : 'Vue d\'ensemble en temps réel'}
          </p>
        </div>
        {role === 'locataire' && (
          <div className="flex gap-3">
            <button
              onClick={() => setIsPayModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Déclarer un paiement
            </button>
            <button
              onClick={() => setIsMaintModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            >
              <Wrench className="w-4 h-4 text-primary" /> Demander une maintenance
            </button>
          </div>
        )}
      </div>

      {/* Pointage Alert Card (Staff only) */}
      {role && role !== 'locataire' && (
        <>
          {activeAttendance ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h4 className="font-extrabold text-red-500 text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" /> Session active de travail (Présent)
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
        </>
      )}

      {/* 1. TENANT DASHBOARD */}
      {role === 'locataire' && tenantProfile && (
        <>
          {/* Tenant KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCard(
              '🏠',
              'sky',
              tenantProfile.leases?.[0]?.apartment?.apartment_number || '—',
              'Mon logement'
            )}
            {statCard(
              '💰',
              'green',
              Helpers.formatMoney(tenantProfile.leases?.[0]?.monthly_rent),
              'Loyer mensuel'
            )}
            {statCard(
              '✅',
              'green',
              tenantProfile.payments?.filter((p: any) => p.status === 'completed').length || 0,
              'Paiements effectués'
            )}
            {statCard(
              '🔴',
              'red',
              tenantProfile.payments?.filter((p: any) => ['pending', 'failed', 'awaiting_confirmation'].includes(p.status)).length || 0,
              'Paiements en attente'
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contract details card */}
            <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm p-6">
              <h3 className="text-base font-bold text-text-primary mb-4 pb-2 border-b border-border-custom">Mon contrat</h3>
              {tenantProfile.leases?.[0] ? (
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-border-custom last:border-0">
                    <span className="text-text-secondary font-medium">Logement</span>
                    <span className="font-bold text-text-primary">
                      {tenantProfile.leases[0].apartment?.apartment_number} ({tenantProfile.leases[0].apartment?.apartment_type})
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border-custom last:border-0">
                    <span className="text-text-secondary font-medium">Immeuble</span>
                    <span className="font-bold text-text-primary">
                      {tenantProfile.leases[0].apartment?.property?.property_name} ({tenantProfile.leases[0].apartment?.property?.city})
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border-custom last:border-0">
                    <span className="text-text-secondary font-medium">Date de début</span>
                    <span className="font-bold text-text-primary">{Helpers.formatDate(tenantProfile.leases[0].start_date)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border-custom last:border-0">
                    <span className="text-text-secondary font-medium">Caution déposée</span>
                    <span className="font-bold text-text-primary">{Helpers.formatMoney(tenantProfile.leases[0].deposit_amount)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border-custom last:border-0">
                    <span className="text-text-secondary font-medium">Statut du contrat</span>
                    <span className={Helpers.statusBadge(tenantProfile.leases[0].status).className}>
                      {Helpers.statusBadge(tenantProfile.leases[0].status).label}
                    </span>
                  </div>

                  {tenantProfile.leases[0].contract_file && (
                    <a
                      href={Helpers.fileUrl(tenantProfile.leases[0].contract_file)}
                      target="_blank"
                      className="w-full flex items-center justify-center gap-2 py-3 mt-4 rounded-xl text-sm font-semibold border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-primary" /> Voir le contrat PDF
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-secondary text-center py-8">Aucun contrat actif configuré.</p>
              )}
            </div>

            {/* Ledger status card */}
            <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm p-6">
              <h3 className="text-base font-bold text-text-primary mb-4 pb-2 border-b border-border-custom">Synthèse de compte</h3>
              {tenantLedger ? (
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-border-custom last:border-0">
                    <span className="text-text-secondary font-medium">Cumul loyers dus</span>
                    <span className="font-bold text-text-primary">{Helpers.formatMoney(tenantLedger.total_du)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border-custom last:border-0">
                    <span className="text-text-secondary font-medium">Total payé & validé</span>
                    <span className="font-bold text-green-500">{Helpers.formatMoney(tenantLedger.total_valide)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border-custom last:border-0">
                    <span className="text-text-secondary font-medium">En cours de validation</span>
                    <span className="font-bold text-amber-500">{Helpers.formatMoney(tenantLedger.en_attente_preuve)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border-custom last:border-0">
                    <span className="text-text-secondary font-medium">Reste à payer</span>
                    <span className={`font-extrabold ${tenantLedger.solde > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {Helpers.formatMoney(Math.max(0, tenantLedger.solde))}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-secondary text-center py-8">Données financières indisponibles.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* 2. TECHNICIAN DASHBOARD */}
      {role === 'technicien' && techStats && (
        <>
          {/* Tech KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCard(<Wrench />, 'sky', techStats.assigned, 'Interventions assignées')}
            {statCard(<Clock />, 'orange', techStats.ongoing, 'En cours')}
            {statCard(<CheckCircle />, 'green', techStats.completed, 'Terminées')}
            {statCard(<CheckSquare />, 'red', techStats.pendingTasks, 'Tâches en attente')}
          </div>

          {/* Ma journée row */}
          {myDay && (
            <div className="p-5 rounded-2xl border border-border-custom bg-bg-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <h4 className="font-bold text-text-primary">Ma journée</h4>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {myDay.todo} à faire · {myDay.doing} en cours · {myDay.done} terminé(s) aujourd'hui · {myDay.events} événement(s)
                  </p>
                </div>
              </div>
              <Link href="/dashboard/activity" className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow cursor-pointer transition-colors">
                Voir ma journée →
              </Link>
            </div>
          )}

          {/* Productivity on period */}
          {techPeriodData && (
            <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm p-6">
              <div className="flex justify-between items-center mb-6 pb-2 border-b border-border-custom">
                <h3 className="text-base font-bold text-text-primary">📈 Productivité (30 derniers jours)</h3>
                <span className="text-xs text-text-muted">Période : {Helpers.formatDate(techPeriodData.start)} → {Helpers.formatDate(techPeriodData.end)}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-4 rounded-xl bg-bg-body border border-border-custom text-center">
                  <div className="text-2xl font-bold text-green-500">{techPeriodData.tasksCompleted}</div>
                  <div className="text-xs text-text-muted uppercase mt-1">Tâches résolues</div>
                </div>
                <div className="p-4 rounded-xl bg-bg-body border border-border-custom text-center">
                  <div className="text-2xl font-bold text-sky-500">{techPeriodData.maintenancesCompleted}</div>
                  <div className="text-xs text-text-muted uppercase mt-1">Chantiers clos</div>
                </div>
                <div className="p-4 rounded-xl bg-bg-body border border-border-custom text-center">
                  <div className="text-2xl font-bold text-amber-500">{techPeriodData.completionRate}%</div>
                  <div className="text-xs text-text-muted uppercase mt-1">Taux de complétion</div>
                </div>
                <div className="p-4 rounded-xl bg-bg-body border border-border-custom text-center">
                  <div className="text-2xl font-bold text-text-primary">{techPeriodData.tasksAssigned}</div>
                  <div className="text-xs text-text-muted uppercase mt-1">Tâches assignées</div>
                </div>
              </div>
            </div>
          )}

          {/* Interventions table */}
          <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-border-custom">
              <h3 className="text-base font-bold text-text-primary font-sans">Mes interventions récentes</h3>
              <Link href="/dashboard/maintenance" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                Tout voir <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
                    <th className="px-6 py-3">Réf</th>
                    <th className="px-6 py-3">Titre</th>
                    <th className="px-6 py-3">Logement</th>
                    <th className="px-6 py-3">Priorité</th>
                    <th className="px-6 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-custom text-sm">
                  {techInterventions.length > 0 ? (
                    techInterventions.map((m) => (
                      <tr key={m.id} className="hover:bg-bg-hover/50">
                        <td className="px-6 py-4 font-semibold">#{m.id}</td>
                        <td className="px-6 py-4 font-medium text-text-primary">{m.title}</td>
                        <td className="px-6 py-4 text-text-secondary">{m.apartment?.apartment_number || '—'}</td>
                        <td className="px-6 py-4">{Helpers.priorityBadge(m.priority).label}</td>
                        <td className="px-6 py-4">
                          <span className={Helpers.maintStatus(m.status).className}>
                            {Helpers.maintStatus(m.status).label}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-text-muted italic">
                        Aucune intervention récente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 3. STAFF / ADMIN DASHBOARD */}
      {role !== 'locataire' && role !== 'technicien' && adminStats && (
        <>
          {/* Admin KPI Grids (1st level) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCard(<Building2 />, 'sky', adminStats.properties, 'Immeubles')}
            {statCard(
              <DoorClosed />,
              'green',
              adminStats.free,
              'Logements libres'
            )}
            {statCard(<Users />, 'sky', adminStats.tenants, 'Locataires')}
            {statCard(<TrendingUp />, 'orange', `${adminStats.occupancyRate}%`, "Taux d'occupation")}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCard(
              <CreditCard />,
              'green',
              Helpers.formatMoney(adminStats.finance.revenue),
              'Revenus encaissés'
            )}
            {statCard(
              <AlertTriangle />,
              'red',
              Helpers.formatMoney(adminStats.finance.unpaid),
              'Impayés'
            )}
            {statCard(
              <Zap />,
              'orange',
              Helpers.formatMoney(adminStats.finance.charges),
              'Charges (dép. + sal.)'
            )}
            {statCard(<Wrench />, 'red', adminStats.maintenances?.active, 'Maintenances actives')}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCard(
              <Banknote />,
              'orange',
              Helpers.formatMoney(adminStats.finance.salariesPending),
              'Salaires à payer'
            )}
            {statCard(<FolderOpen />, 'sky', adminStats.documents, 'Documents')}
            {statCard(<Hammer />, 'sky', adminStats.equipment, 'Équipements')}
            {statCard(<CheckSquare />, 'green', adminStats.tasksOpen, 'Tâches en cours')}
          </div>

          {/* Ma journée row */}
          {myDay && (
            <div className="p-5 rounded-2xl border border-border-custom bg-bg-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <h4 className="font-bold text-text-primary">Ma journée</h4>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {myDay.todo} à faire · {myDay.doing} en cours · {myDay.done} fait aujourd'hui · {myDay.events} événement(s)
                  </p>
                </div>
              </div>
              <Link href="/dashboard/activity" className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow cursor-pointer transition-all">
                Voir ma journée →
              </Link>
            </div>
          )}

          {/* Chart row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue bar chart */}
            <div className="lg:col-span-2 rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-sm">
              <h3 className="text-base font-bold text-text-primary mb-6">Revenus mensuels {new Date().getFullYear()}</h3>
              <div className="flex items-end justify-between gap-2 h-48 pt-4 pb-2">
                {revenueStats.map((val, idx) => {
                  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
                  const maxVal = Math.max(...revenueStats, 1);
                  const pct = (val / maxVal) * 100;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                      <div className="relative w-full flex justify-center">
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 bg-slate-800 text-white text-[10px] py-1 px-2 rounded pointer-events-none transition-opacity duration-200 z-10 whitespace-nowrap shadow-md">
                          {Helpers.formatMoney(val)}
                        </div>
                        <div
                          style={{ height: `${Math.max(pct, 2)}%` }}
                          className="w-full sm:w-6 bg-primary hover:bg-primary-hover rounded-t transition-all duration-300"
                        />
                      </div>
                      <span className="text-[10px] font-bold text-text-muted">{months[idx]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Realtime summary stats list */}
            <div className="rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-sm flex flex-col justify-between">
              <h3 className="text-base font-bold text-text-primary pb-2 border-b border-border-custom">Synthèse temps réel</h3>
              <div className="flex-1 flex flex-col justify-center space-y-4 my-4 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span className="text-text-secondary">Logements occupés</span>
                  </div>
                  <b className="text-text-primary">{adminStats.occupied} / {adminStats.apartments}</b>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    <span className="text-text-secondary">Baux actifs</span>
                  </div>
                  <b className="text-text-primary">{adminStats.activeLeases}</b>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-text-secondary">Logts en maintenance / rés.</span>
                  </div>
                  <b className="text-text-primary">{adminStats.maintenanceApts} / {adminStats.reservedApts}</b>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <span className="text-text-secondary">Utilisateurs</span>
                  </div>
                  <b className="text-text-primary">{adminStats.users}</b>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border-custom">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${adminStats.finance.balance >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-text-secondary font-semibold">Solde net (rev. - chg.)</span>
                  </div>
                  <b className={adminStats.finance.balance >= 0 ? 'text-green-500 font-extrabold' : 'text-red-500 font-extrabold'}>
                    {Helpers.formatMoney(adminStats.finance.balance)}
                  </b>
                </div>
              </div>
            </div>
          </div>

          {/* Performance on Custom Period Card */}
          {hasRole('manager', 'super_admin', 'dir_admin', 'comptable') && periodData && (
            <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border-custom mb-6">
                <div>
                  <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary animate-pulse" /> Performance sur la période
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">Filtrez et analysez les indicateurs sur une plage de dates</p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-custom bg-bg-surface hover:bg-bg-hover text-xs font-bold text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
                >
                  <Printer className="w-4 h-4" /> Imprimer
                </button>
              </div>

              {/* Form and Presets */}
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-6">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => handlePeriodPreset(7)} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary cursor-pointer">7 jours</button>
                  <button onClick={() => handlePeriodPreset(30)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow cursor-pointer">30 jours</button>
                  <button onClick={() => handlePeriodPreset(90)} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary cursor-pointer">3 mois</button>
                  <button onClick={() => handlePeriodPreset(180)} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary cursor-pointer">6 mois</button>
                  <button onClick={() => handlePeriodPreset(365)} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary cursor-pointer">12 mois</button>
                </div>

                <form onSubmit={handlePeriodApply} className="flex flex-wrap items-center gap-3 w-full xl:w-auto text-sm">
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="px-3 py-1.5 border border-border-custom bg-bg-body rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto"
                  />
                  <span className="text-text-muted hidden sm:inline">→</span>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="px-3 py-1.5 border border-border-custom bg-bg-body rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary-hover cursor-pointer w-full sm:w-auto transition-colors"
                  >
                    Appliquer
                  </button>
                </form>
              </div>

              {isPeriodLoading ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-text-muted">
                  <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                  <span className="text-xs">Chargement de la période...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-xs text-text-muted font-bold text-center">
                    Période d'analyse : <span className="text-text-primary bg-bg-surface-2 border border-border-custom px-2 py-0.5 rounded-full ml-1">{Helpers.formatDate(periodData.start)} → {Helpers.formatDate(periodData.end)}</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="p-4 rounded-xl border border-border-custom bg-bg-surface text-center">
                      <div className="text-lg font-extrabold text-green-500">{Helpers.formatMoney(periodData.revenue)}</div>
                      <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Revenus encaissés</div>
                    </div>
                    <div className="p-4 rounded-xl border border-border-custom bg-bg-surface text-center">
                      <div className="text-lg font-extrabold text-red-500">{Helpers.formatMoney(periodData.expenses)}</div>
                      <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Dépenses directes</div>
                    </div>
                    <div className="p-4 rounded-xl border border-border-custom bg-bg-surface text-center">
                      <div className="text-lg font-extrabold text-sky-500">{Helpers.formatMoney(periodData.salaries)}</div>
                      <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Salaires payés</div>
                    </div>
                    <div className="p-4 rounded-xl border border-border-custom bg-bg-surface text-center">
                      <div className={`text-lg font-extrabold ${periodData.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {Helpers.formatMoney(periodData.balance)}
                      </div>
                      <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Solde net</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="p-4 rounded-xl border border-border-custom bg-bg-surface text-center">
                      <div className="text-lg font-bold text-text-primary">{periodData.paymentsCount}</div>
                      <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Transactions validées</div>
                    </div>
                    <div className="p-4 rounded-xl border border-border-custom bg-bg-surface text-center">
                      <div className="text-lg font-bold text-text-primary">{periodData.newTenants}</div>
                      <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Nouveaux locataires</div>
                    </div>
                    <div className="p-4 rounded-xl border border-border-custom bg-bg-surface text-center">
                      <div className="text-lg font-bold text-text-primary">{periodData.newLeases}</div>
                      <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Baux signés</div>
                    </div>
                    <div className="p-4 rounded-xl border border-border-custom bg-bg-surface text-center">
                      <div className="text-lg font-bold text-text-primary">{periodData.maintenanceOpened} / {periodData.maintenanceCompleted}</div>
                      <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Maint. ouvertes / closes</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sectors Row */}
          {sectors.length > 0 && (
            <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm p-6">
              <h3 className="text-base font-bold text-text-primary mb-6 pb-2 border-b border-border-custom">Synthèse par secteur d'activité</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {sectors.map((sec, idx) => (
                  <div key={idx} className="p-5 rounded-xl border border-border-custom bg-bg-surface-2 hover:bg-bg-hover hover:scale-[1.01] cursor-pointer transition-all duration-300">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="text-2xl select-none">{sec.icon}</span>
                      <h4 className="font-bold text-text-primary">{sec.label}</h4>
                    </div>
                    <div className="space-y-3 text-xs leading-normal">
                      {sec.headline?.map((row: any, rIdx: number) => (
                        <div key={rIdx} className="flex justify-between items-center">
                          <span className="text-text-secondary">{row.label}</span>
                          <span className="font-semibold text-text-primary">
                            {row.money ? Helpers.formatMoney(row.value) : row.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* 4. MODALS (TENANT ACTIONS) */}
      {/* ========================================================================= */}

      {/* Pay Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl animate-slide-in">
            <h3 className="text-lg font-bold text-text-primary mb-4">Déclarer un paiement</h3>
            <form onSubmit={handleDeclarePaymentSubmit} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Montant (FCFA)</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Méthode de paiement</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                >
                  <option value="orange_money">Orange Money</option>
                  <option value="mtn_mobile_money">MTN MoMo</option>
                  <option value="bank_transfer">Virement Bancaire</option>
                  <option value="cash">Espèces</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow cursor-pointer transition-colors"
                >
                  Soumettre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Maintenance Request Modal */}
      {isMaintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl animate-slide-in">
            <h3 className="text-lg font-bold text-text-primary mb-4">Créer une demande d'intervention</h3>
            <form onSubmit={handleRequestMaintenanceSubmit} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Sujet de l'intervention</label>
                <input
                  type="text"
                  value={maintTitle}
                  onChange={(e) => setMaintTitle(e.target.value)}
                  placeholder="Ex : Fuite d'eau sous l'évier"
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Description détaillée</label>
                <textarea
                  value={maintDesc}
                  onChange={(e) => setMaintDesc(e.target.value)}
                  placeholder="Précisez le problème, l'emplacement, etc."
                  rows={3}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Urgence</label>
                <select
                  value={maintPriority}
                  onChange={(e) => setMaintPriority(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                >
                  <option value="low">Basse</option>
                  <option value="medium">Moyenne (Par défaut)</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente (Bloquante)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsMaintModalOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow cursor-pointer transition-colors"
                >
                  Créer la demande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
