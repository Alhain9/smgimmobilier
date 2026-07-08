// ============ Contrôleur de Validation de Circuits (Workflows) ============
const workflowService = require('../services/workflow.service');
const { success } = require('../utils/response');
const { workflowValidationDTO, workflowEtapeDTO, listDTO } = require('../dto');

exports.listWorkflows = async (req, res, next) => {
  try {
    const list = await workflowService.listWorkflows();
    return success(res, listDTO(list, workflowValidationDTO));
  } catch (err) { next(err); }
};

exports.getWorkflow = async (req, res, next) => {
  try {
    const wf = await workflowService.getWorkflow(req.params.id);
    return success(res, workflowValidationDTO(wf));
  } catch (err) { next(err); }
};

exports.createWorkflow = async (req, res, next) => {
  try {
    const wf = await workflowService.createWorkflow(req.body);
    res.locals.audit = { action: 'CREATE', entity: 'workflow_validations', entityId: wf.id, newValues: wf.toJSON() };
    return success(res, workflowValidationDTO(wf), 'Workflow de validation créé', 201);
  } catch (err) { next(err); }
};

exports.addStep = async (req, res, next) => {
  try {
    const step = await workflowService.addStep(req.body);
    res.locals.audit = { action: 'CREATE', entity: 'workflow_etapes', entityId: step.id, newValues: step.toJSON() };
    return success(res, workflowEtapeDTO(step), 'Étape ajoutée au workflow', 201);
  } catch (err) { next(err); }
};

exports.removeStep = async (req, res, next) => {
  try {
    await workflowService.removeStep(req.params.stepId);
    res.locals.audit = { action: 'DELETE', entity: 'workflow_etapes', entityId: req.params.stepId };
    return success(res, null, 'Étape supprimée du workflow');
  } catch (err) { next(err); }
};

exports.deleteWorkflow = async (req, res, next) => {
  try {
    await workflowService.deleteWorkflow(req.params.id);
    res.locals.audit = { action: 'DELETE', entity: 'workflow_validations', entityId: req.params.id };
    return success(res, null, 'Workflow supprimé');
  } catch (err) { next(err); }
};
