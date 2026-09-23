-- ============================================================
-- MIGRATION 015 — Module Stock, Consommables & Fournisseurs
-- SMG IMMOBILIER — Gestion d'entrepôt et traçabilité des achats
-- ============================================================

-- 1. Fournisseurs
CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(150) NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(150) NULL,
  address VARCHAR(255) NULL,
  city VARCHAR(100) DEFAULT 'Douala',
  category VARCHAR(100) NULL COMMENT 'Plomberie, Électricité, Quincaillerie, Peinture, etc.',
  notes TEXT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_suppliers_name (name),
  INDEX idx_suppliers_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Articles et consommables en stock
CREATE TABLE IF NOT EXISTS stock_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Général',
  unit VARCHAR(30) NOT NULL DEFAULT 'pièce' COMMENT 'pièce, mètre, kg, litre, rouleau, carton, etc.',
  quantity DECIMAL(12, 2) NOT NULL DEFAULT 0,
  min_alert_threshold DECIMAL(12, 2) NOT NULL DEFAULT 5,
  unit_price_avg DECIMAL(12, 2) NOT NULL DEFAULT 0 COMMENT 'Prix Unitaire Moyen Pondéré (PUMP)',
  last_purchase_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  location VARCHAR(100) NULL COMMENT 'Rayon, étagère, bac dans l entrepôt',
  photo VARCHAR(255) NULL,
  description TEXT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_stock_items_code (item_code),
  INDEX idx_stock_items_category (category),
  INDEX idx_stock_items_qty (quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Achats et réceptions de stock
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
  INDEX idx_purchases_number (purchase_number),
  INDEX idx_purchases_supplier (supplier_id),
  INDEX idx_purchases_date (purchase_date),
  CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  CONSTRAINT fk_purchases_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Lignes d'achats de stock
CREATE TABLE IF NOT EXISTS stock_purchase_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_id BIGINT UNSIGNED NOT NULL,
  stock_item_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(12, 2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_price DECIMAL(14, 2) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_purchase_items_purchase (purchase_id),
  INDEX idx_purchase_items_stock_item (stock_item_id),
  CONSTRAINT fk_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES stock_purchases(id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_items_stock_item FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Mouvements de stock (Journal immuable)
CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  stock_item_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM(
    'in_purchase',
    'out_maintenance',
    'out_worksite',
    'return_maintenance',
    'return_worksite',
    'adjustment_in',
    'adjustment_out'
  ) NOT NULL,
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
  INDEX idx_movements_item (stock_item_id),
  INDEX idx_movements_type (movement_type),
  INDEX idx_movements_ref (reference_type, reference_id),
  INDEX idx_movements_date (created_at),
  CONSTRAINT fk_movements_item FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_movements_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
