-- =====================================================================
-- Migration 004 : permissions à la carte, calendrier partagé, paiements
--   (CamPay / espèces avec preuve, déclaration locataire)
-- =====================================================================
USE `smg_immobilier`;

-- 1. Permissions déléguées par le manager à un utilisateur précis
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `can_manage_users` TINYINT(1) NOT NULL DEFAULT 0 AFTER `status`,
  ADD COLUMN IF NOT EXISTS `can_view_all_calendars` TINYINT(1) NOT NULL DEFAULT 0 AFTER `can_manage_users`;

-- 2. Calendrier : événements partagés (réunions)
ALTER TABLE `calendar_events`
  ADD COLUMN IF NOT EXISTS `is_meeting` TINYINT(1) NOT NULL DEFAULT 0 AFTER `created_by`;

CREATE TABLE IF NOT EXISTS `calendar_event_participants` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id`   BIGINT UNSIGNED NOT NULL,
  `user_id`    BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_event_participant` (`event_id`, `user_id`),
  CONSTRAINT `fk_participant_event` FOREIGN KEY (`event_id`) REFERENCES `calendar_events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_participant_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Paiements : CamPay (mobile money) + déclaration par le locataire
ALTER TABLE `payments`
  MODIFY COLUMN `payment_method` ENUM('orange_money','mtn_mobile_money','bank_transfer','cash','campay') NOT NULL,
  MODIFY COLUMN `status` ENUM('pending','awaiting_confirmation','completed','failed','refunded') NOT NULL DEFAULT 'pending';

ALTER TABLE `payments`
  ADD COLUMN IF NOT EXISTS `created_by` BIGINT UNSIGNED DEFAULT NULL AFTER `status`,
  ADD COLUMN IF NOT EXISTS `campay_reference` VARCHAR(100) DEFAULT NULL AFTER `created_by`;
