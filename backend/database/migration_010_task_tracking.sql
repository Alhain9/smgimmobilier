-- =====================================================================
-- Migration 010 : suivi & traçabilité des tâches
--   statut « non effectué » + raison, heure de réalisation, journal des actions
-- =====================================================================
USE `smg_immobilier`;

ALTER TABLE `tasks`
  MODIFY COLUMN `status` ENUM('pending','in_progress','completed','not_done','cancelled') NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS `done_at` DATETIME NULL AFTER `status`,
  ADD COLUMN IF NOT EXISTS `completion_note` TEXT AFTER `done_at`;

-- Journal horodaté : qui a fait quoi, et quand (suivi de bout en bout / traçabilité)
CREATE TABLE IF NOT EXISTS `task_history` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `task_id`      BIGINT UNSIGNED NOT NULL,
  `action`       VARCHAR(40) NOT NULL,        -- created | status_changed | rescheduled | note
  `description`  TEXT,
  `old_status`   VARCHAR(40),
  `new_status`   VARCHAR(40),
  `scheduled_at` DATETIME NULL,               -- horaire planifié au moment de l'action
  `changed_by`   BIGINT UNSIGNED DEFAULT NULL,
  `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_th_task` (`task_id`),
  CONSTRAINT `fk_th_task` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_th_user` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
