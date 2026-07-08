// ============ Génération PDF (jsPDF) ============
const PDF = {
  _doc() {
    const { jsPDF } = window.jspdf;
    return new jsPDF({ unit: 'mm', format: 'a4' });
  },
  SKY: [14, 165, 233],
  GRAY: [100, 116, 139],

  _header(doc, title, subtitle) {
    doc.setFillColor(...this.SKY);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont(undefined, 'bold');
    doc.text('SMG IMMOBILIER', 14, 13);
    doc.setFontSize(10); doc.setFont(undefined, 'normal');
    doc.text('Gestion immobilière — Douala, Cameroun', 14, 20);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15); doc.setFont(undefined, 'bold');
    doc.text(title, 196, 13, { align: 'right' });
    if (subtitle) { doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.text(subtitle, 196, 20, { align: 'right' }); }
    doc.setTextColor(15, 23, 42);
  },

  _footer(doc) {
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...this.SKY); doc.setLineWidth(0.5); doc.line(14, h - 20, 196, h - 20);
    doc.setFontSize(8); doc.setTextColor(...this.GRAY);
    doc.text('SMG IMMOBILIER • contact@smg-immobilier.com • +237 6 00 00 00 00', 14, h - 14);
    doc.text('Document généré le ' + new Date().toLocaleDateString('fr-FR'), 14, h - 9);
    doc.setTextColor(15, 23, 42);
  },

  _kv(doc, pairs, startY) {
    let y = startY;
    doc.setFontSize(11);
    pairs.forEach(([k, v]) => {
      doc.setFont(undefined, 'bold'); doc.text(String(k), 14, y);
      doc.setFont(undefined, 'normal'); doc.text(String(v ?? '—'), 80, y);
      y += 8;
    });
    return y;
  },

  _save(doc, name) { doc.save(name); Toast.success('PDF généré : ' + name); },

  // ---- Reçu de paiement ----
  paymentReceipt(p) {
    const doc = this._doc();
    const tenant = p.tenant?.user?.full_name || '—';
    this._header(doc, 'REÇU DE PAIEMENT', '#' + (p.id || ''));
    let y = 42;
    y = this._kv(doc, [
      ['Reçu de', tenant],
      ['Logement', p.apartment?.apartment_number || '—'],
      ['Période', p.payment_date ? Helpers.formatDate(p.payment_date) : '—'],
      ['Méthode', Helpers.methodLabel(p.payment_method)],
      ['Statut', p.status === 'completed' ? 'Payé' : p.status],
    ], y);
    y += 6;
    doc.setFillColor(240, 249, 255); doc.rect(14, y, 182, 18, 'F');
    doc.setFontSize(13); doc.setFont(undefined, 'bold');
    doc.text('MONTANT PAYÉ', 18, y + 11);
    doc.setTextColor(...this.SKY); doc.text(Helpers.formatMoney(p.amount), 192, y + 11, { align: 'right' });
    doc.setTextColor(15, 23, 42);
    this._footer(doc);
    this._save(doc, `recu_paiement_${p.id || 'smg'}.pdf`);
  },

  // ---- Facture ----
  invoice(p) {
    const doc = this._doc();
    this._header(doc, 'FACTURE', '#' + (p.id || ''));
    let y = 42;
    y = this._kv(doc, [
      ['Client', p.tenant?.user?.full_name || '—'],
      ['Logement', p.apartment?.apartment_number || '—'],
      ['Date', Helpers.formatDate(p.payment_date)],
    ], y);
    y += 4;
    doc.autoTable({
      startY: y, theme: 'grid', headStyles: { fillColor: this.SKY },
      head: [['Désignation', 'Montant']],
      body: [['Loyer — ' + (p.apartment?.apartment_number || ''), Helpers.formatMoney(p.amount)]],
      foot: [['TOTAL', Helpers.formatMoney(p.amount)]],
      footStyles: { fillColor: [240, 249, 255], textColor: [14, 165, 233], fontStyle: 'bold' },
    });
    this._footer(doc);
    this._save(doc, `facture_${p.id || 'smg'}.pdf`);
  },

  // ---- Rappel de paiement ----
  paymentReminder(ctx) {
    const doc = this._doc();
    this._header(doc, 'RAPPEL DE PAIEMENT', '');
    let y = 42;
    doc.setFontSize(11);
    const msg = Communication.buildMessage({ ...ctx, kind: 'relance' });
    const lines = doc.splitTextToSize(msg, 180);
    doc.text(lines, 14, y);
    this._footer(doc);
    this._save(doc, `rappel_paiement_${(ctx.name || 'smg').replace(/\s+/g, '_')}.pdf`);
  },

  // ---- Contrat de bail ----
  leaseContract(l) {
    const doc = this._doc();
    this._header(doc, 'CONTRAT DE BAIL', l.reference || '');
    let y = 42;
    y = this._kv(doc, [
      ['Locataire', l.tenant?.user?.full_name || l.tenant?.full_name || '—'],
      ['Logement', l.apartment?.apartment_number || '—'],
      ['Immeuble', l.apartment?.property?.property_name || '—'],
      ['Date de début', Helpers.formatDate(l.start_date)],
      ['Date de fin', l.end_date ? Helpers.formatDate(l.end_date) : 'Indéterminée'],
      ['Loyer mensuel', Helpers.formatMoney(l.monthly_rent)],
      ['Caution', Helpers.formatMoney(l.deposit_amount)],
    ], y);
    y += 6;
    doc.setFontSize(10);
    const clauses = doc.splitTextToSize(
      'Le présent contrat est établi entre SMG IMMOBILIER (le bailleur) et le locataire désigné ci-dessus. ' +
      'Le locataire s\'engage à payer le loyer mensuel à la date convenue et à maintenir le logement en bon état. ' +
      'Toute dégradation sera à la charge du locataire. Le présent bail est régi par la législation en vigueur.', 182);
    doc.text(clauses, 14, y);
    y += clauses.length * 5 + 16;
    doc.text('Le Bailleur', 30, y); doc.text('Le Locataire', 150, y);
    doc.setDrawColor(...this.GRAY); doc.line(20, y + 16, 70, y + 16); doc.line(140, y + 16, 190, y + 16);
    this._footer(doc);
    this._save(doc, `contrat_${l.reference || l.id || 'smg'}.pdf`);
  },

  // ---- Devis ----
  quote(data) {
    const doc = this._doc();
    this._header(doc, 'DEVIS', new Date().toLocaleDateString('fr-FR'));
    let y = 42;
    y = this._kv(doc, [
      ['Créé par', `${data.creatorName || '—'} (${data.creatorRole || ''})`],
      ['Immeuble', data.propertyName || '—'],
      ['Logement', data.apartmentNumber || '—'],
      ['Description', data.description || '—'],
      ['Durée estimée', data.duration || '—'],
    ], y);
    y += 4;
    const rows = (data.items || []).map((it) => [it.name, it.qty, Helpers.formatMoney(it.unitPrice), Helpers.formatMoney(it.qty * it.unitPrice)]);
    const materialsTotal = (data.items || []).reduce((s, it) => s + it.qty * it.unitPrice, 0);
    const labor = parseFloat(data.labor || 0);
    doc.autoTable({
      startY: y, theme: 'grid', headStyles: { fillColor: this.SKY },
      head: [['Matériel', 'Qté', 'Prix unit.', 'Total']],
      body: rows.length ? rows : [['—', '0', '0', '0']],
    });
    let fy = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(11);
    doc.text('Main d\'œuvre : ' + Helpers.formatMoney(labor), 14, fy);
    doc.setFont(undefined, 'bold'); doc.setTextColor(...this.SKY);
    doc.text('MONTANT TOTAL : ' + Helpers.formatMoney(materialsTotal + labor), 14, fy + 9);
    doc.setTextColor(15, 23, 42); doc.setFont(undefined, 'normal');
    if (data.notes) { doc.setFontSize(9); doc.text(doc.splitTextToSize('Observations : ' + data.notes, 182), 14, fy + 20); }
    this._footer(doc);
    this._save(doc, `devis_${Date.now()}.pdf`);
  },

  // ---- Document générique (texte rédigé par l'assistant : quittance, relance, rapport...) ----
  document(title, text) {
    const doc = this._doc();
    this._header(doc, String(title || 'DOCUMENT').toUpperCase(), new Date().toLocaleDateString('fr-FR'));
    doc.setFontSize(11); doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(String(text || ''), 182);
    const pageH = doc.internal.pageSize.getHeight();
    let y = 42;
    lines.forEach((line) => {
      if (y > pageH - 26) { this._footer(doc); doc.addPage(); y = 20; }
      doc.text(line, 14, y); y += 6;
    });
    this._footer(doc);
    this._save(doc, `${String(title || 'document').toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`);
  },
};
