-- ============================================================
-- MIGRATION 014 — Système de Reçus (Receipts)
-- SMG IMMOBILIER — Documents financiers liés aux transactions
-- ============================================================

CREATE TABLE IF NOT EXISTS receipts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  receipt_number VARCHAR(50) NOT NULL UNIQUE,
  receipt_type ENUM('rent', 'deposit', 'advance', 'other_income', 'expense_report') NOT NULL DEFAULT 'rent',
  payment_id BIGINT UNSIGNED NULL,
  tenant_id BIGINT UNSIGNED NULL,
  apartment_id BIGINT UNSIGNED NULL,
  property_id BIGINT UNSIGNED NULL,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50),
  payment_date DATE,
  period_start DATE NULL,
  period_end DATE NULL,
  remaining_balance DECIMAL(12, 2) DEFAULT 0,
  observations TEXT,
  generated_by BIGINT UNSIGNED NULL,
  pdf_path VARCHAR(255),
  status ENUM('draft', 'issued', 'cancelled') DEFAULT 'issued',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_receipts_number (receipt_number),
  INDEX idx_receipts_type (receipt_type),
  INDEX idx_receipts_payment (payment_id),
  INDEX idx_receipts_tenant (tenant_id),
  INDEX idx_receipts_property (property_id),
  INDEX idx_receipts_date (payment_date),

  CONSTRAINT fk_receipts_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
  CONSTRAINT fk_receipts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
  CONSTRAINT fk_receipts_apartment FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE SET NULL,
  CONSTRAINT fk_receipts_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
  CONSTRAINT fk_receipts_generated_by FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
