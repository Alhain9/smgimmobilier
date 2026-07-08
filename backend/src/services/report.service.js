const { Tenant, User, Apartment, Property, Lease, Payment, Maintenance, Expense } = require('../models');
const { Op } = require('sequelize');
const ledgerService = require('./ledger.service');

const num = (v) => parseFloat(v) || 0;
const UNPAID = ['pending', 'failed', 'awaiting_confirmation'];

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
  async tenantsSituation() {
    const tenants = await Tenant.findAll({
      include: [
        { model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] },
        { model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number', 'rent_amount'], include: [{ model: Property, as: 'property', attributes: ['id', 'property_name'] }] },
        { model: Lease, as: 'leases', attributes: ['id', 'status', 'start_date', 'end_date', 'monthly_rent', 'apartment_id'], include: [{ model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number'], include: [{ model: Property, as: 'property', attributes: ['id', 'property_name'] }] }] },
        { model: Payment, as: 'payments', attributes: ['id', 'amount', 'status', 'payment_date'] },
      ],
      order: [['created_at', 'DESC']],
    });

    const today = new Date();
    return tenants.map((t) => {
      const o = t.toJSON();
      const apt = this._effectiveApartment(o);
      const payments = o.payments || [];
      const led = ledgerService.computeFromTenant(t); // total dû (mois×loyer) − validés
      const doit = Math.max(0, led.solde);
      const completed = payments.filter((p) => p.status === 'completed')
        .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
      const activeLease = (o.leases || []).find((l) => l.status === 'active') || (o.leases || [])[0] || null;

      // Prochaine échéance (seulement s'il est à jour)
      let nextDue = null;
      if (doit <= 0) {
        if (completed.length) {
          const last = new Date(completed[0].payment_date);
          nextDue = new Date(last.getFullYear(), last.getMonth() + 1, 1);
        } else if (activeLease && activeLease.start_date) {
          nextDue = new Date(activeLease.start_date);
        }
        if (nextDue && nextDue < today) nextDue = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      }

      return {
        tenant_id: o.id,
        nom: o.user ? o.user.full_name : '—',
        telephone: o.user ? o.user.phone : null,
        doit,
        a_jour: doit <= 0,
        statut_compte: led.statut, // a_jour | partiel | retard
        prochaine_echeance: nextDue ? nextDue.toISOString().slice(0, 10) : null,
        fin_bail: activeLease ? activeLease.end_date : null,
        logement: apt ? apt.apartment_number : null,
        immeuble: apt && apt.property ? apt.property.property_name : null,
        statut: o.status,
      };
    });
  }

  // ===== Situation d'un immeuble (modèle Excel « SITUATION IMMEUBLE ») =====
  // Une ligne par logement : locataire, loyer, arriéré, dette, anticipation, versement du mois…
  async buildingSituation(propertyId) {
    const property = await Property.findByPk(propertyId, {
      include: [{
        model: Apartment, as: 'apartments',
        attributes: ['id', 'apartment_number', 'rent_amount'],
        include: [{
          model: Tenant, as: 'tenants', required: false, where: { status: 'active' },
          include: [
            { model: User, as: 'user', attributes: ['full_name', 'phone'] },
            { model: Lease, as: 'leases', attributes: ['start_date', 'monthly_rent', 'status'] },
            { model: Payment, as: 'payments', attributes: ['amount', 'status', 'payment_date', 'payment_method'] },
          ],
        }],
      }],
    });
    if (!property) throw Object.assign(new Error('Immeuble introuvable'), { status: 404 });

    const monthsElapsed = (start) => {
      if (!start) return 0; const s = new Date(start); const n = new Date();
      if (isNaN(s) || s > n) return 0;
      return (n.getFullYear() - s.getFullYear()) * 12 + (n.getMonth() - s.getMonth()) + 1;
    };
    const ym = new Date().toISOString().slice(0, 7);
    const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

    const apts = (property.apartments || []).slice().sort((a, b) => String(a.apartment_number).localeCompare(String(b.apartment_number), 'fr', { numeric: true }));
    const lignes = apts.map((a) => {
      const t = (a.tenants || [])[0];
      const base = {
        numero_chambre: a.apartment_number, nom_locataire: null, telephone: null,
        date_occupation: null, montant_loyer: num(a.rent_amount),
        observations: 'vide', arriere_loyer: 0, avance_sur_arriere: 0, dette: 0,
        anticipation: 0, versement_mois: 0, periode_actuelle: null, mode_paiement: null,
      };
      if (!t) return base;

      const lease = (t.leases || []).find((l) => l.status === 'active') || (t.leases || [])[0] || null;
      const monthly = (lease && num(lease.monthly_rent)) || num(a.rent_amount);
      const start = (lease && lease.start_date) || t.start_date;
      const months = monthly > 0 ? monthsElapsed(start) : 0;
      const totalDu = months * monthly;
      const payments = t.payments || [];
      const valide = payments.filter((p) => p.status === 'completed').reduce((s, p) => s + num(p.amount), 0);
      const solde = totalDu - valide;
      const dette = Math.max(0, solde);
      const anticipation = Math.max(0, -solde);
      const versementMois = payments.filter((p) => p.status === 'completed' && String(p.payment_date).slice(0, 7) === ym).reduce((s, p) => s + num(p.amount), 0);
      const last = payments.slice().sort((x, y) => new Date(y.payment_date) - new Date(x.payment_date))[0];

      // « couvert jusqu'au » = début + nombre de mois payés
      let couvertJusqu = null;
      if (monthly > 0 && start) {
        const moisPayes = Math.floor(valide / monthly);
        const d = new Date(start); d.setMonth(d.getMonth() + moisPayes);
        couvertJusqu = d.toISOString().slice(0, 10);
      }
      const observations = dette <= 0
        ? `à jour${couvertJusqu ? " jusqu'au " + couvertJusqu : ''}`
        : `impayé ~${Math.ceil(dette / (monthly || 1))} mois`;

      return {
        numero_chambre: a.apartment_number,
        nom_locataire: t.user ? t.user.full_name : '—',
        telephone: t.user ? t.user.phone : null,
        date_occupation: fmt(start), montant_loyer: monthly,
        observations, arriere_loyer: dette, avance_sur_arriere: 0, dette,
        anticipation, versement_mois: versementMois,
        periode_actuelle: couvertJusqu, mode_paiement: last ? last.payment_method : null,
      };
    });

    const sum = (k) => lignes.reduce((s, l) => s + (Number(l[k]) || 0), 0);
    return {
      immeuble: property.property_name, property_id: property.id,
      lignes,
      total: {
        montant_loyer: sum('montant_loyer'), arriere_loyer: sum('arriere_loyer'),
        avance_sur_arriere: sum('avance_sur_arriere'), dette: sum('dette'),
        anticipation: sum('anticipation'), versement_mois: sum('versement_mois'),
      },
    };
  }

  // ===== Récap par période : par locataire, par immeuble, maintenance =====
  async periodRecap(start, end) {
    const range = this._range(start, end);

    const [payments, properties, maintenances, expenses] = await Promise.all([
      Payment.findAll({
        where: { payment_date: { [Op.between]: range } },
        include: [
          { model: Tenant, as: 'tenant', attributes: ['id'], include: [{ model: User, as: 'user', attributes: ['id', 'full_name'] }] },
          { model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number', 'property_id'], include: [{ model: Property, as: 'property', attributes: ['id', 'property_name'] }] },
        ],
      }),
      Property.findAll({ attributes: ['id', 'property_name'], include: [{ model: Apartment, as: 'apartments', attributes: ['id', 'status'] }] }),
      Maintenance.findAll({
        where: { created_at: { [Op.between]: range } },
        include: [{ model: Apartment, as: 'apartment', attributes: ['id', 'property_id'], include: [{ model: Property, as: 'property', attributes: ['id', 'property_name'] }] }],
      }),
      Expense.findAll({
        where: { created_at: { [Op.between]: range } },
        include: [{ model: Maintenance, as: 'maintenance', attributes: ['id', 'apartment_id'], include: [{ model: Apartment, as: 'apartment', attributes: ['id', 'property_id'] }] }],
      }),
    ]);

    // --- Par locataire ---
    const byTenantMap = {};
    payments.forEach((p) => {
      const id = p.tenant_id;
      if (!byTenantMap[id]) {
        byTenantMap[id] = {
          tenant_id: id,
          nom: (p.tenant && p.tenant.user && p.tenant.user.full_name) || '—',
          immeuble: (p.apartment && p.apartment.property && p.apartment.property.property_name) || '—',
          logement: p.apartment ? p.apartment.apartment_number : '—',
          paye: 0, impaye: 0, nb_paiements: 0,
        };
      }
      const row = byTenantMap[id];
      row.nb_paiements += 1;
      if (p.status === 'completed') row.paye += num(p.amount);
      else if (UNPAID.includes(p.status)) row.impaye += num(p.amount);
    });

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

    // --- Par immeuble (encaissements + occupation + maintenance) ---
    const encByProp = {}; const unpaidByProp = {};
    payments.forEach((p) => {
      const propId = p.apartment ? p.apartment.property_id : null;
      if (!propId) return;
      if (p.status === 'completed') encByProp[propId] = (encByProp[propId] || 0) + num(p.amount);
      else if (UNPAID.includes(p.status)) unpaidByProp[propId] = (unpaidByProp[propId] || 0) + num(p.amount);
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

    return {
      start, end,
      byTenant: Object.values(byTenantMap).sort((a, b) => b.paye - a.paye),
      byProperty: byProperty.sort((a, b) => b.encaisse - a.encaisse),
      maintenance: {
        total: maintenances.length, ...maintStatus,
        cout: maintCostTotal,
        byProperty: Object.values(maintCountByProp).sort((a, b) => b.total - a.total),
      },
    };
  }
}
module.exports = new ReportService();
