// ============ Page Paramètres Entreprise & Charte Graphique ============
const PageCompanySettings = {
  _settings: null,

  register() {
    Router.register('company-settings', () => this.render());
  },

  async loadSettings() {
    try {
      const res = await API.get('/company-settings');
      this._settings = res.data || {};
      return this._settings;
    } catch (e) {
      console.warn('Erreur chargement paramètres entreprise:', e);
      return {};
    }
  },

  async render() {
    const appContent = document.getElementById('appContent');
    appContent.innerHTML = `<div style="text-align:center;padding:50px"><div class="spinner"></div></div>`;

    const s = await this.loadSettings();

    const logoSrc = s.logo_url
      ? (s.logo_url.startsWith('http') ? s.logo_url : `${CONFIG.SERVER_URL || 'http://localhost:5000'}${s.logo_url}?t=${Date.now()}`)
      : `../assets/images/logo.png?t=${Date.now()}`;

    appContent.innerHTML = `
      <div class="card" style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h2 style="font-size:20px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:10px">
              🏢 Paramètres Entreprise & Charte Graphique
            </h2>
            <p style="font-size:13px;color:var(--text-muted);margin-top:3px">
              Configurez les coordonnées officielles, le logo et la charte graphique de votre société.
              Toutes ces informations et ce logo sont automatiquement appliqués sur <strong>tous les reçus de paiement, rapports de gestion et factures générés</strong>.
            </p>
          </div>
          <div>
            <button class="btn btn-primary" onclick="PageCompanySettings.save()"><span class="btn-icon">💾</span> Enregistrer les modifications</button>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:320px 1fr;gap:20px;align-items:start">
        <!-- COLONNE GAUCHE : LOGO DE L'ENTREPRISE -->
        <div class="card" style="text-align:center">
          <h3 style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px">
            🖼️ Logo Officiel de l'Entreprise
          </h3>
          <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px">
            Apparaît sur tous les reçus de loyer (21x14,85 cm), rapports de gestion et contrats officiels.
          </p>

          <div id="companyLogoPreviewBox" style="width:200px;height:200px;margin:0 auto 16px;border:2px dashed #cbd5e1;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#f8fafc;cursor:pointer;overflow:hidden;position:relative;transition:all 0.2s" onclick="document.getElementById('companyLogoFileInput').click()">
            <img id="companyLogoImg" src="${logoSrc}" alt="Logo Entreprise" style="max-width:90%;max-height:90%;object-fit:contain" onerror="this.onerror=null;this.src='../assets/images/logo.png'" />
            <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(26,58,92,0.85);color:#fff;padding:6px;font-size:11px;font-weight:600">
              <i class="fas fa-camera"></i> Changer le logo
            </div>
          </div>

          <input type="file" id="companyLogoFileInput" accept="image/*" style="display:none" onchange="PageCompanySettings.onLogoSelected(event)" />

          <button class="btn btn-outline" style="width:100%" onclick="document.getElementById('companyLogoFileInput').click()">
            📁 Choisir un nouveau fichier
          </button>
          <small style="display:block;margin-top:8px;font-size:11px;color:var(--text-muted)">
            Formats recommandés : PNG ou JPEG fond transparent ou blanc, min 400×400 px.
          </small>
        </div>

        <!-- COLONNE DROITE : FORMULAIRE COORDONNÉES ET CHARTE -->
        <div style="display:flex;flex-direction:column;gap:20px">
          <!-- COORDONNÉES -->
          <div class="card">
            <h3 style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:16px;border-bottom:1px solid #e2e8f0;padding-bottom:8px">
              📌 Informations Légales & Coordonnées
            </h3>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
              <div style="grid-column:1 / -1">
                <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Nom officiel de l'entreprise *</label>
                <input type="text" id="csName" class="form-control" value="${this._escape(s.name || 'SMG IMMOBILIERE')}" placeholder="ex: SMG IMMOBILIERE" />
              </div>

              <div style="grid-column:1 / -1">
                <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Adresse du siège social *</label>
                <input type="text" id="csAddress" class="form-control" value="${this._escape(s.address || 'Yaoundé et Douala, Cameroun')}" placeholder="ex: Yaoundé et Douala, Cameroun" />
              </div>

              <div>
                <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Téléphones officiels *</label>
                <input type="text" id="csPhone" class="form-control" value="${this._escape(s.phone || '+237 6 699 03 07 71, 670 56 16 12')}" placeholder="ex: +237 6 699 03 07 71, 670 56 16 12" />
              </div>

              <div>
                <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Email de contact *</label>
                <input type="email" id="csEmail" class="form-control" value="${this._escape(s.email || 'smgimmobilier.infos@gmail.com')}" placeholder="ex: smgimmobilier.infos@gmail.com" />
              </div>
            </div>
          </div>

          <!-- CHARTE GRAPHIQUE -->
          <div class="card">
            <h3 style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:16px;border-bottom:1px solid #e2e8f0;padding-bottom:8px">
              🎨 Couleurs de la Charte Graphique
            </h3>

            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:16px">
              <div>
                <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">Couleur Principale</label>
                <div style="display:flex;align-items:center;gap:8px">
                  <input type="color" id="csPrimaryColor" value="${s.primary_color || '#1a3a5c'}" style="width:44px;height:38px;padding:2px;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer" />
                  <span style="font-size:12px;font-weight:600;color:#475569" id="csPrimaryHex">${s.primary_color || '#1a3a5c'}</span>
                </div>
                <small style="color:var(--text-muted);font-size:11px">En-têtes, bandeaux et titres</small>
              </div>

              <div>
                <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">Couleur Secondaire</label>
                <div style="display:flex;align-items:center;gap:8px">
                  <input type="color" id="csSecondaryColor" value="${s.secondary_color || '#f0f4f8'}" style="width:44px;height:38px;padding:2px;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer" />
                  <span style="font-size:12px;font-weight:600;color:#475569" id="csSecondaryHex">${s.secondary_color || '#f0f4f8'}</span>
                </div>
                <small style="color:var(--text-muted);font-size:11px">Fonds de cartes et lignes alternées</small>
              </div>

              <div>
                <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">Couleur Accent</label>
                <div style="display:flex;align-items:center;gap:8px">
                  <input type="color" id="csAccentColor" value="${s.accent_color || '#c0392b'}" style="width:44px;height:38px;padding:2px;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer" />
                  <span style="font-size:12px;font-weight:600;color:#475569" id="csAccentHex">${s.accent_color || '#c0392b'}</span>
                </div>
                <small style="color:var(--text-muted);font-size:11px">Arriérés et alertes financières</small>
              </div>
            </div>
          </div>

          <!-- BOUTON ENREGISTRER -->
          <div style="display:flex;justify-content:flex-end">
            <button class="btn btn-primary btn-lg" onclick="PageCompanySettings.save()" style="padding:12px 28px;font-size:15px;font-weight:700">
              <span class="btn-icon">💾</span> Enregistrer tous les paramètres
            </button>
          </div>
        </div>
      </div>
    `;

    // Écouteurs sur les couleurs pour synchroniser les codes hex
    ['Primary', 'Secondary', 'Accent'].forEach(k => {
      const inp = document.getElementById(`cs${k}Color`);
      const span = document.getElementById(`cs${k}Hex`);
      if (inp && span) {
        inp.addEventListener('input', (e) => { span.textContent = e.target.value; });
      }
    });
  },

  _selectedFile: null,

  onLogoSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    this._selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.getElementById('companyLogoImg');
      if (img) img.src = e.target.result;
      Toast.info('Nouveau logo sélectionné. Cliquez sur "Enregistrer" pour le valider.');
    };
    reader.readAsDataURL(file);
  },

  async save() {
    const name = document.getElementById('csName')?.value.trim();
    const address = document.getElementById('csAddress')?.value.trim();
    const phone = document.getElementById('csPhone')?.value.trim();
    const email = document.getElementById('csEmail')?.value.trim();
    const primary_color = document.getElementById('csPrimaryColor')?.value;
    const secondary_color = document.getElementById('csSecondaryColor')?.value;
    const accent_color = document.getElementById('csAccentColor')?.value;

    if (!name || !address || !phone || !email) {
      Toast.error('Veuillez renseigner au moins le nom, l\'adresse, le téléphone et l\'email.');
      return;
    }

    Toast.info('Enregistrement des paramètres entreprise...');

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('address', address);
      formData.append('phone', phone);
      formData.append('email', email);
      formData.append('nif', '');
      formData.append('rccm', '');
      formData.append('primary_color', primary_color || '#1a3a5c');
      formData.append('secondary_color', secondary_color || '#f0f4f8');
      formData.append('accent_color', accent_color || '#c0392b');

      if (this._selectedFile) {
        formData.append('logo', this._selectedFile);
      }

      // Appel fetch avec FormData
      const token = Auth.getToken();
      const res = await fetch(`${CONFIG.API_URL}/company-settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Erreur lors de la sauvegarde');

      this._settings = json.data;
      this._selectedFile = null;

      // Actualiser le logo dans la barre latérale immédiatement
      const sbLogo = document.getElementById('sidebarLogoImg');
      if (sbLogo) {
        sbLogo.src = `../assets/images/logo.png?t=${Date.now()}`;
        sbLogo.style.display = 'block';
      }

      // Mettre à jour le cache local pour le ReceiptManager
      if (window.ReceiptManager && window.ReceiptManager.storage) {
        window.ReceiptManager.storage.saveConfig({
          companyName: name,
          companyAddress: address,
          companyPhone: phone,
          companyEmail: email,
          companySiret: '',
          primaryColor: primary_color,
          secondaryColor: secondary_color,
          accentColor: accent_color,
          logo: this._settings.logo_url ? `${CONFIG.SERVER_URL}${this._settings.logo_url}` : null,
        });
      }

      Toast.success('Paramètres et logo de l\'entreprise enregistrés avec succès ! 🎉');
      await this.render();
    } catch (err) {
      console.error(err);
      Toast.error(err.message || 'Erreur enregistrement');
    }
  },

  _escape(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
};

window.PageCompanySettings = PageCompanySettings;
