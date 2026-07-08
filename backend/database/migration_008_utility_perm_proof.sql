-- =====================================================================
-- Migration 008 : droit délégable de génération des factures de charges
--   + preuve de paiement sur une facture de charges
-- =====================================================================
USE `smg_immobilier`;

-- Permission « à la carte » : générer / gérer les factures de charges
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `can_manage_utilities` TINYINT(1) NOT NULL DEFAULT 0 AFTER `can_view_all_calendars`;

-- Justificatif de paiement d'une facture de charges
ALTER TABLE `utility_bills`
  ADD COLUMN IF NOT EXISTS `payment_proof` VARCHAR(255) DEFAULT NULL AFTER `paid_date`;
