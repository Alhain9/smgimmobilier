'use client';

import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Lock,
  Camera,
  CheckCircle,
  FileText
} from 'lucide-react';

export default function ProfilePage() {
  const { user, updateUser, getRoleLabel } = useAuth();
  const { showSuccess, showError } = useToast();

  // Profile Form States
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  // Password Form States
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Avatar Upload State
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  if (!user) {
    return (
      <div className="text-center py-20 text-text-muted">
        Veuillez vous connecter pour voir votre profil.
      </div>
    );
  }

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) {
      showError('Le nom complet et l\'email sont requis.');
      return;
    }

    setIsSavingInfo(true);
    try {
      const res = await API.put('/auth/profile', {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
      });
      // Sync local context and storage
      updateUser({
        full_name: res.data.full_name,
        email: res.data.email,
        phone: res.data.phone
      });
      showSuccess('Profil mis à jour avec succès.');
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la mise à jour.');
    } finally {
      setIsSavingInfo(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    const fd = new FormData();
    fd.append('avatar', file);

    try {
      const res = await API.upload('/auth/profile', fd, 'PUT');
      updateUser({
        profile_image: res.data.profile_image
      });
      showSuccess('Photo de profil mise à jour.');
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la mise à jour de la photo.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      showError('Veuillez remplir les deux champs de mot de passe.');
      return;
    }
    if (newPassword.length < 6) {
      showError('Le nouveau mot de passe doit faire au moins 6 caractères.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await API.put('/auth/change-password', { oldPassword, newPassword });
      showSuccess('Mot de passe modifié avec succès.');
      setOldPassword('');
      setNewPassword('');
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la modification du mot de passe.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">👤 Mon Profil</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Gérez vos informations personnelles et identifiants de sécurité
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Card: Avatar & Summary */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-sm flex flex-col items-center text-center space-y-4">
            <div className="relative group">
              {user.profile_image ? (
                <img
                  src={Helpers.fileUrl(user.profile_image)}
                  alt={user.full_name}
                  className="w-24 h-24 rounded-full object-cover border-2 border-border-custom shadow-sm"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/20 text-primary flex items-center justify-center font-bold text-3xl uppercase shadow-sm">
                  {Helpers.initials(user.full_name)}
                </div>
              )}
              {/* Camera overlay */}
              <label className="absolute inset-0 bg-black/45 backdrop-blur-[2px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <Camera className="w-5 h-5 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <h3 className="text-base font-extrabold text-text-primary leading-tight">{user.full_name}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/25 mt-1 inline-block uppercase">
                {getRoleLabel()}
              </span>
            </div>

            {isUploadingAvatar && (
              <span className="text-[10px] text-text-muted font-bold animate-pulse">Envoi en cours...</span>
            )}

            {/* User Meta List */}
            <div className="w-full text-xs font-semibold divide-y divide-border-custom/50 pt-2 text-left">
              <div className="flex justify-between py-2.5">
                <span className="text-text-secondary flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-text-muted" /> Email</span>
                <span className="text-text-primary font-bold truncate max-w-[150px]">{user.email}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-text-secondary flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-text-muted" /> Téléphone</span>
                <span className="text-text-primary font-bold">{user.phone || '—'}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-text-secondary flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-text-muted" /> Statut</span>
                <span className={Helpers.statusBadge(user.status).className}>
                  {Helpers.statusBadge(user.status).label || user.status}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-text-secondary flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-text-muted" /> Membre depuis</span>
                <span className="text-text-primary font-bold">{Helpers.formatDate(user.created_at)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Cards: Edit info & Change password */}
        <div className="lg:col-span-2 space-y-6">
          {/* Edit info Card */}
          <div className="rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-text-primary border-b border-border-custom pb-2">
              Modifier mes informations
            </h3>

            <form onSubmit={handleSaveInfo} className="space-y-4 text-xs font-semibold text-text-secondary">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Nom complet *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="px-3.5 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl text-text-primary focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="px-3.5 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl text-text-primary focus:outline-none"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Téléphone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="px-3.5 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl text-text-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingInfo}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-colors"
                >
                  {isSavingInfo ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>

          {/* Change password Card */}
          <div className="rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-text-primary border-b border-border-custom pb-2">
              Changer mon mot de passe
            </h3>

            <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs font-semibold text-text-secondary">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Mot de passe actuel *</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="px-3.5 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl text-text-primary focus:outline-none"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Nouveau mot de passe *</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 caractères"
                    className="px-3.5 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl text-text-primary focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-colors"
                >
                  {isUpdatingPassword ? 'Mise à jour...' : 'Mettre à jour'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
