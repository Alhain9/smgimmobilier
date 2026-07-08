// ============ Service de Validation de Circuits (Workflows) ============
const { WorkflowValidation, WorkflowEtape, Role } = require('../models');
const { logger } = require('../config/logger');

class WorkflowService {
  async listWorkflows() {
    return WorkflowValidation.findAll({
      include: [{
        model: WorkflowEtape,
        as: 'steps',
        include: [{ model: Role, as: 'role', attributes: ['id', 'role_name'] }]
      }],
      order: [['name', 'ASC']]
    });
  }

  async getWorkflow(id) {
    const wf = await WorkflowValidation.findByPk(id, {
      include: [{
        model: WorkflowEtape,
        as: 'steps',
        include: [{ model: Role, as: 'role', attributes: ['id', 'role_name'] }]
      }]
    });
    if (!wf) throw Object.assign(new Error('Workflow introuvable'), { status: 404 });
    return wf;
  }

  async createWorkflow(data) {
    return WorkflowValidation.create(data);
  }

  async addStep(data) {
    // Vérifier l'existence du workflow
    const wf = await WorkflowValidation.findByPk(data.workflow_id);
    if (!wf) throw Object.assign(new Error('Workflow introuvable'), { status: 404 });

    // Créer la nouvelle étape
    return WorkflowEtape.create(data);
  }

  async removeStep(stepId) {
    const step = await WorkflowEtape.findByPk(stepId);
    if (!step) throw Object.assign(new Error('Étape introuvable'), { status: 404 });
    await step.destroy();
    return true;
  }

  async deleteWorkflow(id) {
    const wf = await WorkflowValidation.findByPk(id);
    if (!wf) throw Object.assign(new Error('Workflow introuvable'), { status: 404 });
    await wf.destroy();
    return true;
  }
}

module.exports = new WorkflowService();
