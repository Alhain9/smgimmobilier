import { CONFIG } from '../services/api';

export const Helpers = {
  formatMoney(amount: number | string | null | undefined): string {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
    return new Intl.NumberFormat('fr-FR').format(numericAmount) + ' FCFA';
  },

  formatDate(date: string | Date | null | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  },

  formatDateTime(date: string | Date | null | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  initials(name: string | null | undefined): string {
    if (!name) return '?';
    return name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  },

  statusBadge(status: string): { label: string; className: string } {
    const map: Record<string, [string, string]> = {
      // appartements
      free: ['bg-green-500/10 text-green-500 border-green-500/20', 'Libre'],
      occupied: ['bg-sky-500/10 text-sky-500 border-sky-500/20', 'Occupé'],
      reserved: ['bg-amber-500/10 text-amber-500 border-amber-500/20', 'Réservé'],
      // paiements
      completed: ['bg-green-500/10 text-green-500 border-green-500/20', 'Payé'],
      pending: ['bg-amber-500/10 text-amber-500 border-amber-500/20', 'En attente'],
      awaiting_confirmation: ['bg-sky-500/10 text-sky-500 border-sky-500/20', 'À vérifier'],
      failed: ['bg-red-500/10 text-red-500 border-red-500/20', 'Échoué'],
      refunded: ['bg-slate-500/10 text-slate-500 border-slate-500/20', 'Remboursé'],
      // maintenance / général
      reported: ['bg-amber-500/10 text-amber-500 border-amber-500/20', 'Signalé'],
      in_progress: ['bg-sky-500/10 text-sky-500 border-sky-500/20', 'En cours'],
      active: ['bg-green-500/10 text-green-500 border-green-500/20', 'Actif'],
      inactive: ['bg-slate-500/10 text-slate-500 border-slate-500/20', 'Inactif'],
      suspended: ['bg-red-500/10 text-red-500 border-red-500/20', 'Suspendu'],
      terminated: ['bg-red-500/10 text-red-500 border-red-500/20', 'Résilié'],
      expired: ['bg-slate-500/10 text-slate-500 border-slate-500/20', 'Expiré'],
      cancelled: ['bg-slate-500/10 text-slate-500 border-slate-500/20', 'Annulé'],
      // équipements
      available: ['bg-green-500/10 text-green-500 border-green-500/20', 'Disponible'],
      in_use: ['bg-sky-500/10 text-sky-500 border-sky-500/20', 'Utilisé'],
      out_of_stock: ['bg-red-500/10 text-red-500 border-red-500/20', 'Rupture'],
      maintenance: ['bg-amber-500/10 text-amber-500 border-amber-500/20', 'Maintenance'],
    };

    const [cls, label] = map[status] || ['bg-slate-500/10 text-slate-500 border-slate-500/20', status];
    return { label, className: `border px-2 py-0.5 rounded-full text-xs font-semibold ${cls}` };
  },

  maintStatus(status: string): { label: string; className: string } {
    const map: Record<string, [string, string]> = {
      reported: ['bg-amber-500/10 text-amber-500 border-amber-500/20', 'Signalé'],
      validated: ['bg-primary/10 text-primary border-primary/20', 'Validé'],
      in_progress: ['bg-sky-500/10 text-sky-500 border-sky-500/20', 'En cours'],
      completed: ['bg-green-500/10 text-green-500 border-green-500/20', 'Terminé'],
      cancelled: ['bg-slate-500/10 text-slate-500 border-slate-500/20', 'Annulé'],
    };
    const [cls, label] = map[status] || ['bg-slate-500/10 text-slate-500 border-slate-500/20', status];
    return { label, className: `border px-2 py-0.5 rounded-full text-xs font-semibold ${cls}` };
  },

  propertyType(t: string): string {
    const map: Record<string, string> = {
      immeuble: '🏢 Immeuble',
      maison: '🏠 Maison',
      terrain: '🌍 Terrain',
    };
    return map[t] || t;
  },

  taskStatus(status: string): { label: string; className: string } {
    const map: Record<string, [string, string]> = {
      pending: ['bg-amber-500/10 text-amber-500 border-amber-500/20', 'À faire'],
      in_progress: ['bg-sky-500/10 text-sky-500 border-sky-500/20', 'En cours'],
      completed: ['bg-green-500/10 text-green-500 border-green-500/20', 'Effectuée'],
      not_done: ['bg-red-500/10 text-red-500 border-red-500/20', 'Non effectuée'],
      cancelled: ['bg-slate-500/10 text-slate-500 border-slate-500/20', 'Annulé'],
    };
    const [cls, label] = map[status] || ['bg-slate-500/10 text-slate-500 border-slate-500/20', status];
    return { label, className: `border px-2 py-0.5 rounded-full text-xs font-semibold ${cls}` };
  },

  priorityBadge(p: string): { label: string; className: string } {
    const map: Record<string, [string, string]> = {
      low: ['bg-slate-500/10 text-slate-500 border-slate-500/20', 'Basse'],
      medium: ['bg-sky-500/10 text-sky-500 border-sky-500/20', 'Normale'],
      high: ['bg-amber-500/10 text-amber-500 border-amber-500/20', 'Haute'],
      urgent: ['bg-red-500/10 text-red-500 border-red-500/20', 'Urgente'],
    };
    const [cls, label] = map[p] || ['bg-slate-500/10 text-slate-500 border-slate-500/20', p];
    return { label, className: `border px-2 py-0.5 rounded-full text-xs font-semibold ${cls}` };
  },

  methodLabel(m: string): string {
    const map: Record<string, string> = {
      orange_money: 'Orange Money',
      mtn_mobile_money: 'MTN MoMo',
      bank_transfer: 'Virement',
      cash: 'Espèces',
      campay: 'Mobile Money',
      kang: 'Mobile Money (Kang)',
    };
    return map[m] || m;
  },

  fileUrl(path: string | null | undefined): string {
    if (!path) return '';
    return path.startsWith('http') ? path : CONFIG.SERVER_URL + path;
  },

  debounce<T extends (...args: any[]) => void>(fn: T, delay = 300): (...args: Parameters<T>) => void {
    let timer: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },
};
