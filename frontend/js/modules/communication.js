// ============ Module Communication : WhatsApp + Appel direct ============
const Communication = {
  DEFAULT_COUNTRY: '237', // Cameroun

  // Nettoie un numéro -> format international sans '+' (ex: 237699999999)
  cleanPhone(phone) {
    if (!phone) return '';
    let p = String(phone).replace(/[^\d+]/g, '');
    if (p.startsWith('+')) return p.slice(1);
    if (p.startsWith('00')) return p.slice(2);
    // si commence déjà par l'indicatif pays
    if (p.startsWith(this.DEFAULT_COUNTRY)) return p;
    // numéro local -> préfixe pays
    return this.DEFAULT_COUNTRY + p.replace(/^0+/, '');
  },

  callLink(phone) { return 'tel:+' + this.cleanPhone(phone); },
  whatsappLink(phone, message) {
    return `https://wa.me/${this.cleanPhone(phone)}?text=${encodeURIComponent(message || '')}`;
  },

  // Construit un message intelligent selon le contexte
  buildMessage(ctx = {}) {
    const civ = 'Bonjour ' + (ctx.name ? `M./Mme ${ctx.name}` : 'cher locataire') + ',';
    const logement = [
      ctx.apartmentType ? this._capitalize(ctx.apartmentType) : 'logement',
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
      return [civ, '', `Nous revenons vers vous concernant votre contrat de bail pour le ${logement}${lieu ? ' situé dans ' + lieu : ''}.`, '', 'Cordialement,', 'SMG IMMOBILIER'].join('\n');
    }
    // message générique
    return [civ, '', `Nous vous contactons concernant votre ${logement}${lieu ? ' situé dans ' + lieu : ''}.`, '', 'Cordialement,', 'SMG IMMOBILIER'].join('\n');
  },

  _capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; },

  openWhatsApp(ctx) {
    if (!ctx.phone) { Toast.error('Numéro de téléphone manquant pour ce locataire'); return; }
    window.open(this.whatsappLink(ctx.phone, this.buildMessage(ctx)), '_blank');
  },
  call(phone) {
    if (!phone) { Toast.error('Numéro de téléphone manquant'); return; }
    window.location.href = this.callLink(phone);
  },

  // Boutons réutilisables. ctxJson = JSON.stringify(ctx) échappé
  buttons(ctx, opts = {}) {
    const json = JSON.stringify(ctx).replace(/"/g, '&quot;');
    const size = opts.sm ? 'btn-sm' : '';
    return `
      <button class="btn ${size} btn-whatsapp" onclick='Communication.openWhatsApp(${JSON.stringify(ctx)})' title="Contacter via WhatsApp">🟢 WhatsApp</button>
      <button class="btn ${size} btn-outline" onclick="Communication.call('${ctx.phone || ''}')" title="Appeler">📞 Appeler</button>`;
  },
};
