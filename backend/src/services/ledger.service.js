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

class LedgerService {
  // Calcule le solde à partir d'un locataire chargé (avec leases + payments + apartment)
  computeFromTenant(tenant) {
    const o = tenant.toJSON ? tenant.toJSON() : tenant;
    const lease = (o.leases || []).find((l) => l.status === 'active') || (o.leases || [])[0] || null;
    const monthlyRent = lease ? num(lease.monthly_rent) : (o.apartment ? num(o.apartment.rent_amount) : 0);
    const startDate = lease ? lease.start_date : o.start_date;
    const months = monthlyRent > 0 ? monthsElapsed(startDate) : 0;
    const totalDue = months * monthlyRent;

    const payments = o.payments || [];
    const totalValide = payments.filter((p) => p.status === 'completed').reduce((s, p) => s + num(p.amount), 0);
    const enAttentePreuve = payments.filter((p) => p.status === 'awaiting_confirmation').reduce((s, p) => s + num(p.amount), 0);
    const totalPaye = payments.filter((p) => ['completed', 'awaiting_confirmation'].includes(p.status)).reduce((s, p) => s + num(p.amount), 0);

    const solde = totalDue - totalValide;            // règle métier : dû − validés
    let statut = 'a_jour';
    if (solde > 0) statut = totalValide > 0 ? 'partiel' : 'retard';

    return {
      loyer_mensuel: monthlyRent,
      mois_dus: months,
      total_du: totalDue,
      total_paye: totalPaye,
      total_valide: totalValide,
      en_attente_preuve: enAttentePreuve,
      solde,
      statut, // a_jour | partiel | retard
      debut: startDate || null,
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
          attributes: ['id', 'amount', 'payment_method', 'payment_date', 'status', 'payment_proof', 'created_at'],
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
