-- =====================================================================
-- Migration 009 : journal des modifications des paiements (loyers)
--   (traçabilité des corrections : montant, date, preuve, validation)
-- =====================================================================
USE `smg_immobilier`;

CREATE TABLE IF NOT EXISTS `payment_history` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_id`  BIGINT UNSIGNED NOT NULL,
  `action`      VARCHAR(40) NOT NULL,            -- created | updated | proof_added | validated | rejected
  `description` TEXT,                            -- détail lisible des changements
  `amount`      DECIMAL(12,2),                   -- montant du paiement au moment du changement
  `status`      VARCHAR(40),                     -- statut au moment du changement
  `changed_by`  BIGINT UNSIGNED DEFAULT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ph_payment` (`payment_id`),
  CONSTRAINT `fk_ph_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ph_user` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
