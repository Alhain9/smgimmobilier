-- =====================================================================
-- Migration 006 : localisation GPS de l'immeuble
--   (la composition par type de logement réutilise la table apartments)
-- =====================================================================
USE `smg_immobilier`;

ALTER TABLE `properties`
  ADD COLUMN IF NOT EXISTS `latitude`  DECIMAL(10,7) NULL DEFAULT NULL AFTER `district`,
  ADD COLUMN IF NOT EXISTS `longitude` DECIMAL(10,7) NULL DEFAULT NULL AFTER `latitude`;
