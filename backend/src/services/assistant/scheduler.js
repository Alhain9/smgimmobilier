// Planificateur léger (setInterval, zéro dépendance) : recalcule périodiquement
// des compteurs globaux (impayés, incidents ouverts) mis en cache mémoire.
// Les alertes par-utilisateur (role-filtered) restent calculées à la volée par alertes.service.
const { Payment, Maintenance } = require('../../models');
const { Op } = require('sequelize');

let _cache = { overduePayments: 0, openIncidents: 0, updatedAt: null };
let _timer = null;

async function recompute() {
  try {
    const [overdue, open] = await Promise.all([
      Payment.count({ where: { status: { [Op.in]: ['pending', 'failed', 'awaiting_confirmation'] } } }),
      Maintenance.count({ where: { status: { [Op.in]: ['reported', 'validated', 'in_progress'] } } }),
    ]);
    _cache = { overduePayments: overdue, openIncidents: open, updatedAt: new Date().toISOString() };
  } catch (_) { /* base momentanément indisponible : on réessaiera au prochain tick */ }
}

function start(intervalMs = 5 * 60 * 1000) {
  if (_timer) return;
  recompute();
  _timer = setInterval(recompute, intervalMs);
  if (_timer.unref) _timer.unref(); // ne bloque pas l'arrêt du process
}

module.exports = { start, recompute, getSnapshot: () => _cache };
