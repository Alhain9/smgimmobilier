-- =====================================================================
-- Migration 010 : ajout du mode de paiement "kang" (Kang Open Banking)
--   (remplace CamPay comme fournisseur Mobile Money ; 'campay' conservé pour l'historique)
-- =====================================================================
USE `smg_immobilier`;

ALTER TABLE `payments`
  MODIFY COLUMN `payment_method` ENUM('orange_money','mtn_mobile_money','bank_transfer','cash','campay','kang') NOT NULL;
