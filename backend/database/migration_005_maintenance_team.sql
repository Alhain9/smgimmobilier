-- =====================================================================
-- Migration 005 : équipe de techniciens par chantier de maintenance
--   (plusieurs techniciens peuvent intervenir sur une même maintenance)
-- =====================================================================
USE `smg_immobilier`;

CREATE TABLE IF NOT EXISTS `maintenance_technicians` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `maintenance_id` BIGINT UNSIGNED NOT NULL,
  `user_id`        BIGINT UNSIGNED NOT NULL,
  `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_maintenance_technician` (`maintenance_id`, `user_id`),
  CONSTRAINT `fk_mtech_maintenance` FOREIGN KEY (`maintenance_id`) REFERENCES `maintenance_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mtech_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
