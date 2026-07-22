-- =====================================================================
-- Migration 012 : Nouveaux modules métiers SMG IMMOBILIER
--   • RH : services, equipes, plannings, pointages, conges
--   • Approbations/Workflow : workflow_validation, workflow_etapes
--   • Collaboration : messages_internes
--   • Mobilité : gps_tracking
-- =====================================================================
USE `smg_immobilier`;

-- 1. RH : Services
CREATE TABLE IF NOT EXISTS `services` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(100) NOT NULL UNIQUE,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. RH : Équipes
CREATE TABLE IF NOT EXISTS `equipes` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(100) NOT NULL UNIQUE,
  `service_id`  BIGINT UNSIGNED NOT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_equipe_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. RH : Association User <-> Equipe/Service (Ajout colonnes service_id / equipe_id sur users)
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `service_id` BIGINT UNSIGNED DEFAULT NULL AFTER `role_id`,
  ADD COLUMN IF NOT EXISTS `equipe_id` BIGINT UNSIGNED DEFAULT NULL AFTER `service_id`,
  ADD CONSTRAINT `fk_user_service` FOREIGN KEY IF NOT EXISTS (`service_id`) REFERENCES `services` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_user_equipe` FOREIGN KEY IF NOT EXISTS (`equipe_id`) REFERENCES `equipes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. RH : Plannings
CREATE TABLE IF NOT EXISTS `plannings` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT UNSIGNED NOT NULL,
  `title`       VARCHAR(200) NOT NULL,
  `description` TEXT,
  `start_datetime` DATETIME NOT NULL,
  `end_datetime`   DATETIME NOT NULL,
  `created_by`  BIGINT UNSIGNED DEFAULT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`  DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_planning_user` (`user_id`),
  CONSTRAINT `fk_planning_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_planning_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. RH : Pointages (Temps de présence)
CREATE TABLE IF NOT EXISTS `pointages` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT UNSIGNED NOT NULL,
  `entry_time`  DATETIME NOT NULL,
  `exit_time`   DATETIME DEFAULT NULL,
  `status`      ENUM('present', 'absent', 'late', 'half_day') NOT NULL DEFAULT 'present',
  `notes`       TEXT,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pointage_user` (`user_id`),
  CONSTRAINT `fk_pointage_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. RH : Congés
CREATE TABLE IF NOT EXISTS `conges` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT UNSIGNED NOT NULL,
  `type`        ENUM('annual', 'sick', 'maternity', 'paternity', 'unpaid', 'other') NOT NULL DEFAULT 'annual',
  `start_date`  DATE NOT NULL,
  `end_date`    DATE NOT NULL,
  `status`      ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  `reason`      TEXT,
  `approved_by` BIGINT UNSIGNED DEFAULT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`  DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_conge_user` (`user_id`),
  CONSTRAINT `fk_conge_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_conge_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Circuit d'approbation / Workflows
CREATE TABLE IF NOT EXISTS `workflow_validations` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(150) NOT NULL UNIQUE,
  `module`      VARCHAR(50) NOT NULL,                -- ex: 'expense', 'conge', 'lease'
  `description` TEXT,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `workflow_etapes` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `workflow_id` BIGINT UNSIGNED NOT NULL,
  `step_order`  TINYINT UNSIGNED NOT NULL,
  `role_id`     BIGINT UNSIGNED NOT NULL,            -- le rôle qui doit valider à cette étape
  `description` VARCHAR(255) DEFAULT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_wf_step` (`workflow_id`, `step_order`),
  CONSTRAINT `fk_wfe_workflow` FOREIGN KEY (`workflow_id`) REFERENCES `workflow_validations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_wfe_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Collaboration : Messagerie interne
CREATE TABLE IF NOT EXISTS `messages_internes` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sender_id`    BIGINT UNSIGNED NOT NULL,
  `recipient_id` BIGINT UNSIGNED NOT NULL,
  `content`      TEXT NOT NULL,
  `is_read`      TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_msg_sender` (`sender_id`),
  KEY `idx_msg_recipient` (`recipient_id`),
  CONSTRAINT `fk_msg_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_msg_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Mobilité : GPS Tracking (Géolocalisation des agents terrain)
CREATE TABLE IF NOT EXISTS `gps_tracking` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT UNSIGNED NOT NULL,
  `latitude`    DECIMAL(10,7) NOT NULL,
  `longitude`   DECIMAL(10,7) NOT NULL,
  `recorded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_gps_user` (`user_id`),
  KEY `idx_gps_date` (`recorded_at`),
  CONSTRAINT `fk_gps_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
