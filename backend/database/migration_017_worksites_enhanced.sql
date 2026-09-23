-- ============================================================
-- MIGRATION 017 — Module Chantiers Internes & Externes
-- SMG IMMOBILIER — Projets, budgets, matériaux, jalons et rapports
-- ============================================================

-- 1. Étendre la table worksites
ALTER TABLE worksites ADD COLUMN worksite_type ENUM('interne', 'externe') DEFAULT 'interne' AFTER title;
ALTER TABLE worksites ADD COLUMN client_name VARCHAR(150) NULL AFTER contractor;
ALTER TABLE worksites ADD COLUMN client_phone VARCHAR(50) NULL AFTER client_name;
ALTER TABLE worksites ADD COLUMN client_email VARCHAR(150) NULL AFTER client_phone;
ALTER TABLE worksites ADD COLUMN material_cost DECIMAL(12, 2) DEFAULT 0 AFTER budget;
ALTER TABLE worksites ADD COLUMN labor_cost DECIMAL(12, 2) DEFAULT 0 AFTER material_cost;
ALTER TABLE worksites ADD COLUMN other_cost DECIMAL(12, 2) DEFAULT 0 AFTER labor_cost;
ALTER TABLE worksites ADD COLUMN contract_amount DECIMAL(14, 2) DEFAULT 0 AFTER other_cost;

-- 2. Tâches et jalons de chantier
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
  INDEX idx_wtasks_worksite (worksite_id),
  INDEX idx_wtasks_assignee (assigned_to),
  CONSTRAINT fk_wtasks_worksite FOREIGN KEY (worksite_id) REFERENCES worksites(id) ON DELETE CASCADE,
  CONSTRAINT fk_wtasks_assignee FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Matériaux et consommables utilisés sur chantier
CREATE TABLE IF NOT EXISTS worksite_materials (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  worksite_id BIGINT UNSIGNED NOT NULL,
  stock_item_id BIGINT UNSIGNED NOT NULL,
  quantity_used DECIMAL(12, 2) NOT NULL DEFAULT 1,
  unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(14, 2) NOT NULL DEFAULT 0,
  declared_by BIGINT UNSIGNED NULL,
  date_used DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wmaterials_worksite (worksite_id),
  INDEX idx_wmaterials_item (stock_item_id),
  CONSTRAINT fk_wmaterials_worksite FOREIGN KEY (worksite_id) REFERENCES worksites(id) ON DELETE CASCADE,
  CONSTRAINT fk_wmaterials_item FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_wmaterials_user FOREIGN KEY (declared_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Photos de chantier (avant / pendant / après)
CREATE TABLE IF NOT EXISTS worksite_photos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  worksite_id BIGINT UNSIGNED NOT NULL,
  photo_url VARCHAR(255) NOT NULL,
  phase ENUM('before', 'during', 'after') DEFAULT 'during',
  caption VARCHAR(255) NULL,
  uploaded_by BIGINT UNSIGNED NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wphotos_worksite (worksite_id),
  CONSTRAINT fk_wphotos_worksite FOREIGN KEY (worksite_id) REFERENCES worksites(id) ON DELETE CASCADE,
  CONSTRAINT fk_wphotos_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
