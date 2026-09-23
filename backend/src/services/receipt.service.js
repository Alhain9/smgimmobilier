// ============ Service Reçus — Génération et gestion des reçus ============
const { Receipt, Payment, Tenant, Apartment, Property, User, Lease, UtilityBill } = require('../models');
const { Op } = require('sequelize');
const { logger } = require('../config/logger');

const num = (v) => parseFloat(v) || 0;

class ReceiptService {
  // ===== Numérotation automatique =====
  async _nextNumber(type) {
    const year = new Date().getFullYear();
    const prefix = {
      rent: 'R-LOYER',
      deposit: 'R-CAUTION',
      advance: 'R-AVANCE',
      other_income: 'R-RECETTE',
      expense_report: 'R-DEPENSE',
      utility: 'R-CHARGE',
    }[type] || 'R-AUTRE';

    const pattern = `${prefix}-${year}-%`;
    const last = await Receipt.findOne({
      where: { receipt_number: { [Op.like]: pattern } },
      order: [['id', 'DESC']],
      attributes: ['receipt_number'],
    });

    let seq = 1;
    if (last && last.receipt_number) {
      const parts = last.receipt_number.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
  }

  // ===== Générer un reçu de loyer à partir d'un paiement =====
  async generateRentReceipt(paymentId, generatedBy) {
    // Vérifier qu'aucun reçu n'existe déjà pour ce paiement
    const existing = await Receipt.findOne({ where: { payment_id: paymentId, receipt_type: 'rent' } });
    if (existing) return existing;

    const payment = await Payment.findByPk(paymentId, {
      include: [
        {
          model: Tenant, as: 'tenant',
          include: [
            { model: User, as: 'user', attributes: ['id', 'full_name', 'phone', 'email'] },
            { model: Lease, as: 'leases', where: { status: 'active' }, required: false },
          ],
        },
        {
          model: Apartment, as: 'apartment',
          include: [{ model: Property, as: 'property' }],
        },
      ],
    });

    if (!payment) throw Object.assign(new Error('Paiement introuvable'), { status: 404 });

    const apartment = payment.apartment;
    const property = apartment ? apartment.property : null;
    const tenant = payment.tenant;
    const activeLease = tenant && tenant.leases ? tenant.leases[0] : null;

    // Calculer la période couverte par ce paiement
    const monthlyRent = activeLease ? num(activeLease.monthly_rent) : (apartment ? num(apartment.rent_amount) : 0);
    let periodStart = null;
    let periodEnd = null;

    if (monthlyRent > 0 && payment.payment_date) {
      const payDate = new Date(payment.payment_date);
      // Le paiement couvre le mois de la date de paiement
      periodStart = new Date(payDate.getFullYear(), payDate.getMonth(), 1);
      const monthsCovered = Math.max(1, Math.floor(num(payment.amount) / monthlyRent));
      periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + monthsCovered);
      periodEnd.setDate(periodEnd.getDate() - 1); // dernier jour de la période
    }

    // Calculer le solde restant (dette totale - ce paiement)
    const allPayments = tenant
      ? await Payment.findAll({ where: { tenant_id: tenant.id, status: 'completed' } })
      : [];
    const totalPaid = allPayments.reduce((s, p) => s + num(p.amount), 0);
    const leaseStart = activeLease ? activeLease.start_date : (tenant ? tenant.start_date : null);
    let totalDue = 0;
    if (monthlyRent > 0 && leaseStart) {
      const start = new Date(leaseStart);
      const now = new Date();
      const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1;
      totalDue = Math.max(0, months) * monthlyRent;
    }
    const remainingBalance = Math.max(0, totalDue - totalPaid);

    const receiptNumber = await this._nextNumber('rent');

    const receipt = await Receipt.create({
      receipt_number: receiptNumber,
      receipt_type: 'rent',
      payment_id: payment.id,
      tenant_id: payment.tenant_id,
      apartment_id: payment.apartment_id,
      property_id: property ? property.id : null,
      amount: payment.amount,
      payment_method: payment.payment_method,
      payment_date: payment.payment_date,
      period_start: periodStart ? periodStart.toISOString().slice(0, 10) : null,
      period_end: periodEnd ? periodEnd.toISOString().slice(0, 10) : null,
      remaining_balance: remainingBalance,
      generated_by: generatedBy || null,
      status: 'issued',
    });

    logger.info('📄 Reçu de loyer généré', { receipt_number: receiptNumber, payment_id: paymentId });
    return receipt;
  }

  // ===== Générer un reçu de caution =====
  async generateDepositReceipt(leaseId, generatedBy) {
    const lease = await Lease.findByPk(leaseId, {
      include: [
        { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone', 'email'] }] },
        { model: Apartment, as: 'apartment', include: [{ model: Property, as: 'property' }] },
      ],
    });
    if (!lease) throw Object.assign(new Error('Bail introuvable'), { status: 404 });

    const receiptNumber = await this._nextNumber('deposit');

    return Receipt.create({
      receipt_number: receiptNumber,
      receipt_type: 'deposit',
      tenant_id: lease.tenant_id,
      apartment_id: lease.apartment_id,
      property_id: lease.apartment && lease.apartment.property ? lease.apartment.property.id : null,
      amount: lease.deposit_amount,
      payment_method: 'cash',
      payment_date: lease.start_date,
      period_start: lease.start_date,
      period_end: lease.end_date,
      remaining_balance: 0,
      generated_by: generatedBy || null,
      status: 'issued',
    });
  }

  // ===== Générer un reçu de charges (électricité / eau) =====
  async generateUtilityReceipt(billId, generatedBy, paymentMethod = 'Espèces') {
    const bill = await UtilityBill.findByPk(billId, {
      include: [
        {
          model: Apartment, as: 'apartment',
          include: [
            { model: Property, as: 'property' },
            { model: Tenant, as: 'tenants', required: false, where: { status: 'active' }, include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone', 'email'] }] },
          ],
        },
      ],
    });
    if (!bill) throw Object.assign(new Error('Facture de charges introuvable'), { status: 404 });

    // Si la facture a déjà un receipt_number, retourner le reçu existant
    if (bill.receipt_number) {
      const existing = await Receipt.findOne({ where: { receipt_number: bill.receipt_number } });
      if (existing) return existing;
    }

    const apt = bill.apartment;
    const property = apt ? apt.property : null;
    const tenant = apt && apt.tenants && apt.tenants[0] ? apt.tenants[0] : null;

    const receiptNumber = await this._nextNumber('utility');
    const payDate = bill.paid_date || new Date().toISOString().slice(0, 10);

    const receipt = await Receipt.create({
      receipt_number: receiptNumber,
      receipt_type: 'utility',
      tenant_id: tenant ? tenant.id : null,
      apartment_id: bill.apartment_id,
      property_id: property ? property.id : null,
      amount: bill.total_amount,
      payment_method: paymentMethod || bill.payment_method || 'Espèces',
      payment_date: payDate,
      period_start: new Date(bill.period_year, bill.period_month - 1, 1).toISOString().slice(0, 10),
      period_end: new Date(bill.period_year, bill.period_month, 0).toISOString().slice(0, 10),
      remaining_balance: 0,
      observations: `Règlement facture ${bill.type === 'water' ? 'eau' : 'électricité'} #${bill.id} - Mois: ${bill.period_month}/${bill.period_year}. Conso: ${Math.max(0, Number(bill.current_index) - Number(bill.previous_index))} kWh.`,
      generated_by: generatedBy || null,
      status: 'issued',
    });

    // Mettre à jour la facture avec ce numéro de reçu et statut payé
    await bill.update({
      receipt_number: receiptNumber,
      status: 'paid',
      paid_date: payDate,
      payment_method: paymentMethod || bill.payment_method || 'Espèces',
    });

    logger.info('📄 Reçu de charges généré', { receipt_number: receiptNumber, bill_id: billId });
    return receipt;
  }

  // ===== Liste des reçus (filtrée) =====
  async list(filters = {}) {
    const where = {};
    if (filters.receipt_type) where.receipt_type = filters.receipt_type;
    if (filters.tenant_id) where.tenant_id = filters.tenant_id;
    if (filters.property_id) where.property_id = filters.property_id;
    if (filters.status) where.status = filters.status;
    if (filters.start && filters.end) {
      where.payment_date = { [Op.between]: [filters.start, filters.end] };
    }
    // Filtrage bailleur : seulement ses propriétés
    if (Array.isArray(filters.ownerPropertyIds)) {
      where.property_id = { [Op.in]: filters.ownerPropertyIds };
    }

    return Receipt.findAll({
      where,
      include: [
        { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }] },
        { model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number', 'rent_amount'] },
        { model: Property, as: 'property', attributes: ['id', 'property_name'] },
        { model: User, as: 'generator', attributes: ['id', 'full_name'] },
      ],
      order: [['created_at', 'DESC']],
    });
  }

  // ===== Détail d'un reçu =====
  async getById(id) {
    const receipt = await Receipt.findByPk(id, {
      include: [
        { model: Payment, as: 'payment' },
        { model: Tenant, as: 'tenant', include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone', 'email'] }] },
        { model: Apartment, as: 'apartment', attributes: ['id', 'apartment_number', 'rent_amount'], include: [{ model: Property, as: 'property' }] },
        { model: Property, as: 'property', include: [{ model: User, as: 'owner', attributes: ['id', 'full_name', 'phone', 'email'] }] },
        { model: User, as: 'generator', attributes: ['id', 'full_name'] },
      ],
    });
    if (!receipt) throw Object.assign(new Error('Reçu introuvable'), { status: 404 });
    return receipt;
  }

  // ===== Annuler un reçu =====
  async cancel(id) {
    const receipt = await Receipt.findByPk(id);
    if (!receipt) throw Object.assign(new Error('Reçu introuvable'), { status: 404 });
    receipt.status = 'cancelled';
    await receipt.save();
    logger.info('📄 Reçu annulé', { receipt_number: receipt.receipt_number });
    return receipt;
  }

  // ===== Générer les reçus pour tous les paiements passés (Archives) =====
  async generateArchives(filters = {}, userId = null) {
    const paymentWhere = { status: 'completed' };
    if (filters.start && filters.end) {
      paymentWhere.payment_date = { [Op.between]: [filters.start, filters.end] };
    } else if (filters.start) {
      paymentWhere.payment_date = { [Op.gte]: filters.start };
    } else if (filters.end) {
      paymentWhere.payment_date = { [Op.lte]: filters.end };
    }

    // Récupérer les paiements complétés
    const payments = await Payment.findAll({
      where: paymentWhere,
      order: [['payment_date', 'ASC'], ['id', 'ASC']],
    });

    // Récupérer les IDs des paiements qui ont déjà un reçu
    const existingReceipts = await Receipt.findAll({
      attributes: ['payment_id'],
      where: { payment_id: { [Op.ne]: null } },
    });
    const existingPaymentIds = new Set(existingReceipts.map((r) => r.payment_id));

    const generated = [];
    for (const p of payments) {
      if (!existingPaymentIds.has(p.id)) {
        try {
          const r = await this.generateRentReceipt(p.id, userId);
          generated.push(r);
          existingPaymentIds.add(p.id);
        } catch (err) {
          logger.warn('Échec génération reçu pour paiement #' + p.id, { error: err.message });
        }
      }
    }

    logger.info('📦 Génération des reçus d\'archives terminée', { totalCompleted: payments.length, generated: generated.length });
    return {
      total_payments: payments.length,
      generated_count: generated.length,
      already_existed: payments.length - generated.length,
      receipts: generated,
    };
  }

  // ===== Création manuelle d'un reçu (Générateur interactif) =====
  async createCustom(data, userId = null) {
    let receiptNumber = (data.receipt_number || '').trim();
    if (!receiptNumber) {
      receiptNumber = await this._nextNumber(data.receipt_type || 'rent');
    }

    // S'assurer que le numéro est unique s'il a été saisi manuellement
    const existing = await Receipt.findOne({ where: { receipt_number: receiptNumber } });
    if (existing) {
      receiptNumber = await this._nextNumber(data.receipt_type || 'rent');
    }

    const receipt = await Receipt.create({
      receipt_number: receiptNumber,
      receipt_type: data.receipt_type || 'rent',
      payment_id: data.payment_id || null,
      tenant_id: data.tenant_id || null,
      apartment_id: data.apartment_id || null,
      property_id: data.property_id || null,
      amount: parseFloat(data.amount) || 0,
      payment_method: data.payment_method || 'Cash',
      payment_date: data.payment_date || new Date().toISOString().slice(0, 10),
      period_start: data.period_start || null,
      period_end: data.period_end || null,
      remaining_balance: parseFloat(data.remaining_balance != null ? data.remaining_balance : (data.debt_amount || 0)) || 0,
      observations: data.observations || null,
      generated_by: userId || null,
      status: 'issued',
    });

    logger.info('📄 Reçu personnalisé créé', { receipt_number: receiptNumber });
    return this.getById(receipt.id);
  }
}

module.exports = new ReceiptService();
