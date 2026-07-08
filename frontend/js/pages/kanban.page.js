// ============ Page Kanban des Tâches ============
const PageKanban = {
  tasks: [],

  register() {
    Router.register('kanban', () => this.render());
  },

  async render() {
    Layout.setTitle('Tableau Kanban');
    Layout.content('<div class="spinner"></div>');

    try {
      const res = await API.get('/tasks');
      this.tasks = res.data || [];
      this.renderBoard();
    } catch (err) {
      Layout.content(`<div class="alert alert-danger">${err.message}</div>`);
    }
  },

  renderBoard() {
    const columns = [
      { id: 'pending', label: '⏳ À faire', color: '#3498DB' },
      { id: 'in_progress', label: '⚡ En cours', color: '#F1C40F' },
      { id: 'completed', label: '✅ Terminé', color: '#2ECC71' },
      { id: 'not_done', label: '❌ Non effectué', color: '#E74C3C' },
      { id: 'cancelled', label: '🚫 Annulé', color: '#95A5A6' }
    ];

    let columnsHtml = columns.map(col => {
      const colTasks = this.tasks.filter(t => t.status === col.id);
      
      const cardsHtml = colTasks.map(t => {
        let actionButtons = '';
        if (col.id === 'pending') {
          actionButtons = `<button class="btn btn-sm btn-outline-warning" style="width:100%" onclick="PageKanban.moveTask(${t.id}, 'in_progress')">Démarrer ➔</button>`;
        } else if (col.id === 'in_progress') {
          actionButtons = `
            <div style="display:flex; gap:5px;">
              <button class="btn btn-sm btn-success" style="flex:1" onclick="PageKanban.moveTask(${t.id}, 'completed')">Fait</button>
              <button class="btn btn-sm btn-danger" style="flex:1" onclick="PageKanban.moveTask(${t.id}, 'not_done')">Rater</button>
            </div>
          `;
        }

        return `
          <div class="card" style="padding:12px; margin-bottom:10px; border-left:4px solid ${col.color}; cursor:pointer;" onclick="event.stopPropagation(); PageKanban.viewTask(${t.id})">
            <div style="font-weight:bold; font-size:14px; margin-bottom:5px;">${t.title}</div>
            <p style="font-size:12px; color:#666; margin:0 0 8px 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.description || 'Pas de description'}</p>
            <div style="display:flex; justify-content:between; align-items:center; font-size:11px; color:#999; margin-bottom:10px;">
              <span>👤 ${t.assignee?.full_name || 'Non assigné'}</span>
              <span>📅 ${t.end_date ? new Date(t.end_date).toLocaleDateString('fr-FR') : '—'}</span>
            </div>
            ${actionButtons}
          </div>
        `;
      }).join('');

      return `
        <div style="flex:1; min-width:250px; background:#F8F9FA; border-radius:8px; padding:12px; display:flex; flex-direction:column;">
          <div style="display:flex; justify-content:between; align-items:center; margin-bottom:12px; border-bottom:2px solid ${col.color}; padding-bottom:8px;">
            <strong style="font-size:15px;">${col.label}</strong>
            <span class="badge badge-secondary" style="background:#E0E0E0; color:#333;">${colTasks.length}</span>
          </div>
          <div style="flex:1; overflow-y:auto; max-height:calc(100vh - 250px); min-height:200px;">
            ${cardsHtml || '<div style="text-align:center; padding:20px; color:#999; font-size:13px;">Aucune tâche</div>'}
          </div>
        </div>
      `;
    }).join('');

    Layout.content(`
      <div class="page-head" style="margin-bottom:20px;">
        <div>
          <h2>Kanban des Tâches</h2>
          <div class="subtitle">Gestion visuelle des interventions techniques</div>
        </div>
      </div>
      <div style="display:flex; gap:16px; overflow-x:auto; padding-bottom:10px;">
        ${columnsHtml}
      </div>
    `);
  },

  async moveTask(id, newStatus) {
    let completion_note = '';
    if (newStatus === 'completed' || newStatus === 'not_done') {
      completion_note = prompt('Note de réalisation/justification (optionnel) :') || '';
    }

    try {
      await API.put(`/tasks/${id}`, { status: newStatus, completion_note });
      Toast.success('Tâche déplacée avec succès !');
      this.render();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async viewTask(id) {
    const t = this.tasks.find(x => x.id === id);
    if (!t) return;
    
    Modal.open(
      t.title,
      `
        <div>
          <p><strong>Description:</strong> ${t.description || '—'}</p>
          <p><strong>Priorité:</strong> <span class="badge badge-warning">${t.priority}</span></p>
          <p><strong>Assigné à:</strong> ${t.assignee?.full_name || 'Non assigné'}</p>
          <p><strong>Date début:</strong> ${t.start_date ? new Date(t.start_date).toLocaleString('fr-FR') : '—'}</p>
          <p><strong>Échéance:</strong> ${t.end_date ? new Date(t.end_date).toLocaleString('fr-FR') : '—'}</p>
          ${t.completion_note ? `<p><strong>Note de complétion:</strong> ${t.completion_note}</p>` : ''}
        </div>
      `,
      `<button class="btn btn-outline" onclick="Modal.close()">Fermer</button>`
    );
  }
};

window.PageKanban = PageKanban;
