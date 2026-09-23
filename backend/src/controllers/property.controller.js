const service = require('../services/property.service');
const importService = require('../services/import.service');
const { createCrudController } = require('./crud.factory');
const { success } = require('../utils/response');
const fs = require('fs');

const controller = createCrudController(service, {
  created: 'Immeuble créé(e)', updated: 'Immeuble mis(e) à jour', deleted: 'Immeuble supprimé(e)',
});

controller.getAll = async (req, res, next) => {
  try {
    const data = await service.getAll(req.query, req.ownerPropertyIds, req.assignedPropertyIds);
    return success(res, data);
  } catch (err) { next(err); }
};

controller.getById = async (req, res, next) => {
  try {
    if (req.ownerPropertyIds && !req.ownerPropertyIds.includes(Number(req.params.id))) {
      throw Object.assign(new Error('Accès non autorisé à cet immeuble'), { status: 403 });
    }
    const data = await service.getById(req.params.id);
    return success(res, data);
  } catch (err) { next(err); }
};

controller.importBuilding = async (req, res, next) => {
  try {
    if (!req.file) {
      throw Object.assign(new Error('Fichier Excel manquant'), { status: 400 });
    }

    const { address, city, district } = req.body;
    const stats = await importService.importBuildingSituation(req.file.path, {
      address,
      city,
      district,
    });

    // Nettoyage du fichier temporaire après import réussi
    try {
      fs.unlinkSync(req.file.path);
    } catch (_) {}

    return success(res, stats, 'Fichier situation Excel importé avec succès');
  } catch (err) {
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
    }
    next(err);
  }
};

controller.uploadLeaseTemplate = async (req, res, next) => {
  try {
    if (!req.file) throw Object.assign(new Error('Fichier modèle de bail manquant (Word .docx ou PDF)'), { status: 400 });
    const property = await service.getById(req.params.id);
    if (!property) throw Object.assign(new Error('Immeuble introuvable'), { status: 404 });
    const templatePath = `/uploads/contracts/${req.file.filename}`;
    await property.update({ lease_template_file: templatePath });
    return success(res, { lease_template_file: templatePath }, 'Modèle de contrat de bail de l\'immeuble enregistré avec succès');
  } catch (err) { next(err); }
};

controller.downloadSampleDocxTemplate = async (req, res, next) => {
  try {
    const path = require('path');
    const defaultPath = path.join(__dirname, '..', 'templates', 'modele_contrat_bail_smg.docx');
    if (!fs.existsSync(defaultPath)) {
      throw Object.assign(new Error('Modèle Word exemple introuvable'), { status: 404 });
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="Modele_Officiel_Contrat_Bail_SMG.docx"');
    return res.sendFile(defaultPath);
  } catch (err) { next(err); }
};

controller.deleteLeaseTemplate = async (req, res, next) => {
  try {
    const property = await service.getById(req.params.id);
    if (!property) throw Object.assign(new Error('Immeuble introuvable'), { status: 404 });
    await property.update({ lease_template_file: null });
    return success(res, null, 'Modèle de contrat Word retiré de l\'immeuble');
  } catch (err) { next(err); }
};

module.exports = controller;
