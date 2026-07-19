'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import {
  Users as UsersIcon,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Lock,
  Unlock,
  Clock,
  ShieldAlert,
  UserCheck
} from 'lucide-react';

interface RoleOption {
  id: number;
  name: string;
  label: string;
}

interface UserRecord {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  status: string;
  is_present?: boolean;
  last_attendance_at?: string;
  can_manage_users?: boolean;
  can_view_all_calendars?: boolean;
  can_manage_utilities?: boolean;
  role?: {
    id: number;
    role_name: string;
  };
}

export default function UsersPage() {
  const { user: currentUser, hasRole } = useAuth();
  const { showSuccess, showError } = useToast();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'permissions' | 'presence'>('list');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState('active');
  const [password, setPassword] = useState('');
  const [canManageUsers, setCanManageUsers] = useState(false);
  const [canViewAllCalendars, setCanViewAllCalendars] = useState(false);
  const [canManageUtilities, setCanManageUtilities] = useState(false);

  // Role permissions detail view tab state
  const [selectedRoleDetail, setSelectedRoleDetail] = useState('manager');

  const ROLE_DETAILS: Record<string, { title: string; desc: string; rights: string[] }> = {
    super_admin: {
      title: '👑 Super Administrateur',
      desc: 'Bénéficie de tous les droits et accès sur le système. Peut tout modifier et contourner les restrictions RBAC.',
      rights: ['Accès total sans restriction', 'Configuration et maintenance système', 'Délégation de permissions'],
    },
    manager: {
      title: '👔 Manager / DG',
      desc: 'Droits maximaux sur la gestion locative, les finances et la technique. Pilote l\'entreprise.',
      rights: [
        'Gestion complète des immeubles, locataires, baux',
        'Gestion financière complète (salaires, paiements, dépenses)',
        'Attribution de délégations de permissions',
        'Planification des tâches',
      ],
    },
    dir_admin: {
      title: '📄 Directeur Administratif',
      desc: 'Prend en charge la gestion administrative, les contrats, le suivi de situation financière et le personnel.',
      rights: [
        'Création et édition des locataires et baux',
        'Suivi des paiements de loyers',
        'Consultation des rapports d\'activité',
        'Lecture des documents et pièces administratives',
      ],
    },
    dir_technique: {
      title: '🔧 Directeur Technique',
      desc: 'Pilote les chantiers de maintenance, les stocks d\'équipements et l\'activité des techniciens.',
      rights: [
        'Création, assignation et suivi des chantiers de maintenance',
        'Gestion de l\'inventaire des équipements et stocks',
        'Planification des tâches des techniciens',
        'Suivi d\'activité des techniciens',
      ],
    },
    gestionnaire: {
      title: '🏢 Gestionnaire',
      desc: 'Gère au quotidien les entrées/sorties de locataires, l\'état des logements et les charges.',
      rights: [
        'Création de biens et logements',
        'Suivi des locataires et baux',
        'Saisie et suivi des demandes de maintenance simples',
      ],
    },
    comptable: {
      title: '💰 Comptable',
      desc: 'Responsable des encaissements, de la validation des paiements et de la facturation.',
      rights: [
        'Validation des paiements de loyers et charges',
        'Calcul et saisie des salaires et primes',
        'Gestion des dépenses et budgets de fonctionnement',
      ],
    },
    technicien: {
      title: '🛠 Technicien',
      desc: 'Rôle de terrain. Réalise les chantiers de maintenance et valide les tâches planifiées.',
      rights: [
        'Accès à l\'agenda de travail quotidien',
        'Déclaration de début / fin d\'intervention',
        'Saisie des rapports d\'exécution',
        'Prise de photos avant/après (via WhatsApp)',
      ],
    },
    locataire: {
      title: '👤 Locataire',
      desc: 'Espace client réduit pour le suivi de son bail, le paiement de son loyer et de ses charges.',
      rights: [
        'Consultation de son contrat de bail actif',
        'Déclaration de paiement avec téléversement de preuve',
        'Saisie de demandes de maintenance technique pour son logement',
      ],
    },
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const userRes = await API.get('/users');
      if (userRes.data) setUsers(userRes.data);

      const roleRes = await API.get('/users/roles');
      if (roleRes.data) setRoles(roleRes.data);
    } catch (err: any) {
      showError(err.message || 'Erreur lors du chargement des utilisateurs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setRoleId(roles[0]?.id ? String(roles[0].id) : '');
    setStatus('active');
    setPassword('');
    setCanManageUsers(false);
    setCanViewAllCalendars(false);
    setCanManageUtilities(false);
    setSelectedUser(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !roleId || !password) {
      showError('Le nom, l\'email, le rôle et le mot de passe sont requis.');
      return;
    }

    try {
      const payload: any = {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        role_id: Number(roleId),
        status,
        password,
      };

      if (hasRole('manager', 'super_admin')) {
        payload.can_manage_users = canManageUsers;
        payload.can_view_all_calendars = canViewAllCalendars;
        payload.can_manage_utilities = canManageUtilities;
      }

      await API.post('/users', payload);
      showSuccess('Utilisateur créé avec succès.');
      setIsCreateModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la création de l\'utilisateur.');
    }
  };

  const handleEditClick = (u: UserRecord) => {
    setSelectedUser(u);
    setFullName(u.full_name);
    setEmail(u.email);
    setPhone(u.phone || '');
    setRoleId(String(u.role?.id || ''));
    setStatus(u.status);
    setPassword('');
    setCanManageUsers(u.can_manage_users || false);
    setCanViewAllCalendars(u.can_view_all_calendars || false);
    setCanManageUtilities(u.can_manage_utilities || false);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!fullName.trim() || !email.trim() || !roleId) {
      showError('Le nom, l\'email et le rôle sont requis.');
      return;
    }

    try {
      const payload: any = {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        role_id: Number(roleId),
        status,
      };

      if (password) {
        payload.password = password;
      }

      if (hasRole('manager', 'super_admin')) {
        payload.can_manage_users = canManageUsers;
        payload.can_view_all_calendars = canViewAllCalendars;
        payload.can_manage_utilities = canManageUtilities;
      }

      await API.put(`/users/${selectedUser.id}`, payload);
      showSuccess('Utilisateur mis à jour avec succès.');
      setIsEditModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la mise à jour.');
    }
  };

  const handleToggleActive = async (id: number) => {
    try {
      await API.patch(`/users/${id}/toggle`);
      showSuccess('Statut de l\'utilisateur modifié avec succès.');
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la modification du statut.');
    }
  };

  const handleToggleAttendance = async (id: number, currentPresence: boolean) => {
    try {
      await API.patch(`/users/${id}/attendance`, { is_present: !currentPresence });
      showSuccess('Pointage de présence enregistré avec succès.');
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors du pointage.');
    }
  };

  const handleDeleteClick = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet utilisateur ?')) return;

    try {
      await API.delete(`/users/${id}`);
      showSuccess('Utilisateur supprimé avec succès.');
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la suppression.');
    }
  };

  const filteredUsers = users.filter((u) => {
    const text = searchTerm.toLowerCase();
    const name = (u.full_name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const roleName = (u.role?.role_name || '').toLowerCase();
    return name.includes(text) || email.includes(text) || roleName.includes(text);
  });

  const canEdit = hasRole('manager', 'super_admin') || (currentUser?.can_manage_users);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Utilisateurs</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Gérez les comptes du personnel, les privilèges de délégation et suivez la présence quotidienne
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              resetForm();
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-all animate-slide-in"
          >
            <Plus className="w-4 h-4" /> Ajouter un collaborateur
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-custom gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-semibold text-sm transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'list'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <UsersIcon className="w-4 h-4" /> Liste du personnel
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-semibold text-sm transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'permissions'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> Rôles & Permissions
        </button>
        <button
          onClick={() => setActiveTab('presence')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 font-semibold text-sm transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'presence'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Clock className="w-4 h-4" /> Présence & Pointage
        </button>
      </div>

      {/* TAB CONTENT: LIST */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un collaborateur par nom, email, rôle..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-custom bg-bg-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center p-12 text-center text-text-muted">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
              <span className="text-xs">Chargement du personnel...</span>
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                      <th className="px-6 py-4">Collaborateur</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Rôle</th>
                      <th className="px-6 py-4">Téléphone</th>
                      <th className="px-6 py-4">Statut</th>
                      {canEdit && <th className="px-6 py-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-custom text-sm">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-bg-hover/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center select-none">
                              {Helpers.initials(u.full_name)}
                            </div>
                            <span className="font-bold text-text-primary">{u.full_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-text-secondary">{u.email}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded-lg bg-primary/5 text-primary text-xs font-bold border border-primary/10">
                            {u.role?.role_name ? (ROLE_DETAILS[u.role.role_name]?.title || u.role.role_name) : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-text-secondary">{u.phone || '—'}</td>
                        <td className="px-6 py-4">
                          <span className={Helpers.statusBadge(u.status).className}>
                            {Helpers.statusBadge(u.status).label}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleEditClick(u)}
                                className="p-1.5 rounded-lg border border-border-custom hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                                title="Modifier"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleToggleActive(u.id)}
                                className={`p-1.5 rounded-lg border border-border-custom hover:bg-bg-hover transition-colors cursor-pointer ${
                                  u.status === 'active' ? 'text-amber-500' : 'text-green-500'
                                }`}
                                title={u.status === 'active' ? 'Désactiver' : 'Activer'}
                              >
                                {u.status === 'active' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleDeleteClick(u.id)}
                                className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 text-red-500 transition-colors cursor-pointer"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center p-12 text-text-muted border border-dashed border-border-custom rounded-2xl bg-bg-surface">
              <span className="text-2xl">👥</span>
              <p className="text-sm mt-2">Aucun utilisateur enregistré correspondant à la recherche.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: ROLES & PERMISSIONS */}
      {activeTab === 'permissions' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Roles selector list */}
          <div className="rounded-2xl border border-border-custom bg-bg-surface overflow-hidden divide-y divide-border-custom shadow-sm h-fit">
            <div className="p-4 bg-bg-surface-2 border-b border-border-custom">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Configuration Rôles</h3>
            </div>
            {Object.keys(ROLE_DETAILS).map((roleKey) => (
              <button
                key={roleKey}
                onClick={() => setSelectedRoleDetail(roleKey)}
                className={`w-full text-left px-5 py-4 font-bold text-sm transition-all flex items-center justify-between cursor-pointer ${
                  selectedRoleDetail === roleKey
                    ? 'bg-primary/5 text-primary border-l-4 border-l-primary'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                }`}
              >
                <span>{ROLE_DETAILS[roleKey].title}</span>
                <span className="text-[10px] uppercase font-bold text-text-muted">{roleKey}</span>
              </button>
            ))}
          </div>

          {/* Role details box */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-sm">
              <div className="border-b border-border-custom pb-4 mb-4">
                <h3 className="text-lg font-bold text-text-primary">{ROLE_DETAILS[selectedRoleDetail]?.title}</h3>
                <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                  {ROLE_DETAILS[selectedRoleDetail]?.desc}
                </p>
              </div>

              <h4 className="text-sm font-bold text-text-primary mb-3">Droits principaux dans le système :</h4>
              <ul className="space-y-2">
                {ROLE_DETAILS[selectedRoleDetail]?.rights.map((right, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-text-secondary">
                    <UserCheck className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{right}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Privileges delegation card */}
            <div className="rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-text-primary">💡 Droits et Privilèges Délégués</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Ces options peuvent être cochées individuellement pour chaque collaborateur pour lui accorder des droits administratifs avancés, quel que soit son rôle d'origine.
              </p>
              <div className="divide-y divide-border-custom">
                <div className="py-3 flex items-start gap-4">
                  <div className="mt-0.5 p-2 rounded-lg bg-primary/10 text-primary">
                    <UsersIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-text-primary">Gestion des comptes (can_manage_users)</h4>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      Autorise l'utilisateur à créer, modifier, suspendre ou supprimer les profils de ses collaborateurs (délégation de gestion RH).
                    </p>
                  </div>
                </div>
                <div className="py-3 flex items-start gap-4">
                  <div className="mt-0.5 p-2 rounded-lg bg-primary/10 text-primary">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-text-primary">Accès aux Calendriers (can_view_all_calendars)</h4>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      Permet d'ouvrir le calendrier global de l'entreprise et de suivre l'agenda de tous les membres des équipes.
                    </p>
                  </div>
                </div>
                <div className="py-3 flex items-start gap-4">
                  <div className="mt-0.5 p-2 rounded-lg bg-primary/10 text-primary">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-text-primary">Générer les charges (can_manage_utilities)</h4>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      Permet d'entrer les relevés de compteurs d'eau/électricité et de calculer la redistribution financière.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ATTENDANCE & POINTAGE */}
      {activeTab === 'presence' && (
        <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                  <th className="px-6 py-4">Collaborateur</th>
                  <th className="px-6 py-4">Rôle</th>
                  <th className="px-6 py-4">Statut Compte</th>
                  <th className="px-6 py-4">Présence</th>
                  <th className="px-6 py-4">Dernier Pointage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center p-12 text-text-muted">
                      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <span className="text-xs">Chargement du pointage...</span>
                    </td>
                  </tr>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => {
                    const isActive = u.status === 'active';
                    const isPresent = u.is_present || false;
                    const lastTime = u.last_attendance_at ? Helpers.formatDateTime(u.last_attendance_at) : 'Aucun pointage';

                    return (
                      <tr key={u.id} className="hover:bg-bg-hover/50">
                        <td className="px-6 py-4 font-bold text-text-primary">{u.full_name}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-0.5 rounded-lg bg-primary/5 text-primary text-xs font-semibold border border-primary/10">
                            {u.role?.role_name ? (ROLE_DETAILS[u.role.role_name]?.title || u.role.role_name) : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleActive(u.id)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                                isActive ? 'bg-green-500' : 'bg-slate-300'
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                  isActive ? 'translate-x-4.5' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            <span
                              className={`text-xs font-bold ${
                                isActive ? 'text-green-500' : 'text-text-muted'
                              }`}
                            >
                              {isActive ? 'Actif' : 'Inactif'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleAttendance(u.id, isPresent)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                                isPresent ? 'bg-green-500' : 'bg-red-500'
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                  isPresent ? 'translate-x-4.5' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            <span
                              className={`text-xs font-bold ${
                                isPresent ? 'text-green-500' : 'text-red-500'
                              }`}
                            >
                              {isPresent ? 'Présent' : 'Absent'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-text-muted text-xs font-medium">{lastTime}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center p-12 text-text-muted">
                      Aucun personnel enregistré.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
                <UsersIcon className="w-5 h-5 text-primary" /> Nouveau collaborateur
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
                  placeholder="Ex : Tom Technique"
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@smg.com"
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Téléphone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+237600000000"
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Rôle *</label>
                  <select
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                    required
                  >
                    <option value="">Sélectionnez un rôle...</option>
                    {roles.filter(r => r.name !== 'locataire').map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
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
                    <option value="suspended">Suspendu</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Mot de passe *</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe confidentiel"
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                />
              </div>

              {/* Privileges checklist (for Manager and Super Admin only) */}
              {hasRole('manager', 'super_admin') && (
                <div className="pt-2 border-t border-border-custom space-y-3">
                  <h4 className="text-xs font-bold text-text-secondary uppercase">Privilèges administratifs délégués</h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2.5 text-xs font-semibold text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canManageUsers}
                        onChange={(e) => setCanManageUsers(e.target.checked)}
                        className="rounded border-border-custom text-primary focus:ring-primary w-4 h-4"
                      />
                      <span>Autoriser la gestion des comptes (can_manage_users)</span>
                    </label>
                    <label className="flex items-center gap-2.5 text-xs font-semibold text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canViewAllCalendars}
                        onChange={(e) => setCanViewAllCalendars(e.target.checked)}
                        className="rounded border-border-custom text-primary focus:ring-primary w-4 h-4"
                      />
                      <span>Autoriser la consultation de tous les calendriers (can_view_all_calendars)</span>
                    </label>
                    <label className="flex items-center gap-2.5 text-xs font-semibold text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canManageUtilities}
                        onChange={(e) => setCanManageUtilities(e.target.checked)}
                        className="rounded border-border-custom text-primary focus:ring-primary w-4 h-4"
                      />
                      <span>Autoriser l'édition des charges d'eau/électricité (can_manage_utilities)</span>
                    </label>
                  </div>
                </div>
              )}

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
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" /> Modifier le collaborateur
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <label className="text-xs font-bold text-text-secondary uppercase">Téléphone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Rôle *</label>
                  <select
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                    required
                  >
                    {roles.filter(r => r.name !== 'locataire').map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
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
                    <option value="suspended">Suspendu</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Nouveau mot de passe (laisser vide si inchangé)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Laisser vide si aucun changement"
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                />
              </div>

              {/* Privileges checklist (for Manager and Super Admin only) */}
              {hasRole('manager', 'super_admin') && (
                <div className="pt-2 border-t border-border-custom space-y-3">
                  <h4 className="text-xs font-bold text-text-secondary uppercase">Privilèges administratifs délégués</h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2.5 text-xs font-semibold text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canManageUsers}
                        onChange={(e) => setCanManageUsers(e.target.checked)}
                        className="rounded border-border-custom text-primary focus:ring-primary w-4 h-4"
                      />
                      <span>Autoriser la gestion des comptes (can_manage_users)</span>
                    </label>
                    <label className="flex items-center gap-2.5 text-xs font-semibold text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canViewAllCalendars}
                        onChange={(e) => setCanViewAllCalendars(e.target.checked)}
                        className="rounded border-border-custom text-primary focus:ring-primary w-4 h-4"
                      />
                      <span>Autoriser la consultation de tous les calendriers (can_view_all_calendars)</span>
                    </label>
                    <label className="flex items-center gap-2.5 text-xs font-semibold text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canManageUtilities}
                        onChange={(e) => setCanManageUtilities(e.target.checked)}
                        className="rounded border-border-custom text-primary focus:ring-primary w-4 h-4"
                      />
                      <span>Autoriser l'édition des charges d'eau/électricité (can_manage_utilities)</span>
                    </label>
                  </div>
                </div>
              )}

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
