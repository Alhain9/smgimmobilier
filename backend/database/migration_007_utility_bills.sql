-- =====================================================================
-- Migration 007 : refacturation des charges (électricité / eau) par compteur
--   divisionnel — activable par immeuble. Report d'index d'un mois à l'autre.
-- =====================================================================
USE `smg_immobilier`;

-- 1. Immeubles : redistribution des charges (option) + valeurs par défaut
ALTER TABLE `properties`
  ADD COLUMN IF NOT EXISTS `utilities_enabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `longitude`,
  ADD COLUMN IF NOT EXISTS `electricity_price` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `utilities_enabled`,
  ADD COLUMN IF NOT EXISTS `water_price`       DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `electricity_price`,
  ADD COLUMN IF NOT EXISTS `garbage_fee`       DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `water_price`,
  ADD COLUMN IF NOT EXISTS `transport_fee`     DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `garbage_fee`;

-- 2. Factures de charges (une par logement / type / mois)
CREATE TABLE IF NOT EXISTS `utility_bills` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `apartment_id`   BIGINT UNSIGNED NOT NULL,
  `type`           ENUM('electricity','water') NOT NULL DEFAULT 'electricity',
  `period_month`   TINYINT UNSIGNED NOT NULL,
  `period_year`    SMALLINT UNSIGNED NOT NULL,
  `previous_index` DECIMAL(12,2) NOT NULL DEFAULT 0,   -- ancien index
  `current_index`  DECIMAL(12,2) NOT NULL DEFAULT 0,   -- nouvel index
  `unit_price`     DECIMAL(10,2) NOT NULL DEFAULT 0,   -- prix du kWh / m3
  `garbage_fee`    DECIMAL(10,2) NOT NULL DEFAULT 0,   -- poubelle / ordures
  `transport_fee`  DECIMAL(10,2) NOT NULL DEFAULT 0,
  `other_fee`      DECIMAL(10,2) NOT NULL DEFAULT 0,
  `other_label`    VARCHAR(80) DEFAULT NULL,
  `total_amount`   DECIMAL(14,2) NOT NULL DEFAULT 0,   -- conso*prix + frais (calculé au service)
  `status`         ENUM('pending','paid') NOT NULL DEFAULT 'pending',
  `paid_date`      DATE DEFAULT NULL,
  `notes`          TEXT,
  `created_by`     BIGINT UNSIGNED DEFAULT NULL,
  `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_utility_bill` (`apartment_id`, `type`, `period_year`, `period_month`),
  CONSTRAINT `fk_ubill_apartment` FOREIGN KEY (`apartment_id`) REFERENCES `apartments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ubill_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
