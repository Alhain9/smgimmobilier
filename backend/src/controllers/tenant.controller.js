const tenantService = require('../services/tenant.service');
const { createCrudController } = require('./crud.factory');
const { success } = require('../utils/response');

const base = createCrudController(tenantService, {
  created: 'Locataire créé', updated: 'Locataire mis à jour', deleted: 'Locataire supprimé',
});

module.exports = {
  ...base,
  getAll: async (req, res, next) => {
    try {
      const data = await tenantService.getAll(req.query, req.ownerPropertyIds, req.assignedPropertyIds);
      return success(res, data);
    } catch (err) { next(err); }
  },
  getById: async (req, res, next) => {
    try {
      const data = await tenantService.getById(req.params.id);
      if (req.ownerPropertyIds) {
        const propId = data.apartment && data.apartment.property ? data.apartment.property.id : (data.apartment ? data.apartment.property_id : null);
        if (propId && !req.ownerPropertyIds.includes(Number(propId))) {
          throw Object.assign(new Error('Accès non autorisé à ce locataire'), { status: 403 });
        }
      }
      return success(res, data);
    } catch (err) { next(err); }
  },
  // Profil du locataire connecté
  myProfile: async (req, res, next) => {
    try {
      const data = await tenantService.getByUserId(req.user.id);
      return success(res, data);
    } catch (err) { next(err); }
  },
  downloadDocx: async (req, res, next) => {
    try {
      const { Lease, Tenant } = require('../models');
      const docxService = require('../services/docx-contract.service');
      const tenant = await Tenant.findByPk(req.params.id, {
        include: [{ model: Lease, as: 'leases' }]
      });
      if (!tenant) throw Object.assign(new Error('Locataire introuvable'), { status: 404 });
      const activeLease = (tenant.leases || []).find((l) => l.status === 'active') || (tenant.leases && tenant.leases[0]);
      if (!activeLease) {
        throw Object.assign(new Error('Aucun contrat de bail associé à ce locataire. Veuillez d\'abord lui affecter un logement.'), { status: 400 });
      }
      const { filename, buffer } = await docxService.generateLeaseDocx(activeLease.id);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (err) { next(err); }
  },
  vacate: async (req, res, next) => {
    try {
      const data = await tenantService.vacate(req.params.id, req.body);
      return success(res, data, 'Départ du locataire enregistré et logement libéré avec succès');
    } catch (err) { next(err); }
  },
  settleDebt: async (req, res, next) => {
    try {
      const data = await tenantService.settleDebt(req.params.id, req.body, req.user);
      return success(res, data, 'Règlement de dette enregistré avec succès');
    } catch (err) { next(err); }
  },
};
