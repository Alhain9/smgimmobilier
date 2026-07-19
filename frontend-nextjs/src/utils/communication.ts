import { Helpers } from './helpers';

export interface CommunicationContext {
  name?: string;
  phone?: string;
  apartmentType?: string;
  apartmentNumber?: string;
  propertyName?: string;
  city?: string;
  district?: string;
  amount?: number;
  dueDate?: string;
  kind?: 'relance' | 'contract' | string;
}

export const Communication = {
  DEFAULT_COUNTRY: '237', // Cameroun

  cleanPhone(phone?: string | null): string {
    if (!phone) return '';
    let p = String(phone).replace(/[^\d+]/g, '');
    if (p.startsWith('+')) return p.slice(1);
    if (p.startsWith('00')) return p.slice(2);
    if (p.startsWith(this.DEFAULT_COUNTRY)) return p;
    return this.DEFAULT_COUNTRY + p.replace(/^0+/, '');
  },

  callLink(phone?: string | null): string {
    return 'tel:+' + this.cleanPhone(phone);
  },

  whatsappLink(phone?: string | null, message?: string): string {
    return `https://wa.me/${this.cleanPhone(phone)}?text=${encodeURIComponent(message || '')}`;
  },

  buildMessage(ctx: CommunicationContext = {}): string {
    const civ = 'Bonjour ' + (ctx.name ? `M./Mme ${ctx.name}` : 'cher locataire') + ',';
    const logement = [
      ctx.apartmentType ? ctx.apartmentType.charAt(0).toUpperCase() + ctx.apartmentType.slice(1) : 'logement',
      ctx.apartmentNumber || '',
    ].join(' ').trim();
    const lieu = [
      ctx.propertyName ? `l'immeuble ${ctx.propertyName}` : '',
      ctx.district ? `à ${ctx.district}` : '',
      ctx.city || '',
    ].filter(Boolean).join(' ');

    if (ctx.kind === 'relance' || ctx.amount) {
      return [
        civ, '',
        `Nous vous contactons concernant le paiement du ${logement}${lieu ? ' situé dans ' + lieu : ''}.`,
        '',
        ctx.amount ? `Montant restant :\n${Helpers.formatMoney(ctx.amount)}` : '',
        ctx.dueDate ? `\nDate limite :\n${Helpers.formatDate(ctx.dueDate)}` : '',
        '',
        'Merci de bien vouloir régulariser votre situation.',
        '', 'SMG IMMOBILIER',
      ].filter((l) => l !== undefined).join('\n');
    }
    if (ctx.kind === 'contract') {
      return [
        civ, '',
        `Nous revenons vers vous concernant votre contrat de bail pour le ${logement}${lieu ? ' situé dans ' + lieu : ''}.`,
        '', 'Cordialement,', 'SMG IMMOBILIER'
      ].join('\n');
    }
    return [
      civ, '',
      `Nous vous contactons concernant votre ${logement}${lieu ? ' situé dans ' + lieu : ''}.`,
      '', 'Cordialement,', 'SMG IMMOBILIER'
    ].join('\n');
  },

  openWhatsApp(ctx: CommunicationContext) {
    if (!ctx.phone) {
      alert('Numéro de téléphone manquant pour ce locataire');
      return;
    }
    if (typeof window !== 'undefined') {
      window.open(this.whatsappLink(ctx.phone, this.buildMessage(ctx)), '_blank');
    }
  },

  call(phone?: string | null) {
    if (!phone) {
      alert('Numéro de téléphone manquant');
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.href = this.callLink(phone);
    }
  },
};
