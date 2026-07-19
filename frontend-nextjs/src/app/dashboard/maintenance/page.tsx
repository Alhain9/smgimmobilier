'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API } from '../../../services/api';
import { Helpers } from '../../../utils/helpers';
import {
  Wrench,
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  X,
  UserPlus,
  Briefcase,
  Layers,
  Image as ImageIcon,
  DollarSign,
  FileText,
  Upload,
  Camera,
  Hammer
} from 'lucide-react';

interface TechnicianOption {
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

interface MaintenanceExpense {
  id: number;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  supplier?: string;
  category?: string;
  invoice_file?: string;
  photo?: string;
}

interface MaintenanceImage {
  id: number;
  image_url: string;
  image_type: 'before' | 'during' | 'after';
}

interface MaintenanceRequest {
  id: number;
  title: string;
  priority: string;
  status: string;
  description?: string;
  apartment?: {
    id: number;
    apartment_number: string;
    apartment_type?: string;
    property?: {
      property_name: string;
      city?: string;
      district?: string;
    };
  };
  tenant?: {
    id: number;
    full_name: string;
    user?: {
      full_name: string;
    };
  };
  technician?: {
    id: number;
    full_name: string;
  };
  team?: Array<{
    id: number;
    full_name: string;
  }>;
  expenses?: MaintenanceExpense[];
  images?: MaintenanceImage[];
  tasks?: Array<{
    id: number;
    title: string;
    status: string;
    assignee?: {
      full_name: string;
    };
  }>;
}

export default function MaintenancePage() {
  const { user: currentUser, hasRole } = useAuth();
  const { showSuccess, showError } = useToast();

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [apartments, setApartments] = useState<ApartmentOption[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);

  // Form states
  const [apartmentId, setApartmentId] = useState('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  
  // Assign state
  const [assignedTechnicianId, setAssignedTechnicianId] = useState('');

  // Team state (multi-select checkmarks)
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);

  // Expense / materials states
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [supplier, setSupplier] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Plomberie');

  // Status state
  const [statusVal, setStatusVal] = useState('reported');

  // Quote states
  const [quoteCreator, setQuoteCreator] = useState(currentUser?.full_name || '');
  const [quoteRole, setQuoteRole] = useState('');
  const [quoteDesc, setQuoteDesc] = useState('');
  const [quoteDuration, setQuoteDuration] = useState('2 jours');
  const [quoteLabor, setQuoteLabor] = useState('0');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [quoteItems, setQuoteItems] = useState<Array<{ name: string; qty: number; price: number }>>([
    { name: '', qty: 1, price: 0 }
  ]);

  // Photo upload states
  const [photoType, setPhotoType] = useState<'before' | 'during' | 'after'>('before');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const reqRes = await API.get('/maintenance');
      if (reqRes.data) setRequests(reqRes.data);

      const aptRes = await API.get('/apartments');
      if (aptRes.data) setApartments(aptRes.data);

      const techRes = await API.get('/users/technicians');
      if (techRes.data) setTechnicians(techRes.data);
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la récupération des données.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshSelectedRequest = async (id: number) => {
    try {
      const res = await API.get(`/maintenance/${id}`);
      if (res.data) {
        setSelectedRequest(res.data);
        // Sync selected team checkmarks
        const currentTeam = res.data.team || [];
        setSelectedTeamIds(currentTeam.map((t: any) => t.id));
      }
    } catch (_) {
      showError('Erreur de rechargement du ticket.');
    }
  };

  const resetForm = () => {
    setApartmentId(apartments[0]?.id ? String(apartments[0].id) : '');
    setTitle('');
    setPriority('medium');
    setDescription('');
    setSelectedRequest(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apartmentId || !title.trim()) {
      showError('Le logement et le titre sont requis.');
      return;
    }

    try {
      const payload = {
        apartment_id: Number(apartmentId),
        title: title.trim(),
        priority,
        description: description.trim(),
      };

      await API.post('/maintenance', payload);
      showSuccess('Ticket de maintenance créé avec succès.');
      setIsCreateModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la création du ticket.');
    }
  };

  const handleAssignClick = (req: MaintenanceRequest) => {
    setSelectedRequest(req);
    setAssignedTechnicianId(String(req.technician?.id || ''));
    setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      await API.patch(`/maintenance/${selectedRequest.id}/assign`, {
        assigned_technician_id: assignedTechnicianId ? Number(assignedTechnicianId) : null,
      });
      showSuccess('Technicien assigné avec succès.');
      setIsAssignModalOpen(false);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur d\'assignation.');
    }
  };

  const handleTeamClick = (req: MaintenanceRequest) => {
    setSelectedRequest(req);
    const currentTeam = req.team || [];
    setSelectedTeamIds(currentTeam.map((t: any) => t.id));
    setIsTeamModalOpen(true);
  };

  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      await API.put(`/maintenance/${selectedRequest.id}/technicians`, {
        user_ids: selectedTeamIds,
      });
      showSuccess('Équipe de techniciens mise à jour.');
      setIsTeamModalOpen(false);
      refreshSelectedRequest(selectedRequest.id);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur de modification de l\'équipe.');
    }
  };

  const handleTeamCheckboxChange = (techId: number, checked: boolean) => {
    if (checked) {
      setSelectedTeamIds((prev) => [...prev, techId]);
    } else {
      setSelectedTeamIds((prev) => prev.filter((id) => id !== techId));
    }
  };

  const handleExpenseClick = (req: MaintenanceRequest) => {
    setSelectedRequest(req);
    setItemName('');
    setQuantity('1');
    setUnitPrice('');
    setSupplier('');
    setExpenseCategory('Plomberie');
    setIsExpenseModalOpen(true);
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !itemName.trim() || !unitPrice || !quantity) {
      showError('Le nom, la quantité et le prix unitaire sont requis.');
      return;
    }

    try {
      const payload = {
        item_name: itemName.trim(),
        quantity: Number(quantity),
        unit_price: Number(unitPrice),
        supplier: supplier.trim() || null,
        category: expenseCategory,
        maintenance_id: selectedRequest.id,
      };

      await API.post('/expenses', payload);
      showSuccess('Matériau ajouté avec succès.');
      setIsExpenseModalOpen(false);
      refreshSelectedRequest(selectedRequest.id);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de l\'ajout du matériau.');
    }
  };

  const handleStatusClick = (req: MaintenanceRequest) => {
    setSelectedRequest(req);
    setStatusVal(req.status);
    setIsStatusModalOpen(true);
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      await API.put(`/maintenance/${selectedRequest.id}`, {
        status: statusVal,
      });
      showSuccess('Statut mis à jour avec succès.');
      setIsStatusModalOpen(false);
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur de modification du statut.');
    }
  };

  const handlePhotoUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !selectedFiles || selectedFiles.length === 0) {
      showError('Veuillez sélectionner au moins une image.');
      return;
    }

    setIsUploading(true);
    const fd = new FormData();
    for (let i = 0; i < selectedFiles.length; i++) {
      fd.append('photo', selectedFiles[i]);
    }
    fd.append('image_type', photoType);

    try {
      await API.upload(`/maintenance/${selectedRequest.id}/photos`, fd);
      showSuccess('Photos téléversées avec succès.');
      setSelectedFiles(null);
      refreshSelectedRequest(selectedRequest.id);
    } catch (err: any) {
      showError(err.message || 'Erreur de téléversement des photos.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleQuoteClick = (req: MaintenanceRequest) => {
    setSelectedRequest(req);
    setQuoteCreator(currentUser?.full_name || '');
    setQuoteRole('Directeur Technique');
    setQuoteDesc(req.title);
    setQuoteDuration('2 jours');
    setQuoteLabor('0');
    setQuoteNotes('');
    setQuoteItems([{ name: '', qty: 1, price: 0 }]);
    setIsQuoteModalOpen(true);
  };

  const handleAddQuoteItem = () => {
    setQuoteItems((prev) => [...prev, { name: '', qty: 1, price: 0 }]);
  };

  const handleQuoteItemChange = (idx: number, field: string, val: any) => {
    setQuoteItems((prev) => {
      const clone = [...prev];
      clone[idx] = { ...clone[idx], [field]: val };
      return clone;
    });
  };

  const handleGenerateQuotePDF = () => {
    if (!selectedRequest) return;

    // Filter empty items
    const activeItems = quoteItems.filter((it) => it.name.trim() !== '');

    // Calculate totals
    const materialsTotal = activeItems.reduce((acc, it) => acc + it.qty * it.price, 0);
    const laborVal = parseFloat(quoteLabor) || 0;
    const grandTotal = materialsTotal + laborVal;

    // Create popup print view (clean, premium print layout)
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showError('Veuillez autoriser les fenêtres pop-up.');
      return;
    }

    const itemsRows = activeItems.map(
      (it) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${it.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${it.qty}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${new Intl.NumberFormat('fr-FR').format(it.price)} FCFA</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${new Intl.NumberFormat('fr-FR').format(it.qty * it.price)} FCFA</td>
      </tr>`
    ).join('') || `<tr><td colspan="4" style="padding:10px; text-align:center; color:#94a3b8;">Aucun matériau déclaré</td></tr>`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Devis - ${selectedRequest.title}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0ea5e9; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; color: #0ea5e9; }
            .meta-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .meta-card { padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; }
            .meta-title { font-weight: bold; font-size: 13px; color: #64748b; text-transform: uppercase; margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px; }
            th { background: #0ea5e9; color: white; padding: 10px; text-align: left; font-size: 14px; }
            .totals { margin-top: 30px; text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
            .total-row { display: flex; width: 300px; justify-content: space-between; font-size: 14px; }
            .grand-total { font-size: 18px; font-weight: bold; color: #0ea5e9; border-top: 2px solid #0ea5e9; padding-top: 10px; }
            .footer { border-top: 1px solid #e2e8f0; margin-top: 50px; padding-top: 20px; font-size: 11px; color: #64748b; text-align: center; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom:20px; display:flex; justify-content:flex-end;">
            <button onclick="window.print()" style="padding: 10px 20px; background: #0ea5e9; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">Imprimer / Sauvegarder PDF</button>
          </div>
          <div class="header">
            <div>
              <div class="title">SMG IMMOBILIER</div>
              <div style="font-size: 12px; color: #64748b; mt: 5px;">Gestion immobilière — Douala, Cameroun</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 20px; font-weight: bold; color: #0ea5e9;">DEVIS ESTIMATIF</div>
              <div style="font-size: 12px; color: #64748b; mt: 5px;">Date : ${new Date().toLocaleDateString('fr-FR')}</div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-card">
              <div class="meta-title">Chantier / Intervention</div>
              <div style="font-weight: bold; font-size: 15px;">${selectedRequest.title}</div>
              <div style="font-size: 13px; color: #475569; margin-top: 5px;">
                Immeuble : ${selectedRequest.apartment?.property?.property_name || '—'}<br>
                Logement : ${selectedRequest.apartment?.apartment_number || '—'}
              </div>
            </div>
            <div class="meta-card">
              <div class="meta-title">Créateur</div>
              <div style="font-weight: bold; font-size: 15px;">${quoteCreator}</div>
              <div style="font-size: 13px; color: #475569; margin-top: 5px;">
                Rôle : ${quoteRole}<br>
                Durée estimée : ${quoteDuration}
              </div>
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <div class="meta-title">Description des Travaux</div>
            <div style="font-size: 14px; color: #334155;">${quoteDesc}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Matériel / Équipement</th>
                <th style="text-align: center;">Quantité</th>
                <th style="text-align: right;">Prix unitaire</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span>Total Matériaux :</span>
              <span style="font-weight: bold;">${new Intl.NumberFormat('fr-FR').format(materialsTotal)} FCFA</span>
            </div>
            <div class="total-row">
              <span>Main d'œuvre :</span>
              <span style="font-weight: bold;">${new Intl.NumberFormat('fr-FR').format(laborVal)} FCFA</span>
            </div>
            <div class="total-row grand-total">
              <span>MONTANT TOTAL :</span>
              <span>${new Intl.NumberFormat('fr-FR').format(grandTotal)} FCFA</span>
            </div>
          </div>

          ${quoteNotes ? `
          <div style="margin-top: 40px;">
            <div class="meta-title">Observations</div>
            <div style="font-size: 12px; color: #475569; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">${quoteNotes}</div>
          </div>` : ''}

          <div class="footer">
            SMG IMMOBILIER • contact@smg-immobilier.com • +237 6 00 00 00 00<br>
            Document édité à titre informatif et estimatif.
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    setIsQuoteModalOpen(false);
    showSuccess('Devis généré pour impression.');
  };

  const handleViewClick = (req: MaintenanceRequest) => {
    setSelectedRequest(req);
    setIsViewModalOpen(true);
    refreshSelectedRequest(req.id);
  };

  const handleDeleteClick = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce ticket ?')) return;

    try {
      await API.delete(`/maintenance/${id}`);
      showSuccess('Ticket de maintenance supprimé.');
      loadData();
    } catch (err: any) {
      showError(err.message || 'Erreur lors de la suppression.');
    }
  };

  const filteredRequests = requests.filter((r) => {
    const text = searchTerm.toLowerCase();
    const pName = r.apartment?.property?.property_name.toLowerCase() || '';
    const aNum = r.apartment?.apartment_number.toLowerCase() || '';
    const title = r.title.toLowerCase();
    return pName.includes(text) || aNum.includes(text) || title.includes(text);
  });

  const canEdit = hasRole('manager', 'dir_technique', 'gestionnaire', 'dir_admin');

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Maintenances</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Gérez les requêtes techniques, affectez les chantiers, suivez les coûts de matériel et archivez les photos
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
            <Plus className="w-4 h-4" /> Nouveau ticket
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-text-primary">{requests.length}</span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Tickets totaux</span>
        </div>
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-amber-500">
            {requests.filter((r) => r.status === 'reported').length}
          </span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Tickets signalés</span>
        </div>
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-sky-500">
            {requests.filter((r) => r.status === 'in_progress').length}
          </span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Interventions en cours</span>
        </div>
        <div className="p-4 rounded-xl border border-border-custom bg-bg-surface flex flex-col justify-center">
          <span className="text-2xl font-bold text-green-500">
            {requests.filter((r) => r.status === 'completed').length}
          </span>
          <span className="text-[10px] text-text-muted font-bold uppercase mt-0.5">Tickets résolus</span>
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
          placeholder="Rechercher par titre de ticket, logement, ou immeuble..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-custom bg-bg-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
        />
      </div>

      {/* Main list table */}
      {isLoading ? (
        <div className="flex flex-col items-center p-12 text-center text-text-muted">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs">Chargement des maintenances...</span>
        </div>
      ) : filteredRequests.length > 0 ? (
        <div className="rounded-2xl border border-border-custom bg-bg-surface shadow-sm overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-custom bg-bg-surface-2 text-xs font-bold uppercase tracking-wider text-text-secondary select-none">
                  <th className="px-6 py-4">Titre</th>
                  <th className="px-6 py-4">Logement / Immeuble</th>
                  <th className="px-6 py-4">Priorité</th>
                  <th className="px-6 py-4">Technicien principal</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom text-sm">
                {filteredRequests.map((r) => (
                  <tr key={r.id} className="hover:bg-bg-hover/50">
                    <td className="px-6 py-4 font-bold text-text-primary">{r.title}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-text-primary">
                          {r.apartment?.property?.property_name || '—'}
                        </span>
                        <span className="text-xs text-text-muted mt-0.5">
                          Logt {r.apartment?.apartment_number || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={Helpers.priorityBadge(r.priority).className}>
                        {Helpers.priorityBadge(r.priority).label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {r.technician ? (
                        <span className="font-semibold text-text-primary">{r.technician.full_name}</span>
                      ) : (
                        <span className="text-text-muted italic text-xs">Non assigné</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={Helpers.maintStatus(r.status).className}>
                        {Helpers.maintStatus(r.status).label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleViewClick(r)}
                          className="p-1.5 rounded-lg border border-border-custom hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                          title="Consulter le Chantier"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {hasRole('manager', 'dir_technique') && (
                          <button
                            onClick={() => handleAssignClick(r)}
                            className="p-1.5 rounded-lg border border-border-custom hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                            title="Assigner un responsable"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {hasRole('manager', 'dir_technique', 'technicien', 'gestionnaire') && (
                          <button
                            onClick={() => handleStatusClick(r)}
                            className="p-1.5 rounded-lg border border-border-custom hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                            title="Changer statut"
                          >
                            <Layers className="w-3.5 h-3.5 text-primary" />
                          </button>
                        )}
                        {hasRole('manager', 'dir_technique') && (
                          <button
                            onClick={() => handleDeleteClick(r.id)}
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
          <span className="text-2xl">🔧</span>
          <p className="text-sm mt-2">Aucun ticket de maintenance enregistré.</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. VIEW DETAILED MODAL */}
      {isViewModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" /> Chantier — {selectedRequest.title}
              </h3>
              <button onClick={() => setIsViewModalOpen(false)} className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4 text-sm no-scrollbar">
              {/* Informations Générales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-bg-body border border-border-custom">
                  <div className="text-xs font-bold text-text-muted uppercase">Immeuble & Logement</div>
                  <div className="font-bold text-text-primary mt-1">
                    {selectedRequest.apartment?.property?.property_name || '—'}
                  </div>
                  <div className="text-xs text-text-secondary mt-0.5">
                    Logement : {selectedRequest.apartment?.apartment_number || '—'}
                    {selectedRequest.apartment?.apartment_type ? ` · ${selectedRequest.apartment.apartment_type}` : ''}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-bg-body border border-border-custom">
                  <div className="text-xs font-bold text-text-muted uppercase">Locataire & Priorité</div>
                  <div className="font-bold text-text-primary mt-1">
                    {selectedRequest.tenant?.user?.full_name || selectedRequest.tenant?.full_name || '—'}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={Helpers.priorityBadge(selectedRequest.priority).className}>
                      {Helpers.priorityBadge(selectedRequest.priority).label}
                    </span>
                    <span className={Helpers.maintStatus(selectedRequest.status).className}>
                      {Helpers.maintStatus(selectedRequest.status).label}
                    </span>
                  </div>
                </div>
              </div>

              {selectedRequest.description && (
                <div className="p-4 rounded-xl bg-bg-body border border-border-custom">
                  <div className="text-xs font-bold text-text-muted uppercase mb-1">Description</div>
                  <p className="text-text-secondary leading-relaxed">{selectedRequest.description}</p>
                </div>
              )}

              {/* Équipe de Techniciens */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-text-primary flex items-center gap-1.5">
                    👷 Équipe de techniciens
                  </h4>
                  {hasRole('manager', 'dir_technique') && (
                    <button
                      onClick={() => handleTeamClick(selectedRequest)}
                      className="px-2.5 py-1 text-xs font-bold border border-border-custom bg-bg-body rounded-lg hover:bg-bg-hover text-text-secondary cursor-pointer"
                    >
                      Gérer l'équipe
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedRequest.team || []).length > 0 ? (
                    (selectedRequest.team || []).map((t) => (
                      <span key={t.id} className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-500 border border-sky-500/20 text-xs font-bold">
                        👷 {t.full_name}
                      </span>
                    ))
                  ) : selectedRequest.technician ? (
                    <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-500 border border-sky-500/20 text-xs font-bold">
                      👷 {selectedRequest.technician.full_name} (Responsable)
                    </span>
                  ) : (
                    <span className="text-text-muted italic text-xs">Aucun technicien affecté à l'équipe</span>
                  )}
                </div>
              </div>

              {/* Matériaux et Coûts */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-text-primary flex items-center gap-1.5">
                    🧰 Matériel & dépenses du chantier
                  </h4>
                  <div className="flex gap-2">
                    {hasRole('manager', 'dir_technique', 'comptable') && (
                      <button
                        onClick={() => handleQuoteClick(selectedRequest)}
                        className="px-2.5 py-1 text-xs font-bold border border-border-custom bg-bg-body rounded-lg hover:bg-bg-hover text-text-secondary flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-primary" /> Générer devis
                      </button>
                    )}
                    {hasRole('manager', 'dir_technique') && (
                      <button
                        onClick={() => handleExpenseClick(selectedRequest)}
                        className="px-2.5 py-1 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary-hover flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Ajouter
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {(selectedRequest.expenses || []).length > 0 ? (
                    <>
                      <div className="divide-y divide-border-custom border border-border-custom rounded-xl overflow-hidden bg-bg-body">
                        {(selectedRequest.expenses || []).map((exp) => (
                          <div key={exp.id} className="p-3 flex justify-between items-center text-xs">
                            <div>
                              <div className="font-bold text-text-primary">{exp.item_name}</div>
                              <div className="text-text-muted mt-0.5">
                                {exp.quantity} × {Helpers.formatMoney(exp.unit_price)}
                                {exp.supplier ? ` · Fournisseur : ${exp.supplier}` : ''}
                                {exp.category ? ` · Catégorie : ${exp.category}` : ''}
                              </div>
                            </div>
                            <span className="font-bold text-text-primary">
                              {Helpers.formatMoney(exp.total_price)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center px-2 py-1">
                        <span className="font-bold text-text-secondary text-xs uppercase tracking-wide">Coût matériel total</span>
                        <span className="text-base font-extrabold text-primary">
                          {Helpers.formatMoney(
                            (selectedRequest.expenses || []).reduce((sum, item) => sum + item.total_price, 0)
                          )}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-text-muted italic text-xs">Aucun matériel n'a été enregistré pour ce chantier.</p>
                  )}
                </div>
              </div>

              {/* Photos Gallery */}
              <div className="space-y-4 pt-2 border-t border-border-custom">
                <h4 className="font-bold text-text-primary flex items-center gap-1.5">
                  📷 Galerie photos de suivi
                </h4>

                <div className="space-y-4">
                  {/* Before */}
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Avant travaux</span>
                    <div className="grid grid-cols-3 gap-3 mt-1.5">
                      {(selectedRequest.images || []).filter((i) => i.image_type === 'before').length > 0 ? (
                        (selectedRequest.images || [])
                          .filter((i) => i.image_type === 'before')
                          .map((img) => (
                            <a
                              key={img.id}
                              href={Helpers.fileUrl(img.image_url)}
                              target="_blank"
                              className="aspect-square rounded-xl overflow-hidden border border-border-custom bg-bg-body cursor-pointer hover:opacity-95 transition-opacity"
                            >
                              <img src={Helpers.fileUrl(img.image_url)} className="w-full h-full object-cover" />
                            </a>
                          ))
                      ) : (
                        <span className="text-xs text-text-muted italic col-span-3">Aucune photo avant travaux</span>
                      )}
                    </div>
                  </div>

                  {/* During */}
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Pendant travaux</span>
                    <div className="grid grid-cols-3 gap-3 mt-1.5">
                      {(selectedRequest.images || []).filter((i) => i.image_type === 'during').length > 0 ? (
                        (selectedRequest.images || [])
                          .filter((i) => i.image_type === 'during')
                          .map((img) => (
                            <a
                              key={img.id}
                              href={Helpers.fileUrl(img.image_url)}
                              target="_blank"
                              className="aspect-square rounded-xl overflow-hidden border border-border-custom bg-bg-body cursor-pointer hover:opacity-95 transition-opacity"
                            >
                              <img src={Helpers.fileUrl(img.image_url)} className="w-full h-full object-cover" />
                            </a>
                          ))
                      ) : (
                        <span className="text-xs text-text-muted italic col-span-3">Aucune photo pendant travaux</span>
                      )}
                    </div>
                  </div>

                  {/* After */}
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Après travaux</span>
                    <div className="grid grid-cols-3 gap-3 mt-1.5">
                      {(selectedRequest.images || []).filter((i) => i.image_type === 'after').length > 0 ? (
                        (selectedRequest.images || [])
                          .filter((i) => i.image_type === 'after')
                          .map((img) => (
                            <a
                              key={img.id}
                              href={Helpers.fileUrl(img.image_url)}
                              target="_blank"
                              className="aspect-square rounded-xl overflow-hidden border border-border-custom bg-bg-body cursor-pointer hover:opacity-95 transition-opacity"
                            >
                              <img src={Helpers.fileUrl(img.image_url)} className="w-full h-full object-cover" />
                            </a>
                          ))
                      ) : (
                        <span className="text-xs text-text-muted italic col-span-3">Aucune photo après travaux</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Photo Upload Tool */}
                {hasRole('manager', 'dir_technique', 'technicien', 'gestionnaire') && (
                  <form onSubmit={handlePhotoUploadSubmit} className="pt-3 border-t border-border-custom space-y-3">
                    <h5 className="text-xs font-bold text-text-secondary uppercase">Ajouter des photos de chantier</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select
                        value={photoType}
                        onChange={(e: any) => setPhotoType(e.target.value)}
                        className="px-3 py-2 border border-border-custom bg-bg-body rounded-xl focus:outline-none text-xs"
                      >
                        <option value="before">Avant travaux</option>
                        <option value="during">Pendant travaux</option>
                        <option value="after">Après travaux</option>
                      </select>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => setSelectedFiles(e.target.files)}
                        className="px-3 py-1.5 border border-border-custom bg-bg-body rounded-xl text-xs"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isUploading}
                      className="w-full px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55"
                    >
                      <Camera className="w-4 h-4" /> {isUploading ? 'Téléversement...' : 'Téléverser les photos'}
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border-custom">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-5 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" /> Nouveau ticket de maintenance
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 text-sm no-scrollbar">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Logement concerné *</label>
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

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Titre de l'intervention *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex : Réparation fuite d'eau salle de bain"
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Priorité</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                >
                  <option value="low">Basse</option>
                  <option value="medium">Normale</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Description détaillée</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Expliquez la panne en détail..."
                  rows={4}
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
                  Créer le ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. ASSIGN MODAL */}
      {isAssignModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl animate-slide-in">
            <h3 className="text-base font-bold text-text-primary mb-4 pb-2 border-b border-border-custom flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Assigner un technicien responsable
            </h3>
            <form onSubmit={handleAssignSubmit} className="space-y-4 text-sm">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Sélectionner le technicien</label>
                <select
                  value={assignedTechnicianId}
                  onChange={(e) => setAssignedTechnicianId(e.target.value)}
                  className="w-full px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                >
                  <option value="">Sélectionnez un responsable...</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. TEAM MANAGE MODAL */}
      {isTeamModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl animate-slide-in">
            <h3 className="text-base font-bold text-text-primary mb-4 pb-2 border-b border-border-custom">
              👷 Équipe du chantier — {selectedRequest.title}
            </h3>
            <p className="text-xs text-text-muted mb-4">
              Sélectionnez tous les techniciens affectés au chantier de maintenance.
            </p>
            <form onSubmit={handleTeamSubmit} className="space-y-4">
              <div className="max-h-[30vh] overflow-y-auto divide-y divide-border-custom border border-border-custom rounded-xl p-2 bg-bg-body">
                {technicians.map((tech) => {
                  const isChecked = selectedTeamIds.includes(tech.id);
                  return (
                    <label key={tech.id} className="flex items-center gap-3 p-2 text-xs font-semibold cursor-pointer hover:bg-bg-hover">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleTeamCheckboxChange(tech.id, e.target.checked)}
                        className="rounded border-border-custom text-primary focus:ring-primary w-4 h-4"
                      />
                      <span>{tech.full_name}</span>
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsTeamModalOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. STATUS MODAL */}
      {isStatusModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl animate-slide-in">
            <h3 className="text-base font-bold text-text-primary mb-4 pb-2 border-b border-border-custom flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" /> Changer le statut
            </h3>
            <form onSubmit={handleStatusSubmit} className="space-y-4 text-sm">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Nouveau statut</label>
                <select
                  value={statusVal}
                  onChange={(e) => setStatusVal(e.target.value)}
                  className="w-full px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                >
                  <option value="reported">Signalé</option>
                  <option value="validated">Validé</option>
                  <option value="in_progress">En cours</option>
                  <option value="completed">Terminé</option>
                  <option value="cancelled">Annulé</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. ADD EXPENSE MODAL */}
      {isExpenseModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in">
            <h3 className="text-base font-bold text-text-primary mb-4 pb-2 border-b border-border-custom flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> Ajouter un matériel ou une dépense
            </h3>
            <form onSubmit={handleExpenseSubmit} className="space-y-4 text-sm">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Nom de l'élément *</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Ex : Robinet mélangeur évier"
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Quantité *</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Ex : 1"
                    min="1"
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Prix unitaire * (FCFA)</label>
                  <input
                    type="number"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="Ex : 8500"
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Fournisseur</label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Ex : Quincaillerie du Centre"
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Catégorie</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  >
                    <option value="Plomberie">Plomberie</option>
                    <option value="Électricité">Électricité</option>
                    <option value="Peinture">Peinture</option>
                    <option value="Menuiserie">Menuiserie</option>
                    <option value="Maçonnerie">Maçonnerie</option>
                    <option value="Climatisation">Climatisation</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-custom">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. QUOTE MODAL */}
      {isQuoteModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Générer un devis estimatif
              </h3>
              <button onClick={() => setIsQuoteModalOpen(false)} className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 py-4 text-sm no-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Créé par</label>
                  <input
                    type="text"
                    value={quoteCreator}
                    onChange={(e) => setQuoteCreator(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Rôle</label>
                  <input
                    type="text"
                    value={quoteRole}
                    onChange={(e) => setQuoteRole(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Description des travaux</label>
                <textarea
                  value={quoteDesc}
                  onChange={(e) => setQuoteDesc(e.target.value)}
                  rows={2}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Durée estimée</label>
                  <input
                    type="text"
                    value={quoteDuration}
                    onChange={(e) => setQuoteDuration(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">Main d'œuvre (FCFA)</label>
                  <input
                    type="number"
                    value={quoteLabor}
                    onChange={(e) => setQuoteLabor(e.target.value)}
                    className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary uppercase block">Détails des matériaux</label>
                {quoteItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleQuoteItemChange(idx, 'name', e.target.value)}
                      placeholder="Nom du matériau"
                      className="flex-1 px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs"
                    />
                    <input
                      type="number"
                      value={item.qty}
                      onChange={(e) => handleQuoteItemChange(idx, 'qty', parseInt(e.target.value) || 0)}
                      placeholder="Qté"
                      className="w-16 px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs text-center"
                    />
                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) => handleQuoteItemChange(idx, 'price', parseInt(e.target.value) || 0)}
                      placeholder="Prix u."
                      className="w-24 px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs text-right"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddQuoteItem}
                  className="text-xs font-bold text-primary hover:text-primary-hover flex items-center gap-1 cursor-pointer"
                >
                  + Ajouter une ligne de matériau
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Observations</label>
                <textarea
                  value={quoteNotes}
                  onChange={(e) => setQuoteNotes(e.target.value)}
                  rows={2}
                  className="px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border-custom">
              <button
                type="button"
                onClick={() => setIsQuoteModalOpen(false)}
                className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleGenerateQuotePDF}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md flex items-center gap-1 cursor-pointer"
              >
                <FileText className="w-4 h-4" /> Générer pour impression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
