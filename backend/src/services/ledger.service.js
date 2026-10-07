const { Tenant, User, Apartment, Property, Lease, Payment, PaymentHistory } = require('../models');

const num = (v) => parseFloat(v) || 0;

// Nombre de mois de loyer dus depuis une date de début (mois courant inclus ou jusqu'à la date de fin)
function monthsElapsed(startDate, endDate = null) {
  if (!startDate) return 0;
  const s = new Date(startDate);
  const n = endDate ? new Date(endDate) : new Date();
  if (isNaN(s) || s > n) return 0;
  return (n.getFullYear() - s.getFullYear()) * 12 + (n.getMonth() - s.getMonth()) + 1;
}

// Calcul précis de la prochaine échéance et du décompte des jours (J-10, J-7, J-4, etc.)
function computeDueInfo(startDate, monthlyRent, totalValide, latestPeriodEnd = null) {
  let nextDue = null;
  let monthsPaid = 0;

  if (latestPeriodEnd) {
    const end = new Date(latestPeriodEnd);
    if (!isNaN(end.getTime())) {
      nextDue = end;
    }
  }

  if (!nextDue) {
    if (!startDate || !monthlyRent || monthlyRent <= 0) {
      return { prochaine_echeance: null, jours_restants: null, statut_echeance: 'ok', echeance_message: 'Aucun bail actif' };
    }
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return { prochaine_echeance: null, jours_restants: null, statut_echeance: 'ok', echeance_message: 'Date invalide' };
    }
    monthsPaid = Math.floor((totalValide || 0) / monthlyRent);
    nextDue = new Date(start);
    nextDue.setMonth(nextDue.getMonth() + monthsPaid);
  }

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
    const dStr = nextDue.toISOString().slice(0, 10);
    echeance_message = `À jour jusqu'au ${dStr} (dans ${diffDays} jours)`;
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
  // Calcule le solde à partir d'un locataire chargé (avec leases + payments + receipts + apartment)
  computeFromTenant(tenant) {
    const o = tenant.toJSON ? tenant.toJSON() : tenant;
    const isDeparted = ['inactive', 'terminated'].includes(o.status);
    const lease = (o.leases || []).find((l) => l.status === 'active') || (o.leases || [])[0] || null;
    const monthlyRent = lease ? num(lease.monthly_rent) : (o.apartment ? num(o.apartment.rent_amount) : 0);
    const startDate = lease ? lease.start_date : o.start_date;
    const departureDate = o.end_date || (lease ? lease.end_date : null);
    const refDate = (isDeparted && departureDate) ? new Date(departureDate) : new Date();

    // Paiements strictement rattachés à ce locataire
    const payments = (o.payments || []).filter(p => !p.tenant_id || Number(p.tenant_id) === Number(o.id));
    const receipts = (o.receipts || []).filter(r => !r.tenant_id || Number(r.tenant_id) === Number(o.id));

    // Déterminer la date de début effective et la fin de période la plus récente
    let effectiveStartDate = startDate;
    let latestPeriodEnd = null;

    payments.forEach((p) => {
      if (p.period_start) {
        if (!effectiveStartDate || new Date(p.period_start) < new Date(effectiveStartDate)) {
          effectiveStartDate = p.period_start;
        }
      }
      if (p.period_end && ['completed', 'awaiting_confirmation'].includes(p.status)) {
        const pEndStr = typeof p.period_end === 'string' ? p.period_end.slice(0, 10) : p.period_end.toISOString().slice(0, 10);
        if (!latestPeriodEnd || new Date(pEndStr) > new Date(latestPeriodEnd)) {
          latestPeriodEnd = pEndStr;
        }
      }
    });

    receipts.forEach((r) => {
      if (r.period_end && r.status !== 'cancelled') {
        const rEndStr = typeof r.period_end === 'string' ? r.period_end.slice(0, 10) : r.period_end.toISOString().slice(0, 10);
        if (!latestPeriodEnd || new Date(rEndStr) > new Date(latestPeriodEnd)) {
          latestPeriodEnd = rEndStr;
        }
      }
    });

    const months = monthlyRent > 0 ? monthsElapsed(effectiveStartDate, (isDeparted && departureDate) ? departureDate : null) : 0;
    const totalDue = months * monthlyRent;

    const totalValide = payments.filter((p) => p.status === 'completed').reduce((s, p) => s + num(p.amount), 0);
    const enAttentePreuve = payments.filter((p) => p.status === 'awaiting_confirmation').reduce((s, p) => s + num(p.amount), 0);
    const totalPaye = payments.filter((p) => ['completed', 'awaiting_confirmation'].includes(p.status)).reduce((s, p) => s + num(p.amount), 0);

    let solde = 0;
    let isOverdueFromPeriod = false;
    let overdueMonthsFromPeriod = 0;
    let overdueMessage = '';

    // Gestion spécifique si une reconnaissance de dette a été formellement enregistrée
    const debtAcknowledged = num(o.debt_acknowledged);
    if (isDeparted && debtAcknowledged > 0) {
      // Paiements effectués pour apurer la dette (après la date de départ ou mentionnant dette/reconnaissance)
      const repaymentPayments = payments.filter((p) => {
        if (p.status !== 'completed') return false;
        if (departureDate && p.payment_date && String(p.payment_date).slice(0, 10) >= departureDate) return true;
        if (p.observations && (p.observations.toLowerCase().includes('dette') || p.observations.toLowerCase().includes('apurement') || p.observations.toLowerCase().includes('reconnaissance'))) return true;
        return false;
      });
      const totalRepaid = repaymentPayments.reduce((s, p) => s + num(p.amount), 0);
      const remainingDebt = Math.max(0, debtAcknowledged - totalRepaid);
      solde = remainingDebt;
      isOverdueFromPeriod = remainingDebt > 0;
      overdueMonthsFromPeriod = monthlyRent > 0 ? Math.ceil(remainingDebt / monthlyRent) : 0;
      if (remainingDebt <= 0) {
        overdueMessage = 'Dette intégralement apurée / soldée ✅';
      } else {
        overdueMessage = `Reconnaissance de dette : reste dû ${Math.round(remainingDebt).toLocaleString('fr-FR')} FCFA sur ${Math.round(debtAcknowledged).toLocaleString('fr-FR')} FCFA`;
      }
    } else if (latestPeriodEnd && monthlyRent > 0) {
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
      const gap = (refDate.getFullYear() - unpaidY) * 12 + (refDate.getMonth() - unpaidM);

      if (gap > 0) {
        isOverdueFromPeriod = true;
        overdueMonthsFromPeriod = gap;
        solde = overdueMonthsFromPeriod * monthlyRent;
        overdueMessage = isDeparted
          ? `Impayé à la sortie (${gap} mois) à partir du mois de ${MONTH_NAMES_FR[unpaidM]} ${unpaidY}`
          : `Impayé à partir du mois de ${MONTH_NAMES_FR[unpaidM]} ${unpaidY}`;
      } else if (gap === 0 && endDay <= 5) {
        isOverdueFromPeriod = true;
        overdueMonthsFromPeriod = 1;
        solde = 1 * monthlyRent;
        overdueMessage = isDeparted
          ? `Impayé à la sortie (1 mois) à partir du mois de ${MONTH_NAMES_FR[unpaidM]} ${unpaidY}`
          : `Impayé à partir du mois de ${MONTH_NAMES_FR[unpaidM]} ${unpaidY}`;
      } else {
        isOverdueFromPeriod = false;
        overdueMonthsFromPeriod = 0;
        solde = 0;
        overdueMessage = gap < 0 ? `À jour (Avance jusqu'au ${latestPeriodEnd})` : 'À jour';
      }
    } else {
      solde = Math.max(0, totalDue - totalValide);
    }

    let statut = 'a_jour';
    if (isDeparted) {
      statut = solde <= 0 ? 'solde' : 'debiteur_sorti';
    } else if (solde > 0 || isOverdueFromPeriod) {
      statut = totalValide > 0 ? 'partiel' : 'retard';
    }

    const dueInfo = computeDueInfo(effectiveStartDate, monthlyRent, totalValide, latestPeriodEnd);

    if (isOverdueFromPeriod) {
      dueInfo.statut_echeance = 'retard';
      dueInfo.echeance_message = overdueMessage;
      dueInfo.prochaine_echeance = latestPeriodEnd;
      dueInfo.mois_dus = overdueMonthsFromPeriod;
    } else if (latestPeriodEnd) {
      dueInfo.prochaine_echeance = latestPeriodEnd;
      dueInfo.mois_dus = 0;
    }

    if (isDeparted) {
      dueInfo.is_departed = true;
      dueInfo.departure_date = departureDate;
      dueInfo.debt_acknowledged = debtAcknowledged;
      dueInfo.is_debt_settled = solde <= 0;
      if (solde <= 0) {
        dueInfo.statut_echeance = 'ok';
        dueInfo.echeance_message = 'Ancien locataire — Compte soldé';
      }
    }

    return {
      loyer_mensuel: monthlyRent,
      mois_dus: isOverdueFromPeriod ? overdueMonthsFromPeriod : (latestPeriodEnd ? 0 : months),
      total_du: totalDue,
      total_paye: totalPaye,
      total_valide: totalValide,
      en_attente_preuve: enAttentePreuve,
      solde,
      statut, // a_jour | partiel | retard | solde | debiteur_sorti
      debut: effectiveStartDate || null,
      is_departed: isDeparted,
      departure_date: departureDate,
      debt_acknowledged: debtAcknowledged,
      is_debt_settled: isDeparted ? solde <= 0 : false,
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
