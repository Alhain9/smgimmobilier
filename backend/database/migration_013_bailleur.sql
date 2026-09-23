-- ============================================================
-- MIGRATION 013 — Modèle Bailleur + extensions Expense
-- SMG IMMOBILIER — Restructuration mono-agence / multi-bailleurs
-- ============================================================

-- 1. Ajouter le rôle « Bailleur » dans la table roles
INSERT IGNORE INTO roles (role_name, created_at, updated_at)
VALUES ('Bailleur', NOW(), NOW());

-- 2. Ajouter owner_id sur properties (FK vers users — le bailleur propriétaire)
ALTER TABLE properties ADD COLUMN owner_id BIGINT UNSIGNED NULL AFTER id;
ALTER TABLE properties ADD CONSTRAINT fk_properties_owner
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;

-- Index pour accélérer les recherches par propriétaire
CREATE INDEX idx_properties_owner ON properties(owner_id);

-- 3. Rendre maintenance_id nullable sur expenses (pour supporter les dépenses hors maintenance)
ALTER TABLE expenses MODIFY COLUMN maintenance_id BIGINT UNSIGNED NULL;

-- 4. Ajouter property_id optionnel sur expenses (dépenses liées directement à un immeuble)
ALTER TABLE expenses ADD COLUMN property_id BIGINT UNSIGNED NULL AFTER maintenance_id;
ALTER TABLE expenses ADD CONSTRAINT fk_expenses_property
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;

-- Index pour accélérer les recherches par immeuble
CREATE INDEX idx_expenses_property ON expenses(property_id);

-- 5. Ajouter expense_type pour catégoriser les dépenses
ALTER TABLE expenses ADD COLUMN expense_type
  ENUM('maintenance', 'utility', 'administrative', 'renovation', 'other')
  DEFAULT 'maintenance' AFTER property_id;
