const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'smg_immobilier',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000, evict: 1000 },
    define: { timestamps: true, underscored: true }
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(`✅ Base de données (MySQL) connectée avec succès`);
    try {
      await sequelize.query("ALTER TABLE equipment ADD COLUMN photo VARCHAR(255) NULL;");
    } catch (_) { /* déjà présent */ }
    try {
      await sequelize.query("INSERT IGNORE INTO roles (role_name, created_at, updated_at) VALUES ('Bailleur', NOW(), NOW());");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE properties ADD COLUMN owner_id BIGINT UNSIGNED NULL AFTER id;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE expenses MODIFY COLUMN maintenance_id BIGINT UNSIGNED NULL;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE expenses ADD COLUMN property_id BIGINT UNSIGNED NULL AFTER maintenance_id;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE properties ADD COLUMN caretaker_name VARCHAR(150) NULL AFTER district;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE properties ADD COLUMN caretaker_phone VARCHAR(50) NULL AFTER caretaker_name;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE properties ADD COLUMN caretaker_salary DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER caretaker_phone;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE expenses MODIFY COLUMN expense_type ENUM('maintenance','utility','administrative','renovation','gardiennage','other') DEFAULT 'maintenance';");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE expenses ADD COLUMN caretaker_name VARCHAR(150) NULL AFTER item_name;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE expenses ADD COLUMN period_month VARCHAR(50) NULL AFTER caretaker_name;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE expenses ADD COLUMN payment_date DATE NULL AFTER period_month;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE expenses ADD COLUMN payment_method VARCHAR(50) DEFAULT 'Espèces' AFTER payment_date;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE expenses ADD COLUMN is_landlord_expense TINYINT(1) NOT NULL DEFAULT 0;");
    } catch (_) {}
        try {
      await sequelize.query("ALTER TABLE utility_bills ADD COLUMN impayer DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER transport_fee;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE utility_bills ADD COLUMN due_date DATE NULL AFTER paid_date;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE utility_bills ADD COLUMN payment_method VARCHAR(50) DEFAULT 'Espèces' AFTER due_date;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE utility_bills ADD COLUMN receipt_number VARCHAR(50) DEFAULT NULL AFTER payment_method;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE properties ADD COLUMN lease_template_file VARCHAR(255) NULL;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE leases ADD COLUMN duration_months INT NULL;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE leases ADD COLUMN renewal_count INT DEFAULT 0;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE leases ADD COLUMN previous_lease_id INT NULL;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE tenants ADD COLUMN cni_delivery_date DATE NULL AFTER national_id;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE tenants ADD COLUMN cni_delivery_place VARCHAR(100) NULL AFTER cni_delivery_date;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE users ADD COLUMN can_manage_worksites TINYINT(1) NOT NULL DEFAULT 0;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE users ADD COLUMN can_delete_worksites TINYINT(1) NOT NULL DEFAULT 0;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE users ADD COLUMN can_manage_stock TINYINT(1) NOT NULL DEFAULT 0;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE users ADD COLUMN can_delete_stock TINYINT(1) NOT NULL DEFAULT 0;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE users ADD COLUMN can_manage_documents TINYINT(1) NOT NULL DEFAULT 0;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE users ADD COLUMN can_manage_expenses TINYINT(1) NOT NULL DEFAULT 0;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE tasks ADD COLUMN priority VARCHAR(50) DEFAULT 'Normal';");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE tasks ADD COLUMN property_id BIGINT UNSIGNED NULL AFTER maintenance_id;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE tasks ADD COLUMN apartment_id BIGINT UNSIGNED NULL AFTER property_id;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE tasks ADD COLUMN location_zone VARCHAR(150) NULL AFTER apartment_id;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE tasks ADD COLUMN nature_probleme VARCHAR(255) NULL AFTER title;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE tasks ADD COLUMN observation TEXT NULL AFTER completion_note;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE tasks ADD COLUMN period_start DATE NULL AFTER end_date;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE tasks ADD COLUMN period_end DATE NULL AFTER period_start;");
    } catch (_) {}
    try {
      await sequelize.query("ALTER TABLE receipts MODIFY COLUMN receipt_type ENUM('rent', 'deposit', 'advance', 'other_income', 'expense_report', 'utility') NOT NULL DEFAULT 'rent';");
    } catch (_) {}
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS receipts (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          receipt_number VARCHAR(50) NOT NULL UNIQUE,
          receipt_type ENUM('rent', 'deposit', 'advance', 'other_income', 'expense_report', 'utility') NOT NULL DEFAULT 'rent',
          payment_id BIGINT UNSIGNED NULL,
          tenant_id BIGINT UNSIGNED NULL,
          apartment_id BIGINT UNSIGNED NULL,
          property_id BIGINT UNSIGNED NULL,
          amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
          payment_method VARCHAR(50),
          payment_date DATE,
          period_start DATE NULL,
          period_end DATE NULL,
          remaining_balance DECIMAL(12, 2) DEFAULT 0,
          observations TEXT,
          generated_by BIGINT UNSIGNED NULL,
          pdf_path VARCHAR(255),
          status ENUM('draft', 'issued', 'cancelled') DEFAULT 'issued',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_receipts_number (receipt_number),
          INDEX idx_receipts_type (receipt_type),
          INDEX idx_receipts_payment (payment_id),
          INDEX idx_receipts_tenant (tenant_id),
          INDEX idx_receipts_property (property_id),
          INDEX idx_receipts_date (payment_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (_) {}
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(150) NOT NULL,
          contact_person VARCHAR(150) NULL,
          phone VARCHAR(50) NULL,
          email VARCHAR(150) NULL,
          address VARCHAR(255) NULL,
          city VARCHAR(100) DEFAULT 'Yaoundé',
          category VARCHAR(100) NULL,
          notes TEXT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_suppliers_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (_) {}
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS stock_items (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          item_code VARCHAR(50) NOT NULL UNIQUE,
          name VARCHAR(150) NOT NULL,
          category VARCHAR(100) NOT NULL DEFAULT 'Général',
          unit VARCHAR(30) NOT NULL DEFAULT 'pièce',
          quantity DECIMAL(12, 2) NOT NULL DEFAULT 0,
          min_alert_threshold DECIMAL(12, 2) NOT NULL DEFAULT 5,
          unit_price_avg DECIMAL(12, 2) NOT NULL DEFAULT 0,
          last_purchase_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
          location VARCHAR(100) NULL,
          photo VARCHAR(255) NULL,
          description TEXT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_stock_items_code (item_code),
          INDEX idx_stock_items_cat (category)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (_) {}
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS stock_purchases (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          purchase_number VARCHAR(50) NOT NULL UNIQUE,
          supplier_id BIGINT UNSIGNED NULL,
          purchase_date DATE NOT NULL,
          total_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
          invoice_number VARCHAR(100) NULL,
          invoice_file VARCHAR(255) NULL,
          status ENUM('ordered', 'received', 'cancelled') DEFAULT 'received',
          notes TEXT NULL,
          created_by BIGINT UNSIGNED NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_purchases_number (purchase_number)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (_) {}
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS stock_purchase_items (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          purchase_id BIGINT UNSIGNED NOT NULL,
          stock_item_id BIGINT UNSIGNED NOT NULL,
          quantity DECIMAL(12, 2) NOT NULL DEFAULT 1,
          unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
          total_price DECIMAL(14, 2) NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_purchase_items_p (purchase_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (_) {}
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS stock_movements (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          stock_item_id BIGINT UNSIGNED NOT NULL,
          movement_type ENUM('in_purchase', 'out_maintenance', 'out_worksite', 'return_maintenance', 'return_worksite', 'adjustment_in', 'adjustment_out') NOT NULL,
          quantity DECIMAL(12, 2) NOT NULL,
          stock_before DECIMAL(12, 2) NOT NULL,
          stock_after DECIMAL(12, 2) NOT NULL,
          unit_cost DECIMAL(12, 2) DEFAULT 0,
          total_cost DECIMAL(14, 2) DEFAULT 0,
          reference_type ENUM('purchase', 'maintenance', 'worksite', 'inventory', 'other') DEFAULT 'other',
          reference_id BIGINT UNSIGNED NULL,
          notes TEXT NULL,
          created_by BIGINT UNSIGNED NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_movements_item (stock_item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (_) {}
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS worksites (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(150) NOT NULL,
          worksite_type ENUM('interne', 'externe') DEFAULT 'interne',
          property_id BIGINT UNSIGNED NULL,
          contractor VARCHAR(150) NULL,
          client_name VARCHAR(150) NULL,
          client_phone VARCHAR(50) NULL,
          client_email VARCHAR(150) NULL,
          location VARCHAR(255) NULL,
          budget DECIMAL(12, 2) DEFAULT 0,
          material_cost DECIMAL(12, 2) DEFAULT 0,
          labor_cost DECIMAL(12, 2) DEFAULT 0,
          other_cost DECIMAL(12, 2) DEFAULT 0,
          contract_amount DECIMAL(14, 2) DEFAULT 0,
          spent_amount DECIMAL(12, 2) DEFAULT 0,
          start_date DATE NULL,
          end_date_estimated DATE NULL,
          end_date_actual DATE NULL,
          progress_percent INT DEFAULT 0,
          status ENUM('planned', 'in_progress', 'on_hold', 'completed', 'cancelled') DEFAULT 'planned',
          manager_id BIGINT UNSIGNED NULL,
          photo VARCHAR(255) NULL,
          description TEXT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at DATETIME NULL,
          INDEX idx_worksites_prop (property_id),
          INDEX idx_worksites_type (worksite_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (_) {}
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS worksite_tasks (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          worksite_id BIGINT UNSIGNED NOT NULL,
          title VARCHAR(150) NOT NULL,
          description TEXT NULL,
          start_date DATE NULL,
          end_date DATE NULL,
          status ENUM('pending', 'in_progress', 'completed', 'blocked') DEFAULT 'pending',
          progress_percent INT DEFAULT 0,
          assigned_to BIGINT UNSIGNED NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_wtasks_worksite (worksite_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (_) {}
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS worksite_materials (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          worksite_id BIGINT UNSIGNED NOT NULL,
          stock_item_id BIGINT UNSIGNED NOT NULL,
          quantity_used DECIMAL(12, 2) NOT NULL DEFAULT 1,
          unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
          total_cost DECIMAL(14, 2) NOT NULL DEFAULT 0,
          declared_by BIGINT UNSIGNED NULL,
          date_used DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_wmaterials_worksite (worksite_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (_) {}
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS worksite_photos (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          worksite_id BIGINT UNSIGNED NOT NULL,
          photo_url VARCHAR(255) NOT NULL,
          phase ENUM('before', 'during', 'after') DEFAULT 'during',
          caption VARCHAR(255) NULL,
          uploaded_by BIGINT UNSIGNED NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_wphotos_worksite (worksite_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (_) {}
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS maintenance_materials (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          maintenance_id BIGINT UNSIGNED NOT NULL,
          stock_item_id BIGINT UNSIGNED NOT NULL,
          quantity_used DECIMAL(12, 2) NOT NULL DEFAULT 1,
          unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
          total_cost DECIMAL(14, 2) NOT NULL DEFAULT 0,
          declared_by BIGINT UNSIGNED NULL,
          date_used DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_maint_mat_maint (maintenance_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (_) {}
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS equipment_allocations (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          equipment_id BIGINT UNSIGNED NOT NULL,
          assigned_to_user_id BIGINT UNSIGNED NULL,
          worksite_id BIGINT UNSIGNED NULL,
          maintenance_id BIGINT UNSIGNED NULL,
          assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expected_return_at DATETIME NULL,
          returned_at DATETIME NULL,
          condition_on_assignment VARCHAR(255) NULL,
          condition_on_return VARCHAR(255) NULL,
          status ENUM('active', 'returned', 'damaged') DEFAULT 'active',
          INDEX idx_equip_alloc (equipment_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (_) {}
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS role_delegations (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          user_id BIGINT UNSIGNED NOT NULL,
          delegated_role VARCHAR(50) NOT NULL,
          granted_by BIGINT UNSIGNED NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          reason TEXT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_delegations_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (_) {}
  } catch (error) {
    console.error(`❌ Erreur connexion base de données (MySQL):`, error.message);
  }
};

module.exports = { sequelize, connectDB };

