const { Apartment, Property, Tenant, User, Lease, Payment, Maintenance, UtilityBill } = require('../models');
const { Op } = require('sequelize');

class ApartmentService {
  async getAll(filters = {}, ownerPropertyIds = null, assignedPropertyIds = null) {
    const where = {};
    if (filters.property_id) where.property_id = filters.property_id;
    if (filters.status) where.status = filters.status;
    if (Array.isArray(ownerPropertyIds)) {
      where.property_id = { [Op.in]: ownerPropertyIds };
    }
    const all = await Apartment.findAll({
      where,
      include: [
        { model: Property, as: 'property', attributes: ['id', 'property_name', 'city'] },
        { model: Tenant, as: 'tenants', where: { status: 'active' }, required: false, include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }] },
      ],
      order: [['created_at', 'DESC']],
    });

    if (Array.isArray(assignedPropertyIds) && assignedPropertyIds.length > 0) {
      const assigned = all.filter((a) => assignedPropertyIds.includes(Number(a.property_id)));
      const others = all.filter((a) => !assignedPropertyIds.includes(Number(a.property_id)));
      assigned.forEach((a) => { a.dataValues.is_assigned = true; });
      others.forEach((a) => { a.dataValues.is_assigned = false; });
      return [...assigned, ...others];
    }

    return all;
  }
  async getById(id) {
    const a = await Apartment.findByPk(id, {
      include: [
        { model: Property, as: 'property' },
        { model: Tenant, as: 'tenants', include: [{ model: User, as: 'user' }] },
      ],
    });
    if (!a) throw Object.assign(new Error('Appartement introuvable'), { status: 404 });
    return a;
  }
  create(data) { return Apartment.create(data); }
  async update(id, data) {
    const a = await Apartment.findByPk(id);
    if (!a) throw Object.assign(new Error('Appartement introuvable'), { status: 404 });
    await a.update(data); return this.getById(id);
  }
  async vacate(id, data = {}) {
    const apt = await Apartment.findByPk(id, {
      include: [
        { model: Tenant, as: 'tenants', where: { status: 'active' }, required: false, include: [{ model: User, as: 'user' }] },
        { model: Lease, as: 'leases', where: { status: 'active' }, required: false },
      ],
    });
    if (!apt) throw Object.assign(new Error('Appartement introuvable'), { status: 404 });

    const departureDate = data.departure_date || new Date().toISOString().slice(0, 10);
    const departureReason = data.departure_reason || 'Départ / Fin de bail';
    const debtAcknowledged = parseFloat(data.debt_acknowledged) || 0;
    const debtDueDate = data.debt_due_date || null;
    const notes = data.observations ? String(data.observations).trim() : '';

    await apt.update({ status: 'free' });

    const leases = apt.leases || [];
    for (const l of leases) {
      await l.update({ status: 'terminated', end_date: departureDate });
    }

    const tenants = apt.tenants || [];
    for (const t of tenants) {
      let obs = t.observations || '';
      const debtText = debtAcknowledged > 0 
        ? ` Reconnaissance de dette signée : ${Math.round(debtAcknowledged).toLocaleString('fr-FR')} FCFA${debtDueDate ? ` (Échéance: ${debtDueDate})` : ''}.` 
        : '';
      const departureLog = `[Sortie le ${departureDate} - Motif : ${departureReason}]${debtText}${notes ? ` Note: ${notes}` : ''}`;
      obs = obs ? `${obs}\n${departureLog}` : departureLog;

      await t.update({
        status: 'inactive',
        end_date: departureDate,
        departure_reason: departureReason,
        debt_acknowledged: debtAcknowledged,
        debt_due_date: debtDueDate,
        is_debt_settled: debtAcknowledged <= 0,
        observations: obs,
      });
    }

    return this.getById(id);
  }
  async remove(id) {
    const a = await Apartment.findByPk(id);
    if (!a) throw Object.assign(new Error('Appartement introuvable'), { status: 404 });

    await Lease.destroy({ where: { apartment_id: id } });
    await Payment.destroy({ where: { apartment_id: id } });
    await Maintenance.destroy({ where: { apartment_id: id } });
    await UtilityBill.destroy({ where: { apartment_id: id } });
    await Tenant.destroy({ where: { apartment_id: id } });
    await a.destroy();
    return true;
  }

  async bulkRemove(ids) {
    if (!Array.isArray(ids) || !ids.length) return 0;
    let count = 0;
    for (const id of ids) {
      try {
        await this.remove(id);
        count++;
      } catch (_) {}
    }
    return count;
  }
}
module.exports = new ApartmentService();
