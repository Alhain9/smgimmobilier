'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { usePathname } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Déterminer le titre du Topbar en fonction de l'URL
  const getPageTitle = () => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length <= 1) return 'Tableau de bord';
    const section = segments[1];

    const map: Record<string, string> = {
      activity: 'Activité du jour',
      calendar: 'Calendrier',
      properties: 'Gestion des Immeubles',
      apartments: 'Gestion des Logements',
      tenants: 'Gestion des Locataires',
      leases: 'Contrats de bail',
      situation: 'Situation & rapports',
      payments: 'Suivi des paiements',
      utilities: 'Charges & compteurs',
      expenses: 'Suivi des dépenses',
      salaries: 'Salaires & paie',
      'my-salary': 'Mon salaire',
      rh: 'Ressources Humaines',
      maintenance: 'Maintenances',
      equipment: 'Gestion des Équipements',
      tasks: 'Gestion des Tâches',
      kanban: 'Tableau Kanban',
      documents: 'Documents',
      reports: 'Rapports statistiques',
      users: 'Comptes utilisateurs',
      workflows: 'Circuit de validation',
      gps: 'Géolocalisation',
      messages: 'Messagerie interne',
      profile: 'Mon Profil',
    };

    return map[section] || 'SMG IMMOBILIER';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-body flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-text-secondary">Chargement de votre session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Le hook useAuth effectue la redirection
  }

  return (
    <div className="min-h-screen flex bg-bg-body text-text-primary overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <Topbar
          title={getPageTitle()}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 no-scrollbar bg-bg-body">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
