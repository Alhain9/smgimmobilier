const { Property, Apartment } = require('../models');

class PropertyService {
  getAll() {
    return Property.findAll({ include: [{ model: Apartment, as: 'apartments' }], order: [['created_at', 'DESC']] });
  }
  async getById(id) {
    const p = await Property.findByPk(id, { include: [{ model: Apartment, as: 'apartments' }] });
    if (!p) throw Object.assign(new Error('Immeuble introuvable'), { status: 404 });
    return p;
  }
  // Préfixe de numérotation par type de logement
  _prefix(type) {
    const map = {
      appartement: 'APP', studio: 'STU', chambre: 'CHB', duplex: 'DUP', villa: 'VIL',
      boutique: 'BTQ', bureau: 'BUR', magasin: 'MAG', espace_commercial: 'ECO',
    };
    return map[type] || String(type || 'LOG').slice(0, 3).toUpperCase();
  }

  // Crée l'immeuble et, si une composition est fournie, génère automatiquement les logements
  // composition: [{ apartment_type, count, rent_amount }]
  async create(data) {
    const { composition, ...propData } = data;
    const property = await Property.create(propData);

    if (Array.isArray(composition) && composition.length) {
      const rows = [];
      let total = 0;
      composition.forEach((c) => {
        const type = c.apartment_type || c.type;
        let count = parseInt(c.count != null ? c.count : c.nombre, 10) || 0;
        const rent = parseFloat(c.rent_amount != null ? c.rent_amount : c.loyer) || 0;
        if (!type || count <= 0) return;
        if (count > 200) count = 200; // garde-fou
        const prefix = this._prefix(type);
        for (let i = 1; i <= count && total < 500; i++, total++) {
          rows.push({
            property_id: property.id,
            apartment_number: `${prefix}-${String(i).padStart(2, '0')}`,
            apartment_type: type, rent_amount: rent, status: 'free',
          });
        }
      });
      if (rows.length) await Apartment.bulkCreate(rows);
    }
    return this.getById(property.id);
  }
  async update(id, data) {
    const p = await Property.findByPk(id);
    if (!p) throw Object.assign(new Error('Immeuble introuvable'), { status: 404 });
    await p.update(data); return this.getById(id);
  }
  async remove(id) {
    const p = await Property.findByPk(id);
    if (!p) throw Object.assign(new Error('Immeuble introuvable'), { status: 404 });
    await p.destroy(); return true;
  }
}
module.exports = new PropertyService();
