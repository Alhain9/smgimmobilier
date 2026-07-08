const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const { authorizePermission } = require('../middlewares/rbac.middleware');

router.use(authenticate);

const manageUsers = authorizePermission('can_manage_users', 'manager');

router.get('/roles', ctrl.getRoles);
// Liste des techniciens (composition d'équipe de chantier) — accessible aux rôles techniques
router.get('/technicians', authorize('manager', 'dir_technique', 'gestionnaire'), ctrl.getTechnicians);
router.get('/', manageUsers, ctrl.getAll);
router.get('/:id', manageUsers, ctrl.getById);
router.post('/', manageUsers, ctrl.create);
router.put('/:id', manageUsers, ctrl.update);
router.patch('/:id/toggle', manageUsers, ctrl.toggleActive);
router.patch('/:id/attendance', manageUsers, ctrl.toggleAttendance);
router.delete('/:id', manageUsers, ctrl.remove);

module.exports = router;
