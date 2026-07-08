// ============ Routes Workflows ============
const router = require('express').Router();
const ctrl = require('../controllers/workflow.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const { validate, schemas } = require('../validators');

router.use(authenticate);

router.get('/', ctrl.listWorkflows);
router.get('/:id', ctrl.getWorkflow);
router.post('/', authorize('super_admin', 'manager'), validate(schemas.createWorkflowValidation), ctrl.createWorkflow);
router.delete('/:id', authorize('super_admin', 'manager'), ctrl.deleteWorkflow);

router.post('/step', authorize('super_admin', 'manager'), validate(schemas.createWorkflowEtape), ctrl.addStep);
router.delete('/step/:stepId', authorize('super_admin', 'manager'), ctrl.removeStep);

module.exports = router;
