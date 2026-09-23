// ============ Middleware Bailleur — Filtrage automatique par propriétaire ============
// ============ + Injection des immeubles affectés aux gestionnaires/comptables ============
const { Property, ManagerProperty } = require('../models');

/**
 * Middleware qui :
 * - Pour les `bailleur` : injecte la liste des IDs de propriétés qu'ils possèdent dans `req.ownerPropertyIds`
 * - Pour les `gestionnaire` et `comptable` : injecte leurs immeubles assignés dans `req.assignedPropertyIds`
 * - Pour les autres rôles : ces champs restent `null` (= pas de filtrage)
 */
const injectOwnerProperties = async (req, res, next) => {
  try {
    if (req.user && req.user.is_bailleur) {
      const properties = await Property.findAll({
        where: { owner_id: req.user.id },
        attributes: ['id'],
        raw: true,
      });
      req.ownerPropertyIds = properties.map((p) => p.id);
      req.assignedPropertyIds = null;
    } else if (req.user && (req.user.role === 'gestionnaire' || req.user.role === 'comptable')) {
      // Injecter les immeubles affectés au gestionnaire/comptable
      const links = await ManagerProperty.findAll({
        where: { user_id: req.user.id },
        attributes: ['property_id'],
        raw: true,
      });
      req.assignedPropertyIds = links.map((l) => l.property_id);
      req.ownerPropertyIds = null;
    } else {
      req.ownerPropertyIds = null;
      req.assignedPropertyIds = null;
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { injectOwnerProperties };
