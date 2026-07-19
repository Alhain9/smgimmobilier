'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function UnderConstructionPage() {
  const pathname = usePathname();
  const pageName = pathname.split('/').pop() || '';

  const formattedName = pageName.charAt(0).toUpperCase() + pageName.slice(1);

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh] border border-dashed border-border-custom rounded-2xl bg-bg-surface shadow-sm animate-slide-in">
      <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-6">
        <AlertCircle className="w-8 h-8" />
      </div>
      
      <h3 className="text-xl font-extrabold tracking-tight text-text-primary">
        Module "{formattedName}" en construction
      </h3>
      <p className="text-sm text-text-secondary mt-2 max-w-md leading-relaxed">
        Ce module est en cours de migration vers Next.js. Vous pouvez tester les pages déjà prêtes à l'emploi :
      </p>

      <div className="flex flex-wrap justify-center gap-3 mt-6">
        <Link
          href="/dashboard/properties"
          className="px-4 py-2 text-xs font-bold bg-primary/10 text-primary hover:bg-primary/15 rounded-xl transition-colors cursor-pointer"
        >
          🏢 Voir les Immeubles
        </Link>
        <Link
          href="/dashboard/tenants"
          className="px-4 py-2 text-xs font-bold bg-primary/10 text-primary hover:bg-primary/15 rounded-xl transition-colors cursor-pointer"
        >
          👥 Voir les Locataires
        </Link>
      </div>

      <Link
        href="/dashboard"
        className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-primary mt-8 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Retour au tableau de bord
      </Link>
    </div>
  );
}
