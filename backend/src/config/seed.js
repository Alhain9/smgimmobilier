// Insère des données de démo SANS recréer les tables (schéma géré par smg_immobilier.sql)
const { sequelize } = require('./database');
const {
  Role, User, Property, Apartment, Tenant, Lease, Payment,
  Maintenance, Equipment, Expense, Task,
} = require('../models');
require('dotenv').config();

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('🔄 Chargement des rôles existants...');
    const roles = {};
    (await Role.findAll()).forEach((r) => { roles[r.code()] = r.id; });
    if (!Object.keys(roles).length) throw new Error('Aucun rôle en base. Importez d\'abord smg_immobilier.sql');

    const ensureUser = async (data) => {
      const [u] = await User.findOrCreate({ where: { email: data.email }, defaults: data });
      return u;
    };

    console.log('🔄 Création des utilisateurs de démo...');
    const admin = await ensureUser({ full_name: 'Super Admin SMG', email: 'admin@smg.com', phone: '+237600000001', password: 'admin123', role_id: roles.super_admin });
    const manager = await ensureUser({ full_name: 'Marc Manager', email: 'manager@smg.com', phone: '+237600000002', password: 'manager123', role_id: roles.manager });
    const dirAdmin = await ensureUser({ full_name: 'Alice Administrative', email: 'admin.dir@smg.com', phone: '+237600000003', password: 'admin123', role_id: roles.dir_admin });
    await dirAdmin.update({ can_manage_users: true, can_view_all_calendars: true });
    await ensureUser({ full_name: 'Tom Technique', email: 'tech.dir@smg.com', phone: '+237600000004', password: 'tech123', role_id: roles.dir_technique });
    await ensureUser({ full_name: 'Gina Gestionnaire', email: 'gestion@smg.com', phone: '+237600000005', password: 'gestion123', role_id: roles.gestionnaire });
    await ensureUser({ full_name: 'Carl Comptable', email: 'compta@smg.com', phone: '+237600000006', password: 'compta123', role_id: roles.comptable });
    const tech = await ensureUser({ full_name: 'Théo Technicien', email: 'technicien@smg.com', phone: '+237600000007', password: 'tech123', role_id: roles.technicien });
    const tech2 = await ensureUser({ full_name: 'Paul Plombier', email: 'technicien2@smg.com', phone: '+237600000008', password: 'tech123', role_id: roles.technicien });
    const locUser = await ensureUser({ full_name: 'Jean Locataire', email: 'locataire@smg.com', phone: '+237699999999', password: 'loc123', role_id: roles.locataire });

    console.log('🔄 Immeubles & appartements...');
    const [prop1] = await Property.findOrCreate({ where: { property_name: 'Résidence Les Palmiers' }, defaults: { address: 'Rue 1.234, Bonapriso', district: 'Bonapriso', city: 'Douala' } });
    const [prop2] = await Property.findOrCreate({ where: { property_name: 'Immeuble Akwa Center' }, defaults: { address: 'Bd de la Liberté', district: 'Akwa', city: 'Douala' } });

    const [apt1] = await Apartment.findOrCreate({ where: { property_id: prop1.id, apartment_number: 'A101' }, defaults: { floor: 1, rent_amount: 150000, status: 'occupied' } });
    const [apt2] = await Apartment.findOrCreate({ where: { property_id: prop1.id, apartment_number: 'A102' }, defaults: { floor: 1, rent_amount: 220000, status: 'free' } });
    await Apartment.findOrCreate({ where: { property_id: prop2.id, apartment_number: 'B201' }, defaults: { floor: 2, rent_amount: 100000, status: 'free' } });

    console.log('🔄 Locataire...');
    const [tenant] = await Tenant.findOrCreate({ where: { user_id: locUser.id }, defaults: { apartment_id: apt1.id, national_id: '123456789', start_date: '2024-01-01', status: 'active' } });

    console.log('🔄 Bail...');
    await Lease.findOrCreate({ where: { tenant_id: tenant.id, apartment_id: apt1.id }, defaults: { start_date: '2024-01-01', monthly_rent: 150000, deposit_amount: 300000, status: 'active' } });

    console.log('🔄 Paiements...');
    await Payment.findOrCreate({ where: { tenant_id: tenant.id, payment_date: '2024-01-04' }, defaults: { apartment_id: apt1.id, amount: 150000, payment_method: 'orange_money', status: 'completed' } });
    await Payment.findOrCreate({ where: { tenant_id: tenant.id, payment_date: '2024-02-05' }, defaults: { apartment_id: apt1.id, amount: 150000, payment_method: 'orange_money', status: 'pending' } });

    console.log('🔄 Maintenance...');
    const [maint] = await Maintenance.findOrCreate({ where: { apartment_id: apt1.id, title: 'Fuite robinet cuisine' }, defaults: { tenant_id: tenant.id, assigned_technician_id: tech.id, description: 'Le robinet fuit', priority: 'high', status: 'in_progress' } });

    console.log('🔄 Dépense liée à la maintenance...');
    await Expense.findOrCreate({ where: { maintenance_id: maint.id, item_name: 'Joint robinet' }, defaults: { created_by: tech.id, category: 'Plomberie', supplier: 'Quincaillerie du Centre', quantity: 2, unit_price: 1500 } });
    await Expense.findOrCreate({ where: { maintenance_id: maint.id, item_name: 'Tuyau PVC Ø32' }, defaults: { created_by: tech.id, category: 'Plomberie', supplier: 'Quincaillerie du Centre', quantity: 3, unit_price: 3000 } });

    console.log('🔄 Équipe de techniciens du chantier...');
    await maint.setTeam([tech.id, tech2.id]);

    console.log('🔄 Équipements...');
    for (const e of [
      { equipment_name: 'Peinture blanche', quantity: 50, price: 2500 },
      { equipment_name: 'Ciment', quantity: 30, price: 6000 },
      { equipment_name: 'Rouleau peinture', quantity: 15, price: 1500 },
      { equipment_name: 'Tuyau PVC', quantity: 20, price: 3000 },
    ]) await Equipment.findOrCreate({ where: { equipment_name: e.equipment_name }, defaults: e });

    console.log('🔄 Tâche...');
    await Task.findOrCreate({ where: { title: 'Inspecter appartement A102' }, defaults: { maintenance_id: maint.id, assigned_to: tech.id, created_by: manager.id, status: 'pending', start_date: new Date() } });

    console.log('\n✅ SEED TERMINÉ !\n');
    console.log('admin@smg.com/admin123 · manager@smg.com/manager123 · compta@smg.com/compta123 · technicien@smg.com/tech123 · locataire@smg.com/loc123');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur seed:', err.message);
    process.exit(1);
  }
};
seed();
