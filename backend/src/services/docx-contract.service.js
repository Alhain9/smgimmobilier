// ============ Service Génération Contrat de Bail Word (.docx) — SMG IMMOBILIER ============
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { Lease, Tenant, Apartment, Property, User } = require('../models');
const companyService = require('./company-settings.service');

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtMoney = (n) => {
  return Number(n || 0).toLocaleString('fr-FR');
};

/**
 * Convertit un entier en lettres majuscules (Français)
 * ex: 30000 -> TRENTE MILLE
 * ex: 372000 -> TROIS CENT SOIXANTE-DOUZE MILLE
 */
function numberToFrenchWords(n) {
  n = Math.round(Number(n) || 0);
  if (n === 0) return 'ZÉRO';

  const units = ['', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF',
    'DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE', 'DIX-SEPT', 'DIX-HUIT', 'DIX-NEUF'];
  const tens = ['', 'DIX', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE', 'SOIXANTE', 'SOIXANTE-DIX', 'QUATRE-VINGT', 'QUATRE-VINGT-DIX'];

  function convertSmall(num) {
    if (num < 20) return units[num];
    if (num < 70) {
      const t = Math.floor(num / 10);
      const u = num % 10;
      if (u === 1 && t < 8) return tens[t] + ' ET UN';
      return tens[t] + (u ? '-' + units[u] : '');
    }
    if (num < 80) {
      const u = num - 60;
      if (u === 11) return 'SOIXANTE ET ONZE';
      return 'SOIXANTE-' + units[u];
    }
    if (num < 100) {
      const u = num - 80;
      if (u === 0) return 'QUATRE-VINGTS';
      return 'QUATRE-VINGT-' + units[u];
    }
    const h = Math.floor(num / 100);
    const r = num % 100;
    let hStr = h === 1 ? 'CENT' : units[h] + ' CENT' + (r === 0 ? 'S' : '');
    return r ? hStr + ' ' + convertSmall(r) : hStr;
  }

  function convert(num) {
    if (num < 1000) return convertSmall(num);
    if (num < 1000000) {
      const k = Math.floor(num / 1000);
      const r = num % 1000;
      let kStr = k === 1 ? 'MILLE' : convertSmall(k) + ' MILLE';
      return r ? kStr + ' ' + convertSmall(r) : kStr;
    }
    const m = Math.floor(num / 1000000);
    const r = num % 1000000;
    let mStr = m === 1 ? 'UN MILLION' : convertSmall(m) + ' MILLIONS';
    return r ? mStr + ' ' + convert(r) : mStr;
  }

  return convert(n).trim();
}

class DocxContractService {
  /**
   * Génère le fichier Word (.docx) rempli pour un contrat de bail donné
   */
  async generateLeaseDocx(leaseId) {
    const lease = await Lease.findByPk(leaseId, {
      include: [
        {
          model: Tenant,
          as: 'tenant',
          include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'phone'] }],
        },
        {
          model: Apartment,
          as: 'apartment',
          include: [
            {
              model: Property,
              as: 'property',
              include: [{ model: User, as: 'owner', attributes: ['id', 'full_name', 'phone', 'email'] }],
            },
          ],
        },
      ],
    });

    if (!lease) {
      throw Object.assign(new Error('Contrat de bail introuvable'), { status: 404 });
    }

    const tenant = lease.tenant;
    const user = tenant?.user;
    const apt = lease.apartment;
    const prop = apt?.property;
    const owner = prop?.owner;
    const settings = companyService.getSettings();

    // Recherche du modèle Word à utiliser :
    // 1. Modèle spécifique à l'immeuble si téléversé et au format .docx
    // 2. Modèle officiel par défaut de SMG IMMOBILIER
    let templateBuffer = null;
    let templateSource = 'default';

    if (prop?.lease_template_file && /\.docx?$/i.test(prop.lease_template_file)) {
      const relPath = prop.lease_template_file.replace(/^\//, '');
      const fullPath = path.join(__dirname, '..', relPath);
      if (fs.existsSync(fullPath)) {
        templateBuffer = fs.readFileSync(fullPath);
        templateSource = `immeuble_${prop.property_name}`;
      }
    }

    if (!templateBuffer) {
      const defaultPath = path.join(__dirname, '..', 'templates', 'modele_contrat_bail_smg.docx');
      if (fs.existsSync(defaultPath)) {
        templateBuffer = fs.readFileSync(defaultPath);
        templateSource = 'default_smg';
      } else {
        throw Object.assign(new Error('Modèle Word par défaut introuvable sur le serveur'), { status: 500 });
      }
    }

    // Chargement du ZIP et initialisation Docxtemplater
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '—',
    });

    const tenantName = user?.full_name || tenant?.full_name || 'Locataire';

    // Détermination de la civilité / titre du locataire (Monsieur, Madame, Mademoiselle)
    let civility = tenant?.civility;
    if (!civility) {
      const lower = tenantName.toLowerCase();
      const isFemale = /\b(mme|madame|mlle|mademoiselle|marie|dora|sylvana|adele|adèle|myriam|ines|inès|mariel|nathalie|vanessa|florence|alice|rose|jeanne|patricia|christelle)\b/i.test(lower);
      civility = isFemale ? 'Madame' : 'Monsieur';
    }
    const titreLocataire = civility;

    const rawCni = tenant?.national_id || tenant?.cni;
    const cniNum = rawCni ? String(rawCni).trim() : '....................';
    const cniDate = tenant?.cni_delivery_date ? fmtDate(tenant.cni_delivery_date) : '';
    const cniPlace = tenant?.cni_delivery_place || prop?.city || 'Yaoundé';
    const dateLieuCni = cniDate 
      ? `délivrée le ${cniDate} à ${cniPlace}` 
      : `délivrée le .................... à ${cniPlace}`;

    const phone = (user?.phone || tenant?.phone || '').trim() || '....................';
    const email = user?.email || tenant?.email || '—';
    const profession = tenant?.profession || 'Salarié(e)';
    const emergencyContact = tenant?.emergency_contact || '—';

    const propName = prop?.property_name || 'Immeuble';
    const isMalaika = /mal[ai]+ka/i.test(propName);
    const propNameFull = isMalaika ? 'la mini-cité MALAIKA' : `l'immeuble ${propName}`;
    const propAddress = prop?.address || (isMalaika ? '150m de la route de Yaoundé - Mfou, lieu-dit « entrée IAI »' : 'Yaoundé, Cameroun');
    const city = prop?.city || 'Yaoundé';
    const district = prop?.district || (isMalaika ? 'Awae Escalier, entrée IAI' : 'Centre');

    const aptNum = apt?.apartment_number || '01';
    const aptType = (apt?.apartment_type || 'Chambre').toLowerCase();
    const designationLogement = aptType.includes('chambre') ? `une chambre (N° ${aptNum})`
      : (aptType.includes('studio') ? `un studio (N° ${aptNum})` : `un logement ${aptNum} (${apt?.apartment_type || 'Appartement'})`);
    const compositionLogement = aptType.includes('chambre')
      ? '1 chambre à coucher, 1 salle de bain et 1 espace cuisine'
      : (aptType.includes('studio') ? '1 salon/chambre, 1 cuisine, 1 salle de bain, 1 balcon' : 'salon, chambres, cuisine, salles de bain, balcon');

    const monthlyRent = Number(lease.monthly_rent) || 0;
    const depositAmount = Number(lease.deposit_amount) || (monthlyRent * 2);
    const durationMonths = lease.duration_months || 10;
    const startDate = fmtDate(lease.start_date);
    const endDate = fmtDate(lease.end_date);
    const today = fmtDate(new Date());

    const totalLoyer = monthlyRent * durationMonths;
    const fraisChateauEau = 12000;
    const totalGeneral = totalLoyer + depositAmount + fraisChateauEau;

    const bailleurName = owner?.full_name || 'AKOULOUZE Adèle née MANY';
    const bailleurCivilite = bailleurName.toLowerCase().includes('adèle') || bailleurName.toLowerCase().includes('mme') ? 'Madame' : 'Monsieur';
    const bailleurCni = '111573154';
    const bailleurCniDate = '23 / 6 / 2011';
    const bailleurCniLieu = 'Yaoundé';

    const representantNom = 'KAMGA Jean Pierre';
    const representantNomComplet = 'KAMGA SIMO Jean Pierre';
    const representantCni = '114493693 délivrée le 21/07/2013';
    const representantTelephone = '695 03 07 71/ 670561612';

    // Dictionnaire complet des balises (format officiel SMG IMMOBILIER)
    const tagsData = {
      // Contrat
      contrat_numero: String(lease.id).padStart(5, '0'),
      lease_id: String(lease.id),

      // Bailleur & Représentant
      bailleur_nom: bailleurName,
      bailleur_civilite: bailleurCivilite,
      bailleur_cni: bailleurCni,
      bailleur_cni_date: bailleurCniDate,
      bailleur_cni_lieu: bailleurCniLieu,
      representant_nom: representantNom,
      representant_nom_complet: representantNomComplet,
      representant_cni: representantCni,
      representant_telephone: representantTelephone,

      // Locataire avec Titre/Civilité automatique
      titre_locataire: titreLocataire,
      civilite: titreLocataire,
      civilite_locataire: titreLocataire,
      titre: titreLocataire,
      nom_locataire: tenantName,
      titre_et_nom: `${titreLocataire} ${tenantName}`,
      cni_numero: cniNum,
      date_lieu_cni: dateLieuCni,
      date_cni: cniDate || '....................',
      lieu_cni: cniPlace,
      telephone: phone,
      email: email,
      profession: profession,
      contact_urgence: emergencyContact,

      // Bien loué
      designation_logement: designationLogement,
      localisation_immeuble: `${city}-${district}, lieu-dit ${propAddress}`,
      composition_logement: compositionLogement,
      nom_immeuble_complet: propNameFull,
      adresse_complete: propAddress,
      immeuble: propName,
      logement: aptNum,
      type_logement: apt?.apartment_type || 'Chambre',
      ville: city,
      ville_signature: city,

      // Durée & Périodes
      duree_bail: `${durationMonths} mois`,
      duree_mois: durationMonths,
      duree_mois_texte: durationMonths === 10 ? 'dix (10)' : `${numberToFrenchWords(durationMonths).toLowerCase()} (${durationMonths})`,
      date_debut: startDate,
      date_fin: endDate,
      date_signature: today,
      date_du_jour: today,

      // Financier (Chiffres et Lettres complètes en Français)
      loyer_mensuel: fmtMoney(monthlyRent),
      loyer_lettres: numberToFrenchWords(monthlyRent),
      loyer: fmtMoney(monthlyRent),
      nb_mois_caution_texte: 'deux (02) mois',
      caution_montant: fmtMoney(depositAmount),
      caution_lettres: numberToFrenchWords(depositAmount),
      caution: fmtMoney(depositAmount),
      total_loyer_chiffres: fmtMoney(totalLoyer),
      total_loyer_lettres: numberToFrenchWords(totalLoyer),
      total_general_chiffres: fmtMoney(totalGeneral),
      total_general_lettres: numberToFrenchWords(totalGeneral),
    };

    try {
      doc.render(tagsData);
    } catch (err) {
      console.error('Erreur lors du rendu du contrat Word :', err);
      throw Object.assign(new Error(`Erreur lors du remplissage du modèle Word : ${err.message}`), { status: 500 });
    }

    const outputBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    const safeName = tenantName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeApt = String(aptNum).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Contrat_Bail_Officiel_${safeName}_${safeApt}.docx`;

    return {
      filename,
      buffer: outputBuffer,
      templateSource,
    };
  }

  getAvailableTags() {
    return [
      { tag: '{nom_locataire}', description: 'Nom complet du locataire' },
      { tag: '{telephone}', description: 'Numéro de téléphone du locataire' },
      { tag: '{cni_numero}', description: 'Numéro de CNI' },
      { tag: '{date_lieu_cni}', description: 'Mention délivrée le ... à ...' },
      { tag: '{designation_logement}', description: 'Désignation (ex: une chambre N° 02)' },
      { tag: '{localisation_immeuble}', description: 'Adresse et localisation de l\'immeuble' },
      { tag: '{composition_logement}', description: 'Pièces (1 chambre, 1 salle de bain, cuisine...)' },
      { tag: '{nom_immeuble_complet}', description: 'Nom officiel de l\'immeuble ou mini-cité' },
      { tag: '{duree_bail}', description: 'Durée en mois (ex: 10 mois)' },
      { tag: '{date_debut}', description: 'Date de début du bail' },
      { tag: '{date_fin}', description: 'Date de fin du bail' },
      { tag: '{loyer_lettres}', description: 'Montant du loyer en lettres (ex: TRENTE MILLE)' },
      { tag: '{loyer_mensuel}', description: 'Montant du loyer en chiffres (ex: 30 000)' },
      { tag: '{caution_lettres}', description: 'Montant caution en lettres (ex: SOIXANTE MILLE)' },
      { tag: '{caution_montant}', description: 'Montant caution en chiffres (ex: 60 000)' },
      { tag: '{total_general_lettres}', description: 'Total général réglé en lettres' },
      { tag: '{total_general_chiffres}', description: 'Total général réglé en chiffres (ex: 372 000)' },
      { tag: '{date_signature}', description: 'Date du jour pour la signature' },
    ];
  }
}

module.exports = new DocxContractService();
