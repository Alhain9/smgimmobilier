const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/properties', require('./property.routes'));
router.use('/apartments', require('./apartment.routes'));
router.use('/tenants', require('./tenant.routes'));
router.use('/leases', require('./lease.routes'));
router.use('/payments', require('./payment.routes'));
router.use('/maintenance', require('./maintenance.routes'));
router.use('/expenses', require('./expense.routes'));
router.use('/equipment', require('./equipment.routes'));
router.use('/tasks', require('./task.routes'));
router.use('/calendar', require('./calendar.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/documents', require('./document.routes'));
router.use('/uploads', require('./document.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/salaries', require('./salary.routes'));
router.use('/relances', require('./relance.routes'));
router.use('/utility-bills', require('./utility.routes'));
router.use('/reports', require('./report.routes'));
router.use('/assistant', require('./assistant.routes'));
// ===== Nouvelles routes SMG IMMOBILIER =====
router.use('/exports', require('./export.routes'));
router.use('/audit-logs', require('./audit.routes'));
router.use('/rh', require('./rh.routes'));
router.use('/workflows', require('./workflow.routes'));
router.use('/messages', require('./message.routes'));
router.use('/gps', require('./gps.routes'));

router.get('/', (req, res) => {
  res.json({ message: 'API SMG IMMOBILIER v2.0', status: 'online', version: '2.0.0' });
});

module.exports = router;
