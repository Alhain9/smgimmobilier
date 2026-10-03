-- Migration 020 : Salaires des gardiens & dépenses rattachées aux immeubles
-- Gestion des gardiens sur les immeubles et enregistrement des dépenses de gardiennage

-- 1. Ajout des informations du gardien sur les propriétés (immeubles)
ALTER TABLE `properties` 
  ADD COLUMN IF NOT EXISTS `caretaker_name` VARCHAR(150) NULL AFTER `district`,
  ADD COLUMN IF NOT EXISTS `caretaker_phone` VARCHAR(50) NULL AFTER `caretaker_name`,
  ADD COLUMN IF NOT EXISTS `caretaker_salary` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `caretaker_phone`;

-- 2. Élargissement des types de dépenses et champs spécifiques pour le gardiennage et justificatifs
ALTER TABLE `expenses` 
  MODIFY COLUMN `expense_type` ENUM('maintenance','utility','administrative','renovation','gardiennage','other') DEFAULT 'maintenance',
  ADD COLUMN IF NOT EXISTS `caretaker_name` VARCHAR(150) NULL AFTER `item_name`,
  ADD COLUMN IF NOT EXISTS `period_month` VARCHAR(50) NULL AFTER `caretaker_name`,
  ADD COLUMN IF NOT EXISTS `payment_date` DATE NULL AFTER `period_month`,
  ADD COLUMN IF NOT EXISTS `payment_method` VARCHAR(50) DEFAULT 'Espèces' AFTER `payment_date`;

-- Indexation pour accélérer les requêtes financières par date et par immeuble
ALTER TABLE `expenses`
  ADD INDEX IF NOT EXISTS `idx_expenses_property` (`property_id`),
  ADD INDEX IF NOT EXISTS `idx_expenses_type` (`expense_type`),
  ADD INDEX IF NOT EXISTS `idx_expenses_paydate` (`payment_date`);
