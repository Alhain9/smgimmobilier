// ============ Page Circuits de Validation (Workflows) ============
const PageWorkflows = {
  workflows: [],

  register() {
    Router.register('workflows', () => this.render());
  },

  async render() {
    Layout.setTitle('Circuits de Validation');
    Layout.content('<div class="spinner"></div>');

    try {
      const res = await API.get('/workflows');
      this.workflows = res.data || [];
      this.renderList();
    } catch (err) {
      Layout.content(`<div class="alert alert-danger">${err.message}</div>`);
    }
  },

  renderList() {
    const listHtml = this.workflows.map(wf => {
      const stepsHtml = (wf.steps || [])
        .sort((a, b) => a.step_order - b.step_order)
        .map(step => `
          <div style="background:#fff; border:1px solid #e0e0e0; border-radius:6px; padding:10px; display:flex; justify-content:between; align-items:center; margin-bottom:8px;">
            <div>
              <strong>Étape ${step.step_order}</strong> : Valideur requis : <em>${step.role?.role_name || '—'}</em>
              <div style="font-size:12px; color:#666; margin-top:2px;">${step.description || 'Pas de description'}</div>
            </div>
            <button class="btn btn-sm btn-outline-danger" onclick="PageWorkflows.deleteStep(${step.id})">Retirer</button>
          </div>
        `).join(' <div style="text-align:center; color:#999; margin:4px 0;">⬇️</div> ');

      return `
        <div class="card" style="margin-bottom:20px; border-left:4px solid var(--primary);">
          <div class="card-header" style="display:flex; justify-content:between; align-items:center; background:#F8F9FA;">
            <div>
              <h4 style="margin:0;">${wf.name}</h4>
              <span style="font-size:12px; color:#999;">Module concerné : <strong>${wf.module}</strong></span>
            </div>
            <div>
              <button class="btn btn-sm btn-primary" onclick="PageWorkflows.addStep(${wf.id})">+ Ajouter étape</button>
              <button class="btn btn-sm btn-outline-danger" style="margin-left:5px;" onclick="PageWorkflows.deleteWorkflow(${wf.id})">Supprimer</button>
            </div>
          </div>
          <div style="padding:20px; background:#fafafa;">
            ${stepsHtml || '<div style="text-align:center; color:#999; font-style:italic;">Aucune étape de validation configurée pour ce circuit</div>'}
          </div>
        </div>
      `;
    }).join('');

    Layout.content(`
      <div class="page-head" style="margin-bottom:20px; display:flex; justify-content:between;">
        <div>
          <h2>Circuits de Validation</h2>
          <div class="subtitle">Configuration des workflows d'approbation (dépenses, congés, baux)</div>
        </div>
        <button class="btn btn-primary" onclick="PageWorkflows.createWorkflow()">+ Nouveau circuit</button>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px;">
        ${listHtml || '<div class="card" style="padding:40px; text-align:center; color:#999;">Aucun circuit de validation configuré</div>'}
      </div>
    `);
  },

  async createWorkflow() {
    CrudPage.openForm({
      title: 'Créer un Circuit',
      fields: [
        { name: 'name', label: 'Nom du circuit', type: 'text', required: true },
        { name: 'module', label: 'Module rattaché', type: 'select', options: [
          { value: 'expense', label: 'Dépenses / Achats' },
          { value: 'conge', label: 'Congés / RH' },
          { value: 'lease', label: 'Baux / Contrats' }
        ], required: true },
        { name: 'description', label: 'Description', type: 'textarea' }
      ],
      onSubmit: async (data) => {
        await API.post('/workflows', data);
        Toast.success('Circuit créé !');
        this.render();
      }
    });
  },

  async addStep(workflowId) {
    // Récupérer la liste des rôles
    const rolesRes = await API.get('/users'); // standard list users doesn't list roles separately, but let's query roles
    // Wait, roles list can be populated
    const roles = [
      { value: 1, label: 'Super Administrateur' },
      { value: 2, label: 'Manager' },
      { value: 3, label: 'Directeur Administratif' },
      { value: 4, label: 'Directeur Technique' },
      { value: 5, label: 'Gestionnaire' },
      { value: 6, label: 'Comptable' }
    ];

    CrudPage.openForm({
      title: 'Ajouter une Étape de Validation',
      fields: [
        { name: 'workflow_id', label: 'Workflow ID', type: 'text', default: workflowId, required: true },
        { name: 'step_order', label: 'Ordre de l\'étape (1, 2, 3...)', type: 'number', required: true },
        { name: 'role_id', label: 'Rôle du validateur', type: 'select', options: roles, required: true },
        { name: 'description', label: 'Consignes de validation', type: 'text' }
      ],
      onSubmit: async (data) => {
        await API.post('/workflows/step', data);
        Toast.success('Étape ajoutée avec succès !');
        this.render();
      }
    });
  },

  async deleteStep(stepId) {
    if (!confirm('Supprimer cette étape ?')) return;
    try {
      await API.delete(`/workflows/step/${stepId}`);
      Toast.success('Étape supprimée');
      this.render();
    } catch (err) { Toast.error(err.message); }
  },

  async deleteWorkflow(id) {
    if (!confirm('Supprimer ce circuit de validation ? Toutes les étapes liées seront détruites.')) return;
    try {
      await API.delete(`/workflows/${id}`);
      Toast.success('Workflow supprimé');
      this.render();
    } catch (err) { Toast.error(err.message); }
  }
};

window.PageWorkflows = PageWorkflows;
