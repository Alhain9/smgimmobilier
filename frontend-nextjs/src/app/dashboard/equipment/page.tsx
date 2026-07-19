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
  Package,
  Wrench,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

interface Equipment {
  id: number;
  equipment_name: string;
  quantity: number;
  price: number;
  status: string;
}

export default function EquipmentPage() {
  const { hasRole } = useAuth();
  const { showSuccess, showError } = useToast();

  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [equipmentName, setEquipmentName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState('available');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await API.get('/equipment');
      if (res.data) setEquipmentList(res.data);
    } catch (err: any) {
      showError(err.message || 'Erreur lors du chargement des équipements.');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenForm = (eq?: Equipment) => {
    if (eq) {
      setEditingId(eq.id);
      setEquipmentName(eq.equipment_name);
      setQuantity(String(eq.quantity));
      setPrice(String(eq.price));
      setStatus(eq.status);
    } else {
      setEditingId(null);
      setEquipmentName('');
      setQuantity('1');
      setPrice('');
      setStatus('available');
    }
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentName || !quantity || !price) {
      showError('Veuillez remplir les champs obligatoires.');
      return;
    }

    const payload = {
      equipment_name: equipmentName.trim(),
      quantity: Number(quantity),
      price: Number(price),
      status: status
    };

    try {
      if (editingId) {
        await API.put(`/equipment/${editingId}`, payload);
        showSuccess('Équipement mis à jour.');
      } else {
        await API.post('/equipment', payload);
        showSuccess('Équipement créé.');
      }
      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de l\'enregistrement.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet équipement ?')) return;
    try {
      await API.delete(`/equipment/${id}`);
      showSuccess('Équipement supprimé.');
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la suppression.');
    }
  };

  const getStatusLabel = (s: string) => {
    const map: Record<string, string> = {
      available: 'Disponible',
      in_use: 'Utilisé',
      out_of_stock: 'Rupture de stock',
      maintenance: 'En maintenance',
    };
    return map[s] || s;
  };

  const renderStatusBadge = (s: string) => {
    const map: Record<string, string> = {
      available: 'bg-green-500/10 text-green-500 border-green-500/20',
      in_use: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      out_of_stock: 'bg-red-500/10 text-red-500 border-red-500/20',
      maintenance: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    };
    const cls = map[s] || 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    return (
      <span className={`border px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${cls}`}>
        {getStatusLabel(s)}
      </span>
    );
  };

  const filteredEquipment = equipmentList.filter(eq =>
    eq.equipment_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canEdit = hasRole('manager', 'dir_technique', 'comptable');
  const canDelete = hasRole('manager', 'dir_technique');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">📦 Équipements & Matériels</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Inventaire de l'outillage, équipements techniques et pièces détachées
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => handleOpenForm()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" /> Nouvel équipement
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-base font-bold text-text-primary">
            Registre du stock
          </h3>
          <div className="relative max-w-[260px] w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par nom..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-border-custom bg-bg-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-semibold"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-text-muted">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs">Chargement du stock...</span>
          </div>
        ) : filteredEquipment.length > 0 ? (
          <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                  <th className="px-5 py-3.5">Nom de l'équipement</th>
                  <th className="px-5 py-3.5 text-center">Quantité</th>
                  <th className="px-5 py-3.5">Prix unitaire</th>
                  <th className="px-5 py-3.5">Valeur du stock</th>
                  <th className="px-5 py-3.5">Statut</th>
                  {canEdit && <th className="px-5 py-3.5 text-right no-print">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom text-xs font-semibold">
                {filteredEquipment.map((eq) => (
                  <tr key={eq.id} className="hover:bg-bg-hover/50 transition-colors">
                    <td className="px-5 py-3.5 text-text-primary font-extrabold">{eq.equipment_name}</td>
                    <td className="px-5 py-3.5 text-center text-text-primary font-bold">{eq.quantity}</td>
                    <td className="px-5 py-3.5 text-text-secondary">{Helpers.formatMoney(eq.price)}</td>
                    <td className="px-5 py-3.5 text-text-primary font-extrabold">{Helpers.formatMoney(eq.quantity * eq.price)}</td>
                    <td className="px-5 py-3.5">{renderStatusBadge(eq.status)}</td>
                    {canEdit && (
                      <td className="px-5 py-3.5 text-right no-print">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenForm(eq)}
                            className="p-1.5 rounded-lg border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary cursor-pointer"
                            title="Modifier"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(eq.id)}
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
            Aucun équipement enregistré
          </div>
        )}
      </div>

      {/* CREATE & EDIT FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                {editingId ? '✏️ Modifier l\'équipement' : '📦 Nouvel équipement'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="py-4 space-y-4 text-sm font-semibold">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Nom *</label>
                <input
                  type="text"
                  value={equipmentName}
                  onChange={(e) => setEquipmentName(e.target.value)}
                  placeholder="Ex: Perceuse à percussion, Compteur d'eau"
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Quantité *</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Prix unitaire (FCFA) *</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ex: 25000"
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                    required
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
                  <option value="available">Disponible</option>
                  <option value="in_use">Utilisé</option>
                  <option value="out_of_stock">Rupture de stock</option>
                  <option value="maintenance">En maintenance</option>
                </select>
              </div>

              {quantity && price && (
                <div className="list-item" style={{ background: 'var(--bg-surface-2)', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="text-text-secondary font-bold">Valeur estimée du stock :</span>
                  <span className="font-extrabold text-primary text-base">
                    {Helpers.formatMoney(Number(quantity) * Number(price))}
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
    </div>
  );
}
