'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import {
  Building2,
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  MapPin,
  CheckCircle,
  XCircle,
  X,
  PlusCircle,
  Wrench
} from 'lucide-react';

interface Apartment {
  id: number;
  apartment_number: string;
  apartment_type: string;
  rent_amount: number;
  status: string;
}

interface Property {
  id: number;
  property_name: string;
  property_type: string;
  address: string;
  district?: string;
  city: string;
  status: string;
  utilities_enabled: boolean;
  electricity_price: number;
  water_price: number;
  garbage_fee: number;
  transport_fee: number;
  description?: string;
  apartments?: Apartment[];
}

export default function PropertiesPage() {
  const { hasRole } = useAuth();
  const { showSuccess, showError } = useToast();

  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  
  // Import state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importAddress, setImportAddress] = useState('');
  const [importDistrict, setImportDistrict] = useState('');
  const [importCity, setImportCity] = useState('Douala');
  const [isImporting, setIsImporting] = useState(false);

  // Form states for Property
  const [propertyName, setPropertyName] = useState('');
  const [propertyType, setPropertyType] = useState('immeuble');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('Douala');
  const [status, setStatus] = useState('active');
  const [utilitiesEnabled, setUtilitiesEnabled] = useState(false);
  const [electricityPrice, setElectricityPrice] = useState(0);
  const [waterPrice, setWaterPrice] = useState(0);
  const [garbageFee, setGarbageFee] = useState(0);
  const [transportFee, setTransportFee] = useState(0);
  const [description, setDescription] = useState('');

  // Composition logic for building creation
  interface CompRow {
    type: string;
    count: number;
    rent: number;
  }
  const [compRows, setCompRows] = useState<CompRow[]>([{ type: 'appartement', count: 1, rent: 0 }]);

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

  const loadProperties = async () => {
    setIsLoading(true);
    try {
      const res = await API.get('/properties');
      if (res.data) setProperties(res.data);
    } catch (err: any) {
      showError(err.message || 'Impossible de charger la liste des immeubles.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProperties();
  }, []);

  const handleAddCompRow = () => {
    setCompRows([...compRows, { type: 'appartement', count: 1, rent: 0 }]);
  };

  const handleRemoveCompRow = (index: number) => {
    setCompRows(compRows.filter((_, i) => i !== index));
  };

  const handleCompRowChange = (index: number, key: keyof CompRow, val: any) => {
    const updated = [...compRows];
    updated[index] = { ...updated[index], [key]: val };
    setCompRows(updated);
  };

  const resetForm = () => {
    setPropertyName('');
    setPropertyType('immeuble');
    setAddress('');
    setDistrict('');
    setCity('Douala');
    setStatus('active');
    setUtilitiesEnabled(false);
    setElectricityPrice(0);
    setWaterPrice(0);
    setGarbageFee(0);
    setTransportFee(0);
    setDescription('');
    setCompRows([{ type: 'appartement', count: 1, rent: 0 }]);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyName.trim() || !address.trim() || !city.trim()) {
      showError('Veuillez remplir les champs obligatoires (Nom, Adresse, Ville).');
      return;
    }

    const composition = compRows
      .filter((c) => c.count > 0)
      .map((c) => ({
        apartment_type: c.type,
        count: Number(c.count),
        rent_amount: Number(c.rent),
      }));

    try {
      const payload = {
        property_name: propertyName.trim(),
        property_type: propertyType,
        address: address.trim(),
        district: district.trim(),
        city: city.trim(),
        status,
        utilities_enabled: utilitiesEnabled,
        electricity_price: Number(electricityPrice) || 0,
        water_price: Number(waterPrice) || 0,
        garbage_fee: Number(garbageFee) || 0,
        transport_fee: Number(transportFee) || 0,
        description: description.trim(),
        composition,
      };

      const res = await API.post('/properties', payload);
      const createdCount = res.data?.apartments?.length || 0;
      showSuccess(`Immeuble créé avec succès et ${createdCount} logements générés.`);
      setIsCreateModalOpen(false);
      resetForm();
      loadProperties();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la création de l\'immeuble.');
    }
  };

  const handleEditClick = (prop: Property) => {
    setSelectedProperty(prop);
    setPropertyName(prop.property_name);
    setPropertyType(prop.property_type);
    setAddress(prop.address);
    setDistrict(prop.district || '');
    setCity(prop.city);
    setStatus(prop.status);
    setUtilitiesEnabled(prop.utilities_enabled);
    setElectricityPrice(prop.electricity_price);
    setWaterPrice(prop.water_price);
    setGarbageFee(prop.garbage_fee);
    setTransportFee(prop.transport_fee);
    setDescription(prop.description || '');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProperty) return;

    try {
      const payload = {
        property_name: propertyName.trim(),
        property_type: propertyType,
        address: address.trim(),
        district: district.trim(),
        city: city.trim(),
        status,
        utilities_enabled: utilitiesEnabled,
        electricity_price: Number(electricityPrice) || 0,
        water_price: Number(waterPrice) || 0,
        garbage_fee: Number(garbageFee) || 0,
        transport_fee: Number(transportFee) || 0,
        description: description.trim(),
      };

      await API.put(`/properties/${selectedProperty.id}`, payload);
      showSuccess('Immeuble mis à jour avec succès.');
      setIsEditModalOpen(false);
      resetForm();
      loadProperties();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la mise à jour de l\'immeuble.');
    }
  };

  const handleDeleteClick = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet immeuble et tous les logements associés ?')) return;

    try {
      await API.delete(`/properties/${id}`);
      showSuccess('Immeuble supprimé avec succès.');
      loadProperties();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la suppression de l\'immeuble.');
    }
  };

  const handleViewClick = async (prop: Property) => {
    try {
      const res = await API.get(`/properties/${prop.id}`);
      if (res.data) {
        setSelectedProperty(res.data);
        setIsViewModalOpen(true);
      }
    } catch (_) {
      showError('Impossible de charger les détails de l\'immeuble.');
    }
  };

  const filtered = properties.filter((p) => {
    const text = searchTerm.toLowerCase();
    return (
      p.property_name.toLowerCase().includes(text) ||
      p.address.toLowerCase().includes(text) ||
      p.city.toLowerCase().includes(text) ||
      (p.district && p.district.toLowerCase().includes(text))
    );
  });

  const canEdit = hasRole('manager', 'dir_admin', 'gestionnaire');
  const canDelete = hasRole('manager', 'super_admin');

  return (
    <div className="space-y-6">
      {/* Header and Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Immeubles & Biens Immobiliers</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Consultez et administrez le parc immobilier de l'entreprise
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsImportModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-bg-surface border border-border-custom text-text-primary hover:bg-bg-hover shadow-sm cursor-pointer transition-all"
            >
              📊 Importer Situation Excel
            </button>
            <button
              onClick={() => {
                resetForm();
                setIsCreateModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" /> Nouvel immeuble
            </button>
          </div>
        )}
      </div>

      {/* Stats Quick Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-text-primary">{properties.length}</span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Biens déclarés</span>
        </div>
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-text-primary">
            {properties.reduce((acc, p) => acc + (p.apartments?.length || 0), 0)}
          </span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Logements totaux</span>
        </div>
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-green-500">
            {properties.reduce(
              (acc, p) => acc + (p.apartments?.filter((a) => a.status === 'occupied').length || 0),
              0
            )}
          </span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Logements occupés</span>
        </div>
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-sky-500">
            {properties.reduce(
              (acc, p) => acc + (p.apartments?.filter((a) => a.status === 'free').length || 0),
              0
            )}
          </span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Logements libres</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher par nom, ville, quartier..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-custom bg-bg-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
        />
      </div>

      {/* Grid List */}
      {isLoading ? (
        <div className="flex flex-col items-center p-12 text-center text-text-muted">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs">Chargement du parc immobilier...</span>
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((prop) => {
            const aptList = prop.apartments || [];
            const occupiedCount = aptList.filter((a) => a.status === 'occupied').length;
            const freeCount = aptList.filter((a) => a.status === 'free').length;

            return (
              <div
                key={prop.id}
                className="flex flex-col justify-between p-6 rounded-2xl border border-border-custom bg-bg-surface shadow-sm hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🏢</span>
                      <div>
                        <h4 className="font-extrabold text-base text-text-primary line-clamp-1">{prop.property_name}</h4>
                        <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full uppercase mt-1 inline-block">
                          {Helpers.propertyType(prop.property_type)}
                        </span>
                      </div>
                    </div>
                    <span className={Helpers.statusBadge(prop.status).className}>
                      {Helpers.statusBadge(prop.status).label}
                    </span>
                  </div>

                  <div className="space-y-2 mt-4 text-xs font-semibold">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <MapPin className="w-3.5 h-3.5 text-text-muted" />
                      <span>
                        {prop.address}, {prop.district ? prop.district + ' · ' : ''}
                        {prop.city}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-custom text-center">
                      <div className="p-2 rounded-lg bg-bg-body">
                        <div className="text-sm font-bold text-text-primary">{aptList.length}</div>
                        <div className="text-[9px] text-text-muted uppercase mt-0.5">Unités</div>
                      </div>
                      <div className="p-2 rounded-lg bg-bg-body">
                        <div className="text-sm font-bold text-green-500">{occupiedCount}/{aptList.length}</div>
                        <div className="text-[9px] text-text-muted uppercase mt-0.5">Occupés</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border-custom">
                  <button
                    onClick={() => handleViewClick(prop)}
                    className="p-2 rounded-lg border border-border-custom hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                    title="Voir les détails"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => handleEditClick(prop)}
                      className="p-2 rounded-lg border border-border-custom hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteClick(prop.id)}
                      className="p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center p-12 text-text-muted border border-dashed border-border-custom rounded-2xl bg-bg-surface">
          <span className="text-2xl">🏢</span>
          <p className="text-sm mt-2">Aucun immeuble ne correspond à votre recherche.</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" /> Nouvel immeuble / bien
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 text-sm no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Nom de l'immeuble *</label>
                  <input
                    type="text"
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    placeholder="Ex : Résidence Concorde"
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Type de bien</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  >
                    <option value="immeuble">Immeuble</option>
                    <option value="maison">Maison</option>
                    <option value="terrain">Terrain</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Adresse *</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rue, N° porte"
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Quartier</label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="Ex : Bonapriso"
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Ville *</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Douala"
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                    required
                  />
                </div>
              </div>

              {/* Utility billing setup */}
              <div className="p-4 rounded-xl border border-border-custom bg-bg-surface-2 space-y-4">
                <label className="flex items-center gap-2 font-semibold text-text-primary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={utilitiesEnabled}
                    onChange={(e) => setUtilitiesEnabled(e.target.checked)}
                    className="w-4 h-4 text-primary"
                  />
                  <span>⚡ Redistribution des charges (compteurs divisionnaires)</span>
                </label>

                {utilitiesEnabled && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-text-secondary uppercase">Prix kWh Électricité (FCFA)</label>
                      <input
                        type="number"
                        value={electricityPrice}
                        onChange={(e) => setElectricityPrice(Number(e.target.value))}
                        className="px-3 py-2 border border-border-custom bg-bg-body rounded-xl focus:outline-none text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-text-secondary uppercase">Prix m³ Eau (FCFA)</label>
                      <input
                        type="number"
                        value={waterPrice}
                        onChange={(e) => setWaterPrice(Number(e.target.value))}
                        className="px-3 py-2 border border-border-custom bg-bg-body rounded-xl focus:outline-none text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-text-secondary uppercase">Ordures / mois (FCFA)</label>
                      <input
                        type="number"
                        value={garbageFee}
                        onChange={(e) => setGarbageFee(Number(e.target.value))}
                        className="px-3 py-2 border border-border-custom bg-bg-body rounded-xl focus:outline-none text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-text-secondary uppercase">Gardien / Transp. (FCFA)</label>
                      <input
                        type="number"
                        value={transportFee}
                        onChange={(e) => setTransportFee(Number(e.target.value))}
                        className="px-3 py-2 border border-border-custom bg-bg-body rounded-xl focus:outline-none text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Informations supplémentaires..."
                  rows={2}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                />
              </div>

              {/* Composition generating widgets */}
              <div className="p-4 rounded-xl border border-dashed border-border-custom bg-bg-surface-2/40 space-y-4">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-text-primary">🏢 Composition de l'immeuble (logements)</label>
                  <button
                    type="button"
                    onClick={handleAddCompRow}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-hover cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" /> Ajouter
                  </button>
                </div>
                <p className="text-[11px] text-text-muted leading-tight">
                  Déclarez les types de logements et leur loyer de base. L'application créera automatiquement ces logements dans la base.
                </p>

                <div className="space-y-3">
                  {compRows.map((row, index) => (
                    <div key={index} className="flex gap-3 items-end">
                      <div className="flex-[2] flex flex-col gap-1">
                        <label className="text-[10px] text-text-secondary font-bold uppercase">Type</label>
                        <select
                          value={row.type}
                          onChange={(e) => handleCompRowChange(index, 'type', e.target.value)}
                          className="px-3 py-1.5 border border-border-custom bg-bg-surface rounded-xl text-xs focus:outline-none"
                        >
                          {APARTMENT_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1 max-w-[80px] flex flex-col gap-1">
                        <label className="text-[10px] text-text-secondary font-bold uppercase">Quantité</label>
                        <input
                          type="number"
                          min={1}
                          value={row.count}
                          onChange={(e) => handleCompRowChange(index, 'count', Number(e.target.value))}
                          className="px-3 py-1.5 border border-border-custom bg-bg-surface rounded-xl text-xs focus:outline-none"
                        />
                      </div>
                      <div className="flex-[1.5] flex flex-col gap-1">
                        <label className="text-[10px] text-text-secondary font-bold uppercase">Loyer (FCFA)</label>
                        <input
                          type="number"
                          min={0}
                          value={row.rent}
                          onChange={(e) => handleCompRowChange(index, 'rent', Number(e.target.value))}
                          className="px-3 py-1.5 border border-border-custom bg-bg-surface rounded-xl text-xs focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCompRow(index)}
                        disabled={compRows.length <= 1}
                        className="px-2 py-1.5 rounded-lg border border-red-100 hover:bg-red-50 text-red-500 font-bold disabled:opacity-40 cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="text-xs font-bold text-text-primary text-right pt-2 border-t border-border-custom">
                  Total : {compRows.reduce((acc, c) => acc + (Number(c.count) || 0), 0)} logement(s)
                </div>
              </div>

              {/* Action Buttons */}
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
      {isEditModalOpen && selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" /> Modifier l'immeuble
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 text-sm no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Nom de l'immeuble *</label>
                  <input
                    type="text"
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Type de bien</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  >
                    <option value="immeuble">Immeuble</option>
                    <option value="maison">Maison</option>
                    <option value="terrain">Terrain</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Adresse *</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Quartier</label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Ville *</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
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
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>

              {/* Utility billing setup */}
              <div className="p-4 rounded-xl border border-border-custom bg-bg-surface-2 space-y-4">
                <label className="flex items-center gap-2 font-semibold text-text-primary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={utilitiesEnabled}
                    onChange={(e) => setUtilitiesEnabled(e.target.checked)}
                    className="w-4 h-4 text-primary"
                  />
                  <span>⚡ Redistribution des charges (compteurs divisionnaires)</span>
                </label>

                {utilitiesEnabled && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-text-secondary uppercase">Prix kWh Électricité (FCFA)</label>
                      <input
                        type="number"
                        value={electricityPrice}
                        onChange={(e) => setElectricityPrice(Number(e.target.value))}
                        className="px-3 py-2 border border-border-custom bg-bg-body rounded-xl focus:outline-none text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-text-secondary uppercase">Prix m³ Eau (FCFA)</label>
                      <input
                        type="number"
                        value={waterPrice}
                        onChange={(e) => setWaterPrice(Number(e.target.value))}
                        className="px-3 py-2 border border-border-custom bg-bg-body rounded-xl focus:outline-none text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-text-secondary uppercase">Ordures / mois (FCFA)</label>
                      <input
                        type="number"
                        value={garbageFee}
                        onChange={(e) => setGarbageFee(Number(e.target.value))}
                        className="px-3 py-2 border border-border-custom bg-bg-body rounded-xl focus:outline-none text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-text-secondary uppercase">Gardien / Transp. (FCFA)</label>
                      <input
                        type="number"
                        value={transportFee}
                        onChange={(e) => setTransportFee(Number(e.target.value))}
                        className="px-3 py-2 border border-border-custom bg-bg-body rounded-xl focus:outline-none text-xs"
                      />
                    </div>
                  </div>
                )}
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

              {/* Action Buttons */}
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
      {isViewModalOpen && selectedProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-extrabold text-text-primary flex items-center gap-2">
                🏢 {selectedProperty.property_name}
              </h3>
              <button onClick={() => setIsViewModalOpen(false)} className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4 text-sm no-scrollbar">
              {/* Location stats */}
              <div>
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">📍 Localisation</h4>
                <div className="space-y-2 border border-border-custom rounded-xl p-4 bg-bg-surface-2">
                  <div className="flex justify-between items-center border-b border-border-custom/50 pb-2 last:border-0 last:pb-0">
                    <span className="text-text-secondary font-medium">Adresse</span>
                    <span className="font-bold text-text-primary">{selectedProperty.address}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-border-custom/50 pb-2 last:border-0 last:pb-0">
                    <span className="text-text-secondary font-medium">Quartier / Ville</span>
                    <span className="font-bold text-text-primary">
                      {selectedProperty.district ? selectedProperty.district + ' · ' : ''}
                      {selectedProperty.city}
                    </span>
                  </div>
                </div>
              </div>

              {/* Charges configuration */}
              {selectedProperty.utilities_enabled && (
                <div>
                  <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">⚡ Redistribution des charges</h4>
                  <div className="grid grid-cols-2 gap-4 border border-border-custom rounded-xl p-4 bg-bg-surface-2 text-xs">
                    <div>
                      <span className="text-text-secondary font-medium block">Électricité (kWh)</span>
                      <b className="text-text-primary mt-0.5 block">{Helpers.formatMoney(selectedProperty.electricity_price)}</b>
                    </div>
                    <div>
                      <span className="text-text-secondary font-medium block">Eau (m³)</span>
                      <b className="text-text-primary mt-0.5 block">{Helpers.formatMoney(selectedProperty.water_price)}</b>
                    </div>
                    <div>
                      <span className="text-text-secondary font-medium block">Ordures / mois</span>
                      <b className="text-text-primary mt-0.5 block">{Helpers.formatMoney(selectedProperty.garbage_fee)}</b>
                    </div>
                    <div>
                      <span className="text-text-secondary font-medium block">Transp. Gardien / mois</span>
                      <b className="text-text-primary mt-0.5 block">{Helpers.formatMoney(selectedProperty.transport_fee)}</b>
                    </div>
                  </div>
                </div>
              )}

              {/* Units and list */}
              <div>
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
                  🏠 Logements ({selectedProperty.apartments?.length || 0} unité(s))
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {selectedProperty.apartments && selectedProperty.apartments.length > 0 ? (
                    selectedProperty.apartments.map((a) => {
                      const colorMap: Record<string, string> = {
                        free: 'border-green-500/20 bg-green-500/5 hover:bg-green-500/10 text-green-600',
                        occupied: 'border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10 text-sky-600',
                        reserved: 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600',
                      };
                      return (
                        <div
                          key={a.id}
                          className={`p-3 rounded-xl border flex flex-col justify-between h-20 transition-all select-none ${
                            colorMap[a.status] || 'border-border-custom bg-bg-surface-2'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-extrabold text-sm">{a.apartment_number}</span>
                            <span className="text-[9px] font-bold uppercase">{a.status}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] mt-2 leading-none">
                            <span className="font-medium text-text-secondary truncate max-w-[60px]">
                              {APARTMENT_TYPES.find((t) => t.value === a.apartment_type)?.label || a.apartment_type}
                            </span>
                            <span className="font-bold">{Helpers.formatMoney(a.rent_amount)}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-text-muted italic col-span-full py-4 text-center">Aucun logement déclaré.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border-custom">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-5 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. IMPORT SITUATION EXCEL MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                📊 Importer Situation Excel
              </h3>
              <button 
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportFile(null);
                  setImportAddress('');
                  setImportDistrict('');
                  setImportCity('Douala');
                }} 
                className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                if (!importFile) {
                  showError('Veuillez sélectionner un fichier Excel.');
                  return;
                }
                setIsImporting(true);
                try {
                  const fd = new FormData();
                  fd.append('file', importFile);
                  fd.append('address', importAddress);
                  fd.append('district', importDistrict);
                  fd.append('city', importCity);

                  const res = await API.upload('/properties/import', fd);
                  showSuccess(`Situation Excel importée avec succès pour l'immeuble "${res.data?.property}". Logements créés/mis à jour: ${res.data?.apartments?.created}/${res.data?.apartments?.updated}.`);
                  setIsImportModalOpen(false);
                  setImportFile(null);
                  setImportAddress('');
                  setImportDistrict('');
                  setImportCity('Douala');
                  loadProperties();
                } catch (err: any) {
                  showError(err.message || 'Erreur lors de l\'importation de la situation.');
                } finally {
                  setIsImporting(false);
                }
              }} 
              className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 text-sm no-scrollbar"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Fichier de situation (.xlsx, .xls) *</label>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setImportFile(e.target.files[0]);
                    }
                  }}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm cursor-pointer"
                  required
                />
                <p className="text-[10px] text-text-muted mt-1 leading-normal">
                  Le fichier doit contenir le nom de l'immeuble dans la cellule A1 (ex: "Situation — Mon Immeuble") et la table de situation à partir de la ligne 5.
                </p>
              </div>

              <div className="border-t border-border-custom my-4 pt-4">
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block mb-3">📍 Compléter / Modifier la localisation</span>
                
                <div className="flex flex-col gap-1.5 mb-3">
                  <label className="text-xs font-bold text-text-secondary uppercase">Adresse</label>
                  <input
                    type="text"
                    value={importAddress}
                    onChange={(e) => setImportAddress(e.target.value)}
                    placeholder="Ex: Rue 1.024, Bonapriso"
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-text-secondary uppercase">Quartier</label>
                    <input
                      type="text"
                      value={importDistrict}
                      onChange={(e) => setImportDistrict(e.target.value)}
                      placeholder="Ex: Bonapriso"
                      className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-text-secondary uppercase">Ville</label>
                    <input
                      type="text"
                      value={importCity}
                      onChange={(e) => setImportCity(e.target.value)}
                      placeholder="Ex: Douala"
                      className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border-custom">
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportFile(null);
                    setImportAddress('');
                    setImportDistrict('');
                    setImportCity('Douala');
                  }}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isImporting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isImporting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Importation...
                    </>
                  ) : (
                    'Lancer l\'import'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
