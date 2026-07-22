-- =====================================================================
-- Migration 011 : Infrastructure SMG IMMOBILIER
--   • audit_logs — traçabilité des actions critiques
--   • refresh_tokens — rotation JWT côté serveur
--   • permissions / roles_permissions — RBAC granulaire
--   • soft delete (deleted_at) sur les tables principales
-- =====================================================================
USE `smg_immobilier`;

-- 1. Audit logs
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT UNSIGNED DEFAULT NULL,
  `action`      VARCHAR(50) NOT NULL,                -- CREATE, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT…
  `entity`      VARCHAR(80) DEFAULT NULL,            -- nom de la table/entité concernée
  `entity_id`   BIGINT UNSIGNED DEFAULT NULL,        -- PK de l'enregistrement concerné
  `old_values`  JSON DEFAULT NULL,                   -- snapshot avant modification
  `new_values`  JSON DEFAULT NULL,                   -- snapshot après modification
  `ip_address`  VARCHAR(45) DEFAULT NULL,
  `user_agent`  VARCHAR(255) DEFAULT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_entity` (`entity`, `entity_id`),
  KEY `idx_audit_action` (`action`),
  KEY `idx_audit_date` (`created_at`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Refresh tokens (hashés, avec rotation et révocation)
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT UNSIGNED NOT NULL,
  `token_hash`  VARCHAR(255) NOT NULL,               -- bcrypt hash du refresh token
  `expires_at`  DATETIME NOT NULL,
  `revoked`     TINYINT(1) NOT NULL DEFAULT 0,
  `replaced_by` BIGINT UNSIGNED DEFAULT NULL,        -- id du token de remplacement (rotation)
  `ip_address`  VARCHAR(45) DEFAULT NULL,
  `user_agent`  VARCHAR(255) DEFAULT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rt_user` (`user_id`),
  KEY `idx_rt_expires` (`expires_at`),
  CONSTRAINT `fk_rt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Permissions granulaires (remplace les colonnes can_* sur users)
CREATE TABLE IF NOT EXISTS `permissions` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code`        VARCHAR(80) NOT NULL,                -- ex: manage_users, view_reports, manage_utilities
  `label`       VARCHAR(150) NOT NULL,               -- libellé lisible
  `module`      VARCHAR(50) DEFAULT 'general',       -- regroupement par module
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_perm_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `roles_permissions` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `role_id`       BIGINT UNSIGNED NOT NULL,
  `permission_id` BIGINT UNSIGNED NOT NULL,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_role_perm` (`role_id`, `permission_id`),
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Soft delete : ajout de deleted_at sur les tables principales
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME NULL DEFAULT NULL;

ALTER TABLE `properties`
  ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME NULL DEFAULT NULL;

ALTER TABLE `apartments`
  ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME NULL DEFAULT NULL;

ALTER TABLE `tenants`
  ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME NULL DEFAULT NULL;

ALTER TABLE `leases`
  ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME NULL DEFAULT NULL;

ALTER TABLE `payments`
  ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME NULL DEFAULT NULL;

ALTER TABLE `maintenance_requests`
  ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME NULL DEFAULT NULL;

ALTER TABLE `expenses`
  ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME NULL DEFAULT NULL;

ALTER TABLE `equipment`
  ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME NULL DEFAULT NULL;

ALTER TABLE `tasks`
  ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME NULL DEFAULT NULL;

ALTER TABLE `salaries`
  ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME NULL DEFAULT NULL;

ALTER TABLE `utility_bills`
  ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME NULL DEFAULT NULL;

ALTER TABLE `calendar_events`
  ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME NULL DEFAULT NULL;

-- 5. Index composites pour le reporting fréquent
CREATE INDEX IF NOT EXISTS `idx_payments_status_date` ON `payments` (`status`, `payment_date`);
CREATE INDEX IF NOT EXISTS `idx_leases_status_dates` ON `leases` (`status`, `start_date`, `end_date`);
CREATE INDEX IF NOT EXISTS `idx_maintenance_status` ON `maintenance_requests` (`status`, `created_at`);
CREATE INDEX IF NOT EXISTS `idx_tenants_status` ON `tenants` (`status`);
CREATE INDEX IF NOT EXISTS `idx_apartments_status` ON `apartments` (`status`);
CREATE INDEX IF NOT EXISTS `idx_salaries_period` ON `salaries` (`period_year`, `period_month`, `status`);

-- 6. Seed des permissions par défaut
INSERT IGNORE INTO `permissions` (`code`, `label`, `module`) VALUES
  ('manage_users',      'Gérer les utilisateurs',       'admin'),
  ('manage_roles',      'Gérer les rôles',              'admin'),
  ('view_dashboard',    'Voir le tableau de bord',      'general'),
  ('manage_properties', 'Gérer les immeubles',          'patrimoine'),
  ('manage_apartments', 'Gérer les logements',          'patrimoine'),
  ('manage_tenants',    'Gérer les locataires',         'patrimoine'),
  ('manage_leases',     'Gérer les contrats',           'patrimoine'),
  ('manage_payments',   'Gérer les paiements',          'finance'),
  ('validate_payments', 'Valider les paiements',        'finance'),
  ('manage_expenses',   'Gérer les dépenses',           'finance'),
  ('manage_salaries',   'Gérer les salaires',           'finance'),
  ('manage_utilities',  'Gérer les charges',            'finance'),
  ('manage_maintenance','Gérer les maintenances',       'technique'),
  ('manage_equipment',  'Gérer les équipements',        'technique'),
  ('manage_tasks',      'Gérer les tâches',             'technique'),
  ('view_reports',      'Voir les rapports',            'reporting'),
  ('export_data',       'Exporter les données',         'reporting'),
  ('manage_calendar',   'Gérer le calendrier',          'general'),
  ('manage_documents',  'Gérer les documents',          'general'),
  ('send_notifications','Envoyer des notifications',    'general'),
  ('manage_hr',         'Gérer les RH (plannings, congés)', 'rh'),
  ('view_all_calendars','Voir tous les calendriers',    'general'),
  ('manage_workflow',   'Gérer les workflows de validation', 'admin');
