const { Tenant, User, Apartment, Property, Lease, Payment, Maintenance, Expense, Worksite, StockItem, StockPurchase, Salary, Warehouse } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const ledgerService = require('./ledger.service');

const num = (v) => parseFloat(v) || 0;
const UNPAID = ['pending', 'failed', 'awaiting_confirmation'];

const mapPaymentMethod = (method) => {
  if (!method) return 'cash';
  const m = String(method).toLowerCase();
  if (m.includes('orange') || m.includes('om')) return 'orange_money';
  if (m.includes('mtn') || m.includes('momo') || m.includes('mobile')) return 'mtn_mobile_money';
  if (m.includes('transfer') || m.includes('virement') || m.includes('bank') || m.includes('vir')) return 'bank_transfer';
  return 'cash';
};

function parsePeriodDates(str) {
  if (!str) return { period_start: null, period_end: null };
  const dates = [];
  const parts = String(str).split(/[-–—àau]/i);
  for (const p of parts) {
    const trimmed = p.trim();
    const dmy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmy) {
      dates.push(`${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`);
    } else {
      const ymd = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
      if (ymd) {
        dates.push(`${ymd[1]}-${String(ymd[2]).padStart(2, '0')}-${String(ymd[3]).padStart(2, '0')}`);
      }
    }
  }
  return {
    period_start: dates[0] || null,
    period_end: dates[1] || null,
  };
}

class ReportService {
  _range(start, end) { return [`${start} 00:00:00`, `${end} 23:59:59`]; }

  // Logement effectif (direct ou via bail actif) → { numero, immeuble, property_id }
  _effectiveApartment(t) {
    let apt = t.apartment;
    if (!apt && Array.isArray(t.leases)) {
      const l = t.leases.find((x) => x.status === 'active' && x.apartment) || t.leases.find((x) => x.apartment);
      if (l) apt = l.apartment;
    }
    return apt || null;
  }

  // ===== Situation de chaque locataire =====
  async tenantsSituation(ownerPropertyIds = null) {
    const tenants = await Tenant.findAll({
      include: [
        { model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] },
        { model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number', 'apartment_type', 'description', 'rent_amount'], include: [{ model: Property, as: 'property', attributes: ['id', 'property_name'] }] },
        { model: Lease, as: 'leases', attributes: ['id', 'status', 'start_date', 'end_date', 'monthly_rent', 'deposit_amount', 'apartment_id'], include: [{ model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number', 'apartment_type', 'description'], include: [{ model: Property, as: 'property', attributes: ['id', 'property_name'] }] }] },
        { model: Payment, as: 'payments', attributes: ['id', 'amount', 'status', 'payment_date', 'payment_method', 'period_start', 'period_end'] },
      ],
      order: [['created_at', 'DESC']],
    });

    const ym = new Date().toISOString().slice(0, 7);
    const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

    const mapped = tenants.map((t) => {
      const o = t.toJSON();
      const apt = this._effectiveApartment(o);
      const payments = o.payments || [];
      const led = ledgerService.computeFromTenant(t);
      const doit = Math.max(0, led.solde);
      const completed = payments.filter((p) => p.status === 'completed')
        .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
      const activeLease = (o.leases || []).find((l) => l.status === 'active') || (o.leases || [])[0] || null;
      const monthly = (activeLease && num(activeLease.monthly_rent)) || (apt ? num(apt.rent_amount) : 0);
      const caution = (activeLease && num(activeLease.deposit_amount)) || 0;
      const versementMois = payments.filter((p) => p.status === 'completed' && String(p.payment_date).slice(0, 7) === ym).reduce((s, p) => s + num(p.amount), 0);
      const last = completed[0] || null;
      const solde = led.solde || 0;
      const arriere = Math.max(0, solde);
      const anticipation = Math.max(0, -solde);

      let periodePaiement = '—';
      if (last) {
        if (last.period_start && last.period_end) {
          periodePaiement = `${fmt(last.period_start)} au ${fmt(last.period_end)}`;
        } else if (last.payment_date) {
          periodePaiement = fmt(last.payment_date);
        }
      }

      return {
        tenant_id: o.id,
        apartment_id: apt ? apt.id : null,
        nom: o.user ? o.user.full_name : '—',
        nom_locataire: o.user ? o.user.full_name : '—',
        telephone: o.user ? o.user.phone : '—',
        doit,
        a_jour: doit <= 0,
        statut_compte: led.statut,
        prochaine_echeance: led.prochaine_echeance || null,
        jours_restants: led.jours_restants,
        statut_echeance: led.statut_echeance || 'ok',
        echeance_message: led.echeance_message || '',
        fin_bail: activeLease ? activeLease.end_date : null,
        logement: apt ? apt.apartment_number : null,
        numero_chambre: apt ? apt.apartment_number : '—',
        immeuble: apt && apt.property ? apt.property.property_name : null,
        property_id: apt && apt.property ? apt.property.id : null,
        description_logement: (apt && (apt.description || apt.apartment_type)) || '—',
        montant_loyer: monthly,
        arriere_loyer: arriere,
        anticipation,
        versement_mois: versementMois,
        periode_paiement: periodePaiement,
        mode_paiement: last ? (last.payment_method || 'cash') : '—',
        caution,
        observations: o.observations || (led.echeance_message ? led.echeance_message : (arriere <= 0 ? 'À jour' : `Impayé ${Math.round(arriere).toLocaleString('fr-FR')} FCFA`)),
        statut: o.status,
      };
    });

    if (Array.isArray(ownerPropertyIds)) {
      return mapped.filter((r) => r.property_id && ownerPropertyIds.includes(Number(r.property_id)));
    }
    return mapped;
  }

  // ===== Situation d'un immeuble (modèle standardisé 12 colonnes fidèle au modèle Excel) =====
  async buildingSituation(propertyId, ownerPropertyIds = null, targetMonth = null, targetYear = null, startDate = null, endDate = null) {
    if (Array.isArray(ownerPropertyIds) && !ownerPropertyIds.includes(Number(propertyId))) {
      throw Object.assign(new Error('Accès non autorisé à cet immeuble'), { status: 403 });
    }
    const property = await Property.findByPk(propertyId, {
      include: [{
        model: Apartment, as: 'apartments',
        attributes: ['id', 'apartment_number', 'rent_amount', 'apartment_type', 'description'],
        include: [
          {
            model: Tenant, as: 'tenants', required: false, where: { status: 'active' },
            include: [
              { model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] },
              { model: Lease, as: 'leases', attributes: ['start_date', 'end_date', 'monthly_rent', 'deposit_amount', 'status'] },
              { model: Payment, as: 'payments', attributes: ['id', 'amount', 'status', 'payment_date', 'payment_method', 'period_start', 'period_end', 'observations', 'tenant_id'] },
            ],
          },
          {
            model: Payment, as: 'payments', required: false,
            attributes: ['id', 'amount', 'status', 'payment_date', 'payment_method', 'period_start', 'period_end', 'observations', 'tenant_id'],
          },
        ],
      }],
    });
    if (!property) throw Object.assign(new Error('Immeuble introuvable'), { status: 404 });

    const now = new Date();
    let year = targetYear ? Number(targetYear) : null;
    let month = targetMonth ? Number(targetMonth) : null;

    if (!year || !month) {
      const refDate = String(endDate || startDate || '').trim();
      if (refDate && refDate.length >= 7 && refDate.includes('-')) {
        const parts = refDate.split('-');
        if (parts[0] && parts[1] && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
          year = year || parseInt(parts[0], 10);
          month = month || parseInt(parts[1], 10);
        }
      }
    }
    year = year || now.getFullYear();
    month = month || (now.getMonth() + 1); // 1 - 12

    const ym = `${year}-${String(month).padStart(2, '0')}`;
    const MOIS_FR = ['', 'JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE'];
    const moisNom = MOIS_FR[month] || '';
    const periodeLibelle = (startDate && endDate)
      ? `DU ${startDate} AU ${endDate}`
      : `${moisNom} ${year}`.trim();

    const fmtFR = (d) => {
      if (!d) return null;
      const s = String(d).slice(0, 10);
      const p = s.split('-');
      return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
    };

    const methodLabels = {
      virement: 'virement',
      bank_transfer: 'virement',
      cash: 'cash',
      orange_money: 'Orange Money',
      mtn_mobile_money: 'MTN MoMo',
      campay: 'Mobile Money',
    };

    const apts = (property.apartments || []).slice().sort((a, b) => String(a.apartment_number).localeCompare(String(b.apartment_number), 'fr', { numeric: true }));
    let lignes = apts.map((a) => {
      const activeTenants = (a.tenants || []).slice().sort((x, y) => y.id - x.id);
      const t = activeTenants[0];
      const base = {
        tenant_id: null,
        apartment_id: a.id,
        numero_chambre: a.apartment_number,
        nom_locataire: '—',
        telephone: '—',
        montant_loyer: num(a.rent_amount),
        description_logement: a.description || a.apartment_type || 'vide',
        arriere_loyer: 0,
        versement_mois: 0,
        anticipation: 0,
        periode_paiement: '—',
        mode_paiement: '—',
        observations: 'Logement libre / vide',
        caution: 0,
      };
      if (!t) return base;

      const lease = (t.leases || []).find((l) => l.status === 'active') || (t.leases || [])[0] || null;
      const monthly = (lease && num(lease.monthly_rent)) || num(a.rent_amount);
      const start = (lease && lease.start_date) || t.start_date;

      // Fusionner les paiements du locataire et ceux rattachés directement au logement
      const tenantPayments = t.payments || [];
      const aptPayments = a.payments || [];
      const paymentMap = new Map();
      tenantPayments.forEach((p) => paymentMap.set(p.id, p));
      aptPayments.forEach((p) => paymentMap.set(p.id, p));
      const payments = Array.from(paymentMap.values());

      const completedPayments = payments.filter((p) => p.status === 'completed');
      const valide = completedPayments.reduce((s, p) => s + num(p.amount), 0);
      
      // Versements réalisés AU COURS du mois cible ou de la période sélectionnée
      const paiementsDuMois = completedPayments.filter((p) => {
        if (!p.payment_date) return false;
        const dStr = String(p.payment_date).slice(0, 10);
        if (startDate && endDate) {
          return dStr >= String(startDate).slice(0, 10) && dStr <= String(endDate).slice(0, 10);
        }
        return dStr.slice(0, 7) === ym;
      });
      const versementMois = paiementsDuMois.reduce((s, p) => s + num(p.amount), 0);
      
      // Dernier paiement fait dans la période cible (pour afficher période et mode)
      const lastDuMois = paiementsDuMois.slice().sort((x, y) => new Date(y.payment_date || 0) - new Date(x.payment_date || 0))[0];
      // Dernier paiement global (fallback)
      const lastGlobal = payments.slice().sort((x, y) => new Date(y.payment_date || 0) - new Date(x.payment_date || 0))[0];
      const last = lastDuMois || lastGlobal;
      const caution = (lease && num(lease.deposit_amount)) || 0;

      // Calcul intelligent des arriérés et de l'anticipation par rapport au mois cible
      let dette = 0;
      let anticipation = 0;
      let couvertJusqu = null;

      // Chercher le dernier period_end payé
      const lastCompletedWithEnd = completedPayments.filter(p => p.period_end).sort((x, y) => new Date(y.period_end) - new Date(x.period_end))[0];

      if (monthly > 0 && lastCompletedWithEnd && lastCompletedWithEnd.period_end) {
        const coverEnd = new Date(lastCompletedWithEnd.period_end);
        couvertJusqu = fmtFR(lastCompletedWithEnd.period_end);
        const endYear = coverEnd.getFullYear();
        const endMonth = coverEnd.getMonth() + 1; // Le mois de period_end = dernier mois couvert
        const diffMonths = (year - endYear) * 12 + (month - endMonth);

        if (diffMonths > 0) {
          dette = diffMonths * monthly;
          anticipation = 0;
        } else if (diffMonths < 0) {
          anticipation = Math.abs(diffMonths) * monthly;
          dette = 0;
        } else {
          dette = 0;
          anticipation = 0;
        }
      } else if (monthly > 0 && start && !isNaN(new Date(start).getTime())) {
        const sDate = new Date(start);
        const totalMonthsDue = Math.max(1, (year - sDate.getFullYear()) * 12 + (month - (sDate.getMonth() + 1)) + 1);
        const totalDu = totalMonthsDue * monthly;
        const solde = totalDu - valide;
        if (solde > 0) {
          dette = solde;
          anticipation = 0;
        } else if (solde < 0) {
          anticipation = Math.abs(solde);
          dette = 0;
        } else {
          dette = 0;
          anticipation = 0;
        }
        const moisPayes = Math.floor(valide / monthly);
        const d = new Date(start);
        if (!isNaN(d.getTime())) {
          d.setMonth(d.getMonth() + moisPayes);
          couvertJusqu = fmtFR(d.toISOString().slice(0, 10));
        }
      }

      // Période correspondant au paiement (priorité au paiement du mois cible)
      let periodePaiement = '—';
      const pRef = lastDuMois || last; // Priorité au paiement du mois cible
      if (pRef) {
        if (pRef.period_start && pRef.period_end) {
          periodePaiement = `${fmtFR(pRef.period_start)} au ${fmtFR(pRef.period_end)}`;
        } else if (couvertJusqu) {
          periodePaiement = `Jusqu'au ${couvertJusqu}`;
        } else if (pRef.payment_date) {
          periodePaiement = fmtFR(pRef.payment_date);
        }
      } else if (couvertJusqu) {
        periodePaiement = `Jusqu'au ${couvertJusqu}`;
      }

      // Observations
      let obs = (t.observations && t.observations.trim()) || (last?.observations && last.observations.trim());
      if (!obs) {
        if (dette > 0) {
          obs = `Arriéré ~${Math.round(dette / monthly)} mois`;
        } else if (anticipation > 0) {
          obs = `Avance ~${Math.round(anticipation / monthly)} mois`;
        } else {
          obs = `À jour${couvertJusqu ? " (couvert " + couvertJusqu + ")" : ''}`;
        }
      }

      return {
        tenant_id: t.id,
        apartment_id: a.id,
        numero_chambre: a.apartment_number,
        nom_locataire: t.user ? t.user.full_name : '—',
        telephone: t.user ? (t.user.phone || '—') : '—',
        montant_loyer: monthly,
        description_logement: a.description || a.apartment_type || '—',
        arriere_loyer: dette,
        versement_mois: versementMois,
        anticipation,
        periode_paiement: periodePaiement,
        mode_paiement: (lastDuMois || last) ? (methodLabels[(lastDuMois || last).payment_method] || (lastDuMois || last).payment_method || '—') : '—',
        observations: obs,
        caution,
      };
    });

    // Application des surcharges manuelles (overrides) enregistrées pour corriger les incohérences
    try {
      const rawOverrides = await sequelize.query(
        `SELECT * FROM situation_overrides
         WHERE property_id = :propertyId
         ORDER BY
           (CASE WHEN period_ym = :ym THEN 0 WHEN period_ym IS NULL THEN 1 ELSE 2 END) ASC,
           period_ym DESC,
           updated_at DESC`,
        { replacements: { propertyId, ym }, type: sequelize.QueryTypes.SELECT }
      );
      if (rawOverrides && rawOverrides.length > 0) {
        const overridesMap = new Map();
        const overridesByNum = new Map();
        rawOverrides.forEach((ov) => {
          if (ov.apartment_id && !overridesMap.has(Number(ov.apartment_id))) {
            overridesMap.set(Number(ov.apartment_id), ov);
          }
          if (ov.numero_chambre && !overridesByNum.has(String(ov.numero_chambre).trim().toLowerCase())) {
            overridesByNum.set(String(ov.numero_chambre).trim().toLowerCase(), ov);
          }
        });

        lignes = lignes.map((row) => {
          const ov = (row.apartment_id && overridesMap.get(Number(row.apartment_id)))
            || (row.numero_chambre && overridesByNum.get(String(row.numero_chambre).trim().toLowerCase()))
            || null;
          if (!ov) return row;

          const numOrVal = (val, fallback) => (val !== null && val !== undefined && !isNaN(Number(val))) ? Number(val) : fallback;
          const strOrVal = (val, fallback) => (val !== null && val !== undefined && String(val).trim() !== '') ? String(val).trim() : fallback;

          return {
            ...row,
            numero_chambre: strOrVal(ov.numero_chambre, row.numero_chambre),
            nom_locataire: strOrVal(ov.nom_locataire, row.nom_locataire),
            telephone: strOrVal(ov.telephone, row.telephone),
            montant_loyer: numOrVal(ov.montant_loyer, row.montant_loyer),
            description_logement: strOrVal(ov.description_logement, row.description_logement),
            arriere_loyer: numOrVal(ov.arriere_loyer, row.arriere_loyer),
            anticipation: numOrVal(ov.anticipation, row.anticipation),
            versement_mois: numOrVal(ov.versement_mois, row.versement_mois),
            periode_paiement: strOrVal(ov.periode_paiement, row.periode_paiement),
            mode_paiement: strOrVal(ov.mode_paiement, row.mode_paiement),
            caution: numOrVal(ov.caution, row.caution),
            observations: strOrVal(ov.observations, row.observations),
            is_overridden: true,
          };
        });
      }
    } catch (e) {
      console.warn('Erreur lors du chargement des surcharges de situation:', e.message);
    }

    const sum = (k) => lignes.reduce((s, l) => s + (Number(l[k]) || 0), 0);
    return {
      immeuble: property.property_name,
      property_id: property.id,
      mois: month,
      annee: year,
      periode: ym,
      periode_libelle: periodeLibelle,
      lignes,
      total: {
        montant_loyer: sum('montant_loyer'),
        arriere_loyer: sum('arriere_loyer'),
        versement_mois: sum('versement_mois'),
        anticipation: sum('anticipation'),
        caution: sum('caution'),
      },
    };
  }

  // ===== Récap par période : par locataire, par immeuble, maintenance =====
  async periodRecap(start, end, ownerPropertyIds = null, filterPropertyIds = null) {
    const range = this._range(start, end);

    // filterPropertyIds = filtre explicite choisi par l'utilisateur dans le frontend
    // ownerPropertyIds = restriction d'accès bailleur
    let effectiveIds = null;
    if (Array.isArray(filterPropertyIds) && filterPropertyIds.length > 0) {
      // Si filtre explicite, on intersecte avec les droits du bailleur
      if (Array.isArray(ownerPropertyIds)) {
        effectiveIds = filterPropertyIds.filter((id) => ownerPropertyIds.includes(Number(id)));
      } else {
        effectiveIds = filterPropertyIds;
      }
    } else if (Array.isArray(ownerPropertyIds)) {
      effectiveIds = ownerPropertyIds;
    }

    const propWhere = effectiveIds ? { id: { [Op.in]: effectiveIds } } : {};
    const aptWhere = effectiveIds ? { property_id: { [Op.in]: effectiveIds } } : {};

    const [payments, properties, maintenances, expenses, activeTenants] = await Promise.all([
      Payment.findAll({
        where: { payment_date: { [Op.between]: range } },
        include: [
          { model: Tenant, as: 'tenant', attributes: ['id'], include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }] },
          { model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number', 'property_id'], where: aptWhere, include: [{ model: Property, as: 'property', attributes: ['id', 'property_name'] }] },
        ],
      }),
      Property.findAll({
        where: propWhere,
        attributes: ['id', 'property_name'],
        include: [{ model: Apartment, as: 'apartments', attributes: ['id', 'status', 'rent_amount'] }],
      }),
      Maintenance.findAll({
        where: { created_at: { [Op.between]: range } },
        include: [{ model: Apartment, as: 'apartment', attributes: ['id', 'property_id'], where: aptWhere, include: [{ model: Property, as: 'property', attributes: ['id', 'property_name'] }] }],
      }),
      Expense.findAll({
        where: { created_at: { [Op.between]: range } },
        include: [{ model: Maintenance, as: 'maintenance', attributes: ['id', 'apartment_id'], include: [{ model: Apartment, as: 'apartment', attributes: ['id', 'property_id'], where: aptWhere }] }],
      }),
      Tenant.findAll({
        where: { status: 'active' },
        include: [
          { model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] },
          { model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number', 'apartment_type', 'rent_amount', 'property_id'], where: aptWhere, include: [{ model: Property, as: 'property', attributes: ['id', 'property_name'] }] },
          { model: Lease, as: 'leases', attributes: ['id', 'status', 'start_date', 'end_date', 'monthly_rent', 'deposit_amount'] },
          { model: Payment, as: 'payments', attributes: ['id', 'amount', 'status', 'payment_date', 'period_start', 'period_end'] },
        ],
      }),
    ]);

    // --- Par locataire ---
    const byTenantMap = {};

    // 1. Initialiser tous les locataires actifs avec leur situation financière réelle
    activeTenants.forEach((t) => {
      const id = t.id;
      const apt = t.apartment;
      const prop = apt ? apt.property : null;
      const led = ledgerService.computeFromTenant(t);
      const dette = Math.max(0, led.solde || 0);

      byTenantMap[id] = {
        tenant_id: id,
        apartment_id: apt ? apt.id : null,
        nom: (t.user && t.user.full_name) || '—',
        immeuble: (prop && prop.property_name) || '—',
        logement: apt ? apt.apartment_number : '—',
        property_id: apt ? apt.property_id : null,
        paye: 0,
        impaye: dette,
        nb_paiements: 0,
      };
    });

    // 2. Agréger les paiements effectués dans la période [start, end]
    payments.forEach((p) => {
      const id = p.tenant_id;
      if (!id) return;
      if (!byTenantMap[id]) {
        byTenantMap[id] = {
          tenant_id: id,
          apartment_id: p.apartment ? p.apartment.id : null,
          nom: (p.tenant && p.tenant.user && p.tenant.user.full_name) || '—',
          immeuble: (p.apartment && p.apartment.property && p.apartment.property.property_name) || '—',
          logement: p.apartment ? p.apartment.apartment_number : '—',
          property_id: p.apartment ? p.apartment.property_id : null,
          paye: 0,
          impaye: 0,
          nb_paiements: 0,
        };
      }
      const row = byTenantMap[id];
      if (p.status === 'completed') {
        row.paye += num(p.amount);
        row.nb_paiements += 1;
      } else if (UNPAID.includes(p.status)) {
        if (row.impaye === 0) row.impaye += num(p.amount);
      }
    });

    // 3. Intégration des surcharges manuelles de la situation (situation_overrides)
    try {
      const overrides = await sequelize.query(
        `SELECT * FROM situation_overrides`,
        { type: sequelize.QueryTypes.SELECT }
      );
      if (overrides && overrides.length > 0) {
        for (const ov of overrides) {
          const matched = Object.values(byTenantMap).find((r) =>
            (ov.tenant_id && r.tenant_id === Number(ov.tenant_id)) ||
            (ov.apartment_id && r.apartment_id === Number(ov.apartment_id))
          );
          if (matched) {
            if (ov.arriere_loyer !== null && ov.arriere_loyer !== undefined) {
              matched.impaye = num(ov.arriere_loyer);
            }
            if (ov.nom_locataire) {
              matched.nom = ov.nom_locataire;
            }
            if (ov.numero_chambre) {
              matched.logement = ov.numero_chambre;
            }
          }
        }
      }
    } catch (e) {
      // Ignorer si indisponible
    }

    // --- Coût maintenance par immeuble (depuis les dépenses) ---
    const costByProp = {};
    let maintCostTotal = 0;
    expenses.forEach((e) => {
      const propId = e.maintenance && e.maintenance.apartment ? e.maintenance.apartment.property_id : null;
      const c = num(e.total_price);
      maintCostTotal += c;
      if (propId) costByProp[propId] = (costByProp[propId] || 0) + c;
    });

    // --- Maintenance par immeuble (comptes) ---
    const maintCountByProp = {};
    const maintStatus = { reported: 0, validated: 0, in_progress: 0, completed: 0, cancelled: 0 };
    maintenances.forEach((m) => {
      if (m.status in maintStatus) maintStatus[m.status] += 1;
      const propId = m.apartment ? m.apartment.property_id : null;
      const propName = (m.apartment && m.apartment.property && m.apartment.property.property_name) || '—';
      if (propId) {
        maintCountByProp[propId] = maintCountByProp[propId] || { immeuble: propName, total: 0 };
        maintCountByProp[propId].total += 1;
      }
    });

    // --- Par immeuble (encaissements + impayés réels + occupation + maintenance) ---
    const encByProp = {};
    const unpaidByProp = {};

    Object.values(byTenantMap).forEach((tRow) => {
      if (tRow.property_id) {
        encByProp[tRow.property_id] = (encByProp[tRow.property_id] || 0) + (tRow.paye || 0);
        unpaidByProp[tRow.property_id] = (unpaidByProp[tRow.property_id] || 0) + (tRow.impaye || 0);
      }
    });

    const byProperty = properties.map((pr) => {
      const apts = pr.apartments || [];
      return {
        property_id: pr.id, immeuble: pr.property_name,
        encaisse: encByProp[pr.id] || 0, impaye: unpaidByProp[pr.id] || 0,
        logements: apts.length, occupes: apts.filter((a) => a.status === 'occupied').length,
        maintenances: maintCountByProp[pr.id] ? maintCountByProp[pr.id].total : 0,
        cout_maintenance: costByProp[pr.id] || 0,
      };
    });

    const tenantRows = Object.values(byTenantMap)
      .filter((t) => t.paye > 0 || t.impaye > 0 || t.nb_paiements > 0)
      .sort((a, b) => b.paye - a.paye || b.impaye - a.impaye);

    return {
      start, end,
      byTenant: tenantRows.length > 0 ? tenantRows : Object.values(byTenantMap).sort((a, b) => b.paye - a.paye),
      byProperty: byProperty.sort((a, b) => b.encaisse - a.encaisse),
      maintenance: {
        total: maintenances.length, ...maintStatus,
        cout: maintCostTotal,
        byProperty: Object.values(maintCountByProp).sort((a, b) => b.total - a.total),
      },
    };
  }

  // ===== Bilan Financier Global de l'Entreprise & Rentabilité Chantiers =====
  async companyFinancialBalance(start, end) {
    const range = this._range(start, end);

    const [
      worksites,
      payments,
      stockItems,
      stockPurchases,
      salaries,
      expenses,
      warehouses,
    ] = await Promise.all([
      Worksite.findAll({
        order: [['createdAt', 'DESC']],
      }),
      Payment.findAll({
        where: {
          payment_date: { [Op.between]: [start, end] },
          status: 'completed',
        },
      }),
      StockItem.findAll(),
      StockPurchase.findAll({
        where: {
          purchase_date: { [Op.between]: [start, end] },
        },
      }),
      Salary.findAll({
        where: {
          status: 'paid',
        },
        include: [{ model: User, as: 'employee', attributes: ['id', 'full_name'] }],
      }),
      Expense.findAll({
        where: {
          created_at: { [Op.between]: range },
        },
      }),
      Warehouse.findAll({ where: { is_active: true } }),
    ]);

    // 1. Analyse des Chantiers
    const filteredWorksites = worksites.filter((ws) => {
      const d = ws.start_date || (ws.createdAt ? ws.createdAt.toISOString().slice(0, 10) : null);
      if (!d) return true;
      return d <= end;
    });

    const worksitesDetail = filteredWorksites.map((ws) => {
      const revenue = num(ws.contract_amount) || num(ws.budget);
      const matCost = num(ws.material_cost);
      const laborCost = num(ws.labor_cost);
      const otherCost = num(ws.other_cost);
      const spent = num(ws.spent_amount);
      const totalCost = spent > 0 ? spent : (matCost + laborCost + otherCost);
      const netProfit = revenue - totalCost;
      const marginPct = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;

      return {
        id: ws.id,
        title: ws.title,
        client_name: ws.client_name || 'Client direct',
        location: ws.location || '—',
        worksite_type: ws.worksite_type || 'interne',
        status: ws.status,
        contractor: ws.contractor || 'Équipe interne',
        start_date: ws.start_date || (ws.createdAt ? ws.createdAt.toISOString().slice(0, 10) : '—'),
        revenue,
        contract_amount: revenue,
        material_cost: matCost,
        labor_cost: laborCost,
        other_cost: otherCost,
        total_cost: totalCost,
        spent_amount: totalCost,
        net_profit: netProfit,
        profit: netProfit,
        margin_pct: marginPct,
      };
    });

    // Totaux Chantiers
    const totalWorksitesRevenue = worksitesDetail.reduce((s, w) => s + w.revenue, 0);
    const totalWorksitesMaterials = worksitesDetail.reduce((s, w) => s + w.material_cost, 0);
    const totalWorksitesLabor = worksitesDetail.reduce((s, w) => s + w.labor_cost, 0);
    const totalWorksitesCost = worksitesDetail.reduce((s, w) => s + w.total_cost, 0);

    // 2. Activité Locative & Commissions Agence
    const totalRentsCollected = payments.reduce((s, p) => s + num(p.amount), 0);
    // Honoraires / Commission de gestion agence estimés à 10%
    const agencyCommission = Math.round(totalRentsCollected * 0.10);

    // 3. Stocks & Approvisionnements Magasins
    const totalStockValuation = stockItems.reduce((s, it) => s + (num(it.quantity) * num(it.unit_price_avg)), 0);
    const totalStockPurchasesPeriod = stockPurchases.reduce((s, sp) => s + num(sp.total_amount), 0);

    // 4. Salaires & Charges de Personnel sur la période
    const periodSalaries = salaries.filter((sal) => {
      const d = sal.paid_date || (sal.updatedAt ? sal.updatedAt.toISOString().slice(0, 10) : null);
      if (!d) return true;
      return d >= start && d <= end;
    });
    const totalSalariesPaid = periodSalaries.reduce((s, sal) => s + num(sal.net_salary), 0);

    // 5. Autres Dépenses Générales
    const totalGeneralExpenses = expenses.reduce((s, exp) => s + num(exp.total_price), 0);

    // 6. Synthèse Globale Entreprise
    const grossIncome = totalWorksitesRevenue + agencyCommission;
    const grandTotalCosts = totalWorksitesCost + totalSalariesPaid + totalGeneralExpenses;
    const netCompanyProfit = grossIncome - grandTotalCosts;
    const companyMarginPct = grossIncome > 0 ? Math.round((netCompanyProfit / grossIncome) * 100) : 0;

    const summary = {
      total_revenue: grossIncome,
      worksites_billed_revenue: totalWorksitesRevenue,
      agency_commission_revenue: agencyCommission,
      materials_and_stock_cost: totalWorksitesMaterials + totalStockPurchasesPeriod,
      worksites_materials_cost: totalWorksitesMaterials,
      stock_purchases_period: totalStockPurchasesPeriod,
      labor_and_payroll_cost: totalWorksitesLabor + totalSalariesPaid,
      worksites_labor_cost: totalWorksitesLabor,
      salaries_paid_cost: totalSalariesPaid,
      worksites_total_spent: totalWorksitesCost,
      worksites_net_profit: totalWorksitesRevenue - totalWorksitesCost,
      net_operating_profit: netCompanyProfit,
      profit_margin_pct: companyMarginPct,
    };

    return {
      period: { start, end },
      summary,
      kpis: {
        gross_income: grossIncome,
        worksites_revenue: totalWorksitesRevenue,
        agency_commission: agencyCommission,
        rents_collected: totalRentsCollected,
        total_costs: grandTotalCosts,
        worksites_cost: totalWorksitesCost,
        worksites_materials: totalWorksitesMaterials,
        worksites_labor: totalWorksitesLabor,
        salaries_paid: totalSalariesPaid,
        general_expenses: totalGeneralExpenses,
        net_profit: netCompanyProfit,
        margin_pct: companyMarginPct,
        stock_valuation: Math.round(totalStockValuation),
        stock_purchases_period: totalStockPurchasesPeriod,
        warehouses_count: warehouses.length,
        worksites_count: worksitesDetail.length,
      },
      stock_valuation_total: Math.round(totalStockValuation),
      rental_management: {
        total_collected: totalRentsCollected,
        agency_commission: agencyCommission,
      },
      worksites: worksitesDetail,
      warehouses: warehouses.map((wh) => ({ id: wh.id, name: wh.name, city: wh.city, warehouse_type: wh.warehouse_type })),
      salaries_summary: {
        total_paid: totalSalariesPaid,
        count: periodSalaries.length,
      },
    };
  }

  // ===== Mise à jour en direct d'une ligne du tableau de situation (12 Colonnes complètes) =====
  async updateSituationLine(data) {
    const {
      apartment_id,
      tenant_id,
      property_id,
      period_ym,
      numero_chambre,
      nom_locataire,
      telephone,
      montant_loyer,
      description_logement,
      arriere_loyer,
      anticipation,
      versement_mois,
      periode_paiement,
      mode_paiement,
      caution,
      observations,
    } = data;

    if (!apartment_id) throw Object.assign(new Error('ID du logement requis'), { status: 400 });

    const apt = await Apartment.findByPk(apartment_id);
    if (!apt) throw Object.assign(new Error('Logement introuvable'), { status: 404 });
    const effPropId = property_id || apt.property_id;

    // 1. Mise à jour de l'appartement
    const aptUpdates = {};
    if (numero_chambre !== undefined && String(numero_chambre).trim() !== '') {
      aptUpdates.apartment_number = String(numero_chambre).trim();
    }
    if (description_logement !== undefined) {
      aptUpdates.description = String(description_logement).trim();
    }
    if (montant_loyer !== undefined && !isNaN(Number(montant_loyer))) {
      aptUpdates.rent_amount = Number(montant_loyer);
    }
    if (Object.keys(aptUpdates).length > 0) {
      await apt.update(aptUpdates);
    }

    // 2. Mise à jour du locataire et bail actif
    let effTenantId = tenant_id;
    if (!effTenantId) {
      const activeTenant = await Tenant.findOne({ where: { apartment_id: apt.id, status: 'active' } });
      if (activeTenant) effTenantId = activeTenant.id;
    }

    if (effTenantId) {
      const tenant = await Tenant.findByPk(effTenantId, {
        include: [{ model: User, as: 'user' }],
      });
      if (tenant) {
        if (tenant.user) {
          const userUpdates = {};
          if (nom_locataire !== undefined && String(nom_locataire).trim() !== '') {
            userUpdates.full_name = String(nom_locataire).trim();
          }
          if (telephone !== undefined) {
            userUpdates.phone = String(telephone).trim();
          }
          if (Object.keys(userUpdates).length > 0) {
            await tenant.user.update(userUpdates);
          }
        }
        if (observations !== undefined) {
          await tenant.update({ observations: String(observations).trim() });
        }

        const leaseUpdates = {};
        if (montant_loyer !== undefined && !isNaN(Number(montant_loyer))) {
          leaseUpdates.monthly_rent = Number(montant_loyer);
        }
        if (caution !== undefined && !isNaN(Number(caution))) {
          leaseUpdates.deposit_amount = Number(caution);
        }
        if (Object.keys(leaseUpdates).length > 0) {
          await Lease.update(
            leaseUpdates,
            { where: { tenant_id: tenant.id, status: 'active' } }
          );
        }
      }
    }

    // 3. Enregistrement persistant dans la table situation_overrides
    const cleanNum = (val) => (val !== undefined && val !== null && val !== '' && !isNaN(Number(val))) ? Number(val) : null;
    const cleanStr = (val) => (val !== undefined && val !== null) ? String(val).trim() : null;

    const overrideFields = {
      property_id: Number(effPropId),
      apartment_id: Number(apt.id),
      tenant_id: effTenantId ? Number(effTenantId) : null,
      period_ym: period_ym ? String(period_ym).trim() : null,
      numero_chambre: cleanStr(numero_chambre),
      nom_locataire: cleanStr(nom_locataire),
      telephone: cleanStr(telephone),
      montant_loyer: cleanNum(montant_loyer),
      description_logement: cleanStr(description_logement),
      arriere_loyer: cleanNum(arriere_loyer),
      anticipation: cleanNum(anticipation),
      versement_mois: cleanNum(versement_mois),
      periode_paiement: cleanStr(periode_paiement),
      mode_paiement: cleanStr(mode_paiement),
      caution: cleanNum(caution),
      observations: cleanStr(observations),
    };

    const existing = await sequelize.query(
      `SELECT id FROM situation_overrides WHERE property_id = :propId AND apartment_id = :aptId AND (period_ym = :ym OR (period_ym IS NULL AND :ym IS NULL)) LIMIT 1`,
      { replacements: { propId: overrideFields.property_id, aptId: overrideFields.apartment_id, ym: overrideFields.period_ym }, type: sequelize.QueryTypes.SELECT }
    );

    if (existing && existing.length > 0) {
      await sequelize.query(
        `UPDATE situation_overrides SET
          tenant_id = :tenant_id,
          numero_chambre = :numero_chambre,
          nom_locataire = :nom_locataire,
          telephone = :telephone,
          montant_loyer = :montant_loyer,
          description_logement = :description_logement,
          arriere_loyer = :arriere_loyer,
          anticipation = :anticipation,
          versement_mois = :versement_mois,
          periode_paiement = :periode_paiement,
          mode_paiement = :mode_paiement,
          caution = :caution,
          observations = :observations,
          updated_at = NOW()
        WHERE id = :id`,
        { replacements: { ...overrideFields, id: existing[0].id } }
      );
    } else {
      await sequelize.query(
        `INSERT INTO situation_overrides (
          property_id, apartment_id, tenant_id, period_ym,
          numero_chambre, nom_locataire, telephone, montant_loyer,
          description_logement, arriere_loyer, anticipation, versement_mois,
          periode_paiement, mode_paiement, caution, observations,
          created_at, updated_at
        ) VALUES (
          :property_id, :apartment_id, :tenant_id, :period_ym,
          :numero_chambre, :nom_locataire, :telephone, :montant_loyer,
          :description_logement, :arriere_loyer, :anticipation, :versement_mois,
          :periode_paiement, :mode_paiement, :caution, :observations,
          NOW(), NOW()
        )`,
        { replacements: overrideFields }
      );
    }

    // 4. Synchronisation bidirectionnelle avec la table Payment
    if (overrideFields.versement_mois !== null) {
      try {
        const vMois = Number(overrideFields.versement_mois);
        const { period_start: pStart, period_end: pEnd } = parsePeriodDates(overrideFields.periode_paiement);

        let pDate = null;
        if (pStart) {
          pDate = pStart;
        } else if (overrideFields.period_ym) {
          pDate = `${overrideFields.period_ym}-15`;
        } else {
          pDate = new Date().toISOString().slice(0, 10);
        }

        const targetYm = (overrideFields.period_ym || (pDate ? pDate.slice(0, 7) : new Date().toISOString().slice(0, 7)));
        const pMethod = mapPaymentMethod(overrideFields.mode_paiement);

        const [tYear, tMonth] = targetYm.split('-');
        const lastDayNum = new Date(Number(tYear), Number(tMonth), 0).getDate();
        const startOfMonth = `${targetYm}-01`;
        const endOfMonth = `${targetYm}-${String(lastDayNum).padStart(2, '0')}`;

        let existingPayment = null;
        const whereClause = {
          apartment_id: apt.id,
          payment_date: {
            [Op.between]: [startOfMonth, endOfMonth]
          }
        };
        if (effTenantId) whereClause.tenant_id = effTenantId;

        existingPayment = await Payment.findOne({
          where: whereClause,
          order: [['id', 'DESC']]
        });

        if (!existingPayment) {
          existingPayment = await Payment.findOne({
            where: {
              apartment_id: apt.id,
              payment_date: {
                [Op.between]: [startOfMonth, endOfMonth]
              }
            },
            order: [['id', 'DESC']]
          });
        }

        if (vMois > 0) {
          if (existingPayment) {
            await existingPayment.update({
              tenant_id: effTenantId || existingPayment.tenant_id,
              amount: vMois,
              payment_method: pMethod,
              period_start: pStart || existingPayment.period_start,
              period_end: pEnd || existingPayment.period_end,
              observations: overrideFields.observations !== null ? overrideFields.observations : existingPayment.observations,
              status: 'completed',
            });
          } else {
            await Payment.create({
              apartment_id: apt.id,
              tenant_id: effTenantId || null,
              amount: vMois,
              payment_method: pMethod,
              payment_date: pDate,
              period_start: pStart,
              period_end: pEnd,
              observations: overrideFields.observations,
              status: 'completed',
            });
          }
        } else if (vMois === 0 && existingPayment) {
          await existingPayment.destroy();
        }
      } catch (err) {
        console.error('[updateSituationLine] Erreur synchronisation paiement:', err);
      }
    }

    return { message: 'Ligne modifiée et surcharges enregistrées avec succès', line: overrideFields };
  }

  // ===== Réinitialisation d'une surcharge (retour au calcul automatique) =====
  async resetSituationOverride({ apartment_id, property_id, period_ym }) {
    if (!apartment_id) throw Object.assign(new Error('ID logement requis'), { status: 400 });
    let sql = 'DELETE FROM situation_overrides WHERE apartment_id = :apartment_id';
    const replacements = { apartment_id: Number(apartment_id) };
    if (property_id) {
      sql += ' AND property_id = :property_id';
      replacements.property_id = Number(property_id);
    }
    if (period_ym) {
      sql += ' AND (period_ym = :period_ym OR period_ym IS NULL)';
      replacements.period_ym = String(period_ym);
    }
    await sequelize.query(sql, { replacements });
    return { message: 'Surcharge réinitialisée au calcul automatique avec succès' };
  }
}
module.exports = new ReportService();

