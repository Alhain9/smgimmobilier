'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import { PDF } from '../../../utils/pdf';
import {
  Plus,
  Search,
  X,
  Edit,
  Trash2,
  Upload,
  FileText,
  Check,
  RotateCcw,
  Zap,
  Droplet,
  AlertCircle
} from 'lucide-react';

interface Tenant {
  id: number;
  user?: {
    full_name: string;
  } | null;
}

interface Apartment {
  id: number;
  apartment_number: string;
  property?: {
    property_name: string;
  } | null;
  tenants?: Tenant[];
}

interface UtilityBill {
  id: number;
  apartment_id: number;
  type: string;
  period_month: number;
  period_year: number;
  previous_index: number;
  current_index: number;
  unit_price: number;
  garbage_fee: number;
  transport_fee: number;
  other_fee: number;
  other_label?: string | null;
  total_amount: number;
  status: string;
  payment_proof?: string | null;
  apartment?: Apartment | null;
}

interface BillableApt {
  id: number;
  label: string;
  electricity_price: number;
  water_price: number;
  garbage_fee: number;
  transport_fee: number;
}

export default function UtilitiesPage() {
  const { hasRole } = useAuth();
  const { showSuccess, showError } = useToast();

  const [bills, setBills] = useState<UtilityBill[]>([]);
  const [billableApts, setBillableApts] = useState<BillableApt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [apartmentId, setApartmentId] = useState('');
  const [type, setType] = useState('electricity');
  const [periodMonth, setPeriodMonth] = useState('1');
  const [periodYear, setPeriodYear] = useState('');
  const [prevIndex, setPrevIndex] = useState('0');
  const [currIndex, setCurrIndex] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [garbageFee, setGarbageFee] = useState('0');
  const [transportFee, setTransportFee] = useState('0');
  const [otherFee, setOtherFee] = useState('0');
  const [otherLabel, setOtherLabel] = useState('');
  const [status, setStatus] = useState('pending');

  // Upload proof states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadBillId, setUploadBillId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const MONTHS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Load bills
      const res = await API.get('/utility-bills');
      if (res.data) setBills(res.data);

      // 2. Load properties to extract billable apartments (utilities_enabled = true)
      const propRes = await API.get('/properties');
      const billables: BillableApt[] = [];
      if (propRes.data) {
        propRes.data
          .filter((p: any) => p.utilities_enabled)
          .forEach((p: any) => {
            (p.apartments || []).forEach((a: any) => {
              billables.push({
                id: a.id,
                label: `${a.apartment_number} — ${p.property_name}`,
                electricity_price: p.electricity_price,
                water_price: p.water_price,
                garbage_fee: p.garbage_fee,
                transport_fee: p.transport_fee,
              });
            });
          });
      }
      setBillableApts(billables);
    } catch (err: any) {
      showError(err.message || 'Erreur lors du chargement des charges.');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle prefilling from last bill or defaults
  const handlePrefill = useCallback(async (aptIdStr: string, typeStr: string) => {
    if (!aptIdStr) return;
    const apt = billableApts.find(a => String(a.id) === String(aptIdStr));
    if (!apt) return;

    let last = null;
    try {
      const res = await API.get(`/utility-bills/last?apartment_id=${aptIdStr}&type=${typeStr}`);
      if (res.data) last = res.data;
    } catch (_) {}

    if (last) {
      setPrevIndex(String(last.current_index));
      setUnitPrice(String(last.unit_price));
      setGarbageFee(String(last.garbage_fee));
      setTransportFee(String(last.transport_fee));
    } else {
      setPrevIndex('0');
      setUnitPrice(typeStr === 'water' ? String(apt.water_price) : String(apt.electricity_price));
      setGarbageFee(String(apt.garbage_fee));
      setTransportFee(String(apt.transport_fee));
    }
    setCurrIndex('');
  }, [billableApts]);

  const handleApartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const aId = e.target.value;
    setApartmentId(aId);
    handlePrefill(aId, type);
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const t = e.target.value;
    setType(t);
    handlePrefill(apartmentId, t);
  };

  const handleOpenForm = (bill?: UtilityBill) => {
    const now = new Date();
    if (bill) {
      setEditingId(bill.id);
      setApartmentId(String(bill.apartment_id));
      setType(bill.type);
      setPeriodMonth(String(bill.period_month));
      setPeriodYear(String(bill.period_year));
      setPrevIndex(String(bill.previous_index));
      setCurrIndex(String(bill.current_index));
      setUnitPrice(String(bill.unit_price));
      setGarbageFee(String(bill.garbage_fee));
      setTransportFee(String(bill.transport_fee));
      setOtherFee(String(bill.other_fee));
      setOtherLabel(bill.other_label || '');
      setStatus(bill.status);
    } else {
      setEditingId(null);
      setApartmentId('');
      setType('electricity');
      setPeriodMonth(String(now.getMonth() + 1));
      setPeriodYear(String(now.getFullYear()));
      setPrevIndex('0');
      setCurrIndex('');
      setUnitPrice('');
      setGarbageFee('0');
      setTransportFee('0');
      setOtherFee('0');
      setOtherLabel('');
      setStatus('pending');
    }
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apartmentId || !currIndex || !unitPrice) {
      showError('Veuillez remplir les champs obligatoires.');
      return;
    }

    const payload = {
      apartment_id: Number(apartmentId),
      type: type,
      period_month: Number(periodMonth),
      period_year: Number(periodYear),
      previous_index: Number(prevIndex) || 0,
      current_index: Number(currIndex),
      unit_price: Number(unitPrice),
      garbage_fee: Number(garbageFee) || 0,
      transport_fee: Number(transportFee) || 0,
      other_fee: Number(otherFee) || 0,
      other_label: otherLabel.trim() || null,
      status: status,
    };

    try {
      if (editingId) {
        await API.put(`/utility-bills/${editingId}`, payload);
        showSuccess('Facture mise à jour.');
      } else {
        await API.post('/utility-bills', payload);
        showSuccess('Facture enregistrée.');
      }
      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de l\'enregistrement.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette facture de charges ?')) return;
    try {
      await API.delete(`/utility-bills/${id}`);
      showSuccess('Facture de charges supprimée.');
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la suppression.');
    }
  };

  const handleTogglePaid = async (id: number, currentStatus: string) => {
    const isPaid = currentStatus === 'paid';
    try {
      await API.patch(`/utility-bills/${id}/paid`, { paid: !isPaid });
      showSuccess('Statut de la facture mis à jour.');
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur de mise à jour.');
    }
  };

  const handleOpenUpload = (id: number) => {
    setUploadBillId(id);
    setSelectedFile(null);
    setIsUploadOpen(true);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadBillId || !selectedFile) {
      showError('Sélectionnez un reçu.');
      return;
    }

    setIsUploading(true);
    const fd = new FormData();
    fd.append('proof', selectedFile);

    try {
      await API.upload(`/utility-bills/${uploadBillId}/proof`, fd);
      showSuccess('Justificatif enregistré.');
      setIsUploadOpen(false);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur d\'upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePDF = (b: UtilityBill) => {
    const loc = b.apartment ? `${b.apartment.apartment_number} (${b.apartment.property ? b.apartment.property.property_name : ''})` : '—';
    const nom = (b.apartment?.tenants?.[0]?.user) ? b.apartment.tenants[0].user.full_name : '—';
    const consoVal = Math.max(0, b.current_index - b.previous_index);
    const txt = `FACTURE DE CHARGES — ${b.type === 'water' ? '💧 Eau' : '⚡ Électricité'}\n`
      + `Période : ${MONTHS[b.period_month - 1]} ${b.period_year}\n`
      + `Logement : ${loc}\nLocataire : ${nom}\n\n`
      + `Ancien index : ${b.previous_index}\nNouvel index : ${b.current_index}\nConsommation : ${consoVal}\n`
      + `Prix unitaire : ${Helpers.formatMoney(b.unit_price)}\nMontant consommation : ${Helpers.formatMoney(consoVal * b.unit_price)}\n`
      + `Poubelle : ${Helpers.formatMoney(b.garbage_fee)}\nTransport : ${Helpers.formatMoney(b.transport_fee)}\n`
      + (Number(b.other_fee) ? `${b.other_label || 'Autre'} : ${Helpers.formatMoney(b.other_fee)}\n` : '')
      + `\nTOTAL À PAYER : ${Helpers.formatMoney(b.total_amount)}\nStatut : ${b.status === 'paid' ? 'PAYÉ' : 'EN ATTENTE'}`;

    PDF.document('Facture de charges', txt);
  };

  const filteredBills = bills.filter(b => {
    const q = searchTerm.toLowerCase();
    const apt = b.apartment?.apartment_number || '';
    const prop = b.apartment?.property?.property_name || '';
    const loc = b.apartment?.tenants?.[0]?.user?.full_name || '';
    return (
      apt.toLowerCase().includes(q) ||
      prop.toLowerCase().includes(q) ||
      loc.toLowerCase().includes(q)
    );
  });

  // Calculate live values in form
  const formConso = Math.max(0, Number(currIndex) - Number(prevIndex));
  const formTotal = formConso * Number(unitPrice) + Number(garbageFee) + Number(transportFee) + Number(otherFee);

  const canEdit = hasRole('manager', 'comptable', 'dir_admin', 'gestionnaire');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">⚡ Charges & Compteurs</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Refacturation des consommations d'eau et d'électricité des locataires
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => handleOpenForm()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" /> Nouvelle facture
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-base font-bold text-text-primary">
            Registre des factures de charges
          </h3>
          <div className="relative max-w-[260px] w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher logement, immeuble..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-border-custom bg-bg-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-semibold"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-text-muted">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs">Chargement des compteurs...</span>
          </div>
        ) : filteredBills.length > 0 ? (
          <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                  <th className="px-5 py-3.5">Logement</th>
                  <th className="px-5 py-3.5">Locataire</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Période</th>
                  <th className="px-5 py-3.5">Index (Conso)</th>
                  <th className="px-5 py-3.5">Total</th>
                  <th className="px-5 py-3.5">Statut</th>
                  <th className="px-5 py-3.5">Justif</th>
                  <th className="px-5 py-3.5 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom text-xs font-semibold">
                {filteredBills.map((b) => {
                  const conso = Math.max(0, b.current_index - b.previous_index);
                  const hasProof = !!b.payment_proof;
                  return (
                    <tr key={b.id} className="hover:bg-bg-hover/50 transition-colors">
                      <td className="px-5 py-3.5 text-text-primary">
                        <p className="font-extrabold">{b.apartment?.apartment_number || '—'}</p>
                        {b.apartment?.property && <span className="text-[10px] text-text-muted font-bold mt-0.5 inline-block">{b.apartment.property.property_name}</span>}
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary">
                        {b.apartment?.tenants?.[0]?.user?.full_name || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary font-bold">
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
                        <span className="text-[10px] text-text-muted">conso: {conso}</span>
                      </td>
                      <td className="px-5 py-3.5 text-text-primary font-extrabold">{Helpers.formatMoney(b.total_amount)}</td>
                      <td className="px-5 py-3.5">
                        <span className={Helpers.statusBadge(b.status === 'paid' ? 'completed' : 'pending').className}>
                          {b.status === 'paid' ? 'Payé' : 'En attente'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {hasProof ? (
                          <a
                            href={Helpers.fileUrl(b.payment_proof)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-extrabold text-sm"
                          >
                            📎 Reçu
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right no-print">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handlePDF(b)}
                            className="p-1.5 rounded-lg border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary cursor-pointer"
                            title="Facture PDF"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                onClick={() => handleTogglePaid(b.id, b.status)}
                                className={`p-1.5 rounded-lg border cursor-pointer ${
                                  b.status === 'paid'
                                    ? 'bg-slate-500/10 hover:bg-slate-500/15 border-slate-500/20 text-text-secondary'
                                    : 'bg-green-500/10 hover:bg-green-500/15 border-green-500/20 text-green-500'
                                }`}
                                title={b.status === 'paid' ? 'Remettre en attente' : 'Marquer payé'}
                              >
                                {b.status === 'paid' ? (
                                  <RotateCcw className="w-3.5 h-3.5" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => handleOpenUpload(b.id)}
                                className="p-1.5 rounded-lg border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary cursor-pointer"
                                title="Joindre justificatif"
                              >
                                <Upload className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenForm(b)}
                                className="p-1.5 rounded-lg border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary cursor-pointer"
                                title="Modifier"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              {hasRole('manager', 'comptable') && (
                                <button
                                  onClick={() => handleDelete(b.id)}
                                  className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/15 border border-red-500/20 cursor-pointer"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
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
            Aucune facture de charges enregistrée
          </div>
        )}
      </div>

      {/* CREATE & EDIT FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                {editingId ? '✏️ Modifier la facture de charges' : '⚡ Nouvelle facture de charges'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 text-sm font-semibold no-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs font-bold text-text-secondary uppercase">Logement</label>
                  <select
                    value={apartmentId}
                    onChange={handleApartmentChange}
                    disabled={!!editingId}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer disabled:opacity-50"
                    required
                  >
                    <option value="">— Choisir le logement —</option>
                    {billableApts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Type de charge</label>
                  <select
                    value={type}
                    onChange={handleTypeChange}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer"
                  >
                    <option value="electricity">⚡ Électricité</option>
                    <option value="water">💧 Eau</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Mois</label>
                  <select
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer"
                  >
                    {MONTHS.map((m, idx) => (
                      <option key={idx} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Année</label>
                  <select
                    value={periodYear}
                    onChange={(e) => setPeriodYear(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer"
                  >
                    {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Ancien index</label>
                  <input
                    type="number"
                    step="0.01"
                    value={prevIndex}
                    onChange={(e) => setPrevIndex(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Nouvel index *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={currIndex}
                    onChange={(e) => setCurrIndex(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Prix unité (FCFA) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Poubelle (FCFA)</label>
                  <input
                    type="number"
                    value={garbageFee}
                    onChange={(e) => setGarbageFee(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Transport (FCFA)</label>
                  <input
                    type="number"
                    value={transportFee}
                    onChange={(e) => setTransportFee(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Autre frais (FCFA)</label>
                  <input
                    type="number"
                    value={otherFee}
                    onChange={(e) => setOtherFee(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-xs font-bold text-text-secondary uppercase">Libellé autre frais</label>
                  <input
                    type="text"
                    value={otherLabel}
                    onChange={(e) => setOtherLabel(e.target.value)}
                    placeholder="Ex: Réparation compteur"
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
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

              {/* Realtime summary display */}
              <div className="list-item" style={{ background: 'var(--bg-surface-2)', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-xs text-text-secondary font-bold">
                  Consommation : <span className="text-text-primary">{formConso} units</span>
                </span>
                <div>
                  <span className="text-xs text-text-muted font-bold mr-2 uppercase">Total à payer :</span>
                  <span className="font-extrabold text-primary text-base">
                    {Helpers.formatMoney(formTotal)}
                  </span>
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

      {/* UPLOAD PROOF MODAL */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                ⬆ Reçu de paiement
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
                <label className="text-xs font-bold text-text-secondary uppercase">Reçu (Image ou PDF)</label>
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
