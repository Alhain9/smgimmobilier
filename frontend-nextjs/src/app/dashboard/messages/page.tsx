'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { API, CONFIG } from '../../../services/api';
import { Communication } from '../../../utils/communication';
import { Helpers } from '../../../utils/helpers';
import { io, Socket } from 'socket.io-client';
import {
  MessageSquare,
  Search,
  Phone,
  Users,
  ExternalLink,
  Trash2,
  Plus,
  X,
  MessageCircle,
  Copy,
  Layers,
  Check,
  Send
} from 'lucide-react';

interface Contact {
  id: number;
  full_name: string;
  phone?: string | null;
  role?: {
    name: string;
    role_name?: string;
    label?: string;
  } | null;
}

interface WhatsAppGroup {
  id: string;
  name: string;
  description?: string | null;
  link: string;
}

interface MessageItem {
  id: number;
  sender_id: number;
  recipient_id: number;
  content: string;
  is_read: boolean;
  sender?: {
    id: number;
    full_name: string;
  } | null;
  recipient?: {
    id: number;
    full_name: string;
  } | null;
  created_at: string;
}

export default function MessagesPage() {
  const { user, hasRole } = useAuth();
  const { showSuccess, showError, showInfo } = useToast();

  const [activeLeftTab, setActiveLeftTab] = useState<'contacts' | 'groups'>('contacts');
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  
  // Chat state
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Create group form modal state
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupLink, setGroupLink] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Message broadcast state
  const [broadcastText, setBroadcastText] = useState('');
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setIsLoadingContacts(true);
    try {
      const res = await API.get('/users');
      if (res.data && user) {
        const list = res.data.filter((u: any) => u.id !== user.id);
        setContacts(list);
      }
    } catch (err: any) {
      showError(err.message || 'Impossible de charger la liste des contacts.');
    } finally {
      setIsLoadingContacts(false);
    }
  }, [user, showError]);

  const loadGroups = useCallback(async () => {
    setIsLoadingGroups(true);
    try {
      const res = await API.get('/rh/whatsapp-groups');
      if (res.data) {
        setGroups(res.data);
      }
    } catch (err: any) {
      showError(err.message || 'Erreur lors du chargement des groupes WhatsApp.');
    } finally {
      setIsLoadingGroups(false);
    }
  }, [showError]);

  const loadConversation = useCallback(async (contactId: number) => {
    setIsLoadingMessages(true);
    try {
      const res = await API.get(`/messages/${contactId}`);
      if (res.data) {
        setMessages(res.data);
      }
    } catch (err: any) {
      showError(err.message || 'Impossible de charger la conversation.');
    } finally {
      setIsLoadingMessages(false);
    }
  }, [showError]);

  useEffect(() => {
    if (user) {
      loadContacts();
      loadGroups();
    }
  }, [user, loadContacts, loadGroups]);

  // Real-time Chat Socket Connection
  useEffect(() => {
    if (!selectedContact || !user) return;
    const token = API.token();
    if (!token) return;

    // Connect to WebSocket Server
    const socket: Socket = io(CONFIG.SERVER_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('🔌 Socket.IO connecté dans Messages Page');
    });

    socket.on('message:nouveau', (data: any) => {
      console.log('✉️ Reçu message:nouveau', data);
      // Append if message belongs to active chat session
      if (
        (data.sender_id === selectedContact.id && data.recipient_id === user.id) ||
        (data.sender_id === user.id && data.recipient_id === selectedContact.id)
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data];
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedContact, user]);

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSelectContact = (c: Contact) => {
    setSelectedContact(c);
    loadConversation(c.id);
  };

  const handleSendInternal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedContact) return;
    if (!messageText.trim()) return;

    try {
      const res = await API.post('/messages', {
        recipient_id: selectedContact.id,
        content: messageText.trim()
      });
      if (res.data) {
        setMessages((prev) => [...prev, res.data]);
        setMessageText('');
      }
    } catch (err: any) {
      showError(err.message || 'Erreur lors de l\'envoi du message.');
    }
  };

  const handleSendWhatsApp = () => {
    if (!selectedContact) return;
    if (!selectedContact.phone) {
      showError("Numéro de téléphone manquant pour ce contact.");
      return;
    }
    if (!messageText.trim()) {
      showInfo("Veuillez saisir votre message d'abord.");
      return;
    }
    
    const url = Communication.whatsappLink(selectedContact.phone, messageText.trim());
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  const handleOpenWhatsApp = (c: Contact) => {
    if (!c.phone) {
      showError("Numéro de téléphone manquant pour ce contact.");
      return;
    }
    const msg = `Bonjour ${c.full_name}, je te contacte depuis la plateforme SMG IMMOBILIER.`;
    const url = Communication.whatsappLink(c.phone, msg);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  const handleCall = (c: Contact) => {
    if (!c.phone) {
      showError("Numéro de téléphone manquant pour ce contact.");
      return;
    }
    const url = Communication.callLink(c.phone);
    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  };

  const handleAddGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName || !groupLink) {
      showError('Le nom du groupe et le lien d\'invitation sont requis.');
      return;
    }
    if (!groupLink.startsWith('http://') && !groupLink.startsWith('https://')) {
      showError('Le lien du groupe doit commencer par http:// ou https://');
      return;
    }

    setIsCreatingGroup(true);
    try {
      await API.post('/rh/whatsapp-groups', {
        name: groupName.trim(),
        link: groupLink.trim(),
        description: groupDescription.trim() || null
      });
      showSuccess('Groupe WhatsApp enregistré.');
      setIsAddGroupOpen(false);
      setGroupName('');
      setGroupLink('');
      setGroupDescription('');
      loadGroups();
    } catch (err: any) {
      showError(err.message || 'Impossible d\'ajouter le groupe.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce groupe WhatsApp de la plateforme ?')) return;
    try {
      await API.delete(`/rh/whatsapp-groups/${id}`);
      showSuccess('Groupe supprimé.');
      loadGroups();
    } catch (err: any) {
      showError(err.message || 'Impossible de supprimer le groupe.');
    }
  };

  const handleBroadcast = async (group: WhatsAppGroup) => {
    if (!broadcastText.trim()) {
      showInfo("Veuillez saisir votre message dans la zone de texte avant de diffuser.");
      return;
    }

    try {
      await navigator.clipboard.writeText(broadcastText);
      setCopiedGroupId(group.id);
      showSuccess("Message copié dans le presse-papiers !");
      showInfo("Redirection vers le groupe WhatsApp... Veuillez coller votre texte.");

      setTimeout(() => {
        setCopiedGroupId(null);
        if (typeof window !== 'undefined') {
          window.open(group.link, '_blank');
        }
      }, 1000);
    } catch (err) {
      showError("Échec de la copie automatique. Veuillez copier manuellement le texte.");
    }
  };

  const filteredContacts = contacts.filter((c) =>
    c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.role?.label || c.role?.role_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canManageGroups = hasRole('super_admin', 'manager', 'dir_admin');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">💬 Espace Collaboration & Messagerie</h2>
          <p className="text-xs font-semibold text-text-muted mt-1 uppercase tracking-wider">
            Échangez via la messagerie interne ou communiquez sur WhatsApp avec vos collaborateurs
          </p>
        </div>
        {canManageGroups && (
          <button
            onClick={() => setIsAddGroupOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer transition-all animate-fade-in"
          >
            <Plus className="w-4 h-4" /> Ajouter un groupe
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-190px)] min-h-[580px]">
        {/* Left Side: Directory & WhatsApp Groups (4/12) */}
        <div className="lg:col-span-4 flex flex-col gap-4 h-full overflow-hidden">
          {/* Tabs switch */}
          <div className="flex bg-bg-surface border border-border-custom p-1 rounded-2xl shadow-xs select-none shrink-0">
            <button
              onClick={() => setActiveLeftTab('contacts')}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeLeftTab === 'contacts'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              👤 Collaborateurs
            </button>
            <button
              onClick={() => setActiveLeftTab('groups')}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeLeftTab === 'groups'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              🟢 Groupes WhatsApp
            </button>
          </div>

          {/* Left panel body */}
          <div className="flex-1 rounded-2xl border border-border-custom bg-bg-surface p-4 shadow-sm overflow-hidden flex flex-col min-h-0">
            {activeLeftTab === 'contacts' ? (
              <div className="flex flex-col h-full gap-3 min-h-0">
                {/* Directory Search */}
                <div className="relative shrink-0">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher un contact..."
                    className="w-full pl-10 pr-4 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary rounded-xl font-semibold text-text-primary"
                  />
                </div>

                {/* Contacts List */}
                <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-border-custom/40 pr-0.5">
                  {isLoadingContacts ? (
                    <div className="flex justify-center items-center py-20 text-text-muted text-xs font-semibold">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-1.5" />
                      Chargement des contacts...
                    </div>
                  ) : filteredContacts.length > 0 ? (
                    filteredContacts.map((c) => {
                      const isSelected = selectedContact?.id === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => handleSelectContact(c)}
                          className={`flex items-center justify-between p-3 my-1 rounded-xl cursor-pointer border transition-all ${
                            isSelected
                              ? 'bg-primary/10 border-primary/25 text-primary'
                              : 'bg-transparent border-transparent hover:bg-bg-hover hover:border-border-custom/55'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 transition-colors ${
                              isSelected ? 'bg-primary text-white' : 'bg-primary/10 border border-primary/20 text-primary'
                            }`}>
                              {c.full_name ? c.full_name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-extrabold text-text-primary leading-tight truncate">
                                {c.full_name}
                              </h4>
                              <span className="text-[9px] text-text-muted font-extrabold uppercase tracking-wider block mt-0.5">
                                {c.role?.label || c.role?.role_name || 'Employé'}
                              </span>
                            </div>
                          </div>
                          {c.phone && (
                            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="WhatsApp disponible" />
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-20 text-text-muted text-xs font-semibold">
                      Aucun collaborateur trouvé
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full gap-4 min-h-0">
                {/* Broadcast helper */}
                <div className="rounded-xl border border-border-custom bg-bg-surface-2 p-3.5 shadow-xs space-y-2 shrink-0">
                  <h4 className="text-[10px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-green-500" /> Assistant de diffusion
                  </h4>
                  <textarea
                    value={broadcastText}
                    onChange={(e) => setBroadcastText(e.target.value)}
                    placeholder="Saisissez ici le message à diffuser..."
                    rows={2}
                    className="w-full px-3 py-2 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-text-primary"
                  />
                </div>

                {/* Groups list */}
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pr-0.5">
                  {isLoadingGroups ? (
                    <div className="flex justify-center items-center py-20 text-text-muted text-xs font-semibold">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-1.5" />
                      Chargement des groupes...
                    </div>
                  ) : groups.length > 0 ? (
                    groups.map((grp) => (
                      <div
                        key={grp.id}
                        className="rounded-xl border border-border-custom bg-bg-surface-2 p-3 shadow-xs space-y-2.5 relative group"
                      >
                        {canManageGroups && (
                          <button
                            onClick={() => handleDeleteGroup(grp.id)}
                            className="absolute top-3 right-3 p-1 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors"
                            title="Supprimer ce groupe"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div className="flex items-center gap-2.5">
                          <div className="w-7.5 h-7.5 rounded-lg bg-green-500 flex items-center justify-center font-bold text-white text-[11px] shrink-0 select-none">
                            WA
                          </div>
                          <h4 className="text-xs font-bold text-text-primary leading-tight max-w-[80%] truncate">
                            {grp.name}
                          </h4>
                        </div>
                        {grp.description && (
                          <p className="text-[10px] text-text-secondary leading-relaxed line-clamp-2">
                            {grp.description}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <a
                            href={grp.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 border border-green-500/20 bg-green-500/10 hover:bg-green-500/15 text-[9px] font-bold text-green-600 rounded-xl transition-all shadow-xs"
                          >
                            Rejoindre <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                          <button
                            onClick={() => handleBroadcast(grp)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 border border-primary/20 bg-primary/10 hover:bg-primary/15 text-[9px] font-bold text-primary rounded-xl transition-all shadow-xs cursor-pointer"
                          >
                            {copiedGroupId === grp.id ? (
                              <>
                                <Check className="w-2.5 h-2.5 text-green-600 animate-scale-up" /> Copié
                              </>
                            ) : (
                              <>
                                <Copy className="w-2.5 h-2.5" /> Diffuser
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 text-text-muted text-xs font-semibold">
                      Aucun groupe configuré
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Active Conversation workspace (8/12) */}
        <div className="lg:col-span-8 h-full">
          {selectedContact ? (
            <div className="rounded-2xl border border-border-custom bg-bg-surface flex flex-col h-full overflow-hidden shadow-sm">
              {/* Active chat header */}
              <div className="flex justify-between items-center px-5 py-4 border-b border-border-custom bg-bg-surface-2 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9.5 h-9.5 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs uppercase">
                    {selectedContact.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-text-primary leading-tight">
                      {selectedContact.full_name}
                    </h3>
                    <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider block mt-0.5">
                      {selectedContact.role?.label || selectedContact.role?.role_name || 'Collaborateur'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedContact.phone && (
                    <>
                      <button
                        onClick={() => handleOpenWhatsApp(selectedContact)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-green-500/20 bg-green-500/10 hover:bg-green-500/15 text-[10px] font-bold text-green-600 rounded-xl transition-all cursor-pointer"
                      >
                        🟢 WhatsApp
                      </button>
                      <button
                        onClick={() => handleCall(selectedContact)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border-custom bg-bg-body hover:bg-bg-hover text-[10px] font-bold text-text-secondary rounded-xl transition-all cursor-pointer"
                      >
                        <Phone className="w-3 h-3" /> Appeler
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setSelectedContact(null)}
                    className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                    title="Fermer la discussion"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Chat Message feed view */}
              <div className="flex-1 p-5 overflow-y-auto no-scrollbar bg-bg-body/30 space-y-4 min-h-0">
                {isLoadingMessages ? (
                  <div className="flex flex-col items-center justify-center h-full text-text-muted text-xs font-semibold">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                    Chargement de la conversation...
                  </div>
                ) : messages.length > 0 ? (
                  <div className="space-y-3.5 pr-1">
                    {messages.map((msg, idx) => {
                      const isMe = msg.sender_id === user?.id;
                      return (
                        <div
                          key={msg.id || idx}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-xs shadow-xs relative ${
                              isMe
                                ? 'bg-primary text-white rounded-tr-none'
                                : 'bg-bg-surface border border-border-custom text-text-primary rounded-tl-none'
                            }`}
                          >
                            <p className="leading-relaxed font-semibold break-words whitespace-pre-wrap">{msg.content}</p>
                            <span
                              className={`text-[8px] block mt-1 text-right select-none ${
                                isMe ? 'text-white/60' : 'text-text-muted'
                              }`}
                            >
                              {Helpers.formatDateTime(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center text-text-muted space-y-2 select-none">
                    <MessageSquare className="w-12 h-12 text-border-custom" />
                    <p className="text-xs italic">Aucun message échangé. Écrivez un message ci-dessous.</p>
                  </div>
                )}
              </div>

              {/* Chat input form composer */}
              <form
                onSubmit={handleSendInternal}
                className="p-4 border-t border-border-custom bg-bg-surface-2 flex flex-col gap-3 shrink-0"
              >
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Écrire un message..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary rounded-xl text-xs font-semibold text-text-primary"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendInternal();
                    }
                  }}
                />
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-text-muted italic hidden sm:block">
                    Appuyez sur Entrée pour envoyer en interne
                  </span>
                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    {selectedContact.phone && (
                      <button
                        type="button"
                        onClick={handleSendWhatsApp}
                        disabled={!messageText.trim()}
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-green-500/20 bg-green-500/10 hover:bg-green-500/15 text-[10px] font-bold text-green-600 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-40"
                        title="Ouvre WhatsApp pour envoyer ce message à l'externe"
                      >
                        🟢 Envoyer sur WhatsApp
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={!messageText.trim()}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4.5 py-2 bg-primary hover:bg-primary-hover text-white text-[10px] font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" /> Envoyer (Interne)
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            <div className="rounded-2xl border border-border-custom bg-bg-surface/50 border-dashed flex flex-col items-center justify-center h-full p-8 text-center text-text-muted select-none">
              <div className="w-16 h-16 rounded-full bg-bg-surface border border-border-custom flex items-center justify-center mb-4 shadow-xs">
                <MessageSquare className="w-7 h-7 text-text-muted" />
              </div>
              <h3 className="text-sm font-bold text-text-primary mb-1">Messagerie Interne & WhatsApp</h3>
              <p className="text-xs max-w-sm text-text-secondary leading-relaxed font-semibold">
                Sélectionnez un collaborateur dans la liste de gauche pour afficher l'historique ou composer un message. Vous pourrez choisir de l'envoyer en interne ou de l'externaliser sur WhatsApp.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ADD WHATSAPP GROUP MODAL */}
      {isAddGroupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-border-custom bg-bg-surface p-6 shadow-2xl my-8 animate-slide-in flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-border-custom">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                👥 Ajouter un groupe WhatsApp
              </h3>
              <button
                onClick={() => setIsAddGroupOpen(false)}
                className="p-1 rounded-lg hover:bg-bg-hover cursor-pointer text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddGroupSubmit} className="py-4 space-y-4 text-sm font-semibold">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Nom du groupe *</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Ex: Équipe de Maintenance Technique"
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Lien d'invitation WhatsApp *</label>
                <input
                  type="text"
                  value={groupLink}
                  onChange={(e) => setGroupLink(e.target.value)}
                  placeholder="Ex: https://chat.whatsapp.com/..."
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl focus:outline-none text-xs transition-all focus:ring-1 focus:ring-primary focus:border-primary"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Description</label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="Explications ou règles d'usage du canal de communication..."
                  rows={2}
                  className="px-3.5 py-2.5 border border-border-custom bg-bg-body focus:bg-bg-surface rounded-xl text-sm"
                />
              </div>

              <div className="pt-4 border-t border-border-custom flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddGroupOpen(false)}
                  className="px-4 py-2 border border-border-custom rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-hover cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreatingGroup}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isCreatingGroup ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
