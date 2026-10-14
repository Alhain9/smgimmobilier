const service = require('../services/apartment.service');
const { createCrudController } = require('./crud.factory');
const { success } = require('../utils/response');

const controller = createCrudController(service, {
  created: 'Appartement créé(e)', updated: 'Appartement mis(e) à jour', deleted: 'Appartement supprimé(e)',
});

controller.getAll = async (req, res, next) => {
  try {
    const data = await service.getAll(req.query, req.ownerPropertyIds, req.assignedPropertyIds);
    return success(res, data);
  } catch (err) { next(err); }
};

controller.getById = async (req, res, next) => {
  try {
    const data = await service.getById(req.params.id);
    if (req.ownerPropertyIds && !req.ownerPropertyIds.includes(Number(data.property_id))) {
      throw Object.assign(new Error('Accès non autorisé à ce logement'), { status: 403 });
    }
    return success(res, data);
  } catch (err) { next(err); }
};

controller.create = async (req, res, next) => {
  try {
    const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);
    const propId = Number(req.body.property_id);
    if (!isAdminOrManager && (!req.assignedPropertyIds || !req.assignedPropertyIds.includes(propId))) {
      throw Object.assign(new Error("Action non autorisée : vous ne pouvez créer des logements que dans les immeubles qui vous sont assignés"), { status: 403 });
    }
    const data = await service.create(req.body);
    return success(res, data, 'Logement créé avec succès', 201);
  } catch (err) { next(err); }
};

controller.update = async (req, res, next) => {
  try {
    const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);
    const apt = await service.getById(req.params.id);
    if (!isAdminOrManager && (!req.assignedPropertyIds || !req.assignedPropertyIds.includes(Number(apt.property_id)))) {
      throw Object.assign(new Error("Action non autorisée : vous ne pouvez modifier que les logements des immeubles qui vous sont assignés"), { status: 403 });
    }
    const data = await service.update(req.params.id, req.body);
    return success(res, data, 'Logement mis à jour');
  } catch (err) { next(err); }
};

controller.remove = async (req, res, next) => {
  try {
    const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);
    const apt = await service.getById(req.params.id);
    if (!isAdminOrManager && (!req.assignedPropertyIds || !req.assignedPropertyIds.includes(Number(apt.property_id)))) {
      throw Object.assign(new Error("Action non autorisée : vous ne pouvez supprimer que les logements des immeubles qui vous sont assignés"), { status: 403 });
    }
    await service.remove(req.params.id);
    return success(res, null, 'Logement supprimé');
  } catch (err) { next(err); }
};

controller.bulkRemove = async (req, res, next) => {
  try {
    const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);
    const ids = req.body.ids || [];
    let deletedCount = 0;
    for (const id of ids) {
      try {
        const apt = await service.getById(id);
        if (isAdminOrManager || (req.assignedPropertyIds && req.assignedPropertyIds.includes(Number(apt.property_id)))) {
          await service.remove(id);
          deletedCount++;
        }
      } catch (_) {}
    }
    return success(res, { count: deletedCount }, `${deletedCount} logement(s) supprimé(s)`);
  } catch (err) { next(err); }
};

controller.vacate = async (req, res, next) => {
  try {
    const isAdminOrManager = req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role);
    const apt = await service.getById(req.params.id);
    if (!isAdminOrManager && (!req.assignedPropertyIds || !req.assignedPropertyIds.includes(Number(apt.property_id)))) {
      throw Object.assign(new Error("Action non autorisée : vous ne pouvez libérer que les logements des immeubles qui vous sont assignés"), { status: 403 });
    }
    const data = await service.vacate(req.params.id, req.body);
    return success(res, data, 'Logement libéré avec succès');
  } catch (err) { next(err); }
};

module.exports = controller;
