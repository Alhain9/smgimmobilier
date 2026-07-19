'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import {
  Search,
  Eye,
  Printer,
  Download,
  Calendar,
  TrendingUp,
  Wrench,
  Users,
  CreditCard,
  X,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Building,
  Clock
} from 'lucide-react';

interface TenantSituation {
  tenant_id: number;
  nom: string;
  telephone: string;
  doit: number;
  statut_compte: string;
  prochaine_echeance: string | null;
  fin_bail: string | null;
  logement: string | null;
  immeuble: string | null;
}

const getActionLabel = (action: string) => {
  const map: Record<string, string> = {
    create: 'Création',
    update: 'Mise à jour',
    delete: 'Suppression',
    verify: 'Validation',
    adjust: 'Ajustement de solde',
    payment: 'Paiement',
  };
  return map[action] || action;
};

interface Property {
  id: number;
  property_name: string;
}

export default function SituationPage() {
  const { user, hasRole } = useAuth();
  const { showError, showSuccess } = useToast();

  const [situationList, setSituationList] = useState<TenantSituation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingSituation, setIsLoadingSituation] = useState(true);

  // Period Recap states
  const [periodStart, setPeriodStart] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [recapData, setRecapData] = useState<any>(null);
  const [isLoadingRecap, setIsLoadingRecap] = useState(true);

  // Building Situation states
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [buildingSituation, setBuildingSituation] = useState<any>(null);
  const [isLoadingBuilding, setIsLoadingBuilding] = useState(false);

  // Ledger Modal states
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  // APIs Loaders
  const loadSituation = useCallback(async () => {
    setIsLoadingSituation(true);
    try {
      const res = await API.get('/reports/tenant-situation');
      if (res.data) setSituationList(res.data);
    } catch (err: any) {
      showError(err.message || 'Impossible de charger la situation des locataires.');
    } finally {
      setIsLoadingSituation(false);
    }
  }, [showError]);

  const loadRecap = useCallback(async (start: string, end: string) => {
    setIsLoadingRecap(true);
    try {
      const res = await API.get(`/reports/recap?start=${start}&end=${end}`);
      if (res.data) setRecapData(res.data);
    } catch (err: any) {
      showError(err.message || 'Impossible de charger le récapitulatif de la période.');
    } finally {
      setIsLoadingRecap(false);
    }
  }, [showError]);

  const loadProperties = useCallback(async () => {
    try {
      const res = await API.get('/properties');
      if (res.data) setProperties(res.data);
    } catch (_) {}
  }, []);

  const loadBuildingSituation = useCallback(async (id: string) => {
    if (!id) {
      setBuildingSituation(null);
      return;
    }
    setIsLoadingBuilding(true);
    try {
      const res = await API.get(`/reports/building-situation/${id}`);
      if (res.data) setBuildingSituation(res.data);
    } catch (err: any) {
      showError(err.message || "Impossible de charger la situation de l'immeuble.");
      setBuildingSituation(null);
    } finally {
      setIsLoadingBuilding(false);
    }
  }, [showError]);

  const loadLedger = useCallback(async (tenantId: number) => {
    setIsLoadingLedger(true);
    setSelectedTenantId(tenantId);
    try {
      const res = await API.get(`/payments/ledger/${tenantId}`);
      if (res.data) setLedgerData(res.data);
    } catch (err: any) {
      showError(err.message || 'Impossible de charger le relevé de compte.');
      setSelectedTenantId(null);
    } finally {
      setIsLoadingLedger(false);
    }
  }, [showError]);

  useEffect(() => {
    if (user) {
      loadSituation();
      loadRecap(periodStart, periodEnd);
      loadProperties();
    }
  }, [user, loadSituation, loadRecap, loadProperties, periodStart, periodEnd]);

  // Handle Preset Ranges
  const applyPreset = (preset: 'month' | 'year' | 30 | 90) => {
    const now = new Date();
    let start = '';
    const end = now.toISOString().slice(0, 10);

    if (preset === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    } else if (preset === 'year') {
      start = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    } else {
      start = new Date(now.getTime() - (preset - 1) * 86400000).toISOString().slice(0, 10);
    }

    setPeriodStart(start);
    setPeriodEnd(end);
    loadRecap(start, end);
  };

  const handleCustomPeriodApply = () => {
    if (!periodStart || !periodEnd) {
      showError('Veuillez sélectionner les deux dates.');
      return;
    }
    if (periodStart > periodEnd) {
      showError('La date de début doit être antérieure à la date de fin.');
      return;
    }
    loadRecap(periodStart, periodEnd);
  };

  const handleBuildingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedPropertyId(id);
    loadBuildingSituation(id);
  };

  // CSV/Excel exporting
  const exportBuildingCSV = () => {
    if (!buildingSituation) return;
    const d = buildingSituation;

    const COLS = [
      ['numero_chambre', 'N° chambre', 'text'],
      ['nom_locataire', 'Nom locataire', 'text'],
      ['telephone', 'Téléphone', 'text'],
      ['date_occupation', 'Date occupation', 'date'],
      ['montant_loyer', 'Montant loyer', 'money'],
      ['observations', 'Observations', 'text'],
      ['arriere_loyer', 'Arriéré de loyer', 'money'],
      ['avance_sur_arriere', 'Avance / arriéré', 'money'],
      ['dette', 'Dette', 'money'],
      ['anticipation', 'Payé par anticipation', 'money'],
      ['versement_mois', 'Versement du mois', 'money'],
      ['periode_actuelle', 'Période actuelle', 'date'],
      ['mode_paiement', 'Mode de paiement', 'method'],
    ];

    const headers = COLS.map(c => c[1]);
    const rows = d.lignes.map((l: any) =>
      COLS.map(c => {
        const v = l[c[0]];
        if (v == null || v === '') return '';
        if (c[2] === 'method') return Helpers.methodLabel(v);
        return v;
      })
    );

    const t = d.total;
    const totals = [
      'TOTAL',
      '',
      '',
      '',
      t.montant_loyer,
      '',
      t.arriere_loyer,
      t.avance_sur_arriere,
      t.dette,
      t.anticipation,
      t.versement_mois,
      '',
      ''
    ];

    const allData = [
      [`SITUATION IMMEUBLE — ${d.immeuble}`],
      [],
      headers,
      ...rows,
      totals
    ];

    const delimiter = ';';
    const csvContent = allData.map((r: any[]) =>
      r.map((v: any) => {
        if (typeof v === 'string') {
          return `"${v.replace(/"/g, '""')}"`;
        }
        return v;
      }).join(delimiter)
    ).join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = String(d.immeuble).replace(/\s+/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `situation_${safeName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('Rapport Excel (CSV) exporté avec succès.');
  };

  const getActionLabel = (a: string) => {
    const map: Record<string, string> = {
      created: 'Création',
      updated: 'Modification',
      proof_added: 'Preuve ajoutée',
      validated: 'Validé',
      rejected: 'Rejeté',
    };
    return map[a] || a;
  };

  const renderStatusBadge = (s: string) => {
    const map: Record<string, [string, string]> = {
      a_jour: ['bg-green-500/10 text-green-500 border-green-500/20', 'À jour'],
      partiel: ['bg-amber-500/10 text-amber-500 border-amber-500/20', 'Partiel'],
      retard: ['bg-red-500/10 text-red-500 border-red-500/20', 'En retard'],
    };
    const [cls, label] = map[s] || ['bg-slate-500/10 text-slate-500 border-slate-500/20', s];
    return <span className={`border px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
  };

  const renderLeaseEnd = (finBailStr?: string | null) => {
    if (!finBailStr) return '—';
    const today = new Date();
    const soon = new Date(today.getTime() + 30 * 86400000);
    const d = new Date(finBailStr);

    let cls = 'text-text-secondary';
    if (d < today) {
      cls = 'text-red-500 font-bold';
    } else if (d < soon) {
      cls = 'text-amber-500 font-bold';
    }

    return <span className={cls}>{Helpers.formatDate(finBailStr)}</span>;
  };

  // Search filter
  const filteredSituation = situationList.filter((r) => {
    const q = searchTerm.toLowerCase();
    return (
      (r.nom || '').toLowerCase().includes(q) ||
      (r.immeuble || '').toLowerCase().includes(q) ||
      (r.logement || '').toLowerCase().includes(q) ||
      (r.telephone || '').includes(q)
    );
  });

  // Building situation column schema helper
  const BUILDING_COLS = [
    ['numero_chambre', 'N° chambre', 'text'],
    ['nom_locataire', 'Nom locataire', 'text'],
    ['telephone', 'Téléphone', 'text'],
    ['date_occupation', 'Date occupation', 'date'],
    ['montant_loyer', 'Montant loyer', 'money'],
    ['observations', 'Observations', 'text'],
    ['arriere_loyer', 'Arriéré de loyer', 'money'],
    ['avance_sur_arriere', 'Avance / arriéré', 'money'],
    ['dette', 'Dette', 'money'],
    ['anticipation', 'Payé par anticipation', 'money'],
    ['versement_mois', 'Versement du mois', 'money'],
    ['periode_actuelle', 'Période actuelle', 'date'],
    ['mode_paiement', 'Mode de paiement', 'method'],
  ];

  const renderCell = (l: any, key: string, type: string) => {
    const v = l[key];
    if (v == null || v === '') return type === 'text' ? (key === 'nom_locataire' ? '/' : '—') : '—';
    if (type === 'money') return Helpers.formatMoney(v);
    if (type === 'date') return Helpers.formatDate(v);
    if (type === 'method') return Helpers.methodLabel(v);
    return v;
  };

  const statCard = (icon: React.ReactNode, color: string, value: any, name: string) => {
    const bgColors: Record<string, string> = {
      sky: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
      green: 'bg-green-500/10 text-green-500 border-green-500/20',
      orange: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      red: 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    return (
      <div className="flex items-center gap-4 p-4 rounded-xl border border-border-custom bg-bg-surface shadow-sm">
        <div className={`w-10 h-10 flex items-center justify-center rounded-lg text-lg font-bold border ${bgColors[color] || 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
          {icon}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-text-primary truncate">{value}</span>
          <span className="text-[10px] font-bold text-text-muted mt-0.5 uppercase tracking-wider">{name}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Hello Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Situation & Rapports locataires</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Suivi des comptes locataires et récapitulatifs par période
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border-custom bg-bg-surface hover:bg-bg-hover text-xs font-bold text-text-secondary hover:text-text-primary shadow-sm cursor-pointer transition-all no-print"
        >
          <Printer className="w-4 h-4" /> Imprimer
        </button>
      </div>

      {/* 1. LOCATAIRES GLOBAL SITUATION */}
      <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
            👤 Situation des locataires
          </h3>
          <div className="relative max-w-[260px] w-full no-print">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un locataire..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-border-custom bg-bg-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-semibold"
            />
          </div>
        </div>

        {isLoadingSituation ? (
          <div className="flex flex-col items-center justify-center p-12 text-text-muted">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs">Chargement de la situation des locataires...</span>
          </div>
        ) : filteredSituation.length > 0 ? (
          <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                  <th className="px-5 py-3.5">Nom</th>
                  <th className="px-5 py-3.5">Téléphone</th>
                  <th className="px-5 py-3.5">Ce qu'il doit</th>
                  <th className="px-5 py-3.5">Statut</th>
                  <th className="px-5 py-3.5">Prochaine échéance</th>
                  <th className="px-5 py-3.5">Fin de bail</th>
                  <th className="px-5 py-3.5">Logement</th>
                  <th className="px-5 py-3.5">Immeuble</th>
                  <th className="px-5 py-3.5 text-right no-print"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom text-xs font-semibold">
                {filteredSituation.map((r) => (
                  <tr key={r.tenant_id} className="hover:bg-bg-hover/50 transition-colors">
                    <td className="px-5 py-3.5 text-text-primary font-extrabold">{r.nom}</td>
                    <td className="px-5 py-3.5 text-text-secondary">
                      {r.telephone ? (
                        <a href={`tel:${r.telephone}`} className="hover:underline">{r.telephone}</a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {r.doit > 0 ? (
                        <span className="text-red-500 font-bold">{Helpers.formatMoney(r.doit)}</span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-500/10 text-green-500 border border-green-500/20">À jour</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">{renderStatusBadge(r.statut_compte)}</td>
                    <td className="px-5 py-3.5 text-text-secondary">
                      {r.prochaine_echeance ? Helpers.formatDate(r.prochaine_echeance) : '—'}
                    </td>
                    <td className="px-5 py-3.5">{renderLeaseEnd(r.fin_bail)}</td>
                    <td className="px-5 py-3.5 text-text-secondary">{r.logement || '—'}</td>
                    <td className="px-5 py-3.5 text-text-secondary">{r.immeuble || '—'}</td>
                    <td className="px-5 py-3.5 text-right no-print">
                      <button
                        onClick={() => loadLedger(r.tenant_id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-custom bg-bg-surface hover:bg-bg-hover text-xs font-bold text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" /> Relevé
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-text-muted text-xs font-bold">
            Aucun locataire trouvé
          </div>
        )}
      </div>

      {/* 2. RECAPS BY PERIOD */}
      <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4 no-print">
        <h3 className="text-base font-bold text-text-primary flex items-center gap-2 border-b border-border-custom pb-3">
          <Calendar className="w-5 h-5 text-primary" /> Période du récapitulatif
        </h3>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => applyPreset('month')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-sm cursor-pointer transition-colors"
            >
              Ce mois
            </button>
            <button
              onClick={() => applyPreset(30)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary hover:text-text-primary cursor-pointer transition-all"
            >
              30 jours
            </button>
            <button
              onClick={() => applyPreset(90)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary hover:text-text-primary cursor-pointer transition-all"
            >
              3 mois
            </button>
            <button
              onClick={() => applyPreset('year')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary hover:text-text-primary cursor-pointer transition-all"
            >
              Cette année
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="px-3.5 py-2 border border-border-custom bg-bg-surface rounded-xl focus:outline-none text-xs font-semibold cursor-pointer shadow-sm focus:ring-1 focus:ring-primary focus:border-primary text-text-primary"
            />
            <span className="text-text-muted text-xs font-bold">→</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="px-3.5 py-2 border border-border-custom bg-bg-surface rounded-xl focus:outline-none text-xs font-semibold cursor-pointer shadow-sm focus:ring-1 focus:ring-primary focus:border-primary text-text-primary"
            />
            <button
              onClick={handleCustomPeriodApply}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-sm cursor-pointer transition-colors ml-1"
            >
              Appliquer
            </button>
          </div>
        </div>
      </div>

      {/* Recap Content Cards */}
      {isLoadingRecap ? (
        <div className="flex flex-col items-center justify-center p-12 bg-bg-surface border border-border-custom rounded-2xl shadow-sm text-text-muted">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs">Chargement du récapitulatif de la période...</span>
        </div>
      ) : recapData ? (
        <div className="space-y-6">
          {/* Tenant Recap */}
          <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border-custom">
              <h3 className="text-sm font-bold text-text-primary">💰 Récap par locataire</h3>
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                {Helpers.formatDate(recapData.start)} → {Helpers.formatDate(recapData.end)}
              </span>
            </div>
            <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                    <th className="px-5 py-3">Locataire</th>
                    <th className="px-5 py-3">Immeuble</th>
                    <th className="px-5 py-3">Logement</th>
                    <th className="px-5 py-3">Encaissé</th>
                    <th className="px-5 py-3">Impayé</th>
                    <th className="px-5 py-3">Paiements (Nb)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-custom text-xs font-semibold">
                  {recapData.byTenant && recapData.byTenant.length > 0 ? (
                    recapData.byTenant.map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-bg-hover/50 transition-colors">
                        <td className="px-5 py-3 text-text-primary font-bold">{r.nom}</td>
                        <td className="px-5 py-3 text-text-secondary">{r.immeuble}</td>
                        <td className="px-5 py-3 text-text-secondary">{r.logement}</td>
                        <td className="px-5 py-3 text-green-500 font-bold">{Helpers.formatMoney(r.paye)}</td>
                        <td className="px-5 py-3 text-red-500 font-bold">{Helpers.formatMoney(r.impaye)}</td>
                        <td className="px-5 py-3 text-text-secondary">{r.nb_paiements}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-5 text-text-muted italic">
                        Aucun paiement sur la période
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Property Recap */}
          <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border-custom">
              <h3 className="text-sm font-bold text-text-primary">🏢 Récap par immeuble</h3>
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                {Helpers.formatDate(recapData.start)} → {Helpers.formatDate(recapData.end)}
              </span>
            </div>
            <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                    <th className="px-5 py-3">Immeuble</th>
                    <th className="px-5 py-3">Encaissé</th>
                    <th className="px-5 py-3">Impayé</th>
                    <th className="px-5 py-3">Occupation</th>
                    <th className="px-5 py-3">Maintenances</th>
                    <th className="px-5 py-3">Coût maint.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-custom text-xs font-semibold">
                  {recapData.byProperty && recapData.byProperty.length > 0 ? (
                    recapData.byProperty.map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-bg-hover/50 transition-colors">
                        <td className="px-5 py-3 text-text-primary font-bold">{r.immeuble}</td>
                        <td className="px-5 py-3 text-green-500 font-bold">{Helpers.formatMoney(r.encaisse)}</td>
                        <td className="px-5 py-3 text-red-500 font-bold">{Helpers.formatMoney(r.impaye)}</td>
                        <td className="px-5 py-3 text-text-secondary">{r.occupes}/{r.logements}</td>
                        <td className="px-5 py-3 text-text-secondary">{r.maintenances}</td>
                        <td className="px-5 py-3 text-text-secondary">{Helpers.formatMoney(r.cout_maintenance)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-5 text-text-muted italic">
                        Aucun immeuble enregistré
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Maintenance Recap */}
          <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-border-custom">
              <h3 className="text-sm font-bold text-text-primary">🔧 Récap maintenance</h3>
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                {Helpers.formatDate(recapData.start)} → {Helpers.formatDate(recapData.end)}
              </span>
            </div>

            {/* Maintenance statistics grids */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-1">
              {statCard(<Wrench className="w-5 h-5" />, 'sky', recapData.maintenance?.total || 0, 'Total interventions')}
              {statCard(
                <Clock className="w-5 h-5" />,
                'orange',
                (recapData.maintenance?.reported || 0) +
                  (recapData.maintenance?.validated || 0) +
                  (recapData.maintenance?.in_progress || 0),
                'En cours / ouvertes'
              )}
              {statCard(<CheckCircle2 className="w-5 h-5" />, 'green', recapData.maintenance?.completed || 0, 'Terminées')}
              {statCard(<CreditCard className="w-5 h-5" />, 'orange', Helpers.formatMoney(recapData.maintenance?.cout || 0), 'Coût matériel')}
            </div>

            {/* List by property */}
            <div className="pt-4 space-y-2.5">
              <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Par immeuble</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recapData.maintenance?.byProperty && recapData.maintenance.byProperty.length > 0 ? (
                  recapData.maintenance.byProperty.map((r: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-3 rounded-xl border border-border-custom bg-bg-surface-2 text-xs font-semibold text-text-primary">
                      <span>{r.immeuble}</span>
                      <span className="font-extrabold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">{r.total}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-text-muted italic py-1">
                    Aucune intervention enregistrée
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 3. DETAILED SITUATION BY PROPERTY */}
      <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border-custom">
          <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
            <Building className="w-5 h-5 text-primary" /> Situation par immeuble
          </h3>

          <div className="flex items-center gap-3 no-print">
            <select
              value={selectedPropertyId}
              onChange={handleBuildingChange}
              className="px-3.5 py-2 border border-border-custom bg-bg-surface rounded-xl focus:outline-none text-xs font-semibold cursor-pointer shadow-sm focus:ring-1 focus:ring-primary focus:border-primary text-text-primary"
            >
              <option value="">— Choisir un immeuble —</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.property_name}
                </option>
              ))}
            </select>

            {buildingSituation && (
              <button
                onClick={exportBuildingCSV}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" /> Exporter Excel
              </button>
            )}
          </div>
        </div>

        {/* Selected Building Detail view */}
        {isLoadingBuilding ? (
          <div className="flex flex-col items-center justify-center p-12 text-text-muted">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs">Chargement de la situation détaillée de l'immeuble...</span>
          </div>
        ) : buildingSituation ? (
          <div className="space-y-4">
            <div className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              Situation Immeuble — {buildingSituation.immeuble}
            </div>

            <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead>
                  <tr className="border-b border-border-custom bg-bg-surface-2 text-[10px] font-bold uppercase tracking-wider text-text-secondary select-none">
                    {BUILDING_COLS.map((c, idx) => (
                      <th key={idx} className="px-4 py-3">{c[1]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-custom text-[11px] font-semibold">
                  {buildingSituation.lignes && buildingSituation.lignes.length > 0 ? (
                    buildingSituation.lignes.map((l: any, idx: number) => (
                      <tr key={idx} className="hover:bg-bg-hover/50 transition-colors">
                        {BUILDING_COLS.map((c, colIdx) => (
                          <td key={colIdx} className="px-4 py-3 text-text-secondary font-medium">
                            {renderCell(l, c[0], c[2])}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={BUILDING_COLS.length} className="text-center py-5 text-text-muted italic">
                        Aucun logement déclaré
                      </td>
                    </tr>
                  )}

                  {/* Total Row */}
                  {buildingSituation.total && (
                    <tr className="font-extrabold bg-bg-surface-2 text-text-primary border-t border-border-custom">
                      <td className="px-4 py-4" colSpan={4}>TOTAL</td>
                      <td className="px-4 py-4">{Helpers.formatMoney(buildingSituation.total.montant_loyer)}</td>
                      <td className="px-4 py-4"></td>
                      <td className="px-4 py-4">{Helpers.formatMoney(buildingSituation.total.arriere_loyer)}</td>
                      <td className="px-4 py-4">{Helpers.formatMoney(buildingSituation.total.avance_sur_arriere)}</td>
                      <td className="px-4 py-4">{Helpers.formatMoney(buildingSituation.total.dette)}</td>
                      <td className="px-4 py-4">{Helpers.formatMoney(buildingSituation.total.anticipation)}</td>
                      <td className="px-4 py-4">{Helpers.formatMoney(buildingSituation.total.versement_mois)}</td>
                      <td className="px-4 py-4" colSpan={2}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-text-muted text-xs font-semibold">
            Choisissez un immeuble pour afficher sa situation détaillée.
          </div>
        )}
      </div>

      {/* 4. GRAND LEDGER MODAL */}
      {selectedTenantId && ledgerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                📋 Relevé — {ledgerData.tenant?.nom || ''}
              </h3>
              <button
                onClick={() => setSelectedTenantId(null)}
                className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4 text-xs font-semibold no-scrollbar">
              <div className="text-text-muted font-bold text-xs uppercase tracking-wide">
                {ledgerData.tenant?.logement || '—'}
                {ledgerData.tenant?.immeuble ? ` · ${ledgerData.tenant.immeuble}` : ''}
                {` · Loyer ${Helpers.formatMoney(ledgerData.loyer_mensuel)}/mois · ${ledgerData.mois_dus} mois dus`}
              </div>

              {/* Stats KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statCard('🏠', 'sky', Helpers.formatMoney(ledgerData.total_du), 'Total loyers dus')}
                {statCard('✅', 'green', Helpers.formatMoney(ledgerData.total_valide), 'Paiements validés')}
                {statCard('🕓', 'orange', Helpers.formatMoney(ledgerData.en_attente_preuve), 'En attente de preuve')}
                {statCard(
                  '⚖️',
                  ledgerData.solde > 0 ? 'red' : 'green',
                  Helpers.formatMoney(Math.max(0, ledgerData.solde)),
                  'Solde restant dû'
                )}
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl border border-border-custom bg-bg-surface-2 text-sm">
                <span className="text-text-secondary font-bold">Statut du locataire</span>
                {renderStatusBadge(ledgerData.statut)}
              </div>

              {/* Transactions History */}
              <div className="space-y-2.5">
                <h4 className="text-sm font-bold text-text-primary">🧾 Historique des transactions</h4>
                <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border-custom bg-bg-surface-2 text-[10px] font-bold uppercase tracking-wider text-text-secondary select-none">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Montant</th>
                        <th className="px-4 py-3">Méthode</th>
                        <th className="px-4 py-3">Statut</th>
                        <th className="px-4 py-3 text-center">Preuve</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-custom text-xs">
                      {ledgerData.transactions && ledgerData.transactions.length > 0 ? (
                        ledgerData.transactions.map((t: any, idx: number) => (
                          <tr key={idx} className="hover:bg-bg-hover/50 transition-colors font-medium">
                            <td className="px-4 py-3 text-text-secondary">{Helpers.formatDate(t.date)}</td>
                            <td className="px-4 py-3 text-text-primary font-bold">{Helpers.formatMoney(t.montant)}</td>
                            <td className="px-4 py-3 text-text-secondary">{Helpers.methodLabel(t.methode)}</td>
                            <td className="px-4 py-3">{Helpers.statusBadge(t.statut).label}</td>
                            <td className="px-4 py-3 text-center">
                              {t.preuve ? (
                                <a
                                  href={Helpers.fileUrl(t.preuve)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline font-extrabold text-sm"
                                >
                                  📎
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-4 text-text-muted italic">
                            Aucune transaction
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modifications History */}
              <div className="space-y-2.5">
                <h4 className="text-sm font-bold text-text-primary">✏️ Historique des modifications</h4>
                <div className="border border-border-custom bg-bg-surface rounded-xl p-3 space-y-2.5 max-h-[200px] overflow-y-auto no-scrollbar border-dashed">
                  {ledgerData.modifications && ledgerData.modifications.length > 0 ? (
                    ledgerData.modifications.map((m: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-start border-b border-border-custom pb-2.5 last:border-0 last:pb-0">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-text-primary font-bold">
                            {getActionLabel(m.action)} — <span className="text-text-secondary font-semibold">{m.description || ''}</span>
                          </p>
                          <span className="text-[10px] text-text-muted mt-1 inline-block">
                            {Helpers.formatDateTime(m.date)}
                            {m.par ? ` · ${m.par}` : ''}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-text-muted italic text-center py-2">
                      Aucune modification enregistrée
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-border-custom flex justify-end">
              <button
                onClick={() => setSelectedTenantId(null)}
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
