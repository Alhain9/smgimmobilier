// ============ Page Fournisseurs — SMG IMMOBILIER ============
const PageSuppliers = {
  register() {
    Router.register('suppliers', () => this.render());
  },

  async render() {
    Layout.setTitle('Fournisseurs');
    const appContent = document.getElementById('appContent');
    const canManage = Auth.hasRole('manager', 'comptable');

    appContent.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h2 style="font-size:18px;font-weight:700;color:var(--text)">🏭 Répertoire des Fournisseurs</h2>
            <p style="font-size:13px;color:var(--text-muted);margin-top:2px">Gestion des partenaires commerciaux, quincailleries, grossistes en matériaux et historiques d'achats.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${canManage ? `
              <button class="btn btn-primary" onclick="PageSuppliers.openModal()"><span class="btn-icon">➕</span> Nouveau Fournisseur</button>
            ` : ''}
            <button class="btn btn-outline" onclick="PageSuppliers.load()"><span class="btn-icon">🔄</span> Actualiser</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="table" id="suppliersTable">
            <thead>
              <tr>
                <th>Fournisseur</th>
                <th>Spécialité / Catégorie</th>
                <th>Contact</th>
                <th>Téléphone</th>
                <th>Email</th>
                <th>Ville / Adresse</th>
                <th>Achats Réalisés</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody id="suppliersTableBody">
              <tr><td colspan="8" style="text-align:center;padding:30px"><div class="spinner"></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await this.load();
  },

  async load() {
    const tbody = document.getElementById('suppliersTableBody');
    try {
      const res = await API.get('/suppliers');
      const suppliers = res.data || [];
      const canManage = Auth.hasRole('manager', 'comptable');

      if (!suppliers.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted)">Aucun fournisseur enregistré.</td></tr>';
        return;
      }

      tbody.innerHTML = suppliers.map((s) => `
        <tr>
          <td><b style="color:var(--primary);font-size:14px">${s.name}</b></td>
          <td><span class="badge badge-secondary">${s.category || 'Général'}</span></td>
          <td>${s.contact_person || '—'}</td>
          <td><b>${s.phone || '—'}</b></td>
          <td><small>${s.email || '—'}</small></td>
          <td>${s.city || 'Yaoundé'}${s.address ? ` (${s.address})` : ''}</td>
          <td><span class="badge badge-info">${(s.purchases || []).length} bon(s)</span></td>
          <td style="text-align:right">
            ${canManage ? `
              <button class="btn btn-sm btn-outline" onclick="PageSuppliers.openModal(${s.id})" title="Modifier">✏️</button>
            ` : ''}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--danger)">Erreur de chargement des fournisseurs.</td></tr>';
    }
  },

  async openModal(id = null) {
    let s = { name: '', category: 'Quincaillerie & Matériaux', contact_person: '', phone: '', email: '', address: '', city: 'Yaoundé', notes: '' };
    if (id) {
      const res = await API.get(`/suppliers/${id}`);
      s = res.data;
    }

    const html = `
      <form id="supplierForm" onsubmit="PageSuppliers.submit(event, ${id})">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label class="form-label">Nom de l'entreprise fournisseur *</label>
            <input type="text" id="s_name" class="form-control" required value="${s.name || ''}" placeholder="ex: Quincaillerie du Centre" />
          </div>
          <div>
            <label class="form-label">Spécialité / Catégorie</label>
            <input type="text" id="s_category" class="form-control" value="${s.category || ''}" placeholder="Plomberie, Peinture, Électricité, Gros œuvre..." />
          </div>
          <div>
            <label class="form-label">Personne de contact</label>
            <input type="text" id="s_contact" class="form-control" value="${s.contact_person || ''}" placeholder="Nom du commercial ou responsable" />
          </div>
          <div>
            <label class="form-label">Téléphone</label>
            <input type="text" id="s_phone" class="form-control" value="${s.phone || ''}" placeholder="+237 6..." />
          </div>
          <div>
            <label class="form-label">Email</label>
            <input type="email" id="s_email" class="form-control" value="${s.email || ''}" placeholder="contact@fournisseur.cm" />
          </div>
          <div>
            <label class="form-label">Ville</label>
            <input type="text" id="s_city" class="form-control" value="${s.city || 'Yaoundé'}" />
          </div>
        </div>
        <div style="margin-top:12px">
          <label class="form-label">Adresse / Localisation</label>
          <input type="text" id="s_address" class="form-control" value="${s.address || ''}" placeholder="ex: Marché Central, Rue des grossistes..." />
        </div>
        <div style="margin-top:12px">
          <label class="form-label">Notes et conditions commerciales</label>
          <textarea id="s_notes" class="form-control" rows="2" placeholder="Délais de livraison, remises accordées...">${s.notes || ''}</textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Annuler</button>
          <button type="submit" class="btn btn-primary">${id ? 'Mettre à jour' : 'Créer le fournisseur'}</button>
        </div>
      </form>
    `;

    Modal.open({ title: id ? '✏️ Modifier le Fournisseur' : '🏭 Nouveau Fournisseur', content: html, size: 'medium' });
  },

  async submit(e, id) {
    e.preventDefault();
    const data = {
      name: document.getElementById('s_name').value,
      category: document.getElementById('s_category').value,
      contact_person: document.getElementById('s_contact').value || null,
      phone: document.getElementById('s_phone').value || null,
      email: document.getElementById('s_email').value || null,
      city: document.getElementById('s_city').value || 'Yaoundé',
      address: document.getElementById('s_address').value || null,
      notes: document.getElementById('s_notes').value || null,
    };

    try {
      if (id) {
        await API.put(`/suppliers/${id}`, data);
        Toast.success('Fournisseur mis à jour');
      } else {
        await API.post('/suppliers', data);
        Toast.success('Fournisseur créé avec succès');
      }
      Modal.close();
      this.load();
    } catch (err) {
      Toast.error(err.message || 'Erreur lors de l\'enregistrement');
    }
  },
};

window.PageSuppliers = PageSuppliers;
