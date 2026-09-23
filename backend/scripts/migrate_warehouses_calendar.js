const { sequelize } = require('../src/config/database');
const { Warehouse } = require('../src/models');

async function migrate() {
  try {
    // 1. Add columns to warehouses
    try {
      await sequelize.query("ALTER TABLE warehouses ADD COLUMN warehouse_type VARCHAR(50) NOT NULL DEFAULT 'mixed'");
      console.log('Added warehouse_type column to warehouses');
    } catch (e) {
      console.log('warehouse_type exists or notice:', e.message);
    }

    try {
      await sequelize.query("ALTER TABLE warehouses ADD COLUMN description TEXT NULL");
      console.log('Added description column to warehouses');
    } catch (e) {
      console.log('description column exists or notice:', e.message);
    }

    // 2. Add description to calendar_events
    try {
      await sequelize.query("ALTER TABLE calendar_events ADD COLUMN description TEXT NULL");
      console.log('Added description column to calendar_events');
    } catch (e) {
      console.log('calendar_events description exists or notice:', e.message);
    }

    // 3. Update / Seed 6 warehouses (3 Douala, 3 Yaounde)
    const existing = await Warehouse.findAll();
    console.log('Current warehouses count:', existing.length);

    // Yaounde 1
    const y1 = existing.find((w) => w.name.includes('Bastos'));
    if (y1) {
      await y1.update({
        name: 'Magasin Central Bastos',
        city: 'Yaoundé',
        warehouse_type: 'mixed',
        description: 'Magasin central de distribution, stocks stratégiques et matériel d intervention.',
      });
    }

    // Yaounde 2
    const y2 = existing.find((w) => w.name.includes('Nsam'));
    if (y2) {
      await y2.update({
        name: 'Dépôt Matériaux Nsam',
        city: 'Yaoundé',
        warehouse_type: 'stocks',
        description: 'Dépôt de gros consommables de construction, ciment, carrelage, peinture et enduits.',
      });
    }

    // Yaounde 3: create if not exists
    const y3 = existing.find((w) => w.name.includes('Omnisports') || (w.city === 'Yaoundé' && w.id > 4));
    if (!y3) {
      await Warehouse.create({
        name: 'Dépôt Matériels & Équipements Omnisports',
        city: 'Yaoundé',
        address: 'Omnisports, face Stade annexe',
        phone: '+237 6 77 12 34 56',
        warehouse_type: 'equipment',
        description: 'Entreposement des équipements de chantiers, échelles, bétonnières, groupes électrogènes et outillage technique.',
        is_active: true,
      });
      console.log('Created 3rd warehouse for Yaounde');
    }

    // Douala 1
    const d1 = existing.find((w) => w.name.includes('Akwa'));
    if (d1) {
      await d1.update({
        name: 'Magasin Matériaux & Stocks Akwa',
        city: 'Douala',
        warehouse_type: 'stocks',
        description: 'Stockage des matériaux de plomberie, électricité, quincaillerie et consommables de finition.',
      });
    }

    // Douala 2
    const d2 = existing.find((w) => w.name.includes('Logbaba'));
    if (d2) {
      await d2.update({
        name: 'Dépôt Logbaba Zone Industrielle',
        city: 'Douala',
        warehouse_type: 'equipment',
        description: 'Parc matériel lourd, échafaudages, marteaux-piqueurs, outillages chantiers et équipements gros œuvre.',
      });
    }

    // Douala 3: create if not exists
    const d3 = existing.find((w) => w.name.includes('Bonanjo') || (w.city === 'Douala' && w.id > 4));
    if (!d3) {
      await Warehouse.create({
        name: 'Magasin Bonanjo Centre',
        city: 'Douala',
        address: 'Bonanjo, Rue Joss',
        phone: '+237 6 99 88 77 66',
        warehouse_type: 'mixed',
        description: 'Point de stockage mixte pour outillages d intervention rapide, quincaillerie et stocks secondaires.',
        is_active: true,
      });
      console.log('Created 3rd warehouse for Douala');
    }

    const allWh = await Warehouse.findAll();
    console.log('Total warehouses now:', allWh.length);
    allWh.forEach((w) => console.log(`- [${w.city}] ${w.name} (${w.warehouse_type}) - ${w.description}`));
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    process.exit(0);
  }
}

migrate();
