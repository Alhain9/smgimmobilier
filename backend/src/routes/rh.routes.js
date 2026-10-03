// ============ Routes RH ============
const router = require('express').Router();
const ctrl = require('../controllers/rh.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/rbac.middleware');
const { validate, schemas } = require('../validators');

// Tous les endpoints RH nécessitent une authentification
router.use(authenticate);

// --- SERVICES ---
router.get('/services', ctrl.listServices);
router.get('/services/:id', ctrl.getService);
router.post('/services', authorize('super_admin', 'manager', 'dir_admin'), validate(schemas.createService), ctrl.createService);
router.put('/services/:id', authorize('super_admin', 'manager', 'dir_admin'), validate(schemas.updateService), ctrl.updateService);
router.delete('/services/:id', authorize('super_admin', 'manager', 'dir_admin'), ctrl.deleteService);

// --- EQUIPES ---
router.get('/equipes', ctrl.listEquipes);
router.get('/equipes/:id', ctrl.getEquipe);
router.post('/equipes', authorize('super_admin', 'manager', 'dir_admin'), validate(schemas.createEquipe), ctrl.createEquipe);
router.put('/equipes/:id', authorize('super_admin', 'manager', 'dir_admin'), validate(schemas.updateEquipe), ctrl.updateEquipe);
router.delete('/equipes/:id', authorize('super_admin', 'manager', 'dir_admin'), ctrl.deleteEquipe);

// --- PLANNINGS ---
router.get('/plannings', ctrl.listPlannings);
router.post('/plannings/bulk-delete', authorize('super_admin', 'manager', 'dir_admin'), ctrl.bulkDeletePlannings);
router.post('/plannings', authorize('super_admin', 'manager', 'dir_admin'), validate(schemas.createPlanning), ctrl.createPlanning);
router.put('/plannings/:id', authorize('super_admin', 'manager', 'dir_admin'), validate(schemas.updatePlanning), ctrl.updatePlanning);
router.delete('/plannings/:id', authorize('super_admin', 'manager', 'dir_admin'), ctrl.deletePlanning);

// --- POINTAGES ---
router.get('/pointages', ctrl.listPointages);
router.post('/pointages/entree', ctrl.pointageEntree);
router.post('/pointages/sortie', ctrl.pointageSortie);

// --- CONGES ---
router.get('/conges', ctrl.listConges);
router.post('/conges/bulk-delete', authorize('super_admin', 'manager', 'comptable', 'dir_admin'), ctrl.bulkDeleteConges);
router.post('/conges', validate(schemas.createConge), ctrl.createConge);
router.put('/conges/:id', authorize('super_admin', 'manager', 'comptable'), validate(schemas.updateConge), ctrl.updateConge);
router.delete('/conges/:id', ctrl.deleteConge);

// --- GROUPES WHATSAPP DYNAMIQUES ---
const fs = require('fs');
const path = require('path');
const groupsFilePath = path.join(__dirname, '../uploads/whatsapp_groups.json');

const getGroups = () => {
  const defaultGroups = [
    {
      id: 'general',
      name: 'SMG — Direction Générale',
      description: 'Groupe officiel d\'information générale et annonces de la direction.',
      link: 'https://chat.whatsapp.com/invite/dummy_direction_generale',
    },
    {
      id: 'tech',
      name: 'SMG — Équipe Technique & Maintenance',
      description: 'Coordination des chantiers et interventions techniques urgentes.',
      link: 'https://chat.whatsapp.com/invite/dummy_technique_interventions',
    },
    {
      id: 'finance',
      name: 'SMG — Comptabilité & Règlements',
      description: 'Validation financière, paie, loyers et gestion documentaire.',
      link: 'https://chat.whatsapp.com/invite/dummy_comptabilite_reglements',
    },
    {
      id: 'gestion',
      name: 'SMG — Gestion Locative & Relances',
      description: 'Suivi de la situation des locataires et gestion des baux.',
      link: 'https://chat.whatsapp.com/invite/dummy_gestion_locative',
    }
  ];

  try {
    if (!fs.existsSync(groupsFilePath)) {
      return defaultGroups;
    }
    const data = fs.readFileSync(groupsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return defaultGroups;
  }
};

const saveGroups = (groups) => {
  try {
    fs.writeFileSync(groupsFilePath, JSON.stringify(groups, null, 2), 'utf8');
    return true;
  } catch (err) {
    return false;
  }
};

router.get('/whatsapp-groups', async (req, res) => {
  let groups = getGroups();

  if (req.user && req.user.role === 'locataire') {
    try {
      const { Tenant, Apartment, Lease } = require('../models');
      const tenant = await Tenant.findOne({
        where: { user_id: req.user.id },
        include: [
          { model: Apartment, as: 'apartment', attributes: ['id', 'property_id'] },
          { model: Lease, as: 'leases', include: [{ model: Apartment, as: 'apartment', attributes: ['id', 'property_id'] }] }
        ]
      });

      const tenantPropId = tenant ? (tenant.apartment?.property_id || (tenant.leases && tenant.leases[0]?.apartment?.property_id)) : null;

      if (tenantPropId) {
        const specificGroups = groups.filter(g => String(g.property_id) === String(tenantPropId));
        if (specificGroups.length > 0) {
          groups = specificGroups;
        } else {
          groups = groups.filter(g => !g.property_id || String(g.property_id) === String(tenantPropId));
        }
      }
    } catch (_) {}
  }

  res.json({ success: true, data: groups });
});

router.post('/whatsapp-groups', authorize('super_admin', 'manager', 'dir_admin'), async (req, res) => {
  const { name, description, link, property_id } = req.body;
  if (!name || !link) {
    return res.status(400).json({ success: false, message: 'Le nom et le lien sont requis.' });
  }

  let property_name = null;
  if (property_id) {
    try {
      const { Property } = require('../models');
      const prop = await Property.findByPk(property_id);
      if (prop) property_name = prop.property_name;
    } catch (_) {}
  }

  const groups = getGroups();
  const newGroup = {
    id: 'grp_' + Date.now(),
    name,
    description: description || '',
    link,
    property_id: property_id || null,
    property_name
  };
  groups.push(newGroup);
  saveGroups(groups);
  res.json({ success: true, data: newGroup });
});

router.delete('/whatsapp-groups/:id', authorize('super_admin', 'manager', 'dir_admin'), (req, res) => {
  const { id } = req.params;
  let groups = getGroups();
  groups = groups.filter(g => g.id !== id);
  saveGroups(groups);
  res.json({ success: true, message: 'Groupe supprimé.' });
});

module.exports = router;
