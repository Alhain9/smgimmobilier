const { sequelize } = require('../config/database');

async function migrate() {
  try {
    console.log('--- Starting Multi-Warehouse & Equipment Loans Migration ---');
    
    // 1. Table warehouses
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS warehouses (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        city VARCHAR(100) NOT NULL,
        address VARCHAR(255) NULL,
        manager_id BIGINT UNSIGNED NULL,
        phone VARCHAR(50) NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_warehouse_city (city),
        INDEX idx_warehouse_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Table warehouses created or already exists.');

    // 2. Colonnes sur stock_items
    const [cols] = await sequelize.query('SHOW COLUMNS FROM stock_items');
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('warehouse_id')) {
      await sequelize.query('ALTER TABLE stock_items ADD COLUMN warehouse_id BIGINT UNSIGNED NULL AFTER id');
      console.log('✅ Column warehouse_id added to stock_items.');
    }
    if (!colNames.includes('item_type')) {
      await sequelize.query("ALTER TABLE stock_items ADD COLUMN item_type ENUM('consumable', 'tool_equipment') NOT NULL DEFAULT 'consumable' AFTER category");
      console.log('✅ Column item_type added to stock_items.');
    }
    if (!colNames.includes('quantity_loaned')) {
      await sequelize.query('ALTER TABLE stock_items ADD COLUMN quantity_loaned DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER quantity');
      console.log('✅ Column quantity_loaned added to stock_items.');
    }

    // 3. Table worksite_equipment_loans
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS worksite_equipment_loans (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        worksite_id BIGINT UNSIGNED NOT NULL,
        stock_item_id BIGINT UNSIGNED NOT NULL,
        warehouse_id BIGINT UNSIGNED NOT NULL,
        quantity DECIMAL(12, 2) NOT NULL DEFAULT 1,
        assigned_date DATE NOT NULL,
        returned_date DATE NULL,
        returned_quantity DECIMAL(12, 2) NOT NULL DEFAULT 0,
        return_warehouse_id BIGINT UNSIGNED NULL,
        status ENUM('loaned', 'partially_returned', 'returned', 'damaged_lost') NOT NULL DEFAULT 'loaned',
        condition_notes TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_wel_worksite (worksite_id),
        INDEX idx_wel_item (stock_item_id),
        INDEX idx_wel_warehouse (warehouse_id),
        INDEX idx_wel_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Table worksite_equipment_loans created or already exists.');

    // 4. Initialiser quelques magasins par défaut si la table est vide
    const [existing] = await sequelize.query('SELECT COUNT(*) as cnt FROM warehouses');
    if (existing[0].cnt == 0) {
      await sequelize.query(`
        INSERT INTO warehouses (name, city, address, phone, is_active) VALUES
        ('Magasin Central Bastos (Magasin A)', 'Yaoundé', 'Bastos, face ambassade', '+237 6 699 03 07 71', 1),
        ('Dépôt Matériaux Nsam (Magasin B)', 'Yaoundé', 'Nsam, descente Brasseries', '+237 6 70 56 16 12', 1),
        ('Magasin Littoral Akwa (Magasin C)', 'Douala', 'Akwa, Boulevard de la Liberté', '+237 6 92 95 88 64', 1),
        ('Dépôt Logbaba Zone Industrielle (Magasin D)', 'Douala', 'Zone industrielle Logbaba', '+237 6 99 00 11 22', 1);
      `);
      console.log('✅ 4 Magasins initiaux créés (Yaoundé & Douala).');

      // Rattacher les stock_items existants au Magasin Central Bastos (id: 1)
      await sequelize.query('UPDATE stock_items SET warehouse_id = 1 WHERE warehouse_id IS NULL');
      console.log('✅ Stock items existants rattachés au Magasin Central Bastos.');
    }

    console.log('--- Migration completed successfully ---');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
