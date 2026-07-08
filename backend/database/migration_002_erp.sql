-- Migration 002 : ERP (fournisseur + photo sur dépenses/équipements d'intervention)
USE `smg_immobilier`;
ALTER TABLE `expenses`
  ADD COLUMN IF NOT EXISTS `category` VARCHAR(80) DEFAULT NULL AFTER `item_name`,
  ADD COLUMN IF NOT EXISTS `supplier` VARCHAR(150) DEFAULT NULL AFTER `unit_price`,
  ADD COLUMN IF NOT EXISTS `photo` VARCHAR(255) DEFAULT NULL AFTER `invoice_file`;
