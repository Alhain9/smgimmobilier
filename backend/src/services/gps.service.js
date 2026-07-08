// ============ Service GPS Tracking ============
const { GPSTracking, User } = require('../models');
const { Op } = require('sequelize');
const { emit } = require('../config/socket');

class GpsService {
  async trackPosition(userId, latitude, longitude) {
    const log = await GPSTracking.create({
      user_id: userId,
      latitude,
      longitude
    });

    const data = {
      userId,
      latitude,
      longitude,
      recorded_at: log.recorded_at
    };

    // Émettre en temps réel pour la carte d'administration
    try {
      emit('gps:position', data, { role: ['super_admin', 'manager', 'dir_technique'] });
    } catch (_) {}

    return log;
  }

  async getLatestPositions() {
    // Récupérer la dernière position enregistrée de chaque utilisateur dans les dernières 24 heures
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Obtenir tous les enregistrements récents
    const positions = await GPSTracking.findAll({
      where: {
        recorded_at: { [Op.gte]: oneDayAgo }
      },
      include: [{ model: User, as: 'user', attributes: ['id', 'full_name'] }],
      order: [['recorded_at', 'DESC']]
    });

    // Conserver uniquement la plus récente pour chaque utilisateur
    const latest = {};
    positions.forEach(p => {
      if (!latest[p.user_id]) {
        latest[p.user_id] = p;
      }
    });

    return Object.values(latest);
  }

  async getUserHistory(userId, start, end) {
    const where = { user_id: userId };
    if (start && end) {
      where.recorded_at = { [Op.between]: [start, end] };
    }
    return GPSTracking.findAll({
      where,
      order: [['recorded_at', 'ASC']]
    });
  }
}

module.exports = new GpsService();
