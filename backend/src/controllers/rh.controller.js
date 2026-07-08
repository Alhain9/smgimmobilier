// ============ Contrôleur de Gestion RH ============
const rhService = require('../services/rh.service');
const { success } = require('../utils/response');
const {
  serviceDTO, equipeDTO, planningDTO, pointageDTO, congeDTO,
  listDTO, paginatedDTO
} = require('../dto');

// ================= SERVICES =================
exports.listServices = async (req, res, next) => {
  try {
    const list = await rhService.listServices();
    return success(res, listDTO(list, serviceDTO));
  } catch (err) { next(err); }
};

exports.getService = async (req, res, next) => {
  try {
    const s = await rhService.getService(req.params.id);
    return success(res, serviceDTO(s));
  } catch (err) { next(err); }
};

exports.createService = async (req, res, next) => {
  try {
    const s = await rhService.createService(req.body);
    res.locals.audit = { action: 'CREATE', entity: 'services', entityId: s.id, newValues: s.toJSON() };
    return success(res, serviceDTO(s), 'Service créé', 201);
  } catch (err) { next(err); }
};

exports.updateService = async (req, res, next) => {
  try {
    const s = await rhService.updateService(req.params.id, req.body);
    res.locals.audit = { action: 'UPDATE', entity: 'services', entityId: s.id, newValues: s.toJSON() };
    return success(res, serviceDTO(s), 'Service mis à jour');
  } catch (err) { next(err); }
};

exports.deleteService = async (req, res, next) => {
  try {
    await rhService.deleteService(req.params.id);
    res.locals.audit = { action: 'DELETE', entity: 'services', entityId: req.params.id };
    return success(res, null, 'Service supprimé');
  } catch (err) { next(err); }
};

// ================= EQUIPES =================
exports.listEquipes = async (req, res, next) => {
  try {
    const list = await rhService.listEquipes();
    return success(res, listDTO(list, equipeDTO));
  } catch (err) { next(err); }
};

exports.getEquipe = async (req, res, next) => {
  try {
    const eq = await rhService.getEquipe(req.params.id);
    return success(res, equipeDTO(eq));
  } catch (err) { next(err); }
};

exports.createEquipe = async (req, res, next) => {
  try {
    const eq = await rhService.createEquipe(req.body);
    res.locals.audit = { action: 'CREATE', entity: 'equipes', entityId: eq.id, newValues: eq.toJSON() };
    return success(res, equipeDTO(eq), 'Équipe créée', 201);
  } catch (err) { next(err); }
};

exports.updateEquipe = async (req, res, next) => {
  try {
    const eq = await rhService.updateEquipe(req.params.id, req.body);
    res.locals.audit = { action: 'UPDATE', entity: 'equipes', entityId: eq.id, newValues: eq.toJSON() };
    return success(res, equipeDTO(eq), 'Équipe mise à jour');
  } catch (err) { next(err); }
};

exports.deleteEquipe = async (req, res, next) => {
  try {
    await rhService.deleteEquipe(req.params.id);
    res.locals.audit = { action: 'DELETE', entity: 'equipes', entityId: req.params.id };
    return success(res, null, 'Équipe supprimée');
  } catch (err) { next(err); }
};

// ================= PLANNINGS =================
exports.listPlannings = async (req, res, next) => {
  try {
    const list = await rhService.listPlannings(req.query);
    return success(res, listDTO(list, planningDTO));
  } catch (err) { next(err); }
};

exports.createPlanning = async (req, res, next) => {
  try {
    const p = await rhService.createPlanning(req.body, req.user.id);
    res.locals.audit = { action: 'CREATE', entity: 'plannings', entityId: p.id, newValues: p.toJSON() };
    return success(res, planningDTO(p), 'Planning créé', 201);
  } catch (err) { next(err); }
};

exports.updatePlanning = async (req, res, next) => {
  try {
    const p = await rhService.updatePlanning(req.params.id, req.body);
    res.locals.audit = { action: 'UPDATE', entity: 'plannings', entityId: p.id, newValues: p.toJSON() };
    return success(res, planningDTO(p), 'Planning mis à jour');
  } catch (err) { next(err); }
};

exports.deletePlanning = async (req, res, next) => {
  try {
    await rhService.deletePlanning(req.params.id);
    res.locals.audit = { action: 'DELETE', entity: 'plannings', entityId: req.params.id };
    return success(res, null, 'Planning supprimé');
  } catch (err) { next(err); }
};

// ================= POINTAGES =================
exports.listPointages = async (req, res, next) => {
  try {
    const list = await rhService.listPointages(req.query);
    return success(res, listDTO(list, pointageDTO));
  } catch (err) { next(err); }
};

exports.pointageEntree = async (req, res, next) => {
  try {
    const pt = await rhService.pointageEntree(req.user.id, req.body.notes);
    return success(res, pointageDTO(pt), 'Pointage entrée enregistré');
  } catch (err) { next(err); }
};

exports.pointageSortie = async (req, res, next) => {
  try {
    const pt = await rhService.pointageSortie(req.user.id, req.body.notes);
    return success(res, pointageDTO(pt), 'Pointage sortie enregistré');
  } catch (err) { next(err); }
};

// ================= CONGES =================
exports.listConges = async (req, res, next) => {
  try {
    const list = await rhService.listConges(req.query);
    return success(res, listDTO(list, congeDTO));
  } catch (err) { next(err); }
};

exports.createConge = async (req, res, next) => {
  try {
    const c = await rhService.createConge({ ...req.body, user_id: req.user.id });
    res.locals.audit = { action: 'CREATE', entity: 'conges', entityId: c.id, newValues: c.toJSON() };
    return success(res, congeDTO(c), 'Demande de congé enregistrée', 201);
  } catch (err) { next(err); }
};

exports.updateConge = async (req, res, next) => {
  try {
    const c = await rhService.updateConge(req.params.id, req.body, req.user.id);
    res.locals.audit = { action: 'UPDATE', entity: 'conges', entityId: c.id, newValues: c.toJSON() };
    return success(res, congeDTO(c), 'Congé mis à jour');
  } catch (err) { next(err); }
};

exports.deleteConge = async (req, res, next) => {
  try {
    await rhService.deleteConge(req.params.id);
    res.locals.audit = { action: 'DELETE', entity: 'conges', entityId: req.params.id };
    return success(res, null, 'Congé supprimé');
  } catch (err) { next(err); }
};
