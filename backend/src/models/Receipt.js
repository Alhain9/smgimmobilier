const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Receipt = sequelize.define('Receipt', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  receipt_number: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  receipt_type: {
    type: DataTypes.ENUM('rent', 'deposit', 'advance', 'other_income', 'expense_report', 'utility'),
    allowNull: false, defaultValue: 'rent',
  },
  payment_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  tenant_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  apartment_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  property_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  payment_method: { type: DataTypes.STRING(50) },
  payment_date: { type: DataTypes.DATEONLY },
  period_start: { type: DataTypes.DATEONLY, allowNull: true },
  period_end: { type: DataTypes.DATEONLY, allowNull: true },
  remaining_balance: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  observations: { type: DataTypes.TEXT },
  generated_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  pdf_path: { type: DataTypes.STRING(255) },
  status: { type: DataTypes.ENUM('draft', 'issued', 'cancelled'), defaultValue: 'issued' },
}, { tableName: 'receipts', timestamps: true });

// Labels lisibles pour les types de reçu
Receipt.TYPE_LABELS = {
  rent: 'Reçu de paiement de loyer',
  deposit: 'Reçu de paiement de caution',
  advance: "Reçu d'avance de loyer",
  other_income: "Reçu d'une autre recette",
  expense_report: 'Justificatif de dépense',
  utility: "Reçu de paiement de charges (électricité/eau)",
};

module.exports = Receipt;
