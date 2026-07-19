'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  ClipboardList,
  Calendar,
  Building2,
  DoorClosed,
  Users,
  FileText,
  TrendingUp,
  CreditCard,
  Zap,
  Receipt,
  Banknote,
  Wallet,
  Users2,
  Wrench,
  Hammer,
  CheckSquare,
  Layers,
  FolderOpen,
  BarChart3,
  UserCog,
  Shuffle,
  MapPin,
  MessageSquare,
  User,
  LogOut,
  Home
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  id?: string;
  label?: string;
  icon?: any;
  roles?: string[];
  section?: string;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout, hasRole } = useAuth();
  const pathname = usePathname();

  const menu: MenuItem[] = [
    { section: 'Principal' },
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['*'] },
    { id: 'rh', label: 'Ressources Humaines', icon: Users2, roles: ['*'] },
    { id: 'activity', label: 'Activité du jour', icon: ClipboardList, roles: ['super_admin', 'manager', 'dir_admin', 'dir_technique', 'gestionnaire', 'comptable', 'technicien'] },
    { id: 'calendar', label: 'Calendrier', icon: Calendar, roles: ['*'] },

    { section: 'Immobilier' },
    { id: 'properties', label: 'Immeubles', icon: Building2, roles: ['super_admin', 'manager', 'dir_admin', 'gestionnaire'] },
    { id: 'apartments', label: 'Logements', icon: DoorClosed, roles: ['super_admin', 'manager', 'dir_admin', 'gestionnaire'] },
    { id: 'tenants', label: 'Locataires', icon: Users, roles: ['super_admin', 'manager', 'dir_admin', 'gestionnaire'] },
    { id: 'leases', label: 'Contrats de bail', icon: FileText, roles: ['super_admin', 'manager', 'dir_admin', 'gestionnaire'] },
    { id: 'situation', label: 'Situation & rapports', icon: TrendingUp, roles: ['super_admin', 'manager', 'dir_admin', 'gestionnaire'] },

    { section: 'Finance' },
    { id: 'payments', label: 'Paiements', icon: CreditCard, roles: ['super_admin', 'manager', 'comptable', 'dir_admin', 'gestionnaire'] },
    { id: 'utilities', label: 'Charges & compteurs', icon: Zap, roles: ['super_admin', 'manager', 'comptable', 'dir_admin', 'gestionnaire'] },
    { id: 'expenses', label: 'Dépenses', icon: Receipt, roles: ['super_admin', 'manager', 'comptable', 'dir_technique'] },
    { id: 'salaries', label: 'Salaires & paie', icon: Banknote, roles: ['super_admin', 'manager', 'comptable'] },
    { id: 'my-salary', label: 'Mon salaire', icon: Wallet, roles: ['manager', 'dir_admin', 'dir_technique', 'gestionnaire', 'comptable', 'technicien'] },

    { section: 'Technique' },
    { id: 'maintenance', label: 'Maintenances', icon: Wrench, roles: ['super_admin', 'manager', 'dir_technique', 'gestionnaire', 'technicien'] },
    { id: 'equipment', label: 'Équipements', icon: Hammer, roles: ['super_admin', 'manager', 'dir_technique', 'comptable'] },
    { id: 'tasks', label: 'Tâches', icon: CheckSquare, roles: ['*'] },
    { id: 'kanban', label: 'Kanban tâches', icon: Layers, roles: ['*'] },

    { section: 'Administration' },
    { id: 'documents', label: 'Documents', icon: FolderOpen, roles: ['super_admin', 'manager', 'dir_admin', 'gestionnaire', 'comptable'] },
    { id: 'reports', label: 'Rapports', icon: BarChart3, roles: ['super_admin', 'manager', 'dir_admin', 'dir_technique', 'comptable'] },
    { id: 'users', label: 'Utilisateurs', icon: UserCog, roles: ['super_admin', 'manager'] },
    { id: 'workflows', label: 'Circuit Validation', icon: Shuffle, roles: ['super_admin', 'manager'] },
    { id: 'gps', label: 'Géolocalisation', icon: MapPin, roles: ['super_admin', 'manager', 'dir_technique'] },

    { section: 'Collaboration' },
    { id: 'messages', label: 'Messagerie', icon: MessageSquare, roles: ['*'] },

    { section: 'Compte' },
    { id: 'profile', label: 'Mon profil', icon: User, roles: ['*'] },
  ];

  const tenantMenu: MenuItem[] = [
    { section: 'Mon espace' },
    { id: 'dashboard', label: 'Accueil', icon: Home, roles: ['*'] },
    { id: 'my-lease', label: 'Mon bail', icon: FileText, roles: ['*'] },
    { id: 'my-payments', label: 'Mes paiements', icon: CreditCard, roles: ['*'] },
    { id: 'my-utilities', label: 'Mes charges', icon: Zap, roles: ['*'] },
    { id: 'my-maintenance', label: 'Mes demandes', icon: Wrench, roles: ['*'] },
    { section: 'Compte' },
    { id: 'profile', label: 'Mon profil', icon: User, roles: ['*'] },
  ];

  const role = user?.role?.name;
  const menuItems = role === 'locataire' ? tenantMenu : menu;

  const canAccess = (item: MenuItem) => {
    if (!item.roles) return true;
    if (item.roles.includes('*')) return true;
    return hasRole(...item.roles);
  };

  const getLinkHref = (itemId: string) => {
    if (itemId === 'dashboard') return '/dashboard';
    return `/dashboard/${itemId}`;
  };

  const isLinkActive = (itemId: string) => {
    const href = getLinkHref(itemId);
    if (itemId === 'dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 border-r border-border-custom bg-bg-sidebar transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center h-16 px-6 border-b border-border-custom bg-bg-surface select-none">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏢</span>
            <div className="font-bold text-lg tracking-wider text-text-primary">
              SMG <span className="text-primary font-extrabold">IMMO</span>
            </div>
          </div>
        </div>

        {/* Navigation Area */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 no-scrollbar">
          {menuItems.map((item, idx) => {
            if (item.section) {
              return (
                <div
                  key={`sec-${idx}`}
                  className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-text-muted select-none"
                >
                  {item.section}
                </div>
              );
            }

            if (!canAccess(item) || !item.id) return null;

            const IconComponent = item.icon;
            const active = isLinkActive(item.id);

            return (
              <Link
                key={item.id}
                href={getLinkHref(item.id)}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                }`}
              >
                <IconComponent className={`w-5 h-5 ${active ? 'text-primary' : 'text-text-muted group-hover:text-text-primary'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer Area with Logout */}
        <div className="p-4 border-t border-border-custom bg-bg-surface-2">
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
          >
            <LogOut className="w-5 h-5 text-red-500" />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
}
