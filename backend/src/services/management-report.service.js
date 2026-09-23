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
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s) || isNaN(e) || s > e) return 1;
    const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
    return Math.max(1, months);
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

    // Requêtes parallèles pour la période
    const [payments, maintenances, directExpenses] = await Promise.all([
      // Paiements dans la période
      Payment.findAll({
        where: {
          apartment_id: { [Op.in]: aptIds },
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

      // Dépenses directes rattachées à la propriété (hors maintenance)
      Expense.findAll({
        where: {
          property_id: propertyId,
          created_at: { [Op.between]: range },
        },
        order: [['created_at', 'ASC']],
      }),
    ]);

    // ===== Calculs Financiers =====
    // 1. Loyer théorique = somme des loyers des appartements occupés × nb de mois
    const occupiedApts = apts.filter((a) => a.status === 'occupied');
    const vacantApts = apts.filter((a) => a.status === 'free');
    const monthlyTheoretical = occupiedApts.reduce((s, a) => s + num(a.rent_amount), 0);
    const totalTheoretical = monthlyTheoretical * months;

    // 2. Loyers réellement encaissés
    const completedPayments = payments.filter((p) => p.status === 'completed');
    const totalCollected = completedPayments.reduce((s, p) => s + num(p.amount), 0);

    // 3. Reste à encaisser / impayés sur la période
    const unpaidPayments = payments.filter((p) => ['pending', 'failed', 'awaiting_confirmation'].includes(p.status));
    const totalUnpaid = unpaidPayments.reduce((s, p) => s + num(p.amount), 0);
    const remainingToCollect = Math.max(0, totalTheoretical - totalCollected);

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

    const otherExpenses = directExpenses.map((e) => ({
      id: e.id,
      date: e.createdAt,
      item_name: e.item_name,
      category: e.category || 'Autre',
      expense_type: e.expense_type || 'other',
      quantity: num(e.quantity) || 1,
      unit_price: num(e.unit_price),
      total_price: num(e.total_price),
      supplier: e.supplier || '—',
      apartment_number: 'Immeuble (commun)',
      maintenance_title: 'Dépense directe',
    }));

    const allExpenses = [...maintenanceExpenses, ...otherExpenses];
    const totalMaintenanceCost = maintenanceExpenses.reduce((s, e) => s + e.total_price, 0);
    const totalOtherCost = otherExpenses.reduce((s, e) => s + e.total_price, 0);
    const totalExpenses = totalMaintenanceCost + totalOtherCost;

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

    // Situation Locative (détail par appartement)
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
    });

    const aggregatedCollections = Array.from(collectionsMap.values()).map((c) => {
      const methodsList = Array.from(c.methods).join(', ') || 'Espèces';
      const receiptList = c.receipt_numbers.length ? c.receipt_numbers.join(',\n') : '—';

      let nature = '';
      const rent = c.rent_amount;
      const paid = c.total_collected;

      if (rent > 0) {
        const monthsPaid = Math.floor(paid / rent);
        if (paid === rent) {
          nature = 'Loyer du mois réglé';
        } else if (paid > rent) {
          if (monthsPaid >= 2) {
            nature = `Loyer couvrant ${monthsPaid} mois (avance / dette)`;
          } else {
            nature = `Loyer du mois + reliquat (+${Math.round(paid - rent)} F)`;
          }
        } else {
          nature = `Paiement partiel (reliquat : ${Math.round(rent - paid)} F)`;
        }
      } else {
        nature = 'Règlement loyer';
      }

      c.dates.sort();
      const firstDate = c.dates[0];
      const lastDate = c.dates[c.dates.length - 1];
      let dateRange = '—';
      if (firstDate && lastDate && firstDate !== lastDate) {
        dateRange = `Du ${firstDate.slice(8, 10)}/${firstDate.slice(5, 7)} au ${lastDate.slice(8, 10)}/${lastDate.slice(5, 7)}`;
      } else if (firstDate) {
        dateRange = `${firstDate.slice(8, 10)}/${firstDate.slice(5, 7)}/${firstDate.slice(0, 4)}`;
      }

      return {
        apartment_number: c.apartment_number,
        tenant_name: c.tenant_name,
        total_collected: c.total_collected,
        transaction_count: c.transaction_count,
        methods: methodsList,
        receipt_numbers: receiptList,
        date_range: dateRange,
        nature: nature,
      };
    });

    // Résultat net de la période
    const netResult = totalCollected - totalExpenses;

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
        maintenance_expenses: totalMaintenanceCost,
        other_expenses: totalOtherCost,
        total_expenses: totalExpenses,
        net_result: netResult,
      },
      rental_situation: {
        total_apartments: apts.length,
        occupied_apartments: occupiedApts.length,
        vacant_apartments: vacantApts.length,
        occupancy_rate: apts.length > 0 ? Math.round((occupiedApts.length / apts.length) * 100) : 0,
        apartments: apartmentList,
      },
      apartments: apartmentList,
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
}

module.exports = new ManagementReportService();
