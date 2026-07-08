-- =====================================================================
-- Migration 001 : extension SaaS (statuts étendus, types de biens)
-- Idempotente autant que possible. À exécuter sur smg_immobilier.
-- =====================================================================
USE `smg_immobilier`;

-- 1. Appartements : statuts étendus + type + superficie
ALTER TABLE `apartments`
  MODIFY COLUMN `status` ENUM('free','occupied','maintenance','reserved') NOT NULL DEFAULT 'free';

ALTER TABLE `apartments`
  ADD COLUMN IF NOT EXISTS `apartment_type` VARCHAR(50) DEFAULT NULL AFTER `floor`,
  ADD COLUMN IF NOT EXISTS `surface` DECIMAL(8,2) DEFAULT NULL AFTER `apartment_type`;

-- 2. Propriétés (biens) : type (immeuble/maison/terrain) + statut + image
ALTER TABLE `properties`
  ADD COLUMN IF NOT EXISTS `property_type` ENUM('immeuble','maison','terrain') NOT NULL DEFAULT 'immeuble' AFTER `property_name`,
  ADD COLUMN IF NOT EXISTS `status` ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER `description`,
  ADD COLUMN IF NOT EXISTS `image` VARCHAR(255) DEFAULT NULL AFTER `status`;

-- 3. Maintenances : statuts étendus (signalé/validé/en cours/terminé/annulé)
ALTER TABLE `maintenance_requests`
  MODIFY COLUMN `status` ENUM('reported','validated','in_progress','completed','cancelled') NOT NULL DEFAULT 'reported';

-- 4. Locataires : profession
ALTER TABLE `tenants`
  ADD COLUMN IF NOT EXISTS `profession` VARCHAR(100) DEFAULT NULL AFTER `national_id`;
