'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import {
  Upload,
  Search,
  X,
  FileText,
  Image as ImageIcon,
  Trash2,
  Eye,
  Download,
  AlertCircle
} from 'lucide-react';

interface Uploader {
  id: number;
  full_name: string;
}

interface DocumentItem {
  id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  related_table: string; // Category
  uploader_id: number;
  created_at: string;
  uploader?: Uploader | null;
}

export default function DocumentsPage() {
  const { hasRole } = useAuth();
  const { showSuccess, showError } = useToast();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Upload Form states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [category, setCategory] = useState('contract');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const CATS = [
    { value: 'contract', label: '📄 Contrat' },
    { value: 'cni', label: '🪪 CNI' },
    { value: 'invoice', label: '🧾 Facture' },
    { value: 'report', label: '📋 Rapport' },
    { value: 'justificatif', label: '💳 Justificatif' },
    { value: 'document', label: '📁 Document administratif' },
  ];

  const catLabel = (v: string) => {
    const c = CATS.find((x) => x.value === v);
    return c ? c.label : (v || 'Document');
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await API.get('/documents');
      if (res.data) setDocuments(res.data);
    } catch (err: any) {
      showError(err.message || 'Erreur lors du chargement des documents.');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenUpload = () => {
    setCategory('contract');
    setSelectedFile(null);
    setIsUploadOpen(true);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showError('Veuillez sélectionner un fichier.');
      return;
    }

    setIsUploading(true);
    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('category', category);

    try {
      await API.upload('/documents', fd);
      showSuccess('Document téléversé avec succès.');
      setIsUploadOpen(false);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors du téléversement.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce document ?')) return;
    try {
      await API.delete(`/documents/${id}`);
      showSuccess('Document supprimé.');
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur de suppression.');
    }
  };

  const isPdf = (type: string) => {
    return (type || '').toLowerCase().includes('pdf');
  };

  const filteredDocs = documents.filter((doc) => {
    const q = searchTerm.toLowerCase();
    const name = doc.file_name || '';
    const cat = catLabel(doc.related_table);
    const author = doc.uploader?.full_name || '';
    return (
      name.toLowerCase().includes(q) ||
      cat.toLowerCase().includes(q) ||
      author.toLowerCase().includes(q)
    );
  });

  const canDelete = hasRole('manager', 'dir_admin');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">📁 Gestion Documentaire</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Consultez, téléchargez et organisez vos documents et justificatifs
          </p>
        </div>
        <button
          onClick={handleOpenUpload}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-all"
        >
          <Upload className="w-4 h-4" /> Téléverser un fichier
        </button>
      </div>

      {/* Main Container */}
      <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-base font-bold text-text-primary">
            Registre des documents administratifs
          </h3>
          <div className="relative max-w-[260px] w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher document, uploader..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-border-custom bg-bg-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-semibold"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-text-muted">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs">Chargement de la bibliothèque de documents...</span>
          </div>
        ) : filteredDocs.length > 0 ? (
          <div className="overflow-x-auto w-full border border-border-custom rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                  <th className="px-5 py-3.5">Fichier</th>
                  <th className="px-5 py-3.5">Catégorie</th>
                  <th className="px-5 py-3.5">Ajouté par</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom text-xs font-semibold">
                {filteredDocs.map((d) => (
                  <tr key={d.id} className="hover:bg-bg-hover/50 transition-colors">
                    <td className="px-5 py-3.5 text-text-primary">
                      <span className="flex items-center gap-2">
                        {isPdf(d.file_type) ? (
                          <FileText className="w-4 h-4 text-red-500 shrink-0" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                        )}
                        <span className="font-extrabold truncate max-w-[250px]">{d.file_name}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] border font-bold uppercase bg-primary/10 text-primary border-primary/20">
                        {catLabel(d.related_table)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary">{d.uploader?.full_name || '—'}</td>
                    <td className="px-5 py-3.5 text-text-secondary">{Helpers.formatDate(d.created_at)}</td>
                    <td className="px-5 py-3.5 text-right no-print">
                      <div className="flex justify-end gap-1.5">
                        <a
                          href={Helpers.fileUrl(d.file_path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary cursor-pointer"
                          title="Prévisualiser"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={Helpers.fileUrl(d.file_path)}
                          download={d.file_name}
                          className="p-1.5 rounded-lg border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary cursor-pointer"
                          title="Télécharger"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(d.id)}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/15 border border-red-500/20 cursor-pointer"
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
        ) : (
          <div className="text-center py-10 text-text-muted text-xs font-bold">
            Aucun document disponible
          </div>
        )}
      </div>

      {/* UPLOAD DOCUMENT MODAL */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                ⬆ Téléverser un document
              </h3>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="py-4 space-y-4 text-sm font-semibold">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Catégorie *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary text-text-primary cursor-pointer"
                  required
                >
                  {CATS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Fichier (PDF ou image) *</label>
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
