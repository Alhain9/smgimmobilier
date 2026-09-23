// ============ Génération PDF (jsPDF & html2pdf) ============
const PDF = {
  _doc(orientation = 'portrait', format = 'a4') {
    const jsPdfClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPdfClass) {
      console.error("jsPDF non disponible.");
      throw new Error("Le moteur PDF (jsPDF) n'est pas encore prêt. Veuillez rafraîchir.");
    }
    const doc = new jsPdfClass({ unit: 'mm', format, orientation });
    const origText = doc.text.bind(doc);
    doc.text = function(text, x, y, options, transform) {
      if (typeof text === 'string') {
        text = text.replace(/[\u202F\u00A0]/g, ' ');
      } else if (Array.isArray(text)) {
        text = text.map(t => typeof t === 'string' ? t.replace(/[\u202F\u00A0]/g, ' ') : t);
      }
      return origText(text, x, y, options, transform);
    };
    return doc;
  },
  isAvailable() {
    return Boolean((window.jspdf && window.jspdf.jsPDF) || window.jsPDF || window.html2pdf);
  },
  SKY: [14, 165, 233],
  GRAY: [100, 116, 139],

  _header(doc, title, subtitle) {
    doc.setFillColor(...this.SKY);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont(undefined, 'bold');
    doc.text('SMG IMMOBILIERE', 14, 13);
    doc.setFontSize(10); doc.setFont(undefined, 'normal');
    doc.text('Yaoundé et Douala, Cameroun', 14, 20);
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
    doc.text('SMG IMMOBILIERE • smgimmobilier.infos@gmail.com • +237 6 699 03 07 71, 670 56 16 12', 14, h - 14);
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

  // ---- Document générique (quittance, relance, rapport...) ----
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

  // ---- Facture d'électricité (détaillée, format A4 conforme au modèle) ----
  utilityBill(b) {
    const doc = this._doc();
    const isWater = b.type === 'water';
    const title = isWater ? "FACTURE D'EAU" : "FACTURE D'ÉLECTRICITÉ";
    const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const moisStr = b.mois || `${MONTHS[(b.period_month || 1) - 1]} ${b.period_year || ''}`;
    
    this._header(doc, title, `N° ${b.id} | ${moisStr}`);
    
    const aptNumber = b.apartment?.apartment_number || b.identifiant_logement || '—';
    const propName = b.apartment?.property?.property_name || b.immeuble || '';
    const aptType = b.apartment?.apartment_type || b.type_logement || 'Appartement';
    const tenantName = (b.apartment && b.apartment.tenants && b.apartment.tenants[0] && b.apartment.tenants[0].user)
      ? b.apartment.tenants[0].user.full_name
      : (b.tenant_name || '—');
    const conso = parseFloat((Math.max(0, Number(b.current_index || 0) - Number(b.previous_index || 0))).toFixed(2));
    const unitSymbol = isWater ? 'm³' : 'kWh';

    const data = [
      ['Logement', propName ? `${aptNumber} (${propName})` : aptNumber],
      ['Type de logement', aptType],
      ['Locataire', tenantName],
      ['Période facturée', moisStr],
      ['Ancien Index', `${Helpers.formatNumber(b.previous_index)} ${unitSymbol}`],
      ['Nouvel Index', `${Helpers.formatNumber(b.current_index)} ${unitSymbol}`],
      ['Consommation', `${Helpers.formatNumber(conso)} ${unitSymbol}`],
      [`Prix unitaire (${unitSymbol})`, Helpers.formatMoney(b.unit_price)],
      ['Montant consommation', Helpers.formatMoney(conso * Number(b.unit_price || 0))],
      ['Taxe Poubelle', Helpers.formatMoney(b.garbage_fee || 0)],
      ['Frais Transport', Helpers.formatMoney(b.transport_fee || 0)],
      ['Arriérés / Impayé', Helpers.formatMoney(b.impayer || 0)],
      ['Date d\'émission', b.created_at ? Helpers.formatDate(b.created_at) : Helpers.formatDate(new Date())],
      ['Date limite de paiement', b.due_date ? Helpers.formatDate(b.due_date) : '—'],
      ['Statut', b.status === 'paid' ? 'PAYÉ' : 'IMPAYÉ'],
    ];

    if (Number(b.other_fee || 0) > 0) {
      data.splice(11, 0, [b.other_label || 'Autre frais', Helpers.formatMoney(b.other_fee)]);
    }

    doc.autoTable({
      startY: 36,
      body: data,
      theme: 'striped',
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 }, 1: { halign: 'right' } },
      didParseCell: function(cellData) {
        if (cellData.row.index === cellData.table.body.length - 1 && cellData.column.index === 1) {
          cellData.cell.styles.fontStyle = 'bold';
          cellData.cell.styles.textColor = b.status === 'paid' ? [39, 174, 96] : [220, 53, 69];
        }
      }
    });

    let finalY = doc.lastAutoTable.finalY + 8;
    doc.setFillColor(240, 249, 255);
    doc.rect(14, finalY, 182, 16, 'F');
    doc.setDrawColor(...this.SKY);
    doc.setLineWidth(0.4);
    doc.rect(14, finalY, 182, 16, 'S');

    doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(15, 23, 42);
    doc.text('MONTANT TOTAL À PAYER', 20, finalY + 10.5);
    doc.setTextColor(...this.SKY); doc.setFontSize(14);
    doc.text(Helpers.formatMoney(b.total_amount), 190, finalY + 10.5, { align: 'right' });

    this._footer(doc);
    this._save(doc, `facture_${isWater ? 'eau' : 'electricite'}_${aptNumber}_${b.id}.pdf`);
  },

  // ---- Reçu de règlement de charge (électricité / eau) ----
  utilityReceipt(b) {
    const doc = this._doc();
    const isWater = b.type === 'water';
    const ref = b.receipt_number || `REC-CHARGE-${b.id}`;
    const title = isWater ? "REÇU DE CHARGES D'EAU" : "REÇU DE CHARGES D'ÉLECTRICITÉ";

    this._header(doc, title, `N° ${ref}`);

    const aptNumber = b.apartment?.apartment_number || b.identifiant_logement || '—';
    const propName = b.apartment?.property?.property_name || b.immeuble || '';
    const tenantName = (b.apartment && b.apartment.tenants && b.apartment.tenants[0] && b.apartment.tenants[0].user)
      ? b.apartment.tenants[0].user.full_name
      : (b.tenant_name || '—');
    const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const moisStr = b.mois || `${MONTHS[(b.period_month || 1) - 1]} ${b.period_year || ''}`;

    let y = 38;
    y = this._kv(doc, [
      ['N° de Reçu', ref],
      ['Facture associée', `#${b.id} (${moisStr})`],
      ['Reçu de (Locataire)', tenantName],
      ['Logement', propName ? `${aptNumber} — ${propName}` : aptNumber],
      ['Date de règlement', b.paid_date ? Helpers.formatDate(b.paid_date) : Helpers.formatDate(new Date())],
      ['Mode de paiement', b.payment_method || 'Espèces'],
      ['Statut', 'PAYÉ INTÉGRALEMENT'],
    ], y);

    y += 4;
    doc.setFillColor(236, 253, 245);
    doc.rect(14, y, 182, 18, 'F');
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(0.5);
    doc.rect(14, y, 182, 18, 'S');

    doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.setTextColor(22, 101, 52);
    doc.text('MONTANT RÉGLÉ', 20, y + 11.5);
    doc.setFontSize(15);
    doc.text(Helpers.formatMoney(b.total_amount), 190, y + 11.5, { align: 'right' });

    y += 30;
    doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.setTextColor(...this.GRAY);
    doc.text('Pour valoir ce que de droit.', 14, y);
    doc.text('Cachet et Signature SMG IMMOBILIER :', 125, y);
    doc.setDrawColor(...this.GRAY);
    doc.line(125, y + 20, 196, y + 20);

    this._footer(doc);
    this._save(doc, `recu_charge_${aptNumber}_${ref}.pdf`);
  },

  // ---- Export groupé / Toutes les factures en paysage ----
  allUtilityBills(bills) {
    const doc = this._doc('landscape', 'a4');

    doc.setFillColor(...this.SKY);
    doc.rect(0, 0, 297, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17); doc.setFont(undefined, 'bold');
    doc.text('SMG IMMOBILIER — RÉCAPITULATIF DES FACTURES DE CHARGES', 148.5, 11, { align: 'center' });
    doc.setFontSize(9); doc.setFont(undefined, 'normal');
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 148.5, 18, { align: 'center' });

    const headers = ['Logement', 'Locataire', 'Période', 'Ancien', 'Nouvel', 'Conso', 'Prix unitaire', 'Frais annexes', 'Impayé', 'Total', 'Statut'];
    const rows = (bills || []).map((b) => {
      const apt = b.apartment ? `${b.apartment.apartment_number} (${b.apartment.property ? b.apartment.property.property_name : ''})` : (b.identifiant_logement || '—');
      const tenant = (b.apartment && b.apartment.tenants && b.apartment.tenants[0] && b.apartment.tenants[0].user)
        ? b.apartment.tenants[0].user.full_name
        : (b.tenant_name || '—');
      const rawConso = Math.max(0, Number(b.current_index || 0) - Number(b.previous_index || 0));
      const conso = Math.round(rawConso * 100) / 100;
      const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
      const per = `${MONTHS[(b.period_month || 1) - 1]} ${b.period_year || ''}`;
      const fees = Number(b.garbage_fee || 0) + Number(b.transport_fee || 0) + Number(b.other_fee || 0);

      return [
        apt,
        tenant,
        per,
        Helpers.formatNumber(b.previous_index),
        Helpers.formatNumber(b.current_index),
        Helpers.formatNumber(conso),
        Helpers.formatMoney(b.unit_price),
        Helpers.formatMoney(fees),
        Helpers.formatMoney(b.impayer || 0),
        Helpers.formatMoney(b.total_amount),
        b.status === 'paid' ? 'PAYÉ' : 'IMPAYÉ'
      ];
    });

    const totalGeneral = (bills || []).reduce((s, b) => s + Number(b.total_amount || 0), 0);
    rows.push(['', '', '', '', '', '', '', '', 'TOTAL', Helpers.formatMoney(totalGeneral), '']);

    doc.autoTable({
      startY: 32,
      margin: { left: 10, right: 10 },
      head: [headers],
      body: rows,
      theme: 'striped',
      styles: { fontSize: 7.5, cellPadding: [2, 1.5] },
      headStyles: { fillColor: this.SKY, textColor: 255, fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 38, halign: 'left', overflow: 'linebreak' },
        1: { cellWidth: 34, halign: 'left', overflow: 'linebreak' },
        2: { cellWidth: 18, halign: 'center', overflow: 'ellipsize' },
        3: { cellWidth: 15, halign: 'right', overflow: 'ellipsize' },
        4: { cellWidth: 15, halign: 'right', overflow: 'ellipsize' },
        5: { cellWidth: 15, halign: 'right', overflow: 'ellipsize' },
        6: { cellWidth: 20, halign: 'right', overflow: 'ellipsize' },
        7: { cellWidth: 30, halign: 'right', overflow: 'ellipsize' },
        8: { cellWidth: 26, halign: 'right', overflow: 'ellipsize' },
        9: { cellWidth: 32, halign: 'right', overflow: 'ellipsize', fontStyle: 'bold' },
        10: { cellWidth: 18, halign: 'center', overflow: 'ellipsize', fontStyle: 'bold' },
      },
      didParseCell: function(data) {
        if (data.row.index === rows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 249, 255];
        }
        if (data.column.index === 10) {
          if (data.cell.raw === 'PAYÉ') {
            data.cell.styles.textColor = [39, 174, 96];
          } else if (data.cell.raw === 'IMPAYÉ') {
            data.cell.styles.textColor = [220, 53, 69];
          }
        }
      },
      didDrawPage: function(data) {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Page ' + data.pageNumber, 280, 202, { align: 'right' });
      }
    });

    doc.save(`recapitulatif_charges_${new Date().toISOString().slice(0, 10)}.pdf`);
    Toast.success('PDF récapitulatif généré avec succès');
  },
};

window.PDF = PDF;

