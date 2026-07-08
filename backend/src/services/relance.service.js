const { User, Role } = require('../models');
const { Op } = require('sequelize');
const notificationService = require('./notification.service');

// Relance de paiement minimale : crée une notification au locataire et trace l'auteur.
class RelanceService {
  async create(data, currentUser) {
    const nom = String(data.nom_locataire || data.nom || '').trim();
    if (!nom) throw Object.assign(new Error('Nom du locataire requis'), { status: 400 });

    // On cible uniquement les comptes locataires
    const where = { full_name: { [Op.like]: `%${nom}%` } };
    const role = await Role.findOne({ where: { role_name: Role.codeToName('locataire') } });
    if (role) where.role_id = role.id;

    const users = await User.findAll({ where, attributes: ['id', 'full_name'] });
    if (!users.length) throw Object.assign(new Error(`Aucun locataire trouvé pour « ${nom} »`), { status: 404 });
    if (users.length > 1) {
      throw Object.assign(new Error(`Plusieurs locataires correspondent à « ${nom} ». Précisez le nom complet.`), { status: 400 });
    }

    const tenant = users[0];
    await notificationService.create({
      user_id: tenant.id,
      title: 'Rappel de paiement de loyer',
      message: `Bonjour ${tenant.full_name}, ceci est un rappel concernant le règlement de votre loyer. `
        + `Merci de régulariser dès que possible. (Relance déclenchée par ${currentUser.full_name || 'le service'}.)`,
    });

    return { statut: 'envoyée', locataire: tenant.full_name, canal: 'notification', declenchee_par: currentUser.id };
  }
}
module.exports = new RelanceService();
