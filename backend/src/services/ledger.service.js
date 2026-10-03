const { Tenant, User, Apartment, Property, Lease, Payment, PaymentHistory } = require('../models');

const num = (v) => parseFloat(v) || 0;

// Nombre de mois de loyer dus depuis une date de début (mois courant inclus)
function monthsElapsed(startDate) {
  if (!startDate) return 0;
  const s = new Date(startDate);
  const n = new Date();
  if (isNaN(s) || s > n) return 0;
  return (n.getFullYear() - s.getFullYear()) * 12 + (n.getMonth() - s.getMonth()) + 1;
}

// Calcul précis de la prochaine échéance et du décompte des jours (J-10, J-7, J-4, etc.)
function computeDueInfo(startDate, monthlyRent, totalValide) {
  if (!startDate || !monthlyRent || monthlyRent <= 0) {
    return { prochaine_echeance: null, jours_restants: null, statut_echeance: 'ok', echeance_message: 'Aucun bail actif' };
  }
  const start = new Date(startDate);
  if (isNaN(start.getTime())) {
    return { prochaine_echeance: null, jours_restants: null, statut_echeance: 'ok', echeance_message: 'Date invalide' };
  }

  const monthsPaid = Math.floor((totalValide || 0) / monthlyRent);
  const nextDue = new Date(start);
  nextDue.setMonth(nextDue.getMonth() + monthsPaid);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDue);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let statut_echeance = 'ok';
  let echeance_message = '';

  if (diffDays < 0) {
    statut_echeance = 'retard';
    echeance_message = `En retard de ${Math.abs(diffDays)} jour(s)`;
  } else if (diffDays === 0) {
    statut_echeance = 'aujourdhui';
    echeance_message = "Échéance aujourd'hui !";
  } else if (diffDays <= 10) {
    statut_echeance = 'imminent';
    echeance_message = `Doit payer dans ${diffDays} jour(s)`;
  } else {
    statut_echeance = 'a_venir';
    echeance_message = `Dans ${diffDays} jour(s)`;
  }

  return {
    prochaine_echeance: nextDue.toISOString().slice(0, 10),
    jours_restants: diffDays,
    statut_echeance,
    echeance_message,
    mois_regles: monthsPaid,
  };
}

class LedgerService {
  // Calcule le solde à partir d'un locataire chargé (avec leases + payments + apartment)
  computeFromTenant(tenant) {
    const o = tenant.toJSON ? tenant.toJSON() : tenant;
    const lease = (o.leases || []).find((l) => l.status === 'active') || (o.leases || [])[0] || null;
    const monthlyRent = lease ? num(lease.monthly_rent) : (o.apartment ? num(o.apartment.rent_amount) : 0);
    const startDate = lease ? lease.start_date : o.start_date;
    const payments = o.payments || [];

    // Déterminer la date de début effective (la plus ancienne entre bail/profil et premier paiement)
    let effectiveStartDate = startDate;
    let latestPeriodEnd = null;

    payments.forEach((p) => {
      if (p.period_start) {
        if (!effectiveStartDate || new Date(p.period_start) < new Date(effectiveStartDate)) {
          effectiveStartDate = p.period_start;
        }
      }
      if (p.period_end && p.status === 'completed') {
        if (!latestPeriodEnd || new Date(p.period_end) > new Date(latestPeriodEnd)) {
          latestPeriodEnd = p.period_end;
        }
      }
    });

    const months = monthlyRent > 0 ? monthsElapsed(effectiveStartDate) : 0;
    const totalDue = months * monthlyRent;

    const totalValide = payments.filter((p) => p.status === 'completed').reduce((s, p) => s + num(p.amount), 0);
    const enAttentePreuve = payments.filter((p) => p.status === 'awaiting_confirmation').reduce((s, p) => s + num(p.amount), 0);
    const totalPaye = payments.filter((p) => ['completed', 'awaiting_confirmation'].includes(p.status)).reduce((s, p) => s + num(p.amount), 0);

    let solde = totalDue - totalValide;            // règle métier : dû − validés

    // Détection automatique des impayés selon la fin de période couverte
    const now = new Date();
    let isOverdueFromPeriod = false;
    let overdueMonthsFromPeriod = 0;
    let overdueMessage = '';
    let autoArrears = 0;

    if (latestPeriodEnd && monthlyRent > 0) {
      const pEnd = new Date(latestPeriodEnd);
      const endYear = pEnd.getFullYear();
      const endMonth = pEnd.getMonth();
      const endDay = pEnd.getDate();

      let unpaidM = endMonth;
      let unpaidY = endYear;
      if (endDay <= 5) {
        unpaidM = endMonth;
      } else if (endDay >= 25) {
        const nextM = new Date(endYear, endMonth + 1, 1);
        unpaidM = nextM.getMonth();
        unpaidY = nextM.getFullYear();
      }

      const MONTH_NAMES_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      const gap = (now.getFullYear() - unpaidY) * 12 + (now.getMonth() - unpaidM);

      if (gap > 0) {
        isOverdueFromPeriod = true;
        overdueMonthsFromPeriod = gap;
      } else if (gap === 0 && endDay <= 5) {
        isOverdueFromPeriod = true;
        overdueMonthsFromPeriod = 1;
      }

      if (isOverdueFromPeriod) {
        autoArrears = overdueMonthsFromPeriod * monthlyRent;
        overdueMessage = `Impayé à partir du mois de ${MONTH_NAMES_FR[unpaidM]} ${unpaidY}`;
        if (autoArrears > solde) {
          solde = autoArrears;
        }
      }
    }

    let statut = 'a_jour';
    if (solde > 0 || isOverdueFromPeriod) statut = totalValide > 0 ? 'partiel' : 'retard';

    const dueInfo = computeDueInfo(effectiveStartDate, monthlyRent, totalValide);

    if (isOverdueFromPeriod) {
      dueInfo.statut_echeance = 'retard';
      dueInfo.echeance_message = overdueMessage;
      dueInfo.prochaine_echeance = latestPeriodEnd;
      dueInfo.mois_dus = overdueMonthsFromPeriod;
    }

    return {
      loyer_mensuel: monthlyRent,
      mois_dus: isOverdueFromPeriod ? overdueMonthsFromPeriod : months,
      total_du: totalDue,
      total_paye: totalPaye,
      total_valide: totalValide,
      en_attente_preuve: enAttentePreuve,
      solde,
      statut, // a_jour | partiel | retard
      debut: effectiveStartDate || null,
      ...dueInfo,
    };
  }

  // Relevé complet d'un locataire : soldes + transactions + historique des modifications
  async tenantLedger(tenantId) {
    const tenant = await Tenant.findByPk(tenantId, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] },
        { model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number', 'rent_amount'], include: [{ model: Property, as: 'property', attributes: ['id', 'property_name'] }] },
        { model: Lease, as: 'leases', attributes: ['id', 'status', 'start_date', 'end_date', 'monthly_rent'], include: [{ model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number'], include: [{ model: Property, as: 'property', attributes: ['id', 'property_name'] }] }] },
        {
          model: Payment, as: 'payments',
          attributes: ['id', 'amount', 'payment_method', 'payment_date', 'period_start', 'period_end', 'observations', 'status', 'payment_proof', 'created_at'],
          include: [{ model: PaymentHistory, as: 'history', include: [{ model: User, as: 'changedBy', attributes: ['id', 'full_name'] }] }],
        },
      ],
    });
    if (!tenant) throw Object.assign(new Error('Locataire introuvable'), { status: 404 });

    const o = tenant.toJSON();
    const summary = this.computeFromTenant(tenant);
    const lease = (o.leases || []).find((l) => l.status === 'active') || (o.leases || [])[0] || null;
    const apt = (lease && lease.apartment) || o.apartment || null;

    const transactions = (o.payments || [])
      .slice()
      .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
      .map((p) => ({
        id: p.id, date: p.payment_date, montant: num(p.amount),
        methode: p.payment_method, statut: p.status, preuve: p.payment_proof || null,
      }));

    // Historique des modifications (toutes transactions confondues), du plus récent au plus ancien
    const modifications = [];
    (o.payments || []).forEach((p) => {
      (p.history || []).forEach((h) => {
        modifications.push({
          payment_id: p.id, action: h.action, description: h.description,
          montant: num(h.amount), statut: h.status,
          par: h.changedBy ? h.changedBy.full_name : null, date: h.createdAt,
        });
      });
    });
    modifications.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      tenant: {
        id: o.id,
        nom: o.user ? o.user.full_name : '—',
        telephone: o.user ? o.user.phone : null,
        logement: apt ? apt.apartment_number : null,
        immeuble: apt && apt.property ? apt.property.property_name : null,
        fin_bail: lease ? lease.end_date : null,
      },
      ...summary,
      transactions,
      modifications,
    };
  }
}
module.exports = new LedgerService();
