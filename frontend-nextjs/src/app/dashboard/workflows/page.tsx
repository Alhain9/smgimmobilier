'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import {
  Plus,
  Trash2,
  X,
  Shuffle,
  ChevronDown,
  ArrowRight,
  ShieldAlert,
  Info
} from 'lucide-react';

interface Step {
  id: number;
  workflow_id: number;
  step_order: number;
  role_id: number;
  description?: string | null;
  role?: {
    role_name: string;
  } | null;
}

interface Workflow {
  id: number;
  name: string;
  module: string;
  description?: string | null;
  steps?: Step[];
}

export default function WorkflowsPage() {
  const { hasRole } = useAuth();
  const { showSuccess, showError } = useToast();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Workflow Form Modal States
  const [isWfOpen, setIsWfOpen] = useState(false);
  const [wfName, setWfName] = useState('');
  const [wfModule, setWfModule] = useState('expense');
  const [wfDescription, setWfDescription] = useState('');

  // Step Form Modal States
  const [isStepOpen, setIsStepOpen] = useState(false);
  const [stepWfId, setStepWfId] = useState<number | null>(null);
  const [stepOrder, setStepOrder] = useState('');
  const [stepRoleId, setStepRoleId] = useState('1');
  const [stepDescription, setStepDescription] = useState('');

  const ROLES = [
    { value: 1, label: 'Super Administrateur' },
    { value: 2, label: 'Manager' },
    { value: 3, label: 'Directeur Administratif' },
    { value: 4, label: 'Directeur Technique' },
    { value: 5, label: 'Gestionnaire' },
    { value: 6, label: 'Comptable' }
  ];

  const MODULES: Record<string, string> = {
    expense: '🛒 Dépenses / Achats',
    conge: '✈️ Congés / RH',
    lease: '📄 Baux / Contrats',
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await API.get('/workflows');
      if (res.data) setWorkflows(res.data);
    } catch (err: any) {
      showError(err.message || 'Erreur lors du chargement des circuits de validation.');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // WORKFLOW CRUD
  const handleOpenWfModal = () => {
    setWfName('');
    setWfModule('expense');
    setWfDescription('');
    setIsWfOpen(true);
  };

  const handleWfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wfName) {
      showError('Le nom du circuit est obligatoire.');
      return;
    }
    try {
      await API.post('/workflows', {
        name: wfName.trim(),
        module: wfModule,
        description: wfDescription.trim() || null
      });
      showSuccess('Circuit de validation créé.');
      setIsWfOpen(false);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la création du circuit.');
    }
  };

  const handleDeleteWorkflow = async (id: number) => {
    if (!window.confirm('Supprimer ce circuit de validation ? Toutes les étapes liées seront détruites.')) return;
    try {
      await API.delete(`/workflows/${id}`);
      showSuccess('Workflow supprimé avec succès.');
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la suppression.');
    }
  };

  // STEPS CRUD
  const handleOpenStepModal = (wfId: number) => {
    setStepWfId(wfId);
    setStepOrder('');
    setStepRoleId('1');
    setStepDescription('');
    setIsStepOpen(true);
  };

  const handleStepSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stepWfId || !stepOrder || !stepRoleId) {
      showError('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    try {
      await API.post('/workflows/step', {
        workflow_id: Number(stepWfId),
        step_order: Number(stepOrder),
        role_id: Number(stepRoleId),
        description: stepDescription.trim() || null
      });
      showSuccess('Étape ajoutée avec succès.');
      setIsStepOpen(false);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de l\'ajout de l\'étape.');
    }
  };

  const handleDeleteStep = async (stepId: number) => {
    if (!window.confirm('Supprimer cette étape ?')) return;
    try {
      await API.delete(`/workflows/step/${stepId}`);
      showSuccess('Étape de validation supprimée.');
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la suppression de l\'étape.');
    }
  };

  const canEdit = hasRole('super_admin', 'manager');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">⛓️ Circuits de Validation</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Configurez les workflows d'approbations financières et administratives
          </p>
        </div>
        {canEdit && (
          <button
            onClick={handleOpenWfModal}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" /> Nouveau circuit
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20 bg-bg-surface border border-border-custom rounded-2xl shadow-sm">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-text-secondary mt-3">Chargement des circuits...</span>
        </div>
      ) : workflows.length > 0 ? (
        <div className="flex flex-col gap-6">
          {workflows.map((wf) => {
            const sortedSteps = (wf.steps || []).slice().sort((a, b) => a.step_order - b.step_order);
            return (
              <div
                key={wf.id}
                className="rounded-2xl border border-l-4 border-l-primary border-border-custom bg-bg-surface shadow-sm overflow-hidden"
              >
                {/* Workflow Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 bg-bg-surface-2 gap-4 border-b border-border-custom">
                  <div>
                    <h3 className="text-base font-extrabold text-text-primary">{wf.name}</h3>
                    <p className="text-[11px] text-text-muted font-bold mt-1 uppercase tracking-wider">
                      Module : <span className="text-text-primary">{MODULES[wf.module] || wf.module}</span>
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenStepModal(wf.id)}
                        className="px-3 py-1.5 rounded-xl bg-primary text-white hover:bg-primary-hover text-[10px] font-bold shadow-sm cursor-pointer transition-colors"
                      >
                        + Ajouter étape
                      </button>
                      <button
                        onClick={() => handleDeleteWorkflow(wf.id)}
                        className="p-1.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/15 border border-red-500/20 cursor-pointer"
                        title="Supprimer le circuit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Workflow Description & Steps */}
                <div className="p-6 bg-bg-surface/50 space-y-4">
                  {wf.description && (
                    <div className="flex items-center gap-2 text-xs text-text-secondary font-semibold bg-bg-surface-2 p-3 rounded-xl border border-border-custom/50 max-w-2xl">
                      <Info className="w-4 h-4 text-primary shrink-0" />
                      <span>{wf.description}</span>
                    </div>
                  )}

                  {/* Steps Chain */}
                  <div className="space-y-3.5">
                    {sortedSteps.length > 0 ? (
                      sortedSteps.map((step, idx) => (
                        <div key={step.id} className="flex flex-col space-y-2">
                          <div className="flex justify-between items-center p-3.5 border border-border-custom bg-bg-surface rounded-xl shadow-sm hover:shadow-md transition-shadow">
                            <div>
                              <p className="text-xs font-bold text-text-primary">
                                Étape {step.step_order} : Validateur requis :{' '}
                                <span className="text-primary font-extrabold">{step.role?.role_name || `Rôle #${step.role_id}`}</span>
                              </p>
                              {step.description && (
                                <p className="text-[11px] text-text-muted font-semibold mt-1">
                                  📌 Consigne : {step.description}
                                </p>
                              )}
                            </div>
                            {canEdit && (
                              <button
                                onClick={() => handleDeleteStep(step.id)}
                                className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/15 border border-red-500/20 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          {idx < sortedSteps.length - 1 && (
                            <div className="flex justify-center text-text-muted text-xs font-bold py-1 select-none animate-pulse">
                              ⬇️ Étape suivante
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-text-muted italic border border-dashed border-border-custom rounded-xl p-6 text-center select-none">
                        Aucune étape de validation configurée pour ce circuit
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border-custom bg-bg-surface p-12 text-center text-text-muted">
          <ShieldAlert className="w-8 h-8 text-text-muted mx-auto mb-2" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Aucun circuit</h3>
          <p className="text-xs font-semibold mt-1">
            Aucun circuit de validation n'est configuré sur la plateforme.
          </p>
        </div>
      )}

      {/* CREATE WORKFLOW MODAL */}
      {isWfOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                ⛓️ Nouveau circuit de validation
              </h3>
              <button
                onClick={() => setIsWfOpen(false)}
                className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWfSubmit} className="py-4 space-y-4 text-sm font-semibold">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Nom du circuit *</label>
                <input
                  type="text"
                  value={wfName}
                  onChange={(e) => setWfName(e.target.value)}
                  placeholder="Ex: Validation Congés, Circuit Dépense Supérieure"
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Module rattaché *</label>
                <select
                  value={wfModule}
                  onChange={(e) => setWfModule(e.target.value)}
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer"
                  required
                >
                  <option value="expense">🛒 Dépenses / Achats</option>
                  <option value="conge">✈️ Congés / RH</option>
                  <option value="lease">📄 Baux / Contrats</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Description</label>
                <textarea
                  value={wfDescription}
                  onChange={(e) => setWfDescription(e.target.value)}
                  placeholder="Explications sur les déclencheurs de ce circuit..."
                  rows={3}
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                />
              </div>

              <div className="pt-4 border-t border-border-custom flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsWfOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD STEP MODAL */}
      {isStepOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                ➕ Ajouter une Étape
              </h3>
              <button
                onClick={() => setIsStepOpen(false)}
                className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStepSubmit} className="py-4 space-y-4 text-sm font-semibold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Ordre de l'étape *</label>
                  <input
                    type="number"
                    value={stepOrder}
                    onChange={(e) => setStepOrder(e.target.value)}
                    placeholder="Ex: 1, 2, 3..."
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Rôle validateur *</label>
                  <select
                    value={stepRoleId}
                    onChange={(e) => setStepRoleId(e.target.value)}
                    className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer"
                    required
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Consignes de validation</label>
                <input
                  type="text"
                  value={stepDescription}
                  onChange={(e) => setStepDescription(e.target.value)}
                  placeholder="Ex: Vérifier la cohérence de la facture jointe"
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="pt-4 border-t border-border-custom flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsStepOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer"
                >
                  Ajouter l'étape
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
