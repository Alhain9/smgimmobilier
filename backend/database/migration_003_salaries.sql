-- Migration 003 : Salaires / Paie du personnel
USE `smg_immobilier`;
CREATE TABLE IF NOT EXISTS `salaries` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`       BIGINT UNSIGNED NOT NULL,
  `period_month`  TINYINT UNSIGNED NOT NULL,
  `period_year`   SMALLINT UNSIGNED NOT NULL,
  `base_salary`   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `bonus`         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `deductions`    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `net_salary`    DECIMAL(14,2) AS (`base_salary` + `bonus` - `deductions`) STORED,
  `payment_type`  ENUM('deposit','cash') NOT NULL DEFAULT 'deposit',
  `proof_photo`   VARCHAR(255) DEFAULT NULL,
  `status`        ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  `paid_date`     DATE DEFAULT NULL,
  `notes`         TEXT DEFAULT NULL,
  `created_by`    BIGINT UNSIGNED DEFAULT NULL,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_salary_user` (`user_id`),
  CONSTRAINT `fk_salary_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_salary_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
