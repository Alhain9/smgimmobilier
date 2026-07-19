'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import {
  Zap,
  Droplet,
  FileText,
  AlertCircle
} from 'lucide-react';

interface MyUtilityBill {
  id: number;
  type: string;
  period_month: number;
  period_year: number;
  previous_index: number;
  current_index: number;
  total_amount: number;
  status: string;
  payment_proof?: string | null;
}

export default function MyUtilitiesPage() {
  const { user } = useAuth();
  const { showError } = useToast();

  const [bills, setBills] = useState<MyUtilityBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const MONTHS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await API.get('/utility-bills/mine');
      if (res.data) setBills(res.data);
    } catch (err: any) {
      showError(err.message || 'Impossible de charger vos factures de charges.');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const typeLabel = (t: string) => {
    return t === 'water' ? '💧 Eau' : '⚡ Électricité';
  };

  const conso = (b: MyUtilityBill) => {
    return Math.max(0, b.current_index - b.previous_index);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">⚡ Mes Charges</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Consommation d'eau et d'électricité refacturée par compteurs divisionnaires
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4">
        <h3 className="text-base font-bold text-text-primary">
          Historique de vos factures de charges
        </h3>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-text-muted">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs">Chargement de vos charges...</span>
          </div>
        ) : bills.length > 0 ? (
          <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                  <th className="px-5 py-3.5">Type de charge</th>
                  <th className="px-5 py-3.5">Période</th>
                  <th className="px-5 py-3.5">Index (Consommation)</th>
                  <th className="px-5 py-3.5">Total à payer</th>
                  <th className="px-5 py-3.5">Statut</th>
                  <th className="px-5 py-3.5">Justificatif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom text-xs font-semibold">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-bg-hover/50 transition-colors">
                    <td className="px-5 py-3.5 text-text-primary font-bold">
                      {b.type === 'water' ? (
                        <span className="flex items-center gap-1 text-blue-500">
                          <Droplet className="w-3.5 h-3.5" /> Eau
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-500">
                          <Zap className="w-3.5 h-3.5" /> Électricité
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary font-bold">
                      {MONTHS[b.period_month - 1]} {b.period_year}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary">
                      <p className="font-bold">{b.previous_index} → {b.current_index}</p>
                      <span className="text-[10px] text-text-muted">Volume consommé : {conso(b)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-text-primary font-extrabold">{Helpers.formatMoney(b.total_amount)}</td>
                    <td className="px-5 py-3.5">
                      <span className={Helpers.statusBadge(b.status === 'paid' ? 'completed' : 'pending').className}>
                        {b.status === 'paid' ? 'Payé' : 'En attente'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {b.payment_proof ? (
                        <a
                          href={Helpers.fileUrl(b.payment_proof)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border-custom bg-bg-surface hover:bg-bg-hover text-[11px] font-bold text-text-secondary hover:text-text-primary transition-all shadow-sm"
                        >
                          <FileText className="w-3.5 h-3.5 text-primary" /> Reçu
                        </a>
                      ) : (
                        <span className="text-text-muted italic">Aucun reçu</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-text-muted text-xs font-bold">
            Aucune facture de charges enregistrée
          </div>
        )}
      </div>
    </div>
  );
}
