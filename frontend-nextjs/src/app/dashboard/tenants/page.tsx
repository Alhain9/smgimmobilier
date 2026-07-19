'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import {
  Users,
  Search,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Phone,
  MessageSquare,
  X,
  FileText,
  UserPlus,
  RefreshCw,
  Calendar
} from 'lucide-react';

interface Lease {
  id: number;
  status: string;
  monthly_rent: number;
  deposit_amount: number;
  start_date: string;
  end_date?: string;
  contract_file?: string;
  apartment?: {
    apartment_number: string;
    property?: {
      property_name: string;
    };
  };
}

interface Payment {
  id: number;
  amount: number;
  payment_date: string;
  status: string;
}

interface Tenant {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  cni?: string;
  profession?: string;
  emergency_contact?: string;
  status: string;
  user?: any;
  apartment?: {
    id: number;
    apartment_number: string;
    apartment_type: string;
    floor?: number;
    rent_amount?: number;
    property?: {
      property_name: string;
      city: string;
    };
  };
  leases?: Lease[];
  payments?: Payment[];
}

export default function TenantsPage() {
  const { hasRole } = useAuth();
  const { showSuccess, showError } = useToast();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [selectedLease, setSelectedLease] = useState<Lease | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cni, setCni] = useState('');
  const [profession, setProfession] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  
  // Lease renew form states
  const [renewRent, setRenewRent] = useState('');
  const [renewEndDate, setRenewEndDate] = useState('');

  const loadTenants = async () => {
    setIsLoading(true);
    try {
      const res = await API.get('/tenants');
      if (res.data) setTenants(res.data);
    } catch (err: any) {
      showError(err.message || 'Impossible de charger la liste des locataires.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const resetForm = () => {
    setFullName('');
    setPhone('');
    setEmail('');
    setPassword('');
    setCni('');
    setProfession('');
    setEmergencyContact('');
    setSelectedTenant(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !email.trim()) {
      showError('Nom complet, Téléphone et Email sont requis.');
      return;
    }

    try {
      const payload = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        cni: cni.trim(),
        profession: profession.trim(),
        emergency_contact: emergencyContact.trim(),
      };

      await API.post('/tenants', payload);
      showSuccess('Fiche locataire créée avec succès.');
      setIsCreateModalOpen(false);
      resetForm();
      loadTenants();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la création du locataire.');
    }
  };

  const handleEditClick = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setFullName(tenant.full_name);
    setPhone(tenant.phone);
    setEmail(tenant.email || '');
    setPassword('');
    setCni(tenant.cni || '');
    setProfession(tenant.profession || '');
    setEmergencyContact(tenant.emergency_contact || '');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    try {
      const payload: any = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        cni: cni.trim(),
        profession: profession.trim(),
        emergency_contact: emergencyContact.trim(),
      };

      if (password.trim()) {
        payload.password = password.trim();
      }

      await API.put(`/tenants/${selectedTenant.id}`, payload);
      showSuccess('Locataire mis à jour avec succès.');
      setIsEditModalOpen(false);
      resetForm();
      loadTenants();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la mise à jour du locataire.');
    }
  };

  const handleDeleteClick = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer la fiche de ce locataire ?')) return;

    try {
      await API.delete(`/tenants/${id}`);
      showSuccess('Locataire supprimé avec succès.');
      loadTenants();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la suppression.');
    }
  };

  const handleViewClick = async (id: number) => {
    try {
      const res = await API.get(`/tenants/${id}`);
      if (res.data) {
        setSelectedTenant(res.data);
        setIsViewModalOpen(true);
      }
    } catch (_) {
      showError('Impossible de charger les détails du locataire.');
    }
  };

  const handleRenewClick = (lease: Lease) => {
    setSelectedLease(lease);
    setRenewRent(String(lease.monthly_rent));
    setRenewEndDate('');
    setIsRenewModalOpen(true);
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLease || !selectedTenant) return;
    if (!renewEndDate) {
      showError('Date d\'échéance requise.');
      return;
    }
    if (parseFloat(renewRent) <= 0) {
      showError('Loyer mensuel invalide.');
      return;
    }

    try {
      await API.post(`/leases/${selectedLease.id}/renew`, {
        end_date: renewEndDate,
        monthly_rent: parseFloat(renewRent),
      });
      showSuccess('Contrat de bail renouvelé avec succès.');
      setIsRenewModalOpen(false);
      // Re-fetch details to update view
      const res = await API.get(`/tenants/${selectedTenant.id}`);
      if (res.data) setSelectedTenant(res.data);
      loadTenants();
    } catch (err: any) {
      showError(err.message || 'Erreur lors du renouvellement du contrat.');
    }
  };

  const handleWhatsApp = (t: Tenant) => {
    const message = encodeURIComponent(`Bonjour ${t.full_name}, concernant votre logement ${t.apartment?.apartment_number || ''}...`);
    window.open(`https://wa.me/${t.phone.replace(/[^0-9]/g, '')}?text=${message}`, '_blank');
  };

  const handleCall = (phoneNum: string) => {
    window.open(`tel:${phoneNum}`, '_self');
  };

  const filtered = tenants.filter((t) => {
    const text = searchTerm.toLowerCase();
    return (
      t.full_name.toLowerCase().includes(text) ||
      t.phone.toLowerCase().includes(text) ||
      t.email.toLowerCase().includes(text) ||
      (t.apartment && t.apartment.apartment_number.toLowerCase().includes(text))
    );
  });

  const canEdit = hasRole('manager', 'dir_admin', 'gestionnaire');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Locataires</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Gérez les dossiers locataires, les contrats de bail et les historiques
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
            <UserPlus className="w-4 h-4" /> Nouveau locataire
          </button>
        )}
      </div>

      {/* Stats Quick Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-text-primary">{tenants.length}</span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Locataires inscrits</span>
        </div>
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-green-500">
            {tenants.filter((t) => t.status === 'active').length}
          </span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Locataires actifs</span>
        </div>
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-sky-500">
            {tenants.filter((t) => t.apartment).length}
          </span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5 font-sans">Logements attribués</span>
        </div>
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-red-500">
            {tenants.filter((t) => t.status === 'suspended').length}
          </span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Locataires suspendus</span>
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
          placeholder="Rechercher par nom, téléphone, email ou logement..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-custom bg-bg-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
        />
      </div>

      {/* Table view */}
      {isLoading ? (
        <div className="flex flex-col items-center p-12 text-center text-text-muted">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs">Chargement des dossiers locataires...</span>
        </div>
      ) : filtered.length > 0 ? (
        <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                  <th className="px-6 py-4">Nom</th>
                  <th className="px-6 py-4">Téléphone</th>
                  <th className="px-6 py-4">Logement</th>
                  <th className="px-6 py-4">Immeuble</th>
                  <th className="px-6 py-4 text-center">Compte</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom text-sm">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-bg-hover/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-white text-xs font-extrabold tracking-wide uppercase select-none">
                          {Helpers.initials(t.full_name)}
                        </div>
                        <span className="font-extrabold text-text-primary">{t.full_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary font-medium">{t.phone}</td>
                    <td className="px-6 py-4">
                      {t.apartment ? (
                        <div>
                          <b className="text-text-primary font-bold">{t.apartment.apartment_number}</b>
                          <div className="text-[10px] text-text-muted mt-0.5">{t.apartment.apartment_type}</div>
                        </div>
                      ) : (
                        <span className="text-text-muted italic">Non attribué</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {t.apartment?.property ? (
                        <div>
                          <span className="font-medium">{t.apartment.property.property_name}</span>
                          <div className="text-[10px] text-text-muted mt-0.5">{t.apartment.property.city}</div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {t.user ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20">Oui</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20">Non</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={Helpers.statusBadge(t.status).className}>
                        {Helpers.statusBadge(t.status).label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleWhatsApp(t)}
                          className="p-1.5 rounded-lg border border-green-200 hover:bg-green-50 text-green-600 transition-colors cursor-pointer"
                          title="Message WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCall(t.phone)}
                          className="p-1.5 rounded-lg border border-border-custom hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                          title="Appeler"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleViewClick(t.id)}
                          className="p-1.5 rounded-lg border border-border-custom hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                          title="Dossier complet"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEditClick(t)}
                          className="p-1.5 rounded-lg border border-border-custom hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                          title="Modifier"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(t.id)}
                          className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 text-red-500 transition-colors cursor-pointer"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
          <span className="text-2xl">👤</span>
          <p className="text-sm mt-2">Aucun locataire ne correspond à votre recherche.</p>
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
                <UserPlus className="w-5 h-5 text-primary" /> Nouveau locataire
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 text-sm no-scrollbar">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Nom complet *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nom Prénom"
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Téléphone *</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex : +2376xxxxxxxx"
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex : locataire@smg.com"
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Numéro CNI</label>
                  <input
                    type="text"
                    value={cni}
                    onChange={(e) => setCni(e.target.value)}
                    placeholder="Numéro d'identité"
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Profession</label>
                  <input
                    type="text"
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    placeholder="Ex : Comptable"
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Contact d'urgence</label>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Nom et téléphone du proche"
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                />
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
      {isEditModalOpen && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" /> Modifier le locataire
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 text-sm no-scrollbar">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Nom complet *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Téléphone *</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Mot de passe (laisser vide pour ne pas modifier)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  placeholder="Nouveau mot de passe..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Numéro CNI</label>
                  <input
                    type="text"
                    value={cni}
                    onChange={(e) => setCni(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Profession</label>
                  <input
                    type="text"
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Contact d'urgence</label>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                />
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

      {/* 3. VIEW DETAILS MODAL */}
      {isViewModalOpen && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-extrabold text-text-primary flex items-center gap-2">
                Fiche Locataire — {selectedTenant.full_name}
              </h3>
              <button onClick={() => setIsViewModalOpen(false)} className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-5 py-4 text-sm no-scrollbar">
              {/* Profile metadata */}
              <div className="grid grid-cols-2 gap-4 border border-border-custom rounded-xl p-4 bg-bg-surface-2">
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase">Téléphone</span>
                  <span className="font-bold text-text-primary mt-0.5 block">{selectedTenant.phone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase">Email</span>
                  <span className="font-bold text-text-primary mt-0.5 block">{selectedTenant.email}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase">Profession</span>
                  <span className="font-bold text-text-primary mt-0.5 block">{selectedTenant.profession || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted font-bold uppercase">CNI / Identité</span>
                  <span className="font-bold text-text-primary mt-0.5 block">{selectedTenant.cni || '—'}</span>
                </div>
              </div>

              {/* Logement */}
              <div>
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">🏠 Logement actuel</h4>
                <div className="border border-border-custom rounded-xl p-4 bg-bg-surface-2 space-y-2">
                  {selectedTenant.apartment ? (
                    <>
                      <div className="flex justify-between items-center pb-2 border-b border-border-custom/50">
                        <span className="text-text-secondary font-medium">Numéro de logement</span>
                        <b className="text-text-primary">
                          {selectedTenant.apartment.apartment_number} ({selectedTenant.apartment.apartment_type})
                        </b>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-border-custom/50">
                        <span className="text-text-secondary font-medium">Immeuble</span>
                        <b className="text-text-primary">
                          {selectedTenant.apartment.property?.property_name} ({selectedTenant.apartment.property?.city})
                        </b>
                      </div>
                      {selectedTenant.apartment.rent_amount && (
                        <div className="flex justify-between items-center">
                          <span className="text-text-secondary font-medium">Loyer mensuel</span>
                          <b className="text-primary">{Helpers.formatMoney(selectedTenant.apartment.rent_amount)}</b>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-text-muted italic py-1">Aucun logement attribué actuellement.</p>
                  )}
                </div>
              </div>

              {/* Leases */}
              <div>
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">📄 Contrats de bail</h4>
                <div className="space-y-3">
                  {selectedTenant.leases && selectedTenant.leases.length > 0 ? (
                    selectedTenant.leases.map((l) => (
                      <div key={l.id} className="p-4 border border-border-custom rounded-xl bg-bg-surface-2 flex flex-col gap-3">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="font-bold text-text-primary">Bail #{l.id}</span>
                            <div className="text-xs text-text-secondary mt-0.5">
                              Loyer : {Helpers.formatMoney(l.monthly_rent)}/m · Caution : {Helpers.formatMoney(l.deposit_amount)}
                            </div>
                            <div className="text-[10px] text-text-muted mt-1 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              Dès le {Helpers.formatDate(l.start_date)} {l.end_date ? `au ${Helpers.formatDate(l.end_date)}` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={Helpers.statusBadge(l.status).className}>
                              {Helpers.statusBadge(l.status).label}
                            </span>
                            {l.contract_file && (
                              <a
                                href={Helpers.fileUrl(l.contract_file)}
                                target="_blank"
                                className="p-1 rounded-lg border border-border-custom bg-bg-surface text-text-secondary hover:text-text-primary cursor-pointer"
                                title="Voir le PDF"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>

                        {canEdit && (l.status === 'active' || l.status === 'expired' || l.status === 'terminated') && (
                          <div className="flex justify-between items-center pt-2 border-t border-dashed border-border-custom mt-1">
                            <span className="text-[11px] text-text-muted">Ajuster ou prolonger ce bail ?</span>
                            <button
                              onClick={() => handleRenewClick(l)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-primary/20 text-xs font-bold text-primary hover:bg-primary/5 cursor-pointer"
                            >
                              <RefreshCw className="w-3 h-3" /> Renouveler
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-text-muted italic py-1">Aucun contrat de bail enregistré.</p>
                  )}
                </div>
              </div>

              {/* Payments */}
              <div>
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">💰 Synthèse des paiements</h4>
                <div className="grid grid-cols-2 gap-4 border border-border-custom rounded-xl p-4 bg-bg-surface-2">
                  <div>
                    <span className="text-[10px] text-text-secondary font-bold uppercase">Paiements validés</span>
                    <b className="text-green-500 font-extrabold text-sm mt-0.5 block">
                      {selectedTenant.payments?.filter((p) => p.status === 'completed').length || 0}
                    </b>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-secondary font-bold uppercase">Paiements en attente</span>
                    <b className="text-amber-500 font-extrabold text-sm mt-0.5 block">
                      {selectedTenant.payments?.filter((p) => ['pending', 'failed', 'awaiting_confirmation'].includes(p.status)).length || 0}
                    </b>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border-custom">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-5 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer"
              >
                Fermer
              </button>
              {canEdit && (
                <button
                  onClick={() => {
                    setIsViewModalOpen(false);
                    handleEditClick(selectedTenant);
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-colors"
                >
                  Modifier le dossier
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. LEASE RENEW MODAL */}
      {isRenewModalOpen && selectedLease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl animate-slide-in">
            <h3 className="text-base font-bold text-text-primary mb-4 pb-2 border-b border-border-custom">
              Renouveler le contrat de bail (Bail #{selectedLease.id})
            </h3>
            <form onSubmit={handleRenewSubmit} className="space-y-4 text-sm">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Nouveau loyer mensuel (FCFA)</label>
                <input
                  type="number"
                  value={renewRent}
                  onChange={(e) => setRenewRent(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Nouvelle date d'échéance (fin de contrat)</label>
                <input
                  type="date"
                  value={renewEndDate}
                  onChange={(e) => setRenewEndDate(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsRenewModalOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow cursor-pointer transition-colors"
                >
                  Confirmer le renouvellement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
