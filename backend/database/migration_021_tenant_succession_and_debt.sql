-- Migration 021 : Libération de logement, succession locative et reconnaissance de dette
-- Gestion de la libération d'un logement, archivage de l'ancien locataire débiteur
-- et isolation comptable vis-à-vis du nouveau locataire

ALTER TABLE `tenants`
  ADD COLUMN `departure_reason` VARCHAR(150) NULL AFTER `status`,
  ADD COLUMN `debt_acknowledged` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `departure_reason`,
  ADD COLUMN `debt_due_date` DATE NULL AFTER `debt_acknowledged`,
  ADD COLUMN `is_debt_settled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `debt_due_date`;
