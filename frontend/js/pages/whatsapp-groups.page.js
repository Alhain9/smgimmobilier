// ============ Page Groupes WhatsApp (Collaboration) ============
const PageWhatsappGroups = {
  groups: [],

  register() {
    Router.register('whatsapp-groups', () => this.render());
  },

  async render() {
    if (Auth.getRole() === 'locataire') {
      Router.go('dashboard');
      return;
    }
    Layout.setTitle('Groupes WhatsApp');
    const canManage = Auth.hasRole('super_admin', 'manager', 'dir_admin');

    Layout.content(`
      <div class="flex gap-2 mb-3">
        <button class="btn btn-outline" onclick="Router.go('messages')">💬 Messagerie Interne</button>
        <button class="btn btn-primary">📱 Groupes WhatsApp</button>
      </div>

      <div class="page-head flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2>📱 Groupes WhatsApp — Collaboration</h2>
          <div class="subtitle">Rejoignez les canaux d'échange et d'information officiels</div>
        </div>
        ${canManage ? `<button class="btn btn-primary" onclick="PageWhatsappGroups.openCreateModal()">+ Nouveau groupe WhatsApp</button>` : ''}
      </div>

      <div id="whatsappGroupsContainer">
        <div class="spinner"></div>
      </div>
    `);

    await this.loadGroups();
  },

  async loadGroups() {
    const container = document.getElementById('whatsappGroupsContainer');
    if (!container) return;

    try {
      const res = await API.get('/rh/whatsapp-groups');
      this.groups = res.data || [];
      const canManage = Auth.hasRole('super_admin', 'manager', 'dir_admin');

      if (!this.groups.length) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="icon">📱</div>
            <h3>Aucun groupe WhatsApp disponible</h3>
            <p class="text-muted">Les groupes de discussion apparaîtront ici.</p>
          </div>`;
        return;
      }

      container.innerHTML = `
        <div class="stats-grid" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
          ${this.groups.map((g) => `
            <div class="card flex flex-col justify-between" style="padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); background: var(--bg-surface);">
              <div>
                <div class="flex items-center gap-3 mb-3">
                  <div style="width: 44px; height: 44px; border-radius: 50%; background: rgba(37, 211, 102, 0.15); color: #25D366; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: bold;">
                    💬
                  </div>
                  <div style="flex: 1; overflow: hidden;">
                    <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${g.name}</h3>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${g.property_name ? `📍 ${g.property_name}` : 'Canal Général / Tous immeubles'}</span>
                  </div>
                </div>
                <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 20px;">
                  ${g.description || 'Groupe de discussion et d\'information.'}
                </p>
              </div>
              <div class="flex items-center justify-between gap-2 pt-3" style="border-top: 1px solid var(--border-color);">
                <a href="${g.link}" target="_blank" rel="noopener noreferrer" class="btn btn-success flex-1 text-center" style="background: #25D366; border-color: #25D366; color: #fff; font-weight: 600;">
                  🟢 Rejoindre sur WhatsApp
                </a>
                ${canManage ? `
                  <button class="btn btn-sm btn-outline-danger" title="Supprimer le groupe" onclick="PageWhatsappGroups.deleteGroup('${g.id}')">
                    🗑
                  </button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="card" style="padding: 20px; color: var(--danger);">Erreur : ${err.message}</div>`;
    }
  },

  async openCreateModal() {
    let propOptions = '<option value="">— Tous les immeubles / Cités —</option>';
    try {
      const { data: props } = await API.get('/properties');
      if (props && props.length) {
        propOptions += props.map(p => `<option value="${p.id}">${p.property_name} (${p.city || 'Immeuble'})</option>`).join('');
      }
    } catch (_) {}

    Modal.open('➕ Ajouter un groupe WhatsApp', `
      <div class="form-group mb-3">
        <label>Nom du groupe <span style="color:var(--danger)">*</span></label>
        <input type="text" class="form-control" id="wgName" placeholder="Ex: Résidents — Immeuble Pasteur" required />
      </div>
      <div class="form-group mb-3">
        <label>Immeuble / Cité associée</label>
        <select class="form-control" id="wgPropertyId">${propOptions}</select>
        <div class="text-muted" style="font-size:12px; margin-top:4px">Si un immeuble est sélectionné, seuls les locataires de cet immeuble verront ce groupe.</div>
      </div>
      <div class="form-group mb-3">
        <label>Lien d'invitation WhatsApp <span style="color:var(--danger)">*</span></label>
        <input type="url" class="form-control" id="wgLink" placeholder="https://chat.whatsapp.com/..." required />
      </div>
      <div class="form-group mb-3">
        <label>Description du groupe</label>
        <textarea class="form-control" id="wgDesc" rows="3" placeholder="Description courte des échanges dans ce groupe..."></textarea>
      </div>
    `, `
      <button class="btn btn-outline" onclick="Modal.close()">Annuler</button>
      <button class="btn btn-primary" onclick="PageWhatsappGroups.submitCreate()">Enregistrer</button>
    `);
  },

  async submitCreate() {
    const name = document.getElementById('wgName').value.trim();
    const link = document.getElementById('wgLink').value.trim();
    const description = document.getElementById('wgDesc').value.trim();
    const property_id = document.getElementById('wgPropertyId').value;

    if (!name || !link) {
      Toast.error('Veuillez remplir le nom et le lien WhatsApp.');
      return;
    }

    try {
      await API.post('/rh/whatsapp-groups', { name, link, description, property_id: property_id || null });
      Modal.close();
      Toast.success('Groupe WhatsApp créé avec succès.');
      this.loadGroups();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de la création du groupe.');
    }
  },

  async deleteGroup(id) {
    if (!confirm('Voulez-vous vraiment supprimer ce groupe WhatsApp ?')) return;

    try {
      await API.delete('/rh/whatsapp-groups/' + id);
      Toast.success('Groupe WhatsApp supprimé.');
      this.loadGroups();
    } catch (err) {
      Toast.error(err.message || 'Échec de la suppression.');
    }
  }
};

window.PageWhatsappGroups = PageWhatsappGroups;
