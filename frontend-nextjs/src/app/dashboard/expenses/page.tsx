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
  AlertCircle
} from 'lucide-react';

interface Maintenance {
  id: number;
  title: string;
  apartment?: {
    apartment_number: string;
  } | null;
}

interface Expense {
  id: number;
  maintenance_id: number;
  item_name: string;
  category?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  supplier?: string | null;
  maintenance?: Maintenance | null;
}

export default function ExpensesPage() {
  const { hasRole } = useAuth();
  const { showSuccess, showError } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [maintenanceId, setMaintenanceId] = useState('');
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [supplier, setSupplier] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [eRes, mRes] = await Promise.all([
        API.get('/expenses'),
        API.get('/maintenance')
      ]);
      if (eRes.data) setExpenses(eRes.data);
      if (mRes.data) setMaintenances(mRes.data);
    } catch (err: any) {
      showError(err.message || 'Erreur lors du chargement des dépenses.');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenForm = (exp?: Expense) => {
    if (exp) {
      setEditingId(exp.id);
      setMaintenanceId(String(exp.maintenance_id));
      setItemName(exp.item_name);
      setCategory(exp.category || '');
      setQuantity(String(exp.quantity));
      setUnitPrice(String(exp.unit_price));
      setSupplier(exp.supplier || '');
    } else {
      setEditingId(null);
      setMaintenanceId('');
      setItemName('');
      setCategory('');
      setQuantity('1');
      setUnitPrice('');
      setSupplier('');
    }
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintenanceId || !itemName || !quantity || !unitPrice) {
      showError('Veuillez remplir les champs obligatoires.');
      return;
    }

    const payload = {
      maintenance_id: Number(maintenanceId),
      item_name: itemName.trim(),
      category: category.trim() || null,
      quantity: Number(quantity),
      unit_price: Number(unitPrice),
      supplier: supplier.trim() || null,
    };

    try {
      if (editingId) {
        await API.put(`/expenses/${editingId}`, payload);
        showSuccess('Dépense mise à jour avec succès.');
      } else {
        await API.post('/expenses', payload);
        showSuccess('Dépense enregistrée avec succès.');
      }
      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de l\'enregistrement.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette dépense ?')) return;
    try {
      await API.delete(`/expenses/${id}`);
      showSuccess('Dépense supprimée.');
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la suppression.');
    }
  };

  const filteredExpenses = expenses.filter(e => {
    const q = searchTerm.toLowerCase();
    const item = e.item_name || '';
    const cat = e.category || '';
    const sup = e.supplier || '';
    const maint = e.maintenance?.title || '';
    return (
      item.toLowerCase().includes(q) ||
      cat.toLowerCase().includes(q) ||
      sup.toLowerCase().includes(q) ||
      maint.toLowerCase().includes(q)
    );
  });

  const canEdit = hasRole('manager', 'comptable', 'dir_technique');
  const canDelete = hasRole('manager', 'comptable');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">🔧 Dépenses de Maintenance</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Suivi des coûts matériels et des fournitures de maintenance
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => handleOpenForm()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" /> Nouvelle dépense
          </button>
        )}
      </div>

      {/* Main Container */}
      <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-base font-bold text-text-primary">
            Liste des achats de matériel par ticket d'intervention
          </h3>
          <div className="relative max-w-[260px] w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher équipement, fournisseur..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-border-custom bg-bg-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-semibold"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-text-muted">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs">Chargement des dépenses...</span>
          </div>
        ) : filteredExpenses.length > 0 ? (
          <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                  <th className="px-5 py-3.5">Équipement</th>
                  <th className="px-5 py-3.5">Maintenance</th>
                  <th className="px-5 py-3.5">Fournisseur</th>
                  <th className="px-5 py-3.5 text-center">Quantité</th>
                  <th className="px-5 py-3.5">Prix unitaire</th>
                  <th className="px-5 py-3.5">Total</th>
                  {canEdit && <th className="px-5 py-3.5 text-right no-print">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom text-xs font-semibold">
                {filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-bg-hover/50 transition-colors">
                    <td className="px-5 py-3.5 text-text-primary">
                      <p className="font-extrabold">{e.item_name}</p>
                      {e.category && <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5 inline-block">{e.category}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary">
                      {e.maintenance ? (
                        <div>
                          <p>{e.maintenance.title}</p>
                          {e.maintenance.apartment && <span className="text-[10px] text-text-muted font-bold">Appartement: {e.maintenance.apartment.apartment_number}</span>}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary">{e.supplier || '—'}</td>
                    <td className="px-5 py-3.5 text-center text-text-primary font-bold">{e.quantity}</td>
                    <td className="px-5 py-3.5 text-text-secondary">{Helpers.formatMoney(e.unit_price)}</td>
                    <td className="px-5 py-3.5 text-text-primary font-extrabold">{Helpers.formatMoney(e.total_price)}</td>
                    {canEdit && (
                      <td className="px-5 py-3.5 text-right no-print">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenForm(e)}
                            className="p-1.5 rounded-lg border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary cursor-pointer"
                            title="Modifier"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(e.id)}
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
            Aucune dépense enregistrée
          </div>
        )}
      </div>

      {/* CREATE & EDIT FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                {editingId ? '✏️ Modifier la dépense' : '🔧 Nouvelle dépense'}
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
                <label className="text-xs font-bold text-text-secondary uppercase">Maintenance liée *</label>
                <select
                  value={maintenanceId}
                  onChange={(e) => setMaintenanceId(e.target.value)}
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer"
                  required
                >
                  <option value="">— Choisir l'intervention de maintenance —</option>
                  {maintenances.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} {m.apartment ? `(${m.apartment.apartment_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Nom équipement / matériel *</label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Ex: Joint de robinet, Ciment"
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Catégorie</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ex: Plomberie, Peinture"
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
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
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="Ex: 1500"
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Fournisseur</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Ex: Quincaillerie du Centre"
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>

              {quantity && unitPrice && (
                <div className="list-item" style={{ background: 'var(--bg-surface-2)', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="text-text-secondary font-bold">Total estimé :</span>
                  <span className="font-extrabold text-primary text-base">
                    {Helpers.formatMoney(Number(quantity) * Number(unitPrice))}
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
