// Outils de l'assistant. Chaque outil appelle l'API SMG avec le JWT de l'utilisateur
// (cf. smg-client) => le RBAC s'applique tout seul. Les outils d'ÉCRITURE exigent une
// confirmation (gérée par l'agent : ils ne s'exécutent qu'avec context.confirmer === true).
const smg = require('./smg-client');

// ------- Définitions exposées à Claude (tool use) -------
const TOOLS = [
  // ===== Lecture / analyse =====
  {
    name: 'detail_chiffre_affaires',
    description: "Détaille le chiffre d'affaires encaissé d'un mois : total, ventilation par locataire et par immeuble. Le rendement annuel n'est pas disponible.",
    input_schema: { type: 'object', properties: { mois: { type: 'string', description: 'Mois au format AAAA-MM (ex: 2026-01)' } }, required: ['mois'] },
  },
  {
    name: 'lister_loyers_impayes',
    description: 'Liste les loyers impayés (en attente ou échoués). Filtrable par mois.',
    input_schema: { type: 'object', properties: { mois: { type: 'string', description: 'Mois AAAA-MM (optionnel)' } } },
  },
  {
    name: 'lister_incidents',
    description: 'Liste les incidents / interventions de maintenance, avec leur coût si disponible. Filtrable par mois.',
    input_schema: { type: 'object', properties: { mois: { type: 'string', description: 'Mois AAAA-MM (optionnel)' } } },
  },
  {
    name: 'lister_biens_vacants',
    description: 'Liste les logements vacants (libres).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'synthese_periode',
    description: 'Agrégats financiers et activité sur une période (revenus, dépenses, salaires, solde, occupations) pour comparaison ou tendance.',
    input_schema: { type: 'object', properties: { debut: { type: 'string', description: 'Date début AAAA-MM-JJ' }, fin: { type: 'string', description: 'Date fin AAAA-MM-JJ' } }, required: ['debut', 'fin'] },
  },
  // ===== Documents =====
  {
    name: 'rediger_document',
    description: "Récupère les données réelles nécessaires pour rédiger un document (quittance, relance ou rapport). Renvoie les données ; c'est toi qui rédiges ensuite le texte en français.",
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['quittance', 'relance', 'rapport'] },
        locataire: { type: 'string', description: 'Nom du locataire (quittance/relance)' },
        mois: { type: 'string', description: 'Mois AAAA-MM (quittance/rapport)' },
      },
      required: ['type'],
    },
  },
  // ===== Écriture (confirmation obligatoire) =====
  {
    name: 'enregistrer_paiement',
    description: "Enregistre un paiement de loyer. ÉCRITURE : nécessite la confirmation de l'utilisateur avant exécution.",
    input_schema: {
      type: 'object',
      properties: {
        locataire: { type: 'string' },
        mois: { type: 'string', description: 'Mois AAAA-MM' },
        montant: { type: 'number', description: 'Montant en FCFA' },
        methode: { type: 'string', description: "Méthode (par défaut 'cash')", enum: ['cash', 'orange_money', 'mtn_mobile_money', 'bank_transfer', 'campay'] },
      },
      required: ['locataire', 'montant'],
    },
  },
  {
    name: 'declarer_incident',
    description: "Déclare un incident/maintenance sur un bien, avec un coût optionnel. ÉCRITURE : nécessite confirmation.",
    input_schema: {
      type: 'object',
      properties: {
        bien: { type: 'string', description: "Numéro/nom du logement (ex: 'A101' ou 'Akwa B2')" },
        probleme: { type: 'string' },
        cout_fcfa: { type: 'number', description: 'Coût estimé en FCFA (optionnel)' },
      },
      required: ['bien', 'probleme'],
    },
  },
  {
    name: 'changer_statut_bien',
    description: "Change le statut d'un logement (libre, occupé, maintenance, réservé). ÉCRITURE : nécessite confirmation.",
    input_schema: {
      type: 'object',
      properties: {
        bien: { type: 'string', description: 'Numéro/nom du logement' },
        statut: { type: 'string', description: 'libre | occupé | maintenance | réservé' },
      },
      required: ['bien', 'statut'],
    },
  },
  {
    name: 'envoyer_relance',
    description: "Envoie une relance de paiement à un locataire. ÉCRITURE : nécessite confirmation.",
    input_schema: { type: 'object', properties: { nom_locataire: { type: 'string' } }, required: ['nom_locataire'] },
  },
];

const WRITE_TOOLS = new Set(['enregistrer_paiement', 'declarer_incident', 'changer_statut_bien', 'envoyer_relance']);

// ------- Helpers -------
const norm = (s) => String(s || '').toLowerCase().replace(/\b(m|mr|mme|mlle|monsieur|madame)\.?\b/g, '').trim();
const inMonth = (dateStr, mois) => !mois || String(dateStr || '').slice(0, 7) === mois;
const num = (v) => Number(v) || 0;

const STATUT_MAP = {
  libre: 'free', vacant: 'free', disponible: 'free',
  occupe: 'occupied', occupé: 'occupied', loue: 'occupied', loué: 'occupied',
  maintenance: 'maintenance', travaux: 'maintenance',
  reserve: 'reserved', réservé: 'reserved', reserve_: 'reserved',
};

function matchByName(list, name, getName) {
  const q = norm(name);
  return (list || []).filter((it) => norm(getName(it)).includes(q));
}

// Résout un locataire par nom. Essaie /tenants ; repli via /payments (accessible aux rôles finance).
async function resolveTenant(name, token) {
  let list = [];
  try { list = await smg.get('/tenants', token); } catch (e) { if (e.status !== 403) throw e; }
  let matches = matchByName(list, name, (t) => t.full_name);
  if (!matches.length) {
    try {
      const pays = await smg.get('/payments', token);
      const map = {};
      (pays || []).forEach((p) => {
        if (p.tenant && p.tenant.user) {
          map[p.tenant.id] = { id: p.tenant.id, full_name: p.tenant.user.full_name, apartment: p.apartment, apartment_id: p.apartment && p.apartment.id };
        }
      });
      matches = matchByName(Object.values(map), name, (t) => t.full_name);
    } catch { /* ignore */ }
  }
  if (!matches.length) throw new Error(`Locataire « ${name} » introuvable.`);
  if (matches.length > 1) throw new Error(`Plusieurs locataires correspondent à « ${name} » : ${matches.map((m) => m.full_name).join(', ')}. Précisez le nom complet.`);
  return matches[0];
}

// Résout un logement par numéro/nom (GET /apartments est accessible à tout le personnel).
async function resolveApartment(bien, token) {
  const list = await smg.get('/apartments', token);
  const q = norm(bien);
  let matches = (list || []).filter((a) => norm(a.apartment_number) === q || norm(`${a.property ? a.property.property_name + ' ' : ''}${a.apartment_number}`).includes(q) || norm(a.apartment_number).includes(q));
  if (!matches.length) throw new Error(`Bien « ${bien} » introuvable.`);
  if (matches.length > 1) throw new Error(`Plusieurs biens correspondent à « ${bien} ». Précisez (ex: numéro exact).`);
  return matches[0];
}

// ------- Exécution -------
async function executeTool(name, input, ctx) {
  const t = ctx.token;
  switch (name) {
    // ===== Lecture / analyse =====
    case 'detail_chiffre_affaires': {
      const pays = await smg.get('/payments', t, { status: 'completed' });
      const f = (pays || []).filter((p) => inMonth(p.payment_date, input.mois));
      const total = f.reduce((s, p) => s + num(p.amount), 0);
      const parLoc = {}; const parImm = {};
      f.forEach((p) => {
        const nom = (p.tenant && p.tenant.user && p.tenant.user.full_name) || 'Inconnu';
        const bien = p.apartment ? p.apartment.apartment_number : '—';
        parLoc[nom] = parLoc[nom] || { nom, bien, montant: 0, statut: 'payé' };
        parLoc[nom].montant += num(p.amount);
        const imm = (p.apartment && p.apartment.property && p.apartment.property.property_name) || '—';
        parImm[imm] = parImm[imm] || { immeuble: imm, encaisse: 0 };
        parImm[imm].encaisse += num(p.amount);
      });
      return {
        mois: input.mois, total_fcfa: total,
        par_locataire: Object.values(parLoc), par_immeuble: Object.values(parImm),
        note: "Le rendement annuel par immeuble n'est pas disponible (valeur d'acquisition des biens non renseignée en base).",
      };
    }
    case 'lister_loyers_impayes': {
      const debts = await smg.get('/payments/debts', t);
      const f = (debts || []).filter((p) => inMonth(p.payment_date, input.mois));
      if (!f.length) return { message: 'Aucun loyer impayé.' };
      return f.map((p) => ({
        locataire: (p.tenant && p.tenant.user && p.tenant.user.full_name) || '—',
        bien: p.apartment ? p.apartment.apartment_number : '—',
        immeuble: (p.apartment && p.apartment.property && p.apartment.property.property_name) || '—',
        montant: num(p.amount),
      }));
    }
    case 'lister_incidents': {
      const maint = await smg.get('/maintenance', t);
      const f = (maint || []).filter((m) => inMonth(m.createdAt, input.mois));
      let coutParMaint = null;
      try {
        const exp = await smg.get('/expenses', t);
        coutParMaint = {};
        (exp || []).forEach((e) => { coutParMaint[e.maintenance_id] = (coutParMaint[e.maintenance_id] || 0) + num(e.total_price); });
      } catch { coutParMaint = null; /* rôle sans accès aux dépenses */ }
      return f.map((m) => ({
        date: m.createdAt, bien: m.apartment ? m.apartment.apartment_number : '—',
        immeuble: (m.apartment && m.apartment.property && m.apartment.property.property_name) || '—',
        probleme: m.title, statut: m.status,
        cout_fcfa: coutParMaint ? (coutParMaint[m.id] || 0) : 'non disponible (accès dépenses refusé)',
      }));
    }
    case 'lister_biens_vacants': {
      const apts = await smg.get('/apartments', t, { status: 'free' });
      if (!apts || !apts.length) return { message: 'Aucun logement vacant.' };
      return apts.map((a) => ({ numero: a.apartment_number, type: a.apartment_type, immeuble: a.property ? a.property.property_name : '—', loyer_fcfa: num(a.rent_amount) }));
    }
    case 'synthese_periode': {
      return smg.get('/dashboard/period', t, { start: input.debut, end: input.fin });
    }
    // ===== Documents (récupère les données réelles ; Claude rédige le texte) =====
    case 'rediger_document': {
      if (input.type === 'rapport') {
        const mois = input.mois || new Date().toISOString().slice(0, 7);
        const data = await executeTool('synthese_periode', { debut: `${mois}-01`, fin: `${mois}-31` }, ctx);
        return { type: 'rapport', periode: mois, donnees: data };
      }
      const tenant = await resolveTenant(input.locataire, t);
      let detail = null;
      try { detail = await smg.get('/tenants/' + tenant.id, t); } catch { /* comptable : pas d'accès fiche */ }
      const apt = (detail && detail.apartment) || tenant.apartment || null;
      if (input.type === 'quittance') {
        const pays = await smg.get('/payments', t, { status: 'completed' });
        const p = (pays || []).find((x) => x.tenant && x.tenant.id === tenant.id && inMonth(x.payment_date, input.mois));
        return {
          type: 'quittance', locataire: tenant.full_name, periode: input.mois,
          logement: apt ? apt.apartment_number : null, immeuble: apt && apt.property ? apt.property.property_name : null,
          montant_fcfa: p ? num(p.amount) : null, date_paiement: p ? p.payment_date : null,
          paiement_trouve: !!p,
        };
      }
      // relance
      const debts = await smg.get('/payments/debts', t).catch(() => []);
      const dus = (debts || []).filter((x) => x.tenant && x.tenant.id === tenant.id);
      return {
        type: 'relance', locataire: tenant.full_name,
        logement: apt ? apt.apartment_number : null, immeuble: apt && apt.property ? apt.property.property_name : null,
        montant_du_fcfa: dus.reduce((s, x) => s + num(x.amount), 0), nombre_impayes: dus.length,
      };
    }
    // ===== Écriture =====
    case 'enregistrer_paiement': {
      const tenant = await resolveTenant(input.locataire, t);
      const mois = input.mois || new Date().toISOString().slice(0, 7);
      const body = {
        tenant_id: tenant.id,
        apartment_id: tenant.apartment_id || (tenant.apartment && tenant.apartment.id) || undefined,
        amount: input.montant,
        payment_date: /^\d{4}-\d{2}$/.test(mois) ? `${mois}-01` : mois,
        payment_method: input.methode || 'cash',
        status: 'completed',
      };
      const p = await smg.post('/payments', t, body);
      return { ok: true, locataire: tenant.full_name, montant_fcfa: input.montant, methode: body.payment_method, periode: mois, paiement_id: p && p.id };
    }
    case 'declarer_incident': {
      const apt = await resolveApartment(input.bien, t);
      const m = await smg.post('/maintenance', t, { apartment_id: apt.id, title: input.probleme, description: input.probleme, priority: 'medium', status: 'reported' });
      let coutEnregistre = false;
      if (input.cout_fcfa) {
        try { await smg.post('/expenses', t, { maintenance_id: m.id, item_name: String(input.probleme).slice(0, 80), category: 'Intervention', quantity: 1, unit_price: input.cout_fcfa }); coutEnregistre = true; }
        catch { coutEnregistre = false; }
      }
      return { ok: true, bien: apt.apartment_number, incident: input.probleme, incident_id: m && m.id, cout_fcfa: input.cout_fcfa || 0, cout_enregistre: coutEnregistre };
    }
    case 'changer_statut_bien': {
      const statut = STATUT_MAP[norm(input.statut)] || input.statut;
      if (!['free', 'occupied', 'maintenance', 'reserved'].includes(statut)) throw new Error(`Statut « ${input.statut} » non reconnu (libre, occupé, maintenance, réservé).`);
      const apt = await resolveApartment(input.bien, t);
      await smg.put('/apartments/' + apt.id, t, { status: statut });
      return { ok: true, bien: apt.apartment_number, statut };
    }
    case 'envoyer_relance': {
      return smg.post('/relances', t, { nom_locataire: input.nom_locataire });
    }
    default:
      throw new Error(`Outil inconnu : ${name}`);
  }
}

// Résumé lisible d'une action d'écriture (affiché pour confirmation)
function resumeAction(name, input) {
  switch (name) {
    case 'enregistrer_paiement':
      return `Enregistrer un paiement de ${input.montant} FCFA (${input.methode || 'espèces'}) pour ${input.locataire}${input.mois ? ' au titre de ' + input.mois : ''}.`;
    case 'declarer_incident':
      return `Déclarer un incident « ${input.probleme} » sur le bien ${input.bien}${input.cout_fcfa ? ` (coût ${input.cout_fcfa} FCFA)` : ''}.`;
    case 'changer_statut_bien':
      return `Changer le statut du bien ${input.bien} en « ${input.statut} ».`;
    case 'envoyer_relance':
      return `Envoyer une relance de paiement à ${input.nom_locataire}.`;
    default:
      return 'Action à confirmer.';
  }
}

// Message de succès après exécution confirmée
function messageSucces(name, r) {
  switch (name) {
    case 'enregistrer_paiement':
      return `✅ Paiement de ${r.montant_fcfa} FCFA (${r.methode}) enregistré pour ${r.locataire}.`;
    case 'declarer_incident':
      return `✅ Incident déclaré sur ${r.bien}.${r.cout_fcfa ? (r.cout_enregistre ? ` Coût ${r.cout_fcfa} FCFA enregistré.` : ' (coût non enregistré : accès dépenses refusé)') : ''}`;
    case 'changer_statut_bien':
      return `✅ Le bien ${r.bien} est désormais « ${r.statut} ».`;
    case 'envoyer_relance':
      return `✅ Relance envoyée à ${r.locataire} (${r.canal}).`;
    default:
      return '✅ Action effectuée.';
  }
}

module.exports = { TOOLS, WRITE_TOOLS, executeTool, resumeAction, messageSucces };
