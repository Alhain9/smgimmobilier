'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import {
  Plus,
  Search,
  X,
  Edit,
  Trash2,
  Upload,
  Calendar,
  DollarSign
} from 'lucide-react';

interface Employee {
  id: number;
  full_name: string;
  role?: {
    name: string;
    label?: string;
  } | null;
}

interface Salary {
  id: number;
  user_id: number;
  period_month: number;
  period_year: number;
  base_salary: number;
  bonus: number;
  deductions: number;
  net_salary: number;
  payment_type: string;
  status: string;
  proof_photo?: string | null;
  notes?: string | null;
  employee?: Employee | null;
}

export default function SalariesPage() {
  const { hasRole } = useAuth();
  const { showSuccess, showError } = useToast();

  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [periodMonth, setPeriodMonth] = useState('1');
  const [periodYear, setPeriodYear] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [bonus, setBonus] = useState('0');
  const [deductions, setDeductions] = useState('0');
  const [paymentType, setPaymentType] = useState('deposit');
  const [status, setStatus] = useState('pending');
  const [notes, setNotes] = useState('');

  // Upload proof states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadSalaryId, setUploadSalaryId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const MONTHS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sRes, uRes] = await Promise.all([
        API.get('/salaries'),
        API.get('/users')
      ]);
      if (sRes.data) setSalaries(sRes.data);
      if (uRes.data) {
        // filter locataires
        const staff = uRes.data.filter((u: any) => u.role?.name !== 'locataire');
        setEmployees(staff);
      }
    } catch (err: any) {
      showError(err.message || 'Erreur lors du chargement des salaires.');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenForm = (sal?: Salary) => {
    const now = new Date();
    if (sal) {
      setEditingId(sal.id);
      setEmployeeId(String(sal.user_id));
      setPeriodMonth(String(sal.period_month));
      setPeriodYear(String(sal.period_year));
      setBaseSalary(String(sal.base_salary));
      setBonus(String(sal.bonus));
      setDeductions(String(sal.deductions));
      setPaymentType(sal.payment_type);
      setStatus(sal.status);
      setNotes(sal.notes || '');
    } else {
      setEditingId(null);
      setEmployeeId('');
      setPeriodMonth(String(now.getMonth() + 1));
      setPeriodYear(String(now.getFullYear()));
      setBaseSalary('');
      setBonus('0');
      setDeductions('0');
      setPaymentType('deposit');
      setStatus('pending');
      setNotes('');
    }
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !baseSalary || !periodMonth || !periodYear) {
      showError('Veuillez remplir les champs obligatoires.');
      return;
    }

    const payload = {
      user_id: Number(employeeId),
      period_month: Number(periodMonth),
      period_year: Number(periodYear),
      base_salary: Number(baseSalary),
      bonus: Number(bonus) || 0,
      deductions: Number(deductions) || 0,
      payment_type: paymentType,
      status: status,
      notes: notes.trim() || null,
    };

    try {
      if (editingId) {
        await API.put(`/salaries/${editingId}`, payload);
        showSuccess('Fiche de salaire mise à jour.');
      } else {
        await API.post('/salaries', payload);
        showSuccess('Fiche de salaire enregistrée.');
      }
      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de l\'enregistrement.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette fiche de salaire ?')) return;
    try {
      await API.delete(`/salaries/${id}`);
      showSuccess('Fiche de salaire supprimée.');
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la suppression.');
    }
  };

  const handleOpenUpload = (id: number) => {
    setUploadSalaryId(id);
    setSelectedFile(null);
    setIsUploadOpen(true);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadSalaryId || !selectedFile) {
      showError('Sélectionnez un fichier.');
      return;
    }

    setIsUploading(true);
    const fd = new FormData();
    fd.append('proof', selectedFile);

    try {
      await API.upload(`/salaries/${uploadSalaryId}/proof`, fd);
      showSuccess('Preuve de paiement enregistrée.');
      setIsUploadOpen(false);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur d\'upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const filteredSalaries = salaries.filter(s => {
    const q = searchTerm.toLowerCase();
    const emp = s.employee?.full_name || '';
    const roleName = s.employee?.role?.label || s.employee?.role?.name || '';
    return (
      emp.toLowerCase().includes(q) ||
      roleName.toLowerCase().includes(q)
    );
  });

  const canEdit = hasRole('manager', 'comptable');
  const canDelete = hasRole('manager');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">💼 Salaires & Paie</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Consultez et validez les fiches de paie et rémunérations des collaborateurs
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => handleOpenForm()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" /> Nouveau salaire
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-base font-bold text-text-primary">
            Registre de la paie mensuelle
          </h3>
          <div className="relative max-w-[260px] w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher employé, rôle..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-border-custom bg-bg-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-semibold"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-text-muted">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs">Chargement des fiches de paie...</span>
          </div>
        ) : filteredSalaries.length > 0 ? (
          <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                  <th className="px-5 py-3.5">Employé</th>
                  <th className="px-5 py-3.5">Période</th>
                  <th className="px-5 py-3.5">Base</th>
                  <th className="px-5 py-3.5">Prime</th>
                  <th className="px-5 py-3.5">Net à payer</th>
                  <th className="px-5 py-3.5">Mode</th>
                  <th className="px-5 py-3.5">Preuve</th>
                  <th className="px-5 py-3.5">Statut</th>
                  {canEdit && <th className="px-5 py-3.5 text-right no-print">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom text-xs font-semibold">
                {filteredSalaries.map((s) => (
                  <tr key={s.id} className="hover:bg-bg-hover/50 transition-colors">
                    <td className="px-5 py-3.5 text-text-primary">
                      <p className="font-extrabold">{s.employee?.full_name || '—'}</p>
                      {s.employee?.role && <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5 inline-block">{s.employee.role.label || s.employee.role.name}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary font-bold">
                      {MONTHS[s.period_month - 1]} {s.period_year}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary">{Helpers.formatMoney(s.base_salary)}</td>
                    <td className="px-5 py-3.5 text-text-secondary">{Helpers.formatMoney(s.bonus)}</td>
                    <td className="px-5 py-3.5 text-text-primary font-extrabold">{Helpers.formatMoney(s.net_salary)}</td>
                    <td className="px-5 py-3.5 text-text-secondary">
                      {s.payment_type === 'cash' ? '💵 Espèces' : '🏦 Dépôt bancaire'}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {s.proof_photo ? (
                        <a
                          href={Helpers.fileUrl(s.proof_photo)}
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
                    <td className="px-5 py-3.5">
                      <span className={Helpers.statusBadge(s.status === 'paid' ? 'completed' : 'pending').className}>
                        {s.status === 'paid' ? 'Payé' : 'En attente'}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3.5 text-right no-print">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenUpload(s.id)}
                            className="p-1.5 rounded-lg border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary cursor-pointer"
                            title="Preuve de paiement (photo)"
                          >
                            <Upload className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenForm(s)}
                            className="p-1.5 rounded-lg border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary cursor-pointer"
                            title="Modifier"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/15 border border-red-500/20 cursor-pointer"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-text-muted text-xs font-bold">
            Aucun salaire enregistré
          </div>
        )}
      </div>

      {/* CREATE & EDIT FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                {editingId ? '✏️ Modifier la fiche' : '💼 Nouvelle fiche de salaire'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 text-sm font-semibold no-scrollbar">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Employé *</label>
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer"
                  required
                >
                  <option value="">— Choisir l'employé —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} {emp.role?.label ? `(${emp.role.label})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Mois *</label>
                  <select
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer"
                    required
                  >
                    {MONTHS.map((m, idx) => (
                      <option key={idx} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Année *</label>
                  <input
                    type="number"
                    value={periodYear}
                    onChange={(e) => setPeriodYear(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1 col-span-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Salaire de base *</label>
                  <input
                    type="number"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    placeholder="Base"
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Primes</label>
                  <input
                    type="number"
                    value={bonus}
                    onChange={(e) => setBonus(e.target.value)}
                    placeholder="Primes"
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Retenues</label>
                  <input
                    type="number"
                    value={deductions}
                    onChange={(e) => setDeductions(e.target.value)}
                    placeholder="Retenues"
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Mode de paiement</label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer"
                  >
                    <option value="deposit">Dépôt bancaire</option>
                    <option value="cash">Espèces</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Statut</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer"
                  >
                    <option value="pending">En attente</option>
                    <option value="paid">Payé</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informations additionnelles..."
                  rows={2}
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                />
              </div>

              {baseSalary && (
                <div className="list-item" style={{ background: 'var(--bg-surface-2)', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="text-text-secondary font-bold">Net à payer :</span>
                  <span className="font-extrabold text-primary text-base">
                    {Helpers.formatMoney(Number(baseSalary) + Number(bonus) - Number(deductions))}
                  </span>
                </div>
              )}

              <div className="pt-4 border-t border-border-custom flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-colors"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD PROOF MODAL */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                📷 Preuve de paiement
              </h3>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="py-4 space-y-4 text-sm font-semibold">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Reçu de dépôt ou photo (cash)</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full px-3.5 py-2 border border-border-custom bg-bg-body rounded-xl text-xs focus:outline-none cursor-pointer text-text-secondary"
                  required
                />
              </div>

              <div className="pt-4 border-t border-border-custom flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
