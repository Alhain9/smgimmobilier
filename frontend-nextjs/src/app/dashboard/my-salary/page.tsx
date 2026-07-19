'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import {
  DollarSign,
  Briefcase,
  Gift,
  Minus,
  CheckCircle,
  FileText,
  AlertCircle
} from 'lucide-react';

interface MySalary {
  id: number;
  period_month: number;
  period_year: number;
  base_salary: number;
  bonus: number;
  deductions: number;
  net_salary: number;
  payment_type: string;
  status: string;
  proof_photo?: string | null;
  paid_date?: string | null;
  notes?: string | null;
}

export default function MySalaryPage() {
  const { user } = useAuth();
  const { showError } = useToast();

  const [salaries, setSalaries] = useState<MySalary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const MONTHS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await API.get('/salaries/mine');
      if (res.data) setSalaries(res.data);
    } catch (err: any) {
      showError(err.message || 'Impossible de charger vos fiches de salaire.');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const totalPaid = salaries
    .filter((s) => s.status === 'paid')
    .reduce((sum, s) => sum + Number(s.net_salary || 0), 0);

  const typeLabel = (t: string) => {
    return t === 'cash' ? '💵 Espèces' : '🏦 Dépôt bancaire';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">🪙 Mon Salaire</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Historique de vos rémunérations et fiches de paie mensuelles
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-text-secondary mt-3">Chargement de votre historique...</span>
        </div>
      ) : (
        <>
          {/* Total Paid KPI Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center gap-4 p-5 rounded-2xl border border-border-custom bg-bg-surface shadow-sm">
              <div className="w-12 h-12 flex items-center justify-center rounded-xl text-lg font-bold bg-green-500/10 text-green-500">
                <DollarSign className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-text-primary tracking-tight leading-tight">
                  {Helpers.formatMoney(totalPaid)}
                </span>
                <span className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
                  Total perçu
                </span>
              </div>
            </div>
          </div>

          {/* Salaries Cards List */}
          <div className="space-y-6">
            {salaries.length > 0 ? (
              salaries.map((s) => {
                const isPaid = s.status === 'paid';
                return (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-sm space-y-4"
                  >
                    <div className="flex justify-between items-start gap-4 border-b border-border-custom pb-4">
                      <div>
                        <h3 className="text-lg font-extrabold text-text-primary">
                          {MONTHS[s.period_month - 1]} {s.period_year}
                        </h3>
                        <p className="text-xs text-text-muted mt-1 font-semibold uppercase tracking-wider">
                          {typeLabel(s.payment_type)}
                          {isPaid && s.paid_date ? ` · payé le ${Helpers.formatDate(s.paid_date)}` : ''}
                        </p>
                      </div>
                      <span className={Helpers.statusBadge(isPaid ? 'completed' : 'pending').className}>
                        {isPaid ? 'Payé' : 'En attente'}
                      </span>
                    </div>

                    {/* Stats Grid for Salary details */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="flex items-center gap-3 p-4 rounded-xl border border-border-custom bg-bg-surface-2">
                        <Briefcase className="w-4 h-4 text-sky-500" />
                        <div>
                          <p className="text-sm font-extrabold text-text-primary">{Helpers.formatMoney(s.base_salary)}</p>
                          <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider mt-0.5">Base</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-4 rounded-xl border border-border-custom bg-bg-surface-2">
                        <Gift className="w-4 h-4 text-green-500" />
                        <div>
                          <p className="text-sm font-extrabold text-text-primary">{Helpers.formatMoney(s.bonus)}</p>
                          <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider mt-0.5">Prime</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-4 rounded-xl border border-border-custom bg-bg-surface-2">
                        <Minus className="w-4 h-4 text-amber-500" />
                        <div>
                          <p className="text-sm font-extrabold text-text-primary">{Helpers.formatMoney(s.deductions)}</p>
                          <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider mt-0.5">Retenues</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-4 rounded-xl border border-border-custom bg-bg-surface-2 bg-primary/5 ring-1 ring-primary/20">
                        <DollarSign className="w-4 h-4 text-primary" />
                        <div>
                          <p className="text-sm font-extrabold text-primary">{Helpers.formatMoney(s.net_salary)}</p>
                          <p className="text-[10px] text-primary/70 font-bold uppercase tracking-wider mt-0.5">Net à payer</p>
                        </div>
                      </div>
                    </div>

                    {s.notes && (
                      <div className="p-3.5 rounded-xl border border-border-custom bg-bg-surface-2/50 text-xs text-text-secondary font-semibold">
                        <span className="font-bold text-text-primary">Note : </span> {s.notes}
                      </div>
                    )}

                    {/* View Proof Button */}
                    {s.proof_photo && (
                      <div className="pt-2">
                        <a
                          href={Helpers.fileUrl(s.proof_photo)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 border border-border-custom rounded-xl hover:bg-bg-hover text-xs font-bold text-text-secondary hover:text-text-primary shadow-sm transition-all"
                        >
                          <FileText className="w-4 h-4 text-primary" /> Voir la preuve de paiement
                        </a>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-border-custom bg-bg-surface p-12 text-center text-text-muted">
                <AlertCircle className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <h3 className="text-sm font-bold uppercase tracking-wider">Aucune fiche de salaire</h3>
                <p className="text-xs font-semibold mt-1">Vos fiches de paie apparaîtront ici lorsqu'elles seront générées par l'administration.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
