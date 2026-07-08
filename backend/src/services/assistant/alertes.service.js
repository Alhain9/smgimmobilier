// Alertes proactives, calculées AVEC le JWT de l'utilisateur : on ignore les
// catégories qu'il n'a pas le droit de voir (403). Aucune permission recodée.
const smg = require('./smg-client');
const num = (v) => Number(v) || 0;

async function getAlertes(ctx) {
  const t = ctx.token;
  const alertes = [];

  // 1. Loyers en retard (rôles finance/gestion)
  try {
    const debts = await smg.get('/payments/debts', t);
    if (debts && debts.length) {
      alertes.push({
        type: 'impayes', niveau: 'danger', icone: '🔴',
        titre: `${debts.length} loyer(s) en retard`,
        montant_fcfa: debts.reduce((s, p) => s + num(p.amount), 0),
        details: debts.slice(0, 6).map((p) => ({
          locataire: (p.tenant && p.tenant.user && p.tenant.user.full_name) || '—',
          bien: p.apartment ? p.apartment.apartment_number : '—',
          montant: num(p.amount),
        })),
      });
    }
  } catch { /* 403 → l'utilisateur ne voit pas les paiements */ }

  // 2. Incidents ouverts (tout le personnel a accès à GET /maintenance)
  try {
    const maint = await smg.get('/maintenance', t);
    const open = (maint || []).filter((m) => ['reported', 'validated', 'in_progress'].includes(m.status));
    if (open.length) {
      alertes.push({
        type: 'incidents', niveau: 'warning', icone: '🔧',
        titre: `${open.length} incident(s) ouvert(s)`,
        details: open.slice(0, 6).map((m) => ({
          bien: m.apartment ? m.apartment.apartment_number : '—',
          probleme: m.title, statut: m.status,
        })),
      });
    }
  } catch { /* ignore */ }

  // 3. Échéances : baux se terminant sous 30 jours
  try {
    const leases = await smg.get('/leases', t);
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400000);
    const soon = (leases || []).filter((l) => l.end_date && new Date(l.end_date) >= now && new Date(l.end_date) <= in30);
    if (soon.length) {
      alertes.push({
        type: 'echeances', niveau: 'info', icone: '📅',
        titre: `${soon.length} bail/baux à échéance sous 30 jours`,
        details: soon.slice(0, 6).map((l) => ({ bien: l.apartment ? l.apartment.apartment_number : '—', fin: l.end_date })),
      });
    }
  } catch { /* ignore */ }

  return alertes;
}

module.exports = { getAlertes };
