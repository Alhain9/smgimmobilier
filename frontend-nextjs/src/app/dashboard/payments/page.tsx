'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import { Communication } from '../../../utils/communication';
import { PDF } from '../../../utils/pdf';
import {
  Plus,
  Search,
  Check,
  X,
  Phone,
  FileText,
  Trash2,
  Edit,
  Upload,
  BookOpen,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';

interface Tenant {
  id: number;
  apartment_id?: number | null;
  user?: {
    full_name: string;
    phone: string;
  } | null;
  full_name?: string; // fallback
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

interface Apartment {
  id: number;
  apartment_number: string;
  apartment_type?: string;
  property?: {
    property_name: string;
    city?: string;
    district?: string;
  } | null;
}

interface Payment {
  id: number;
  tenant_id: number;
  apartment_id?: number | null;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: string;
  payment_proof?: string | null;
  tenant?: Tenant | null;
  apartment?: Apartment | null;
}

export default function PaymentsPage() {
  const { hasRole } = useAuth();
  const { showSuccess, showError } = useToast();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'debts'>('all');

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tenantId, setTenantId] = useState('');
  const [apartmentId, setApartmentId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('orange_money');
  const [status, setStatus] = useState('completed');

  // Upload proof states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadPaymentId, setUploadPaymentId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Ledger states
  const [ledgerTenantId, setLedgerTenantId] = useState<number | null>(null);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch payments or debts depending on view mode
      let res;
      if (viewMode === 'debts') {
        res = await API.get('/payments/debts');
      } else {
        res = await API.get('/payments');
      }
      if (res.data) setPayments(res.data);

      // 2. Fetch select options
      const [tRes, aRes] = await Promise.all([
        API.get('/tenants'),
        API.get('/apartments')
      ]);
      if (tRes.data) setTenants(tRes.data);
      if (aRes.data) setApartments(aRes.data);
    } catch (err: any) {
      showError(err.message || 'Erreur lors du chargement des paiements.');
    } finally {
      setIsLoading(false);
    }
  }, [viewMode, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Prefill apartment when tenant changes in the form
  useEffect(() => {
    if (tenantId) {
      const selectedTenant = tenants.find(t => String(t.id) === String(tenantId));
      if (selectedTenant && selectedTenant.apartment_id) {
        setApartmentId(String(selectedTenant.apartment_id));
      }
    }
  }, [tenantId, tenants]);

  const handleOpenForm = (pay?: Payment) => {
    if (pay) {
      setEditingId(pay.id);
      setTenantId(String(pay.tenant_id));
      setApartmentId(pay.apartment_id ? String(pay.apartment_id) : '');
      setAmount(String(pay.amount));
      setPaymentDate(pay.payment_date.slice(0, 10));
      setPaymentMethod(pay.payment_method);
      setStatus(pay.status);
    } else {
      setEditingId(null);
      setTenantId('');
      setApartmentId('');
      setAmount('');
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentMethod('orange_money');
      setStatus('completed');
    }
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !amount || !paymentDate) {
      showError('Veuillez remplir les champs obligatoires.');
      return;
    }

    const payload = {
      tenant_id: Number(tenantId),
      apartment_id: apartmentId ? Number(apartmentId) : null,
      amount: Number(amount),
      payment_date: paymentDate,
      payment_method: paymentMethod,
      status: status,
    };

    try {
      if (editingId) {
        await API.put(`/payments/${editingId}`, payload);
        showSuccess('Paiement mis à jour avec succès.');
      } else {
        await API.post('/payments', payload);
        showSuccess('Paiement enregistré avec succès.');
      }
      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de l\'enregistrement.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce paiement ?')) return;
    try {
      await API.delete(`/payments/${id}`);
      showSuccess('Paiement supprimé.');
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la suppression.');
    }
  };

  const handleVerify = async (id: number, decision: 'completed' | 'failed') => {
    try {
      await API.patch(`/payments/${id}/verify`, { decision });
      showSuccess(decision === 'completed' ? 'Paiement validé avec succès' : 'Paiement rejeté');
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la validation.');
    }
  };

  const handleOpenUpload = (id: number) => {
    setUploadPaymentId(id);
    setSelectedFile(null);
    setIsUploadOpen(true);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadPaymentId || !selectedFile) {
      showError('Sélectionnez un fichier.');
      return;
    }

    setIsUploading(true);
    const fd = new FormData();
    fd.append('proof', selectedFile);

    try {
      await API.upload(`/payments/${uploadPaymentId}/proof`, fd);
      showSuccess('Justificatif de paiement uploade avec succès.');
      setIsUploadOpen(false);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur d\'upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLoadLedger = async (tenantId: number) => {
    setIsLoadingLedger(true);
    setLedgerTenantId(tenantId);
    try {
      const res = await API.get(`/payments/ledger/${tenantId}`);
      if (res.data) setLedgerData(res.data);
    } catch (err: any) {
      showError(err.message || 'Impossible de charger le relevé.');
      setLedgerTenantId(null);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  const buildCommunicationCtx = (p: Payment) => {
    return {
      name: p.tenant?.user?.full_name || p.tenant?.full_name,
      phone: p.tenant?.user?.phone,
      apartmentType: p.apartment?.apartment_type,
      apartmentNumber: p.apartment?.apartment_number,
      propertyName: p.apartment?.property?.property_name,
      city: p.apartment?.property?.city,
      district: p.apartment?.property?.district,
      amount: p.amount,
      dueDate: p.payment_date,
      kind: 'relance',
    };
  };

  const handleWhatsApp = (p: Payment) => {
    Communication.openWhatsApp(buildCommunicationCtx(p));
  };

  const handleCall = (p: Payment) => {
    Communication.call(p.tenant?.user?.phone);
  };

  const handleReceiptPDF = (p: Payment) => {
    PDF.paymentReceipt(p);
  };

  const handleReminderPDF = (p: Payment) => {
    PDF.paymentReminder(buildCommunicationCtx(p));
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

  const filteredPayments = payments.filter(p => {
    const q = searchTerm.toLowerCase();
    const locName = p.tenant?.user?.full_name || '';
    const bldName = p.apartment?.property?.property_name || '';
    const aptNum = p.apartment?.apartment_number || '';
    return (
      locName.toLowerCase().includes(q) ||
      bldName.toLowerCase().includes(q) ||
      aptNum.toLowerCase().includes(q)
    );
  });

  const canEdit = hasRole('manager', 'comptable');
  const canContact = hasRole('manager', 'comptable', 'dir_admin', 'gestionnaire');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">
            {viewMode === 'debts' ? '🔴 Impayés & Relances' : '💳 Paiements'}
          </h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            {viewMode === 'debts'
              ? 'Relancez les locataires débiteurs et générez des rappels'
              : 'Gérez et validez le suivi des loyers de la plateforme'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'debts' ? (
            <button
              onClick={() => setViewMode('all')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border-custom bg-bg-surface hover:bg-bg-hover text-xs font-bold text-text-secondary hover:text-text-primary shadow-sm cursor-pointer transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Tous les paiements
            </button>
          ) : (
            <>
              <button
                onClick={() => setViewMode('debts')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-500/25 bg-red-500/10 text-red-500 hover:bg-red-500/15 text-xs font-bold shadow-sm cursor-pointer transition-all"
              >
                🔴 Voir les impayés
              </button>
              {canEdit && (
                <button
                  onClick={() => handleOpenForm()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4" /> Nouveau paiement
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-base font-bold text-text-primary">
            {viewMode === 'debts' ? 'Liste des locataires en retard de loyer' : 'Historique des transactions de loyer'}
          </h3>
          <div className="relative max-w-[260px] w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par nom, immeuble..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-border-custom bg-bg-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-semibold"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-text-muted">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs">Chargement des données de facturation...</span>
          </div>
        ) : filteredPayments.length > 0 ? (
          <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                  <th className="px-5 py-3.5">Locataire</th>
                  <th className="px-5 py-3.5">Immeuble</th>
                  <th className="px-5 py-3.5">Logement</th>
                  <th className="px-5 py-3.5">Montant</th>
                  <th className="px-5 py-3.5">Date</th>
                  {viewMode !== 'debts' && <th className="px-5 py-3.5">Méthode</th>}
                  <th className="px-5 py-3.5">Statut</th>
                  {viewMode !== 'debts' && <th className="px-5 py-3.5">Preuve</th>}
                  <th className="px-5 py-3.5 text-right">Relance & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom text-xs font-semibold">
                {filteredPayments.map((p) => {
                  const hasProof = !!p.payment_proof;
                  return (
                    <tr key={p.id} className="hover:bg-bg-hover/50 transition-colors">
                      <td className="px-5 py-3.5 text-text-primary font-extrabold">
                        {p.tenant?.user ? p.tenant.user.full_name : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary">
                        {p.apartment?.property ? (
                          <div>
                            <p>{p.apartment.property.property_name}</p>
                            <span className="text-[10px] text-text-muted">{p.apartment.property.city || ''}</span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary font-bold">
                        {p.apartment ? (
                          <div>
                            <p>{p.apartment.apartment_number}</p>
                            <span className="text-[10px] text-text-muted">{p.apartment.apartment_type || ''}</span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-text-primary font-extrabold">
                        {Helpers.formatMoney(p.amount)}
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary">
                        {Helpers.formatDate(p.payment_date)}
                      </td>
                      {viewMode !== 'debts' && (
                        <td className="px-5 py-3.5 text-text-secondary">
                          {Helpers.methodLabel(p.payment_method)}
                        </td>
                      )}
                      <td className="px-5 py-3.5">
                        {Helpers.statusBadge(p.status).label ? (
                          <span className={Helpers.statusBadge(p.status).className}>
                            {Helpers.statusBadge(p.status).label}
                          </span>
                        ) : (
                          p.status
                        )}
                      </td>
                      {viewMode !== 'debts' && (
                        <td className="px-5 py-3.5">
                          {hasProof ? (
                            <a
                              href={Helpers.fileUrl(p.payment_proof)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-extrabold text-sm"
                            >
                              📎 Voir
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          {/* Verify action (only for awaiting confirmation status) */}
                          {canContact && p.status === 'awaiting_confirmation' && (
                            <>
                              <button
                                onClick={() => handleVerify(p.id, 'completed')}
                                className="p-1.5 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/15 border border-green-500/20 cursor-pointer"
                                title="Approuver"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleVerify(p.id, 'failed')}
                                className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/15 border border-red-500/20 cursor-pointer"
                                title="Rejeter"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {/* Contact via WhatsApp & Phone */}
                          {canContact && (
                            <>
                              <button
                                onClick={() => handleWhatsApp(p)}
                                className="px-2.5 py-1.5 rounded-xl bg-green-500/10 text-green-600 hover:bg-green-500/15 border border-green-500/20 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                title="WhatsApp"
                              >
                                🟢 Relancer
                              </button>
                              <button
                                onClick={() => handleCall(p)}
                                className="p-1.5 rounded-lg border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary cursor-pointer"
                                title="Appeler"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {/* PDF generation receipt/reminder */}
                          <button
                            onClick={() => (p.status === 'completed' ? handleReceiptPDF(p) : handleReminderPDF(p))}
                            className="p-1.5 rounded-lg border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary cursor-pointer"
                            title={p.status === 'completed' ? 'Télécharger le reçu PDF' : 'Télécharger le rappel PDF'}
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          {/* Ledger link */}
                          {p.tenant_id && (
                            <button
                              onClick={() => handleLoadLedger(p.tenant_id)}
                              className="p-1.5 rounded-lg border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary cursor-pointer"
                              title="Grand Livre locataire"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Crud Actions */}
                          {canEdit && (
                            <>
                              <button
                                onClick={() => handleOpenUpload(p.id)}
                                className="p-1.5 rounded-lg border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary cursor-pointer"
                                title="Uploader justificatif"
                              >
                                <Upload className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenForm(p)}
                                className="p-1.5 rounded-lg border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary cursor-pointer"
                                title="Modifier"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(p.id)}
                                className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/15 border border-red-500/20 cursor-pointer"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-text-muted text-xs font-bold">
            Aucun paiement enregistré
          </div>
        )}
      </div>

      {/* CREATE & EDIT FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                {editingId ? '✏️ Modifier le paiement' : '💳 Nouveau paiement'}
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
                <label className="text-xs font-bold text-text-secondary uppercase">Locataire *</label>
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer"
                  required
                >
                  <option value="">— Sélectionner le locataire —</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.user?.full_name || t.full_name || `Locataire #${t.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Logement</label>
                <select
                  value={apartmentId}
                  onChange={(e) => setApartmentId(e.target.value)}
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer"
                >
                  <option value="">— Aucun logement attribué —</option>
                  {apartments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.apartment_number} {a.property ? `(${a.property.property_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Montant (FCFA) *</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Ex: 150000"
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Date de paiement *</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Méthode de paiement</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer"
                  >
                    <option value="orange_money">Orange Money</option>
                    <option value="mtn_mobile_money">MTN MoMo</option>
                    <option value="bank_transfer">Virement bancaire</option>
                    <option value="cash">Espèces</option>
                    <option value="kang">Mobile Money (Kang)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Statut</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer"
                  >
                    <option value="completed">Payé</option>
                    <option value="pending">En attente</option>
                    <option value="awaiting_confirmation">À vérifier</option>
                    <option value="failed">Échoué</option>
                    <option value="refunded">Remboursé</option>
                  </select>
                </div>
              </div>

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

      {/* UPLOAD JUSTIFICATIF MODAL */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                ⬆ Justificatif de paiement
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
                <label className="text-xs font-bold text-text-secondary uppercase">Uploader le reçu (Image ou PDF)</label>
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
                  {isUploading ? 'Upload en cours...' : 'Uploader'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILED LEDGER MODAL */}
      {ledgerTenantId && ledgerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                📋 Relevé — {ledgerData.tenant?.nom || ''}
              </h3>
              <button
                onClick={() => setLedgerTenantId(null)}
                className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4 text-xs font-semibold no-scrollbar">
              <div className="text-text-muted font-bold text-xs uppercase tracking-wide">
                {ledgerData.tenant?.logement || '—'}
                {ledgerData.tenant?.immeuble ? ` · ${ledgerData.tenant.immeuble}` : ''}
                {` · Loyer ${Helpers.formatMoney(ledgerData.loyer_mensuel)}/mois · ${ledgerData.mois_dus} mois dus`}
              </div>

              {/* Stats KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border-custom bg-bg-surface">
                  <span className="text-lg">🏠</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-text-primary truncate">{Helpers.formatMoney(ledgerData.total_du)}</span>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Total loyers dus</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border-custom bg-bg-surface">
                  <span className="text-lg">✅</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-text-primary truncate">{Helpers.formatMoney(ledgerData.total_valide)}</span>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Paiements validés</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border-custom bg-bg-surface">
                  <span className="text-lg">🕓</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-text-primary truncate">{Helpers.formatMoney(ledgerData.en_attente_preuve)}</span>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">En attente de preuve</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border-custom bg-bg-surface">
                  <span className="text-lg">⚖️</span>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-xs font-bold truncate ${ledgerData.solde > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {Helpers.formatMoney(Math.max(0, ledgerData.solde))}
                    </span>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Solde restant dû</span>
                  </div>
                </div>
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

            <div className="pt-4 border-t border-border-custom flex justify-end">
              <button
                onClick={() => setLedgerTenantId(null)}
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
