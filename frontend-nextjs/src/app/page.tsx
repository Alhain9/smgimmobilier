'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, ArrowRight, Check } from 'lucide-react';

export default function Home() {
  const { theme, toggleTheme } = useTheme();

  const services = [
    { icon: '🏢', title: 'Gestion des immeubles', desc: "Gérez vos immeubles, appartements, statuts d'occupation et historique en temps réel." },
    { icon: '👤', title: 'Suivi des locataires', desc: 'Dossiers locataires complets : coordonnées, CNI, contrats et historique de paiement.' },
    { icon: '📄', title: 'Contrats de bail', desc: 'Création de baux, upload de PDF signés et consultation par le locataire.' },
    { icon: '💰', title: 'Paiements & dettes', desc: 'Loyers, justificatifs Orange Money / MTN / virement et suivi des impayés.' },
    { icon: '🔧', title: 'Maintenances', desc: 'Tickets, assignation des techniciens et photos avant / pendant / après travaux.' },
    { icon: '📊', title: 'Tableaux de bord', desc: 'Un dashboard adapté à chaque rôle avec statistiques et indicateurs clés.' },
  ];

  const features = [
    { icon: '🛠', title: 'Dépenses & équipements', desc: 'Gérez le stock (peinture, ciment, plomberie…), les quantités et les coûts.' },
    { icon: '📸', title: "Photos d'intervention", desc: 'Documentez chaque travaux avec galerie avant / pendant / après.' },
    { icon: '📅', title: 'Calendrier interne', desc: 'Vues jour / semaine / mois pour tâches, échéances et maintenances.' },
    { icon: '✅', title: 'Gestion des tâches', desc: 'Assignez et suivez les tâches des équipes techniques et administratives.' },
    { icon: '🔐', title: 'Rôles & permissions', desc: 'Système RBAC avec 8 rôles : du super-admin au locataire.' },
    { icon: '🌗', title: 'Mode clair / sombre', desc: 'Interface confortable de jour comme de nuit, selon vos préférences.' },
  ];

  const advantages = [
    'Centralisation totale',
    'Collaboration en équipe',
    'Sécurité renforcée (JWT)',
    'Suivi financier clair',
    '100% Responsive',
    'Interface premium moderne',
  ];

  const testimonials = [
    { text: '« La plateforme nous a fait gagner un temps précieux sur le suivi des loyers et des impayés. Tout est centralisé. »', author: 'Marc M.', role: 'Directeur Général', initials: 'MM' },
    { text: '« Je reçois mes interventions et j\'envoie mes photos avant/après directement depuis mon espace technicien. Très pratique. »', author: 'Théo T.', role: 'Technicien', initials: 'TT' },
    { text: '« En tant que locataire, je consulte mon bail et mes paiements en ligne, et je signale mes problèmes en un clic. »', author: 'Jean L.', role: 'Locataire', initials: 'JL' },
  ];

  return (
    <div className="min-h-screen bg-bg-body text-text-primary flex flex-col font-sans transition-colors duration-250">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-40 w-full border-b border-border-custom bg-bg-surface/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 font-extrabold text-lg select-none">
            <span className="text-2xl">🏢</span>
            <span>
              SMG <span className="text-primary">IMMOBILIER</span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
              title="Changer de thème"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <Link
              href="/login"
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-hover shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              Connexion
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <header className="relative py-24 md:py-32 flex items-center justify-center text-center overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b border-border-custom">
        <div className="relative z-10 max-w-4xl mx-auto px-6 flex flex-col items-center gap-6">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/15 text-primary tracking-wide uppercase">
            Plateforme Professionnelle
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
            La gestion immobilière,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-sky-500">
              simplifiée et centralisée
            </span>
          </h1>
          <p className="max-w-2xl text-lg text-text-secondary leading-relaxed">
            SMG IMMOBILIER digitalise la gestion de vos immeubles, locataires, contrats, paiements et maintenances dans une seule plateforme moderne et sécurisée.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full sm:w-auto">
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-base font-semibold bg-primary text-white hover:bg-primary-hover shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              Accéder à la plateforme <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#services"
              className="flex items-center justify-center px-6 py-3 rounded-xl text-base font-semibold border border-border-custom bg-bg-surface hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            >
              Découvrir les services
            </a>
          </div>
        </div>
      </header>

      {/* SERVICES SECTION */}
      <section className="py-20 max-w-7xl mx-auto px-6 w-full" id="services">
        <div className="text-center max-w-3xl mx-auto mb-16 flex flex-col gap-3">
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">Nos Services</span>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Une solution complète pour SMG IMMOBILIER
          </h2>
          <p className="text-text-secondary">
            Centralisez toutes les opérations immobilières, administratives, financières et techniques de l'entreprise.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((s, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl border border-border-custom bg-bg-surface shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300"
            >
              <div className="w-12 h-12 flex items-center justify-center text-2xl rounded-xl bg-primary/10 text-primary mb-5 select-none">
                {s.icon}
              </div>
              <h3 className="text-lg font-bold mb-2 text-text-primary">{s.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* STATS BAND */}
      <section className="py-12 border-y border-border-custom bg-bg-surface-2">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl md:text-5xl font-extrabold text-primary">8</div>
            <div className="text-xs font-medium text-text-muted uppercase tracking-wider mt-2">Rôles utilisateurs</div>
          </div>
          <div>
            <div className="text-3xl md:text-5xl font-extrabold text-primary">12+</div>
            <div className="text-xs font-medium text-text-muted uppercase tracking-wider mt-2">Modules de gestion</div>
          </div>
          <div>
            <div className="text-3xl md:text-5xl font-extrabold text-primary">100%</div>
            <div className="text-xs font-medium text-text-muted uppercase tracking-wider mt-2">Sécurisé (JWT)</div>
          </div>
          <div>
            <div className="text-3xl md:text-5xl font-extrabold text-primary">24/7</div>
            <div className="text-xs font-medium text-text-muted uppercase tracking-wider mt-2">Accès plateforme</div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="py-20 bg-bg-surface-2/50" id="features">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 flex flex-col gap-3">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Fonctionnalités</span>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Tout ce dont l'entreprise a besoin
            </h2>
            <p className="text-text-secondary">
              Des outils pensés pour les équipes administratives, techniques et financières.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl border border-border-custom bg-bg-surface shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300"
              >
                <div className="w-12 h-12 flex items-center justify-center text-2xl rounded-xl bg-primary/10 text-primary mb-5 select-none">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold mb-2 text-text-primary">{f.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ADVANTAGES SECTION */}
      <section className="py-20 max-w-7xl mx-auto px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="flex flex-col gap-6">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Avantages</span>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
              Pourquoi choisir la plateforme SMG IMMOBILIER ?
            </h2>
            <p className="text-text-secondary leading-relaxed">
              En numérisant la totalité du parcours de gestion locative, la direction, les comptables, les techniciens et les locataires interagissent sur une interface unique.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              {advantages.map((a, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-semibold text-text-secondary">{a}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative rounded-2xl border border-border-custom bg-bg-surface p-8 shadow-lg overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -z-10" />
            <h3 className="text-xl font-bold mb-4">Système d'information sécurisé</h3>
            <p className="text-sm text-text-secondary leading-relaxed mb-6">
              L'architecture découple l'interface utilisateur de la couche d'accès aux données. Les droits d'accès sont vérifiés dynamiquement par rôle et par jeton d'authentification unique.
            </p>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-bg-body border border-border-custom">
                <div className="text-xs font-bold uppercase tracking-wide text-text-muted">Sécurité</div>
                <div className="text-sm font-semibold text-text-primary mt-1">Chiffrement de bout en bout & JWT</div>
              </div>
              <div className="p-4 rounded-xl bg-bg-body border border-border-custom">
                <div className="text-xs font-bold uppercase tracking-wide text-text-muted">Authentification</div>
                <div className="text-sm font-semibold text-text-primary mt-1">Hachage Bcrypt & Sessions persistantes</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS SECTION */}
      <section className="py-20 bg-bg-surface-2/50 border-t border-border-custom">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 flex flex-col gap-3">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Témoignages</span>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Ils utilisent la plateforme
            </h2>
            <p className="text-text-secondary">
              La parole aux équipes et partenaires de l'entreprise au quotidien.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl border border-border-custom bg-bg-surface shadow-sm flex flex-col justify-between"
              >
                <p className="text-sm text-text-secondary leading-relaxed italic">{t.text}</p>
                <div className="flex items-center gap-3 mt-6">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold select-none">
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-text-primary">{t.author}</div>
                    <div className="text-xs text-text-muted">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-20 max-w-3xl mx-auto px-6 w-full" id="faq">
        <div className="text-center mb-16 flex flex-col gap-3">
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">FAQ</span>
          <h2 className="text-3xl font-extrabold tracking-tight">Questions fréquentes</h2>
        </div>

        <div className="space-y-4">
          <details className="group border border-border-custom rounded-2xl bg-bg-surface p-4 [&_summary::-webkit-details-marker]:hidden cursor-pointer">
            <summary className="flex items-center justify-between font-bold text-text-primary text-sm sm:text-base">
              <span>Qui peut créer un compte utilisateur ?</span>
              <span className="transition group-open:-rotate-180">▼</span>
            </summary>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              Tous les comptes (personnel et locataires) sont créés par le Directeur Général (manager) ou une personne qu'il a déléguée, depuis le tableau de bord. Il n'y a pas d'inscription publique pour garantir la confidentialité des données.
            </p>
          </details>

          <details className="group border border-border-custom rounded-2xl bg-bg-surface p-4 [&_summary::-webkit-details-marker]:hidden cursor-pointer">
            <summary className="flex items-center justify-between font-bold text-text-primary text-sm sm:text-base">
              <span>Comment s'effectuent les paiements ?</span>
              <span className="transition group-open:-rotate-180">▼</span>
            </summary>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              Les locataires peuvent déclarer leurs paiements via Orange Money, MTN MoMo, virement bancaire ou espèces, puis charger le justificatif sur leur espace. Le comptable valide ensuite la transaction pour mettre à jour la situation.
            </p>
          </details>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto py-8 border-t border-border-custom bg-bg-surface-2 text-center text-xs text-text-muted">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>© 2026 SMG IMMOBILIER. Tous droits réservés.</div>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-text-primary transition-colors">Accueil</Link>
            <Link href="/login" className="hover:text-text-primary transition-colors">Connexion</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
