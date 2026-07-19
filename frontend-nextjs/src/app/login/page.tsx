'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { Sun, Moon, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showError, showSuccess } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      showError('Veuillez remplir tous les champs.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      showSuccess('Connexion réussie');
    } catch (err: any) {
      showError(err.message || 'Identifiants incorrects.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-body text-text-primary grid grid-cols-1 lg:grid-cols-2 select-none font-sans">
      {/* Left branding panel - Hidden on mobile */}
      <div className="hidden lg:flex flex-col justify-center px-16 bg-gradient-to-br from-primary to-sky-600 text-white relative overflow-hidden">
        {/* Decorative circle shapes */}
        <div className="absolute -top-16 -left-16 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-16 w-96 h-96 bg-white/10 rounded-full blur-3xl" />

        <div className="relative max-w-md flex flex-col gap-6">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl shadow-inner">
            🏢
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight">SMG IMMOBILIER</h2>
          <p className="text-white/90 text-base leading-relaxed">
            Plateforme centralisée de gestion immobilière, administrative, financière et technique.
          </p>
          <ul className="mt-4 space-y-4">
            {[
              { icon: '🏢', text: 'Gestion des immeubles & logements' },
              { icon: '📄', text: 'Contrats de bail & documents' },
              { icon: '💰', text: 'Paiements & suivi financier' },
              { icon: '🔧', text: 'Maintenances & interventions techniques' },
            ].map((item, idx) => (
              <li key={idx} className="flex items-center gap-3.5 text-sm font-semibold tracking-wide">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-lg">
                  {item.icon}
                </span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right form container */}
      <div className="flex flex-col items-center justify-center p-8 sm:p-12 relative bg-bg-surface">
        {/* Top bar controls */}
        <div className="absolute top-6 right-6 flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
            title="Changer de thème"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <Link
            href="/"
            className="p-2 rounded-xl text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors flex items-center gap-1"
            title="Retour à l'accueil"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>

        {/* Login form card */}
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Connexion</h1>
          <p className="text-sm text-text-secondary mt-1">Accédez à votre espace SMG IMMOBILIER</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                Adresse email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@smg.com"
                className="w-full px-4 py-3 rounded-xl border border-border-custom bg-bg-body focus:bg-bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-border-custom bg-bg-body focus:bg-bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all"
                required
              />
            </div>

            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-primary hover:text-primary-hover"
              >
                Mot de passe oublié ?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-hover shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {isSubmitting ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
