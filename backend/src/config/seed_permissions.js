// ============ Seeder de permissions et d'associations aux rôles ============
const { sequelize } = require('./database');
const { Permission, Role, RolePermission } = require('../models');
require('dotenv').config();

const permissionsToSeed = [
  { code: 'manage_users', label: 'Gérer les utilisateurs', module: 'admin' },
  { code: 'manage_roles', label: 'Gérer les rôles', module: 'admin' },
  { code: 'view_dashboard', label: 'Voir le tableau de bord', module: 'general' },
  { code: 'manage_properties', label: 'Gérer les immeubles', module: 'patrimoine' },
  { code: 'manage_apartments', label: 'Gérer les logements', module: 'patrimoine' },
  { code: 'manage_tenants', label: 'Gérer les locataires', module: 'patrimoine' },
  { code: 'manage_leases', label: 'Gérer les contrats', module: 'patrimoine' },
  { code: 'manage_payments', label: 'Gérer les paiements', module: 'finance' },
  { code: 'validate_payments', label: 'Valider les paiements', module: 'finance' },
  { code: 'manage_expenses', label: 'Gérer les dépenses', module: 'finance' },
  { code: 'manage_salaries', label: 'Gérer les salaires', module: 'finance' },
  { code: 'manage_utilities', label: 'Gérer les charges', module: 'finance' },
  { code: 'manage_maintenance', label: 'Gérer les maintenances', module: 'technique' },
  { code: 'manage_equipment', label: 'Gérer les équipements', module: 'technique' },
  { code: 'manage_tasks', label: 'Gérer les tâches', module: 'technique' },
  { code: 'view_reports', label: 'Voir les rapports', module: 'reporting' },
  { code: 'export_data', label: 'Exporter les données', module: 'reporting' },
  { code: 'manage_calendar', label: 'Gérer le calendrier', module: 'general' },
  { code: 'manage_documents', label: 'Gérer les documents', module: 'general' },
  { code: 'send_notifications', label: 'Envoyer des notifications', module: 'general' },
  { code: 'manage_hr', label: 'Gérer les RH (plannings, congés)', module: 'rh' },
  { code: 'view_all_calendars', label: 'Voir tous les calendriers', module: 'general' },
  { code: 'manage_workflow', label: 'Gérer les workflows de validation', module: 'admin' }
];

const rolePermissionsMapping = {
  super_admin: ['*'], // toutes les permissions
  manager: [
    'view_dashboard', 'manage_users', 'manage_properties', 'manage_apartments',
    'manage_tenants', 'manage_leases', 'manage_payments', 'validate_payments',
    'manage_expenses', 'manage_salaries', 'manage_utilities', 'manage_maintenance',
    'manage_equipment', 'manage_tasks', 'view_reports', 'export_data',
    'manage_calendar', 'manage_documents', 'send_notifications', 'manage_hr',
    'view_all_calendars', 'manage_workflow'
  ],
  dir_admin: [
    'view_dashboard', 'manage_users', 'manage_properties', 'manage_apartments',
    'manage_tenants', 'manage_leases', 'manage_payments', 'manage_utilities',
    'view_reports', 'export_data', 'manage_calendar', 'manage_documents',
    'view_all_calendars'
  ],
  dir_technique: [
    'view_dashboard', 'manage_expenses', 'manage_maintenance', 'manage_equipment',
    'manage_tasks', 'view_reports', 'export_data', 'manage_calendar'
  ],
  gestionnaire: [
    'view_dashboard', 'manage_properties', 'manage_apartments', 'manage_tenants',
    'manage_leases', 'manage_payments', 'manage_utilities', 'manage_maintenance',
    'manage_tasks', 'manage_calendar', 'manage_documents'
  ],
  comptable: [
    'view_dashboard', 'manage_properties', 'manage_apartments', 'manage_tenants',
    'manage_leases', 'manage_payments', 'validate_payments', 'manage_expenses',
    'manage_salaries', 'manage_utilities', 'manage_equipment', 'view_reports',
    'export_data', 'manage_calendar', 'manage_documents'
  ],
  technicien: [
    'manage_maintenance', 'manage_tasks', 'manage_calendar'
  ],
  locataire: [
    'manage_tasks', 'manage_calendar' // seulement tâches et calendrier restreints à leur profil
  ]
};

const run = async () => {
  try {
    await sequelize.authenticate();
    console.log('🔄 Seeding des permissions...');

    // 1. Insérer toutes les permissions
    const createdPermissions = {};
    for (const perm of permissionsToSeed) {
      const [p] = await Permission.findOrCreate({
        where: { code: perm.code },
        defaults: perm
      });
      createdPermissions[perm.code] = p.id;
    }
    console.log('✅ Permissions insérées');

    // 2. Associer aux rôles
    const roles = await Role.findAll();
    for (const role of roles) {
      const code = role.code();
      const mappedPerms = rolePermissionsMapping[code];

      if (!mappedPerms) continue;

      console.log(`🔑 Association des permissions au rôle: ${role.role_name} (${code})...`);

      let permIds = [];
      if (mappedPerms.includes('*')) {
        // toutes les permissions pour super_admin
        permIds = Object.values(createdPermissions);
      } else {
        permIds = mappedPerms
          .map(code => createdPermissions[code])
          .filter(Boolean);
      }

      // Supprimer les anciennes associations pour ce rôle
      await RolePermission.destroy({ where: { role_id: role.id } });

      // Insérer les nouvelles
      const toInsert = permIds.map(permId => ({
        role_id: role.id,
        permission_id: permId
      }));

      await RolePermission.bulkCreate(toInsert);
    }

    console.log('✅ Permissions et rôles associés avec succès !');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur lors du seeding des permissions:', err);
    process.exit(1);
  }
};

run();
