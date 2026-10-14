const leaseService = require('../services/lease.service');
const { createCrudController } = require('./crud.factory');
const { success, error } = require('../utils/response');

const base = createCrudController(leaseService, {
  created: 'Contrat créé', updated: 'Contrat mis à jour', deleted: 'Contrat supprimé',
});

module.exports = {
  ...base,
  getAll: async (req, res, next) => {
    try {
      const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);
      let filters = { ...req.query };

      if (req.user && !isAdminOrManager && !req.user.is_bailleur) {
        if (req.assignedPropertyIds && req.assignedPropertyIds.length > 0) {
          filters.ownerPropertyIds = req.assignedPropertyIds;
        }
      } else if (req.ownerPropertyIds) {
        filters.ownerPropertyIds = req.ownerPropertyIds;
      }

      const data = await leaseService.getAll(filters);
      const assignedSet = new Set((req.assignedPropertyIds || []).map(Number));
      const shaped = data.map((l) => {
        const item = typeof l.toJSON === 'function' ? l.toJSON() : { ...l };
        const propId = item.apartment && item.apartment.property ? Number(item.apartment.property.id) : (item.apartment ? Number(item.apartment.property_id) : null);
        item.is_assigned = isAdminOrManager || (propId ? assignedSet.has(propId) : (!req.assignedPropertyIds || req.assignedPropertyIds.length === 0));
        return item;
      });

      return success(res, shaped);
    } catch (err) { next(err); }
  },
  create: async (req, res, next) => {
    try {
      const { Apartment } = require('../models');
      const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);
      if (!isAdminOrManager && req.body.apartment_id) {
        const apt = await Apartment.findByPk(req.body.apartment_id);
        if (apt && req.assignedPropertyIds && req.assignedPropertyIds.length > 0) {
          if (!req.assignedPropertyIds.includes(Number(apt.property_id))) {
            return error(res, 'Accès refusé : vous ne pouvez créer un contrat que sur vos immeubles assignés', 403);
          }
        }
      }
      const lease = await leaseService.create(req.body);
      return success(res, lease, 'Contrat créé', 201);
    } catch (err) { next(err); }
  },
  update: async (req, res, next) => {
    try {
      const { Lease, Apartment } = require('../models');
      const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);
      const existing = await Lease.findByPk(req.params.id, {
        include: [{ model: Apartment, as: 'apartment' }],
      });
      if (!existing) return error(res, 'Contrat introuvable', 404);
      if (!isAdminOrManager && req.assignedPropertyIds && req.assignedPropertyIds.length > 0) {
        const propId = existing.apartment ? Number(existing.apartment.property_id) : null;
        if (propId && !req.assignedPropertyIds.includes(propId)) {
          return error(res, 'Accès refusé : ce contrat ne concerne pas vos immeubles assignés', 403);
        }
      }
      const updated = await leaseService.update(req.params.id, req.body);
      return success(res, updated, 'Contrat mis à jour');
    } catch (err) { next(err); }
  },
  remove: async (req, res, next) => {
    try {
      const { Lease, Apartment } = require('../models');
      const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);
      const existing = await Lease.findByPk(req.params.id, {
        include: [{ model: Apartment, as: 'apartment' }],
      });
      if (!existing) return error(res, 'Contrat introuvable', 404);
      if (!isAdminOrManager && req.assignedPropertyIds && req.assignedPropertyIds.length > 0) {
        const propId = existing.apartment ? Number(existing.apartment.property_id) : null;
        if (propId && !req.assignedPropertyIds.includes(propId)) {
          return error(res, 'Accès refusé : ce contrat ne concerne pas vos immeubles assignés', 403);
        }
      }
      await leaseService.remove(req.params.id);
      return success(res, null, 'Contrat supprimé');
    } catch (err) { next(err); }
  },
  bulkRemove: async (req, res, next) => {
    try {
      const { Lease, Apartment } = require('../models');
      const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);
      const ids = req.body.ids || [];
      let deletedCount = 0;
      for (const id of ids) {
        try {
          const existing = await Lease.findByPk(id, {
            include: [{ model: Apartment, as: 'apartment' }],
          });
          if (existing) {
            const propId = existing.apartment ? Number(existing.apartment.property_id) : null;
            if (isAdminOrManager || !req.assignedPropertyIds || req.assignedPropertyIds.length === 0 || (propId && req.assignedPropertyIds.includes(propId))) {
              await leaseService.remove(id);
              deletedCount++;
            }
          }
        } catch (_) {}
      }
      return success(res, { count: deletedCount }, `${deletedCount} contrat(s) supprimé(s)`);
    } catch (err) { next(err); }
  },
  uploadContract: async (req, res, next) => {
    try {
      const { Lease, Apartment } = require('../models');
      const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);
      if (!req.file) return error(res, 'Aucun fichier reçu', 400);

      const existing = await Lease.findByPk(req.params.id, {
        include: [{ model: Apartment, as: 'apartment' }],
      });
      if (!existing) return error(res, 'Contrat introuvable', 404);
      if (!isAdminOrManager && req.assignedPropertyIds && req.assignedPropertyIds.length > 0) {
        const propId = existing.apartment ? Number(existing.apartment.property_id) : null;
        if (propId && !req.assignedPropertyIds.includes(propId)) {
          return error(res, 'Accès refusé : ce contrat ne concerne pas vos immeubles assignés', 403);
        }
      }

      const filePath = `/uploads/contracts/${req.file.filename}`;
      const lease = await leaseService.attachContract(req.params.id, filePath);
      return success(res, lease, 'Contrat PDF enregistré');
    } catch (err) { next(err); }
  },
  renew: async (req, res, next) => {
    try {
      const { Lease, Apartment } = require('../models');
      const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);
      const { end_date } = req.body;
      if (!end_date) return error(res, 'La nouvelle date d\'échéance est requise', 400);

      const existing = await Lease.findByPk(req.params.id, {
        include: [{ model: Apartment, as: 'apartment' }],
      });
      if (!existing) return error(res, 'Contrat introuvable', 404);
      if (!isAdminOrManager && req.assignedPropertyIds && req.assignedPropertyIds.length > 0) {
        const propId = existing.apartment ? Number(existing.apartment.property_id) : null;
        if (propId && !req.assignedPropertyIds.includes(propId)) {
          return error(res, 'Accès refusé : ce contrat ne concerne pas vos immeubles assignés', 403);
        }
      }

      const lease = await leaseService.renew(req.params.id, req.body);
      return success(res, lease, 'Contrat de bail renouvelé avec succès');
    } catch (err) { next(err); }
  },
  downloadDocx: async (req, res, next) => {
    try {
      const docxService = require('../services/docx-contract.service');
      const { filename, buffer } = await docxService.generateLeaseDocx(req.params.id);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (err) { next(err); }
  },
  getTags: async (req, res, next) => {
    try {
      const docxService = require('../services/docx-contract.service');
      return success(res, docxService.getAvailableTags(), 'Liste des balises disponibles');
    } catch (err) { next(err); }
  },
};
