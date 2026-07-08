const { Equipment } = require('../models');

class EquipmentService {
  getAll() { return Equipment.findAll({ order: [['equipment_name', 'ASC']] }); }
  async getById(id) {
    const e = await Equipment.findByPk(id);
    if (!e) throw Object.assign(new Error('Équipement introuvable'), { status: 404 });
    return e;
  }
  create(data) { return Equipment.create(data); }
  async update(id, data) {
    const e = await Equipment.findByPk(id);
    if (!e) throw Object.assign(new Error('Équipement introuvable'), { status: 404 });
    await e.update(data); return e;
  }
  async remove(id) {
    const e = await Equipment.findByPk(id);
    if (!e) throw Object.assign(new Error('Équipement introuvable'), { status: 404 });
    await e.destroy(); return true;
  }
}
module.exports = new EquipmentService();
