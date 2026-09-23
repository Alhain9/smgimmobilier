-- =====================================================================
-- Migration 018 : Module Factures d'Électricité & Reçus de Paiement
-- Système SMG IMMOBILIER — Complémentaire et rétrocompatible
-- =====================================================================
USE `smg_immobilier`;

-- 1. Extension de la table `utility_bills`
ALTER TABLE `utility_bills`
  ADD COLUMN IF NOT EXISTS `impayer` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `transport_fee`,
  ADD COLUMN IF NOT EXISTS `due_date` DATE NULL AFTER `paid_date`,
  ADD COLUMN IF NOT EXISTS `payment_method` VARCHAR(50) DEFAULT 'Espèces' AFTER `due_date`,
  ADD COLUMN IF NOT EXISTS `receipt_number` VARCHAR(50) DEFAULT NULL AFTER `payment_method`;

-- 2. Élargissement du type de reçu dans la table `receipts` pour inclure 'utility'
ALTER TABLE `receipts`
  MODIFY COLUMN `receipt_type` ENUM('rent', 'deposit', 'advance', 'other_income', 'expense_report', 'utility') NOT NULL DEFAULT 'rent';

-- 3. Vue : Factures d'électricité avec détails logement et calculs
CREATE OR REPLACE VIEW `v_factures_electricite` AS
SELECT 
    u.id AS facture_id,
    u.apartment_id,
    a.apartment_number AS identifiant_logement,
    a.apartment_type AS type_logement,
    p.property_name AS immeuble,
    u.previous_index AS ancien_index,
    u.current_index AS nouvel_index,
    u.unit_price AS prix_kwh,
    u.garbage_fee AS poubelle,
    u.transport_fee AS transport,
    u.other_fee AS autres_frais,
    u.impayer,
    u.period_month,
    u.period_year,
    CONCAT(
      CASE u.period_month
        WHEN 1 THEN 'Janvier' WHEN 2 THEN 'Février' WHEN 3 THEN 'Mars'
        WHEN 4 THEN 'Avril' WHEN 5 THEN 'Mai' WHEN 6 THEN 'Juin'
        WHEN 7 THEN 'Juillet' WHEN 8 THEN 'Août' WHEN 9 THEN 'Septembre'
        WHEN 10 THEN 'Octobre' WHEN 11 THEN 'Novembre' WHEN 12 THEN 'Décembre'
      END, ' ', u.period_year
    ) AS mois,
    u.due_date AS date_limite,
    u.created_at AS date_facture,
    u.total_amount AS montant_total,
    GREATEST(0, u.current_index - u.previous_index) AS consommation_kwh,
    CASE 
      WHEN u.status = 'paid' THEN 'PAYÉ'
      ELSE 'IMPAYÉ'
    END AS statut,
    u.status,
    u.paid_date,
    u.payment_method,
    u.receipt_number
FROM utility_bills u
INNER JOIN apartments a ON u.apartment_id = a.id
LEFT JOIN properties p ON a.property_id = p.id
WHERE u.type = 'electricity'
ORDER BY u.created_at DESC;

-- 4. Vue : Récapitulatif mensuel de l'électricité
CREATE OR REPLACE VIEW `v_recap_mensuel_electricite` AS
SELECT 
    CONCAT(period_year, '-', LPAD(period_month, 2, '0')) AS mois_code,
    CONCAT(
      CASE period_month
        WHEN 1 THEN 'Janvier' WHEN 2 THEN 'Février' WHEN 3 THEN 'Mars'
        WHEN 4 THEN 'Avril' WHEN 5 THEN 'Mai' WHEN 6 THEN 'Juin'
        WHEN 7 THEN 'Juillet' WHEN 8 THEN 'Août' WHEN 9 THEN 'Septembre'
        WHEN 10 THEN 'Octobre' WHEN 11 THEN 'Novembre' WHEN 12 THEN 'Décembre'
      END, ' ', period_year
    ) AS mois_libelle,
    COUNT(*) AS nb_factures,
    COALESCE(SUM(total_amount), 0) AS total_facture,
    COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) AS total_collecte,
    COALESCE(SUM(CASE WHEN status = 'pending' THEN total_amount ELSE 0 END), 0) AS total_impaye,
    COALESCE(AVG(total_amount), 0) AS moyenne_facture
FROM utility_bills
WHERE type = 'electricity'
GROUP BY period_year, period_month
ORDER BY period_year DESC, period_month DESC;

-- 5. Vue : Récapitulatif par logement
CREATE OR REPLACE VIEW `v_recap_logement_electricite` AS
SELECT 
    a.id AS logement_id,
    a.apartment_number AS identifiant_logement,
    a.apartment_type AS type_logement,
    p.property_name AS immeuble,
    COUNT(u.id) AS nb_factures,
    COALESCE(SUM(u.total_amount), 0) AS total_facture,
    COALESCE(SUM(CASE WHEN u.status = 'paid' THEN u.total_amount ELSE 0 END), 0) AS total_collecte,
    COALESCE(SUM(CASE WHEN u.status = 'pending' THEN u.total_amount ELSE 0 END), 0) AS total_impaye,
    MAX(u.created_at) AS derniere_facture,
    MIN(u.created_at) AS premiere_facture
FROM apartments a
LEFT JOIN properties p ON a.property_id = p.id
LEFT JOIN utility_bills u ON a.id = u.apartment_id AND u.type = 'electricity'
GROUP BY a.id, a.apartment_number, a.apartment_type, p.property_name
ORDER BY a.apartment_number;
