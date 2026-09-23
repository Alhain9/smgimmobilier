// ============ Service Équipements & Vue Croisée Disponibilité — SMG IMMOBILIER ============
const { Equipment, EquipmentAllocation, User, Worksite, Maintenance, StockItem } = require('../models');

const num = (v) => parseFloat(v) || 0;

class EquipmentService {
  _inc() {
    return [
      {
        model: EquipmentAllocation, as: 'allocations',
        where: { status: 'active' },
        required: false,
        include: [
          { model: User, as: 'technician', attributes: ['id', 'full_name', 'phone'] },
          { model: Worksite, as: 'worksite', attributes: ['id', 'title'] },
          { model: Maintenance, as: 'maintenance', attributes: ['id', 'title'] },
        ],
      },
    ];
  }

  async getAll() {
    return Equipment.findAll({
      include: this._inc(),
      order: [['equipment_name', 'ASC']],
    });
  }

  async getById(id) {
    const e = await Equipment.findByPk(id, {
      include: [
        {
          model: EquipmentAllocation, as: 'allocations',
          include: [
            { model: User, as: 'technician', attributes: ['id', 'full_name', 'phone'] },
            { model: Worksite, as: 'worksite', attributes: ['id', 'title'] },
            { model: Maintenance, as: 'maintenance', attributes: ['id', 'title'] },
          ],
        },
      ],
    });
    if (!e) throw Object.assign(new Error('Équipement introuvable'), { status: 404 });
    return e;
  }

  create(data) {
    return Equipment.create(data);
  }

  async update(id, data) {
    const e = await Equipment.findByPk(id);
    if (!e) throw Object.assign(new Error('Équipement introuvable'), { status: 404 });
    await e.update(data);
    return e;
  }

  async remove(id) {
    const e = await Equipment.findByPk(id);
    if (!e) throw Object.assign(new Error('Équipement introuvable'), { status: 404 });
    await e.destroy();
    return true;
  }

  // ===== Affecter un équipement (à un technicien, un chantier ou une intervention) =====
  async allocate(equipmentId, data, userId) {
    const equip = await Equipment.findByPk(equipmentId);
    if (!equip) throw Object.assign(new Error('Équipement introuvable'), { status: 404 });

    const activeAlloc = await EquipmentAllocation.count({
      where: { equipment_id: equipmentId, status: 'active' },
    });

    if (activeAlloc >= equip.quantity) {
      throw Object.assign(new Error(`Tous les exemplaires de « ${equip.equipment_name} » sont actuellement affectés.`), { status: 400 });
    }

    const allocation = await EquipmentAllocation.create({
      equipment_id: equipmentId,
      assigned_to_user_id: data.assigned_to_user_id || userId,
      worksite_id: data.worksite_id || null,
      maintenance_id: data.maintenance_id || null,
      assigned_at: data.assigned_at || new Date(),
      expected_return_at: data.expected_return_at || null,
      condition_on_assignment: data.condition_on_assignment || 'Bon état',
      status: 'active',
    });

    // Mettre à jour le statut de l'équipement
    const newActiveCount = activeAlloc + 1;
    if (newActiveCount >= equip.quantity) {
      await equip.update({ status: 'in_use' });
    }

    return allocation;
  }

  // ===== Retourner un équipement affecté =====
  async returnEquipment(allocationId, returnData = {}) {
    const alloc = await EquipmentAllocation.findByPk(allocationId, {
      include: [{ model: Equipment, as: 'equipment' }],
    });
    if (!alloc) throw Object.assign(new Error('Affectation introuvable'), { status: 404 });

    await alloc.update({
      status: 'returned',
      returned_at: new Date(),
      condition_on_return: returnData.condition_on_return || 'Bon état',
    });

    const activeCount = await EquipmentAllocation.count({
      where: { equipment_id: alloc.equipment_id, status: 'active' },
    });

    if (activeCount < alloc.equipment.quantity) {
      await alloc.equipment.update({ status: 'available' });
    }

    return alloc;
  }

  // ===== VUE CROISÉE DIRECTEUR TECHNIQUE (Disponibilité temps réel) =====
  // Répond instantanément à : « Avons-nous le matériel et les équipements nécessaires pour cette intervention / ce chantier ? »
  async checkCrossAvailability(requiredItems = [], requiredEquipmentIds = []) {
    const missingMaterials = [];
    const missingEquipments = [];

    // 1. Vérification des consommables en stock
    for (const req of requiredItems) {
      const item = await StockItem.findByPk(req.stock_item_id || req.id);
      if (!item) {
        missingMaterials.push({ id: req.stock_item_id || req.id, name: 'Article inconnu', required: req.quantity, available: 0 });
      } else {
        const available = num(item.quantity);
        const needed = num(req.quantity);
        if (available < needed) {
          missingMaterials.push({
            id: item.id,
            item_code: item.item_code,
            name: item.name,
            unit: item.unit,
            required: needed,
            available: available,
            shortage: needed - available,
          });
        }
      }
    }

    // 2. Vérification des équipements & outillages
    for (const eqId of requiredEquipmentIds) {
      const equip = await Equipment.findByPk(eqId, {
        include: [{ model: EquipmentAllocation, as: 'allocations', where: { status: 'active' }, required: false }],
      });
      if (!equip) {
        missingEquipments.push({ id: eqId, name: 'Équipement inconnu', status: 'missing' });
      } else {
        const activeAllocations = (equip.allocations || []).length;
        const availableQty = Math.max(0, equip.quantity - activeAllocations);
        if (availableQty <= 0 || equip.status === 'maintenance') {
          missingEquipments.push({
            id: equip.id,
            name: equip.equipment_name,
            total_qty: equip.quantity,
            available_qty: availableQty,
            status: equip.status,
            assigned_to: (equip.allocations || []).map((a) => a.assigned_to_user_id),
          });
        }
      }
    }

    const canProceed = missingMaterials.length === 0 && missingEquipments.length === 0;

    return {
      can_proceed: canProceed,
      status: canProceed ? 'READY' : 'SHORTAGE',
      message: canProceed
        ? '✅ Tout le matériel et les équipements requis sont disponibles en stock.'
        : '⚠️ Manque de matériel ou d\'équipement pour démarrer l\'opération.',
      missing_materials: missingMaterials,
      missing_equipments: missingEquipments,
    };
  }
}

module.exports = new EquipmentService();
