'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import {
  FileText,
  Plus,
  Search,
  Edit2,
  Trash2,
  Upload,
  MessageSquare,
  X,
  FileCheck,
  Calendar
} from 'lucide-react';

interface TenantOption {
  id: number;
  full_name: string;
}

interface ApartmentOption {
  id: number;
  apartment_number: string;
  property?: {
    property_name: string;
  };
}

interface Lease {
  id: number;
  monthly_rent: number;
  deposit_amount: number;
  start_date: string;
  end_date?: string;
  contract_file?: string;
  status: string;
  tenant?: {
    id: number;
    full_name: string;
    phone?: string;
    user?: {
      full_name: string;
      phone?: string;
    };
  };
  apartment?: {
    id: number;
    apartment_number: string;
    property?: {
      property_name: string;
      city?: string;
      district?: string;
    };
  };
}

export default function LeasesPage() {
  const { hasRole } = useAuth();
  const { showSuccess, showError } = useToast();

  const [leases, setLeases] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [apartments, setApartments] = useState<ApartmentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedLease, setSelectedLease] = useState<Lease | null>(null);

  // Form states
  const [tenantId, setTenantId] = useState('');
  const [apartmentId, setApartmentId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [status, setStatus] = useState('pending');

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const leaseRes = await API.get('/leases');
      if (leaseRes.data) setLeases(leaseRes.data);

      const tenantRes = await API.get('/tenants');
      if (tenantRes.data) setTenants(tenantRes.data);

      const aptRes = await API.get('/apartments');
      if (aptRes.data) setApartments(aptRes.data);
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la récupération des données.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setTenantId(tenants[0]?.id ? String(tenants[0].id) : '');
    setApartmentId(apartments[0]?.id ? String(apartments[0].id) : '');
    setStartDate('');
    setEndDate('');
    setMonthlyRent('');
    setDepositAmount('');
    setStatus('pending');
    setSelectedLease(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !apartmentId || !startDate || !monthlyRent) {
      showError('Locataire, Logement, Date de début et Loyer mensuel sont requis.');
      return;
    }

    try {
      const payload = {
        tenant_id: Number(tenantId),
        apartment_id: Number(apartmentId),
        start_date: startDate,
        end_date: endDate || null,
        monthly_rent: Number(monthlyRent),
        deposit_amount: Number(depositAmount) || 0,
        status,
      };

      await API.post('/leases', payload);
      showSuccess('Contrat de bail créé avec succès.');
      setIsCreateModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur de création du contrat.');
    }
  };

  const handleEditClick = (lease: Lease) => {
    setSelectedLease(lease);
    setTenantId(String(lease.tenant?.id || ''));
    setApartmentId(String(lease.apartment?.id || ''));
    setStartDate(lease.start_date ? lease.start_date.slice(0, 10) : '');
    setEndDate(lease.end_date ? lease.end_date.slice(0, 10) : '');
    setMonthlyRent(String(lease.monthly_rent));
    setDepositAmount(String(lease.deposit_amount));
    setStatus(lease.status);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLease) return;

    try {
      const payload = {
        tenant_id: Number(tenantId),
        apartment_id: Number(apartmentId),
        start_date: startDate,
        end_date: endDate || null,
        monthly_rent: Number(monthlyRent),
        deposit_amount: Number(depositAmount) || 0,
        status,
      };

      await API.put(`/leases/${selectedLease.id}`, payload);
      showSuccess('Contrat mis à jour avec succès.');
      setIsEditModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la modification.');
    }
  };

  const handleUploadClick = (lease: Lease) => {
    setSelectedLease(lease);
    setSelectedFile(null);
    setIsUploadModalOpen(true);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLease || !selectedFile) {
      showError('Veuillez sélectionner un fichier PDF.');
      return;
    }

    setIsUploading(true);
    const fd = new FormData();
    fd.append('contract', selectedFile);

    try {
      await API.upload(`/leases/${selectedLease.id}/contract`, fd);
      showSuccess('Contrat PDF signé enregistré avec succès.');
      setIsUploadModalOpen(false);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors du chargement du fichier.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteClick = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce contrat de bail ?')) return;

    try {
      await API.delete(`/leases/${id}`);
      showSuccess('Contrat supprimé avec succès.');
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la suppression.');
    }
  };

  const handleWhatsApp = (l: Lease) => {
    const phone = l.tenant?.user?.phone || l.tenant?.phone || '';
    if (!phone) {
      showError('Numéro de téléphone indisponible.');
      return;
    }
    const message = encodeURIComponent(`Bonjour ${l.tenant?.full_name || ''}, votre contrat pour le logement ${l.apartment?.apartment_number || ''} est prêt...`);
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${message}`, '_blank');
  };

  const filtered = leases.filter((l) => {
    const text = searchTerm.toLowerCase();
    const tName = l.tenant?.full_name?.toLowerCase() || '';
    const aNum = l.apartment?.apartment_number?.toLowerCase() || '';
    const pName = l.apartment?.property?.property_name?.toLowerCase() || '';
    return tName.includes(text) || aNum.includes(text) || pName.includes(text);
  });

  const canEdit = hasRole('manager', 'dir_admin', 'gestionnaire');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Contrats de bail</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Gérez les baux de location, les cautions et archivez les fichiers PDF signés
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              resetForm();
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" /> Nouveau contrat
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-text-primary">{leases.length}</span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Contrats totaux</span>
        </div>
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-green-500">
            {leases.filter((l) => l.status === 'active').length}
          </span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Contrats actifs</span>
        </div>
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-sky-500">
            {leases.filter((l) => l.status === 'pending').length}
          </span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5 font-sans">En attente de signature</span>
        </div>
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-red-500">
            {leases.filter((l) => l.status === 'terminated').length}
          </span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Contrats résiliés</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher par locataire, logement ou immeuble..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-custom bg-bg-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
        />
      </div>

      {/* Leases Table */}
      {isLoading ? (
        <div className="flex flex-col items-center p-12 text-center text-text-muted">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs">Chargement des contrats de bail...</span>
        </div>
      ) : filtered.length > 0 ? (
        <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                  <th className="px-6 py-4">Locataire</th>
                  <th className="px-6 py-4">Logement</th>
                  <th className="px-6 py-4">Immeuble</th>
                  <th className="px-6 py-4">Loyer</th>
                  <th className="px-6 py-4">Début</th>
                  <th className="px-6 py-4 text-center">Fichier PDF</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom text-sm">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-bg-hover/50">
                    <td className="px-6 py-4 font-bold text-text-primary">
                      {l.tenant?.full_name || '—'}
                    </td>
                    <td className="px-6 py-4 text-text-secondary font-medium">
                      {l.apartment?.apartment_number || '—'}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {l.apartment?.property?.property_name || '—'}
                    </td>
                    <td className="px-6 py-4 font-bold text-text-primary">
                      {Helpers.formatMoney(l.monthly_rent)}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {Helpers.formatDate(l.start_date)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {l.contract_file ? (
                        <a
                          href={Helpers.fileUrl(l.contract_file)}
                          target="_blank"
                          className="px-2.5 py-1 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 text-xs font-bold text-primary inline-flex items-center gap-1 cursor-pointer"
                        >
                          <FileCheck className="w-3.5 h-3.5" /> Ouvrir
                        </a>
                      ) : (
                        <span className="text-text-muted text-xs italic">Non signé</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={Helpers.statusBadge(l.status).className}>
                        {Helpers.statusBadge(l.status).label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleWhatsApp(l)}
                          className="p-1.5 rounded-lg border border-green-200 hover:bg-green-50 text-green-600 transition-colors cursor-pointer"
                          title="WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleUploadClick(l)}
                              className="p-1.5 rounded-lg border border-border-custom hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                              title="Uploader le PDF signé"
                            >
                              <Upload className="w-3.5 h-3.5 text-primary" />
                            </button>
                            <button
                              onClick={() => handleEditClick(l)}
                              className="p-1.5 rounded-lg border border-border-custom hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                              title="Modifier"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {hasRole('manager', 'dir_admin') && (
                          <button
                            onClick={() => handleDeleteClick(l.id)}
                            className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 text-red-500 transition-colors cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center p-12 text-text-muted border border-dashed border-border-custom rounded-2xl bg-bg-surface">
          <span className="text-2xl">📄</span>
          <p className="text-sm mt-2">Aucun contrat de bail enregistré.</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Nouveau contrat de bail
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 text-sm no-scrollbar">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Locataire *</label>
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                >
                  <option value="">Sélectionnez un locataire...</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Logement *</label>
                <select
                  value={apartmentId}
                  onChange={(e) => setApartmentId(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                >
                  <option value="">Sélectionnez un logement...</option>
                  {apartments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.apartment_number} {a.property ? `(${a.property.property_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Date de début *</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Date de fin</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Loyer mensuel * (FCFA)</label>
                  <input
                    type="number"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    placeholder="Ex : 120000"
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Montant Caution (FCFA)</label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="Ex : 240000"
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Statut</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                >
                  <option value="pending">En attente</option>
                  <option value="active">Actif</option>
                  <option value="expired">Expiré</option>
                  <option value="terminated">Résilié</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-custom">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. EDIT MODAL */}
      {isEditModalOpen && selectedLease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" /> Modifier le contrat
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 text-sm no-scrollbar">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Locataire *</label>
                <select
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Logement *</label>
                <select
                  value={apartmentId}
                  onChange={(e) => setApartmentId(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                >
                  {apartments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.apartment_number} {a.property ? `(${a.property.property_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Date de début *</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Date de fin</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Loyer mensuel * (FCFA)</label>
                  <input
                    type="number"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Montant Caution (FCFA)</label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Statut</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                >
                  <option value="pending">En attente</option>
                  <option value="active">Actif</option>
                  <option value="expired">Expiré</option>
                  <option value="terminated">Résilié</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-custom">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. UPLOAD FILE MODAL */}
      {isUploadModalOpen && selectedLease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl animate-slide-in">
            <h3 className="text-base font-bold text-text-primary mb-4 pb-2 border-b border-border-custom flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" /> Téléverser le contrat PDF signé
            </h3>
            <form onSubmit={handleUploadSubmit} className="space-y-4 text-sm">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Sélectionner le fichier PDF *</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-3 rounded-xl border border-border-custom bg-bg-body focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-xs transition-all"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors"
                >
                  {isUploading ? 'Téléversement...' : 'Téléverser'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
