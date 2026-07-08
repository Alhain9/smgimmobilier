const PageProfile = {
  register() { Router.register('profile', () => this.render()); },

  async render() {
    Layout.setTitle('Mon profil');
    const { data: u } = await API.get('/auth/me');
    const avatar = u.profile_image
      ? `<img src="${Helpers.fileUrl(u.profile_image)}" style="width:96px;height:96px;border-radius:50%;object-fit:cover"/>`
      : `<div class="user-avatar" style="width:96px;height:96px;font-size:34px">${Helpers.initials(u.full_name)}</div>`;

    Layout.content(`
      <div class="page-head"><div><h2>Mon profil</h2><div class="subtitle">Vos informations personnelles</div></div></div>
      <div class="grid-2">
        <div class="card"><div class="card-body" style="text-align:center">
          <div id="avatarBox" style="display:flex;justify-content:center;margin-bottom:16px">${avatar}</div>
          <h3>${u.full_name}</h3>
          <div class="badge badge-primary" style="margin:8px 0">${u.role ? u.role.label : ''}</div>
          <div class="list-item"><div style="flex:1;text-align:left">📧 Email</div><b>${u.email}</b></div>
          <div class="list-item"><div style="flex:1;text-align:left">📞 Téléphone</div><b>${u.phone || '—'}</b></div>
          <div class="list-item"><div style="flex:1;text-align:left">🔖 Statut</div>${Helpers.statusBadge(u.status)}</div>
          <div class="list-item"><div style="flex:1;text-align:left">📅 Membre depuis</div><b>${Helpers.formatDate(u.created_at)}</b></div>
          <div class="form-group mt-4" style="text-align:left">
            <label>Changer la photo de profil</label>
            <input type="file" id="avatarFile" class="form-control" accept="image/*" onchange="PageProfile.uploadAvatar()"/>
          </div>
        </div></div>

        <div>
          <div class="card mb-4"><div class="card-header"><h3>Modifier mes informations</h3></div><div class="card-body">
            <div class="form-group"><label>Nom complet</label><input class="form-control" id="pf_name" value="${u.full_name}"/></div>
            <div class="form-group"><label>Email</label><input type="email" class="form-control" id="pf_email" value="${u.email}"/></div>
            <div class="form-group"><label>Téléphone</label><input class="form-control" id="pf_phone" value="${u.phone || ''}"/></div>
            <button class="btn btn-primary" onclick="PageProfile.saveInfo()">Enregistrer</button>
          </div></div>

          <div class="card"><div class="card-header"><h3>Changer mon mot de passe</h3></div><div class="card-body">
            <div class="form-group"><label>Mot de passe actuel</label><input type="password" class="form-control" id="pf_old"/></div>
            <div class="form-group"><label>Nouveau mot de passe</label><input type="password" class="form-control" id="pf_new" minlength="6"/></div>
            <button class="btn btn-primary" onclick="PageProfile.changePassword()">Mettre à jour</button>
          </div></div>
        </div>
      </div>`);
  },

  async saveInfo() {
    try {
      const res = await API.put('/auth/profile', {
        full_name: document.getElementById('pf_name').value,
        email: document.getElementById('pf_email').value,
        phone: document.getElementById('pf_phone').value,
      });
      this._syncSession(res.data);
      Toast.success('Profil mis à jour');
    } catch (e) { Toast.error(e.message); }
  },

  async uploadAvatar() {
    const file = document.getElementById('avatarFile').files[0];
    if (!file) return;
    const fd = new FormData(); fd.append('avatar', file);
    try {
      const res = await API.upload('/auth/profile', fd, 'PUT');
      this._syncSession(res.data);
      Toast.success('Photo mise à jour');
      PageProfile.render();
    } catch (e) { Toast.error(e.message); }
  },

  async changePassword() {
    const oldPassword = document.getElementById('pf_old').value;
    const newPassword = document.getElementById('pf_new').value;
    if (newPassword.length < 6) { Toast.error('Mot de passe : 6 caractères minimum'); return; }
    try {
      await API.put('/auth/change-password', { oldPassword, newPassword });
      Toast.success('Mot de passe modifié');
      document.getElementById('pf_old').value = ''; document.getElementById('pf_new').value = '';
    } catch (e) { Toast.error(e.message); }
  },

  // Met à jour la session locale + topbar
  _syncSession(user) {
    const current = Auth.getUser();
    const merged = { ...current, full_name: user.full_name, email: user.email, phone: user.phone, profile_image: user.profile_image };
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(merged));
    Layout.renderUser();
  },
};
