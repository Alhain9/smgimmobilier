// ============ Repository générique CRUD avancé ============
// Pagination, tri, recherche texte, soft delete, count
const { Op } = require('sequelize');

class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  // ---------- Liste simple (sans pagination) ----------
  findAll(options = {}) {
    return this.model.findAll({ order: [['created_at', 'DESC']], ...options });
  }

  // ---------- Liste paginée avec tri + recherche ----------
  async findPaginated({ page = 1, limit = 20, sortBy = 'created_at', order = 'DESC', where = {}, include = [], search, searchFields = [] } = {}) {
    const offset = (page - 1) * limit;

    // Recherche texte : construit un OR sur les champs spécifiés
    if (search && searchFields.length > 0) {
      const orClauses = searchFields.map((field) => ({
        [field]: { [Op.like]: `%${search}%` },
      }));
      where = { ...where, [Op.or]: orClauses };
    }

    const { rows, count } = await this.model.findAndCountAll({
      where,
      include,
      order: [[sortBy, order.toUpperCase()]],
      limit: Number(limit),
      offset,
      distinct: true, // pour les include avec hasMany
    });

    return {
      data: rows,
      count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(count / limit),
    };
  }

  findById(id, options = {}) {
    return this.model.findByPk(id, options);
  }

  findOne(where, options = {}) {
    return this.model.findOne({ where, ...options });
  }

  create(data) {
    return this.model.create(data);
  }

  bulkCreate(data, options = {}) {
    return this.model.bulkCreate(data, options);
  }

  async update(id, data) {
    const record = await this.model.findByPk(id);
    if (!record) return null;
    return record.update(data);
  }

  // ---------- Hard delete ----------
  async delete(id) {
    const record = await this.model.findByPk(id);
    if (!record) return null;
    await record.destroy();
    return record;
  }

  // ---------- Soft delete (met à jour deleted_at) ----------
  async softDelete(id) {
    const record = await this.model.findByPk(id);
    if (!record) return null;
    // Sequelize paranoid : appeler destroy() si paranoid activé
    if (this.model.options.paranoid) {
      await record.destroy();
    } else {
      await record.update({ deleted_at: new Date() });
    }
    return record;
  }

  // ---------- Restauration (soft delete) ----------
  async restore(id) {
    if (this.model.options.paranoid) {
      const record = await this.model.findByPk(id, { paranoid: false });
      if (!record) return null;
      await record.restore();
      return record;
    }
    return this.update(id, { deleted_at: null });
  }

  count(where = {}) {
    return this.model.count({ where });
  }

  sum(field, where = {}) {
    return this.model.sum(field, { where });
  }

  // ---------- Upsert ----------
  async upsert(data, options = {}) {
    return this.model.upsert(data, options);
  }

  // ---------- Existence ----------
  async exists(where) {
    const count = await this.model.count({ where });
    return count > 0;
  }
}

module.exports = BaseRepository;
