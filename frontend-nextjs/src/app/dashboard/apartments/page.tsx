'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import {
  DoorClosed,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  PlusCircle,
  Building2
} from 'lucide-react';

interface PropertyOption {
  id: number;
  property_name: string;
}

interface Apartment {
  id: number;
  apartment_number: string;
  apartment_type: string;
  floor?: number;
  rent_amount: number;
  status: string;
  description?: string;
  property?: {
    id: number;
    property_name: string;
  };
  tenants?: Array<{
    id: number;
    full_name: string;
    user?: {
      full_name: string;
    };
  }>;
}

export default function ApartmentsPage() {
  const { hasRole } = useAuth();
  const { showSuccess, showError } = useToast();

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);

  // Form states
  const [propertyId, setPropertyId] = useState('');
  const [apartmentNumber, setApartmentNumber] = useState('');
  const [apartmentType, setApartmentType] = useState('appartement');
  const [floor, setFloor] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [status, setStatus] = useState('free');
  const [description, setDescription] = useState('');

  const APARTMENT_TYPES = [
    { value: 'appartement', label: 'Appartement' },
    { value: 'studio', label: 'Studio' },
    { value: 'chambre', label: 'Chambre' },
    { value: 'duplex', label: 'Duplex' },
    { value: 'villa', label: 'Villa' },
    { value: 'boutique', label: 'Boutique' },
    { value: 'bureau', label: 'Bureau' },
    { value: 'magasin', label: 'Magasin' },
    { value: 'espace_commercial', label: 'Espace commercial' },
  ];

  const APARTMENT_STATUSES = [
    { value: 'free', label: 'Libre' },
    { value: 'occupied', label: 'Occupé' },
    { value: 'maintenance', label: 'En maintenance' },
    { value: 'reserved', label: 'Réservé' },
  ];

  const loadData = async () => {
    setIsLoading(true);
    try {
      const aptRes = await API.get('/apartments');
      if (aptRes.data) setApartments(aptRes.data);

      const propRes = await API.get('/properties');
      if (propRes.data) setProperties(propRes.data);
    } catch (err: any) {
      showError(err.message || 'Erreur lors du chargement des logements.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setPropertyId(properties[0]?.id ? String(properties[0].id) : '');
    setApartmentNumber('');
    setApartmentType('appartement');
    setFloor('');
    setRentAmount('');
    setStatus('free');
    setDescription('');
    setSelectedApartment(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId || !apartmentNumber.trim() || !rentAmount) {
      showError('Immeuble, Numéro de logement et Loyer sont requis.');
      return;
    }

    try {
      const payload = {
        property_id: Number(propertyId),
        apartment_number: apartmentNumber.trim(),
        apartment_type: apartmentType,
        floor: floor ? Number(floor) : null,
        rent_amount: Number(rentAmount),
        status,
        description: description.trim(),
      };

      await API.post('/apartments', payload);
      showSuccess('Logement créé avec succès.');
      setIsCreateModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur de création.');
    }
  };

  const handleEditClick = (apt: Apartment) => {
    setSelectedApartment(apt);
    setPropertyId(String(apt.property?.id || ''));
    setApartmentNumber(apt.apartment_number);
    setApartmentType(apt.apartment_type);
    setFloor(apt.floor != null ? String(apt.floor) : '');
    setRentAmount(String(apt.rent_amount));
    setStatus(apt.status);
    setDescription(apt.description || '');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApartment) return;

    try {
      const payload = {
        property_id: Number(propertyId),
        apartment_number: apartmentNumber.trim(),
        apartment_type: apartmentType,
        floor: floor ? Number(floor) : null,
        rent_amount: Number(rentAmount),
        status,
        description: description.trim(),
      };

      await API.put(`/apartments/${selectedApartment.id}`, payload);
      showSuccess('Logement mis à jour avec succès.');
      setIsEditModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la modification.');
    }
  };

  const handleDeleteClick = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce logement ?')) return;
    try {
      await API.delete(`/apartments/${id}`);
      showSuccess('Logement supprimé avec succès.');
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur de suppression.');
    }
  };

  const filtered = apartments.filter((a) => {
    const text = searchTerm.toLowerCase();
    return (
      a.apartment_number.toLowerCase().includes(text) ||
      a.apartment_type.toLowerCase().includes(text) ||
      (a.property && a.property.property_name.toLowerCase().includes(text))
    );
  });

  const canEdit = hasRole('manager', 'dir_admin', 'gestionnaire');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Logements</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Administrez les lots individuels des immeubles, les tarifs de loyer et statuts
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
            <Plus className="w-4 h-4" /> Nouveau logement
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-text-primary">{apartments.length}</span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Logements déclarés</span>
        </div>
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-green-500">
            {apartments.filter((a) => a.status === 'occupied').length}
          </span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Logements occupés</span>
        </div>
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-sky-500">
            {apartments.filter((a) => a.status === 'free').length}
          </span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Logements vacants</span>
        </div>
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-amber-500">
            {apartments.filter((a) => a.status === 'maintenance').length}
          </span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">En maintenance</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher par numéro, type, ou immeuble..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-custom bg-bg-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
        />
      </div>

      {/* Table view */}
      {isLoading ? (
        <div className="flex flex-col items-center p-12 text-center text-text-muted">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs">Chargement de la liste...</span>
        </div>
      ) : filtered.length > 0 ? (
        <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                  <th className="px-6 py-4">Numéro</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Immeuble</th>
                  <th className="px-6 py-4">Loyer</th>
                  <th className="px-6 py-4">Locataire principal</th>
                  <th className="px-6 py-4">Statut</th>
                  {canEdit && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom text-sm">
                {filtered.map((a) => {
                  const occupant = a.tenants?.[0]?.full_name || '—';
                  return (
                    <tr key={a.id} className="hover:bg-bg-hover/50">
                      <td className="px-6 py-4 font-bold text-text-primary">{a.apartment_number}</td>
                      <td className="px-6 py-4 text-text-secondary">
                        {APARTMENT_TYPES.find((t) => t.value === a.apartment_type)?.label || a.apartment_type}
                      </td>
                      <td className="px-6 py-4 text-text-secondary font-medium">
                        {a.property?.property_name || '—'}
                      </td>
                      <td className="px-6 py-4 font-bold text-text-primary">
                        {Helpers.formatMoney(a.rent_amount)}
                      </td>
                      <td className="px-6 py-4 text-text-secondary">{occupant}</td>
                      <td className="px-6 py-4">
                        <span className={Helpers.statusBadge(a.status).className}>
                          {Helpers.statusBadge(a.status).label}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleEditClick(a)}
                              className="p-1.5 rounded-lg border border-border-custom hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                              title="Modifier"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {hasRole('manager') && (
                              <button
                                onClick={() => handleDeleteClick(a.id)}
                                className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 text-red-500 transition-colors cursor-pointer"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center p-12 text-text-muted border border-dashed border-border-custom rounded-2xl bg-bg-surface">
          <span className="text-2xl">🚪</span>
          <p className="text-sm mt-2">Aucun logement ne correspond à votre recherche.</p>
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
                <DoorClosed className="w-5 h-5 text-primary" /> Nouveau logement
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 text-sm no-scrollbar">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Immeuble *</label>
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                >
                  <option value="">Sélectionnez un immeuble...</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.property_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Numéro de logement *</label>
                  <input
                    type="text"
                    value={apartmentNumber}
                    onChange={(e) => setApartmentNumber(e.target.value)}
                    placeholder="Ex : 101, A2"
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Type de logement</label>
                  <select
                    value={apartmentType}
                    onChange={(e) => setApartmentType(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  >
                    {APARTMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Étage</label>
                  <input
                    type="number"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder="Ex : 1"
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Loyer mensuel * (FCFA)</label>
                  <input
                    type="number"
                    value={rentAmount}
                    onChange={(e) => setRentAmount(e.target.value)}
                    placeholder="Montant du loyer"
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                    required
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
                  {APARTMENT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Équipements, caractéristiques..."
                  rows={3}
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
      {isEditModalOpen && selectedApartment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" /> Modifier le logement
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 text-sm no-scrollbar">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Immeuble *</label>
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.property_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Numéro de logement *</label>
                  <input
                    type="text"
                    value={apartmentNumber}
                    onChange={(e) => setApartmentNumber(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Type de logement</label>
                  <select
                    value={apartmentType}
                    onChange={(e) => setApartmentType(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  >
                    {APARTMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Étage</label>
                  <input
                    type="number"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Loyer mensuel * (FCFA)</label>
                  <input
                    type="number"
                    value={rentAmount}
                    onChange={(e) => setRentAmount(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                    required
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
                  {APARTMENT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
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
    </div>
  );
}
