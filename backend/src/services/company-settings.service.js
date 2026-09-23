// ============ Service Paramètres Entreprise & Charte Graphique ============
const fs = require('fs');
const path = require('path');
const { logger } = require('../config/logger');

const CONFIG_FILE = path.join(__dirname, '../config/company-settings.json');
const LOGO_DEFAULT_PATH = path.join(__dirname, '../uploads/company/logo.png');

const DEFAULTS = {
  name: 'SMG IMMOBILIERE',
  address: 'Yaoundé et Douala, Cameroun',
  phone: '+237 6 699 03 07 71, 670 56 16 12',
  email: 'smgimmobilier.infos@gmail.com',
  nif: '',
  rccm: '',
  logo_url: '/uploads/company/logo.png',
  primary_color: '#1a3a5c',
  secondary_color: '#f0f4f8',
  accent_color: '#c0392b',
};

class CompanySettingsService {
  getSettings() {
    let settings = { ...DEFAULTS };
    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        settings = { ...settings, ...parsed };
      } catch (e) {
        logger.warn('Erreur lecture company-settings.json', { error: e.message });
      }
    }

    // Vérifier si le logo existe sur disque
    let logoPath = null;
    if (settings.logo_url) {
      const rel = settings.logo_url.replace(/^\/uploads\//, '');
      const candidate = path.join(__dirname, '../uploads', rel);
      if (fs.existsSync(candidate)) {
        logoPath = candidate;
      }
    }
    if (!logoPath && fs.existsSync(LOGO_DEFAULT_PATH)) {
      logoPath = LOGO_DEFAULT_PATH;
      settings.logo_url = '/uploads/company/logo.png';
    }

    return {
      ...settings,
      logo_path: logoPath,
    };
  }

  updateSettings(data = {}, logoFile = null) {
    const current = this.getSettings();
    delete current.logo_path;

    const updated = {
      ...current,
      name: (data.name || current.name).trim(),
      address: (data.address || current.address).trim(),
      phone: (data.phone || current.phone).trim(),
      email: (data.email || current.email).trim(),
      nif: (data.nif || current.nif).trim(),
      rccm: (data.rccm || current.rccm || '').trim(),
      primary_color: data.primary_color || current.primary_color,
      secondary_color: data.secondary_color || current.secondary_color,
      accent_color: data.accent_color || current.accent_color,
    };

    if (logoFile) {
      updated.logo_url = `/uploads/company/${logoFile.filename}`;
      // Synchronisation directe avec frontend/assets/images/logo.png
      try {
        const uploadedPath = path.join(__dirname, '../uploads/company', logoFile.filename);
        const frontendLogoPath = path.join(__dirname, '../../../frontend/assets/images/logo.png');
        if (fs.existsSync(uploadedPath)) {
          fs.copyFileSync(uploadedPath, frontendLogoPath);
          logger.info('🖼️ Logo synchronisé vers frontend/assets/images/logo.png');

          // Regénérer automatiquement les icônes PWA (192, 512, favicons)
          const { exec } = require('child_process');
          const scriptPath = path.join(__dirname, '../../../frontend/assets/icons/convert_icons.ps1');
          if (fs.existsSync(scriptPath)) {
            exec(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, (err) => {
              if (err) logger.warn('Avertissement regénération icônes PWA:', { error: err.message });
              else logger.info('✅ Icônes PWA et favicons regénérées avec le nouveau logo entreprise !');
            });
          }
        }
      } catch (syncErr) {
        logger.warn('Erreur synchronisation logo frontend:', { error: syncErr.message });
      }
    }

    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
      logger.info('🏢 Paramètres entreprise enregistrés avec succès');
    } catch (e) {
      logger.error('Erreur sauvegarde company-settings.json', { error: e.message });
      throw e;
    }

    return this.getSettings();
  }
}

module.exports = new CompanySettingsService();
