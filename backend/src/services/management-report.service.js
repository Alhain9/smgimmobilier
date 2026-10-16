// ============ Service Rapports de Gestion Périodiques ============
const { Property, Apartment, Tenant, Lease, Payment, Maintenance, Expense, Task, User, Receipt } = require('../models');
const { Op } = require('sequelize');

const num = (v) => parseFloat(v) || 0;

class ManagementReportService {
  _range(start, end) {
    return [`${start} 00:00:00`, `${end} 23:59:59`];
  }

  // Calcul du nombre de mois dans la période (min 1)
  _monthsInPeriod(start, end) {
    if (!start || !end) return 1;
    const sStr = String(start).slice(0, 10);
    const eStr = String(end).slice(0, 10);
    if (sStr >= eStr) return 1;

    const s = new Date(sStr + 'T00:00:00Z');
    const e = new Date(eStr + 'T00:00:00Z');
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;

    const sYear = s.getUTCFullYear();
    const sMonth = s.getUTCMonth();
    const eYear = e.getUTCFullYear();
    const eMonth = e.getUTCMonth();
    const eDay = e.getUTCDate();

    // Même mois et même année (ex: 01/09/2026 au 30/09/2026) => exactement 1 mois
    if (sYear === eYear && sMonth === eMonth) {
      return 1;
    }

    // Si fin est le 1er jour du mois suivant (ex: 01/09 au 01/10), c'est exactement 1 mois (le mois de septembre)
    if ((eYear === sYear && eMonth === sMonth + 1 && eDay <= 1) || (eYear === sYear + 1 && sMonth === 11 && eMonth === 0 && eDay <= 1)) {
      return 1;
    }

    // Si fin est le 1er jour d'un mois ultérieur (ex: 01/09 au 01/11), cela fait 2 mois (septembre et octobre)
    let monthsDiff = (eYear - sYear) * 12 + (eMonth - sMonth);
    if (eDay <= 1 && monthsDiff > 0) {
      return Math.max(1, monthsDiff);
    }
    if (eDay >= 28) {
      monthsDiff += 1;
    }
    const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    const approxFromDays = Math.max(1, Math.round(diffDays / 30.4375));
    return Math.max(1, monthsDiff > 0 ? monthsDiff : approxFromDays);
  }

  // ===== 1. RAPPORT D'UN BIEN / IMMEUBLE =====
  async buildingReport(propertyId, start, end, ownerPropertyIds = null) {
    if (Array.isArray(ownerPropertyIds) && !ownerPropertyIds.includes(Number(propertyId))) {
      throw Object.assign(new Error('Accès refusé : cet immeuble ne vous appartient pas'), { status: 403 });
    }

    const range = this._range(start, end);
    const months = this._monthsInPeriod(start, end);

    const property = await Property.findByPk(propertyId, {
      include: [
        { model: User, as: 'owner', attributes: ['id', 'full_name', 'phone', 'email'] },
        {
          model: Apartment, as: 'apartments',
          include: [
            {
              model: Tenant, as: 'tenants', required: false, where: { status: 'active' },
              include: [
                { model: User, as: 'user', attributes: ['id', 'full_name', 'phone', 'email'] },
                { model: Lease, as: 'leases', required: false, where: { status: 'active' } },
              ],
            },
          ],
        },
      ],
    });

    if (!property) throw Object.assign(new Error('Immeuble introuvable'), { status: 404 });

    const apts = property.apartments || [];
    const aptIds = apts.map((a) => a.id);
    const allTenantIds = apts.flatMap(a => (a.tenants || []).map(t => t.id)).filter(Boolean);

    // Requêtes parallèles pour la période
    const paymentOrConditions = [{ apartment_id: { [Op.in]: aptIds } }];
    if (allTenantIds.length > 0) {
      paymentOrConditions.push({ tenant_id: { [Op.in]: allTenantIds } });
    }

    const [payments, maintenances, directExpenses] = await Promise.all([
      // Paiements dans la période (par logement ou par locataire du bien)
      Payment.findAll({
        where: {
          [Op.or]: paymentOrConditions,
          payment_date: { [Op.between]: [start, end] },
        },
        include: [
          { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }] },
          { model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number'] },
          { model: Receipt, as: 'receipts', attributes: ['id', 'receipt_number'] },
        ],
        order: [['payment_date', 'ASC']],
      }),

      // Maintenances créées ou actives dans la période avec tâches & dépenses
      Maintenance.findAll({
        where: {
          apartment_id: { [Op.in]: aptIds },
          created_at: { [Op.between]: range },
        },
        include: [
          { model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number'] },
          { model: User, as: 'technician', attributes: ['id', 'full_name', 'phone'] },
          {
            model: Task, as: 'tasks',
            include: [{ model: User, as: 'assignee', attributes: ['id', 'full_name'] }],
          },
          { model: Expense, as: 'expenses' },
        ],
        order: [['created_at', 'ASC']],
      }),

      // Dépenses directes rattachées à la propriété (hors maintenance, salaires gardiens, etc.)
      Expense.findAll({
        where: {
          property_id: propertyId,
          [Op.or]: [
            { payment_date: { [Op.between]: [start, end] } },
            { created_at: { [Op.between]: range } },
          ],
        },
        order: [['created_at', 'ASC']],
      }),
    ]);

    // Situation Locative brute (détail par appartement depuis la base)
    const apartmentList = apts.map((a) => {
      const tenant = (a.tenants || [])[0];
      const user = tenant ? tenant.user : null;
      const lease = tenant && tenant.leases ? tenant.leases[0] : null;
      return {
        id: a.id,
        apartment_number: a.apartment_number,
        apartment_type: a.apartment_type,
        description: a.description || a.apartment_type || 'Logement',
        rent_amount: num(a.rent_amount),
        status: a.status,
        tenant_name: user ? user.full_name : null,
        tenant_phone: user ? user.phone : null,
        lease_start: lease ? lease.start_date : (tenant ? tenant.start_date : null),
        lease_end: lease ? lease.end_date : (tenant ? tenant.end_date : null),
      };
    });

    // Situation locative standardisée complète (12 colonnes avec surcharges manuelles réelles)
    let buildingSituation = null;
    try {
      const reportService = require('./report.service');
      buildingSituation = await reportService.buildingSituation(propertyId, ownerPropertyIds, null, null, start, end);
    } catch (e) {
      console.warn('Erreur lors du calcul de buildingSituation dans buildingReport:', e.message);
    }

    const situationLignes = (buildingSituation && buildingSituation.lignes && buildingSituation.lignes.length)
      ? buildingSituation.lignes
      : apartmentList;
    const sitTotal = buildingSituation && buildingSituation.total;

    // Indexation de la situation par appartement pour synchronisation parfaite
    const sitByAptId = new Map();
    const sitByAptNum = new Map();
    situationLignes.forEach((l) => {
      if (l.apartment_id) sitByAptId.set(Number(l.apartment_id), l);
      if (l.numero_chambre) sitByAptNum.set(String(l.numero_chambre).trim().toLowerCase(), l);
    });

    // ===== Calculs Financiers Unifiés avec Situation & Rapports =====
    // 1. Loyer théorique = somme des loyers réels × nb de mois
    const occupiedApts = apts.filter((a) => a.status === 'occupied');
    const vacantApts = apts.filter((a) => a.status === 'free');
    const situationSumMontantLoyer = situationLignes.reduce((s, l) => s + (Number(l.montant_loyer != null ? l.montant_loyer : l.rent_amount) || 0), 0);
    const monthlyTheoretical = (sitTotal && Number(sitTotal.montant_loyer) > 0)
      ? Number(sitTotal.montant_loyer)
      : (situationSumMontantLoyer > 0 ? situationSumMontantLoyer : occupiedApts.reduce((s, a) => s + num(a.rent_amount), 0));
    const totalTheoretical = monthlyTheoretical * months;

    // 2. Loyers réellement encaissés (cumul vérifié de tous les encaissements de la période)
    // Synchronisation absolue avec la situation des 12 colonnes :
    // sitTotal.versement_mois intègre les versements effectifs de la période ainsi que toutes les surcharges manuelles validées.
    const completedPayments = payments.filter((p) => p.status === 'completed');
    const rawPaymentsCollected = completedPayments.reduce((s, p) => s + num(p.amount), 0);
    const isFullCalendarMonth = (months === 1 && String(start).slice(8, 10) === '01' && (String(end).slice(8, 10) >= '28'));

    const totalCollected = (sitTotal && sitTotal.versement_mois != null)
      ? Number(sitTotal.versement_mois)
      : rawPaymentsCollected;

    // 3. Reste à encaisser / impayés sur la période
    const unpaidPayments = payments.filter((p) => ['pending', 'failed', 'awaiting_confirmation'].includes(p.status));
    const rawPaymentsUnpaid = unpaidPayments.reduce((s, p) => s + num(p.amount), 0);
    const totalUnpaid = (sitTotal && sitTotal.arriere_loyer != null)
      ? sitTotal.arriere_loyer
      : rawPaymentsUnpaid;
    const remainingToCollect = (sitTotal && sitTotal.arriere_loyer != null)
      ? sitTotal.arriere_loyer
      : Math.max(0, totalTheoretical - totalCollected);

    // 4. Taux d'encaissement
    const collectionRate = totalTheoretical > 0 ? Math.round((totalCollected / totalTheoretical) * 100) : (totalCollected > 0 ? 100 : 0);

    // ===== Dépenses & Travaux =====
    const maintenanceExpenses = [];
    maintenances.forEach((m) => {
      (m.expenses || []).forEach((e) => {
        maintenanceExpenses.push({
          id: e.id,
          date: e.createdAt,
          item_name: e.item_name,
          category: e.category || 'Maintenance',
          quantity: num(e.quantity) || 1,
          unit_price: num(e.unit_price),
          total_price: num(e.total_price),
          supplier: e.supplier || '—',
          apartment_number: m.apartment ? m.apartment.apartment_number : '—',
          maintenance_title: m.title,
        });
      });
    });

    const caretakerExpenses = [];
    const otherExpenses = [];

    directExpenses.forEach((e) => {
      const isGardien = e.expense_type === 'gardiennage' || (e.category && e.category.toLowerCase().includes('gardien'));
      const obj = {
        id: e.id,
        date: e.payment_date || e.createdAt,
        item_name: e.item_name,
        caretaker_name: e.caretaker_name || property.caretaker_name || 'Gardien',
        period_month: e.period_month,
        category: isGardien ? 'Gardiennage & Sécurité' : (e.category || 'Autre'),
        expense_type: isGardien ? 'gardiennage' : (e.expense_type || 'other'),
        quantity: num(e.quantity) || 1,
        unit_price: num(e.unit_price),
        total_price: num(e.total_price),
        supplier: e.supplier || (isGardien ? (e.caretaker_name || 'Gardien') : '—'),
        payment_method: e.payment_method || 'Espèces',
        apartment_number: 'Immeuble (commun)',
        maintenance_title: isGardien ? 'Salaire Gardien' : 'Dépense directe',
      };
      if (isGardien) caretakerExpenses.push(obj);
      else otherExpenses.push(obj);
    });

    const allExpenses = [...caretakerExpenses, ...maintenanceExpenses, ...otherExpenses];
    const totalCaretakerCost = caretakerExpenses.reduce((s, e) => s + e.total_price, 0);
    const totalMaintenanceCost = maintenanceExpenses.reduce((s, e) => s + e.total_price, 0);
    const totalOtherCost = otherExpenses.reduce((s, e) => s + e.total_price, 0);
    const totalExpenses = totalCaretakerCost + totalMaintenanceCost + totalOtherCost;

    // Travaux réalisés (détail technique)
    const worksDone = maintenances.map((m) => ({
      id: m.id,
      date: m.createdAt,
      title: m.title,
      description: m.description,
      apartment_number: m.apartment ? m.apartment.apartment_number : '—',
      technician: m.technician ? m.technician.full_name : 'Non assigné',
      priority: m.priority,
      status: m.status,
      cost: (m.expenses || []).reduce((s, e) => s + num(e.total_price), 0),
      tasks: (m.tasks || []).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        assignee: t.assignee ? t.assignee.full_name : '—',
        completion_note: t.completion_note,
        done_at: t.done_at,
      })),
    }));


    // Transactions individuelles de la période
    const transactionList = payments.map((p) => ({
      id: p.id,
      date: p.payment_date,
      tenant_name: p.tenant?.user?.full_name || '—',
      apartment_number: p.apartment?.apartment_number || '—',
      amount: num(p.amount),
      payment_method: p.payment_method,
      status: p.status,
      receipt_number: (p.receipts && p.receipts[0]) ? p.receipts[0].receipt_number : null,
    }));

    // Regroupement des encaissements par logement / locataire pour la période
    // Fait la somme ("le plus") des transactions multiples d'un même locataire
    const collectionsMap = new Map();
    completedPayments.forEach((p) => {
      const key = p.apartment_id || (p.tenant_id ? `t-${p.tenant_id}` : `p-${p.id}`);
      const tenantName = p.tenant?.user?.full_name || 'Locataire';
      const aptNumber = p.apartment?.apartment_number || '—';
      const amount = num(p.amount);
      const receiptNo = (p.receipts && p.receipts[0]) ? p.receipts[0].receipt_number : null;

      const aptObj = apts.find((a) => a.id === p.apartment_id);
      const rent = aptObj ? num(aptObj.rent_amount) : 0;

      if (!collectionsMap.has(key)) {
        collectionsMap.set(key, {
          apartment_id: p.apartment_id,
          tenant_id: p.tenant_id,
          apartment_number: aptNumber,
          tenant_name: tenantName,
          total_collected: 0,
          transaction_count: 0,
          methods: new Set(),
          receipt_numbers: [],
          dates: [],
          rent_amount: rent,
        });
      }

      const rec = collectionsMap.get(key);
      rec.total_collected += amount;
      rec.transaction_count += 1;
      if (p.payment_method) rec.methods.add(p.payment_method);
      if (receiptNo && !rec.receipt_numbers.includes(receiptNo)) rec.receipt_numbers.push(receiptNo);
      if (p.payment_date) rec.dates.push(p.payment_date);
      if (p.period_start) rec.period_start = p.period_start;
      if (p.period_end) rec.period_end = p.period_end;
      if (p.observations) rec.observations = p.observations;
    });

    // Synchronisation stricte avec la situation des 12 colonnes
    situationLignes.forEach((l) => {
      const vMois = Number(l.versement_mois) || 0;
      const key = l.apartment_id || `apt-${l.numero_chambre}`;
      if (collectionsMap.has(key)) {
        const c = collectionsMap.get(key);
        if (l.is_overridden && l.versement_mois !== null) {
          c.total_collected = vMois;
        }
        if (l.periode_paiement && l.periode_paiement !== '—') {
          c.periode_paiement = l.periode_paiement;
        }
        if (l.mode_paiement && l.mode_paiement !== '—') {
          c.methods = new Set([l.mode_paiement]);
        }
      } else if (vMois > 0) {
        const mSet = new Set();
        if (l.mode_paiement && l.mode_paiement !== '—') mSet.add(l.mode_paiement);
        else mSet.add('Espèces');
        collectionsMap.set(key, {
          apartment_id: l.apartment_id,
          tenant_id: l.tenant_id,
          apartment_number: l.numero_chambre || '—',
          tenant_name: l.nom_locataire || 'Locataire',
          total_collected: vMois,
          transaction_count: 1,
          methods: mSet,
          receipt_numbers: [],
          dates: [],
          rent_amount: Number(l.montant_loyer) || 0,
          periode_paiement: l.periode_paiement,
          period_start: l.period_start,
          period_end: l.period_end,
        });
      }
    });

    const aggregatedCollections = Array.from(collectionsMap.values())
      .filter((c) => {
        const sitLine = (c.apartment_id && sitByAptId.get(Number(c.apartment_id)))
          || sitByAptNum.get(String(c.apartment_number).trim().toLowerCase())
          || null;
        if (sitLine && sitLine.is_overridden && sitLine.versement_mois !== null) {
          c.total_collected = Number(sitLine.versement_mois);
        }
        return Number(c.total_collected) > 0;
      })
      .map((c) => {
      const sitLine = (c.apartment_id && sitByAptId.get(Number(c.apartment_id)))
        || sitByAptNum.get(String(c.apartment_number).trim().toLowerCase())
        || null;

      const tenantName = (c.tenant_name && c.tenant_name !== 'Locataire')
        ? c.tenant_name
        : ((sitLine && sitLine.nom_locataire && sitLine.nom_locataire !== '—') ? sitLine.nom_locataire : c.tenant_name);

      const methodLabels = {
        cash: 'Espèces',
        especes: 'Espèces',
        bank_transfer: 'Virement bancaire',
        virement: 'Virement bancaire',
        orange_money: 'Orange Money',
        mtn_mobile_money: 'MTN Mobile Money',
        campay: 'Mobile Money',
        cheque: 'Chèque',
        autre: 'Autre',
      };
      const methodLabel = Array.from(c.methods).map(m => methodLabels[m] || m).filter(Boolean).join(', ')
        || (sitLine && sitLine.mode_paiement && sitLine.mode_paiement !== '—' ? sitLine.mode_paiement : 'Espèces');

      const receiptList = c.receipt_numbers.length ? c.receipt_numbers.join(',\n') : '—';

      c.dates.sort();
      const firstDate = c.dates[0];
      const lastDate = c.dates[c.dates.length - 1];
      let dateRange = '—';
      if (firstDate && lastDate && firstDate !== lastDate) {
        dateRange = `Du ${firstDate.slice(8, 10)}/${firstDate.slice(5, 7)} au ${lastDate.slice(8, 10)}/${lastDate.slice(5, 7)}`;
      } else if (firstDate) {
        dateRange = `${firstDate.slice(8, 10)}/${firstDate.slice(5, 7)}/${firstDate.slice(0, 4)}`;
      }

      // PÉRIODE CORRESPONDANT AU PAIEMENT concrète (ex: du 01/09/2026 au 01/12/2026)
      let periodePaiement = '—';
      if (sitLine && sitLine.periode_paiement && sitLine.periode_paiement !== '—') {
        periodePaiement = sitLine.periode_paiement;
      } else if (c.period_start && c.period_end) {
        const fmtFR = (d) => {
          if (!d) return '';
          const s = String(d).slice(0, 10);
          const p = s.split('-');
          return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
        };
        periodePaiement = `du ${fmtFR(c.period_start)} au ${fmtFR(c.period_end)}`;
      } else if (c.periode_paiement && c.periode_paiement !== '—') {
        periodePaiement = c.periode_paiement;
      } else if (dateRange !== '—') {
        periodePaiement = dateRange;
      }

      const finalCollected = (sitLine && sitLine.is_overridden && sitLine.versement_mois !== null)
        ? Number(sitLine.versement_mois)
        : Number(c.total_collected);

      return {
        apartment_id: c.apartment_id,
        tenant_id: c.tenant_id,
        apartment_number: c.apartment_number,
        tenant_name: tenantName,
        total_collected: finalCollected,
        transaction_count: c.transaction_count,
        methods: methodLabel,
        receipt_numbers: receiptList,
        date_range: dateRange,
        nature: periodePaiement,
        periode_paiement: periodePaiement,
      };
    });

    // Résultat net à reverser au bailleur = Total des encaissements perçus (loyers)
    const netResult = totalCollected;

    return {
      property: {
        id: property.id,
        property_name: property.property_name,
        property_type: property.property_type,
        address: property.address,
        city: property.city,
        owner: property.owner ? { id: property.owner.id, full_name: property.owner.full_name, phone: property.owner.phone, email: property.owner.email } : null,
      },
      period: { start, end, months },
      summary: {
        theoretical_rent: totalTheoretical,
        collected_rent: totalCollected,
        unpaid_rent: totalUnpaid,
        remaining_to_collect: remainingToCollect,
        collection_rate: collectionRate,
        caretaker_expenses: totalCaretakerCost,
        maintenance_expenses: totalMaintenanceCost,
        other_expenses: totalOtherCost,
        total_expenses: totalExpenses,
        net_result: netResult,
      },
      building_situation: buildingSituation,
      rental_situation: {
        total_apartments: situationLignes.length || apts.length,
        occupied_apartments: situationLignes.filter(l => (l.nom_locataire && l.nom_locataire !== '—' && l.observations !== 'Logement libre / vide' && l.description_logement !== 'vide') || l.status === 'occupied').length || occupiedApts.length,
        vacant_apartments: situationLignes.filter(l => (!l.nom_locataire || l.nom_locataire === '—' || l.observations === 'Logement libre / vide' || l.description_logement === 'vide') && l.status !== 'occupied').length || vacantApts.length,
        occupancy_rate: situationLignes.length > 0
          ? Math.round((situationLignes.filter(l => (l.nom_locataire && l.nom_locataire !== '—' && l.observations !== 'Logement libre / vide' && l.description_logement !== 'vide') || l.status === 'occupied').length / situationLignes.length) * 100)
          : 0,
        apartments: situationLignes,
      },
      apartments: situationLignes,
      aggregated_collections: aggregatedCollections,
      works_done: worksDone,
      expenses_detail: allExpenses,
      transactions: transactionList,
    };
  }

  // ===== 2. RAPPORT DU BAILLEUR (SYNTHÈSE MULTI-IMMEUBLES) =====
  async ownerReport(userId, start, end) {
    const owner = await User.findByPk(userId, {
      attributes: ['id', 'full_name', 'phone', 'email'],
    });
    if (!owner) throw Object.assign(new Error('Bailleur introuvable'), { status: 404 });

    const properties = await Property.findAll({
      where: { owner_id: userId },
      attributes: ['id', 'property_name'],
    });

    if (!properties.length) {
      return {
        owner,
        period: { start, end, months: this._monthsInPeriod(start, end) },
        summary: { theoretical_rent: 0, collected_rent: 0, unpaid_rent: 0, remaining_to_collect: 0, collection_rate: 0, total_expenses: 0, net_result: 0 },
        buildings: [],
      };
    }

    const buildingReports = await Promise.all(
      properties.map((p) => this.buildingReport(p.id, start, end, [p.id]))
    );

    // Consolidation globale
    const sumKey = (key) => buildingReports.reduce((s, r) => s + (r.summary[key] || 0), 0);
    const theoretical = sumKey('theoretical_rent');
    const collected = sumKey('collected_rent');
    const unpaid = sumKey('unpaid_rent');
    const remaining = sumKey('remaining_to_collect');
    const caretakerExp = sumKey('caretaker_expenses');
    const maintExp = sumKey('maintenance_expenses');
    const otherExp = sumKey('other_expenses');
    const totalExp = sumKey('total_expenses');
    const netResult = collected - totalExp;
    const rate = theoretical > 0 ? Math.round((collected / theoretical) * 100) : (collected > 0 ? 100 : 0);

    const totalApts = buildingReports.reduce((s, r) => s + r.rental_situation.total_apartments, 0);
    const occupiedApts = buildingReports.reduce((s, r) => s + r.rental_situation.occupied_apartments, 0);
    const vacantApts = buildingReports.reduce((s, r) => s + r.rental_situation.vacant_apartments, 0);

    return {
      owner,
      period: { start, end, months: this._monthsInPeriod(start, end) },
      summary: {
        total_properties: properties.length,
        total_apartments: totalApts,
        occupied_apartments: occupiedApts,
        vacant_apartments: vacantApts,
        occupancy_rate: totalApts > 0 ? Math.round((occupiedApts / totalApts) * 100) : 0,
        theoretical_rent: theoretical,
        collected_rent: collected,
        unpaid_rent: unpaid,
        remaining_to_collect: remaining,
        collection_rate: rate,
        caretaker_expenses: caretakerExp,
        maintenance_expenses: maintExp,
        other_expenses: otherExp,
        total_expenses: totalExp,
        net_result: netResult,
      },
      buildings: buildingReports,
    };
  }

  // ===== 3. RAPPORT GLOBAL AGENCE (SMG IMMOBILIER) =====
  async agencyReport(start, end) {
    const properties = await Property.findAll({
      attributes: ['id', 'property_name', 'owner_id'],
      include: [{ model: User, as: 'owner', attributes: ['id', 'full_name'] }],
    });

    const buildingReports = await Promise.all(
      properties.map((p) => this.buildingReport(p.id, start, end))
    );

    const sumKey = (key) => buildingReports.reduce((s, r) => s + (r.summary[key] || 0), 0);
    const theoretical = sumKey('theoretical_rent');
    const collected = sumKey('collected_rent');
    const totalExp = sumKey('total_expenses');

    return {
      agency: { name: 'SMG IMMOBILIER', title: 'Rapport Global de Gestion Immobilière' },
      period: { start, end, months: this._monthsInPeriod(start, end) },
      summary: {
        total_properties: properties.length,
        theoretical_rent: theoretical,
        collected_rent: collected,
        unpaid_rent: sumKey('unpaid_rent'),
        remaining_to_collect: sumKey('remaining_to_collect'),
        collection_rate: theoretical > 0 ? Math.round((collected / theoretical) * 100) : 0,
        total_expenses: totalExp,
        net_result: collected - totalExp,
      },
      buildings: buildingReports,
    };
  }

  // ===== 4. RÉCAPITULATIF DES ENTRÉES PAR IMMEUBLE =====
  async inflowsRecap(start, end, propertyIds = null, ownerPropertyIds = null) {
    const whereProp = {};

    let targetPropIds = null;
    if (propertyIds) {
      const rawList = Array.isArray(propertyIds) ? propertyIds : String(propertyIds).split(',');
      const parsed = rawList.map(x => parseInt(String(x).trim(), 10)).filter(n => !isNaN(n) && n > 0);
      if (parsed.length > 0) {
        targetPropIds = parsed;
      }
    }

    if (targetPropIds && Array.isArray(ownerPropertyIds)) {
      const allowed = targetPropIds.filter(id => ownerPropertyIds.includes(id));
      whereProp.id = { [Op.in]: allowed.length ? allowed : [-1] };
    } else if (targetPropIds) {
      whereProp.id = targetPropIds.length === 1 ? targetPropIds[0] : { [Op.in]: targetPropIds };
    } else if (Array.isArray(ownerPropertyIds)) {
      whereProp.id = { [Op.in]: ownerPropertyIds };
    }

    const properties = await Property.findAll({
      where: whereProp,
      attributes: ['id', 'property_name', 'city', 'district'],
      include: [
        {
          model: Apartment, as: 'apartments',
          attributes: ['id', 'apartment_number'],
          include: [{ model: Tenant, as: 'tenants', attributes: ['id'] }],
        }
      ],
      order: [['property_name', 'ASC']]
    });

    const items = [];
    let grandTotalVirement = 0;
    let grandTotalCash = 0;
    let grandTotal = 0;

    for (const prop of properties) {
      const aptIds = (prop.apartments || []).map(a => a.id);
      const tenantIds = (prop.apartments || []).flatMap(a => (a.tenants || []).map(t => t.id)).filter(Boolean);
      let virement = 0;
      let cash = 0;

      const orConds = [];
      if (aptIds.length) orConds.push({ apartment_id: { [Op.in]: aptIds } });
      if (tenantIds.length) orConds.push({ tenant_id: { [Op.in]: tenantIds } });

      if (orConds.length) {
        const payments = await Payment.findAll({
          where: {
            [Op.or]: orConds,
            status: 'completed',
            payment_date: { [Op.between]: [start, end] },
          },
          attributes: ['id', 'amount', 'payment_method'],
        });

        payments.forEach(p => {
          const amt = num(p.amount);
          const m = String(p.payment_method || '').toLowerCase();
          if (m === 'bank_transfer' || m.includes('vir') || m === 'virement') {
            virement += amt;
          } else {
            cash += amt;
          }
        });
      }

      const total = virement + cash;
      grandTotalVirement += virement;
      grandTotalCash += cash;
      grandTotal += total;

      let dominanceBadge = 'Aucun encaissement';
      let dominanceClass = 'badge-muted';
      if (total > 0) {
        if (virement === total) {
          dominanceBadge = '100% Virement';
          dominanceClass = 'badge-info';
        } else if (cash === total) {
          dominanceBadge = '100% Cash';
          dominanceClass = 'badge-warning';
        } else if ((virement / total) >= 0.70) {
          dominanceBadge = 'Majoritairement Virement';
          dominanceClass = 'badge-success';
        } else if ((cash / total) >= 0.85) {
          dominanceBadge = 'Quasi-totalité Cash';
          dominanceClass = 'badge-danger';
        } else {
          dominanceBadge = 'Mixte';
          dominanceClass = 'badge-primary';
        }
      }

      items.push({
        property_id: prop.id,
        property_name: prop.property_name,
        city: prop.city,
        virement,
        cash,
        total,
        share: 0,
        dominance_badge: dominanceBadge,
        dominance_class: dominanceClass,
      });
    }

    // Calcul de la part du total global (%)
    items.forEach(it => {
      it.share = grandTotal > 0 ? Math.round((it.total / grandTotal) * 1000) / 10 : 0;
    });

    items.sort((a, b) => b.total - a.total);

    const pctVirement = grandTotal > 0 ? Math.round((grandTotalVirement / grandTotal) * 1000) / 10 : 0;
    const pctCash = grandTotal > 0 ? Math.round((grandTotalCash / grandTotal) * 1000) / 10 : 0;

    // Constats et observations automatiques
    const fmtVal = (val) => String(Math.round(val || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const observations = [];
    observations.push(`Sur la période du ${start} au ${end}, le volume total des entrées s'élève à ${fmtVal(grandTotal)} FCFA réparti sur ${items.length} immeuble(s).`);
    if (pctCash >= 60) {
      observations.push(`Forte prédominance des encaissements en Cash / Espèces (${pctCash}% contre ${pctVirement}% en Virement bancaire). Recommandation : encourager les virements bancaires pour sécuriser la trésorerie et renforcer la traçabilité.`);
    } else if (pctVirement >= 50) {
      observations.push(`Bonne bancarisation des flux avec ${pctVirement}% des loyers perçus par virement bancaire.`);
    } else {
      observations.push(`Encaissements équilibrés : ${pctVirement}% par virement bancaire et ${pctCash}% en cash/mobile money.`);
    }

    const top3 = items.filter(it => it.total > 0).slice(0, 3);
    if (top3.length > 0) {
      const topNames = top3.map(t => `${t.property_name} (${t.share}%)`).join(', ');
      const topShare = Math.round(top3.reduce((s, t) => s + t.share, 0) * 10) / 10;
      observations.push(`Concentration des recettes : Les contributeurs majeurs (${topNames}) représentent à eux seuls ${topShare}% des entrées globales.`);
    }

    const inactiveProps = items.filter(it => it.total === 0);
    if (inactiveProps.length > 0) {
      observations.push(`Suivi des loyers : ${inactiveProps.length} immeuble(s) n'ont enregistré aucune entrée sur cette période (${inactiveProps.map(p => p.property_name).join(', ')}).`);
    }

    return {
      period: { start, end },
      summary: {
        total_entrees: grandTotal,
        total_virement: grandTotalVirement,
        total_cash: grandTotalCash,
        percent_virement: pctVirement,
        percent_cash: pctCash,
      },
      items,
      observations,
    };
  }
}

module.exports = new ManagementReportService();
