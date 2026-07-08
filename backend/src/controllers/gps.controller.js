// ============ Contrôleur GPS Tracking ============
const gpsService = require('../services/gps.service');
const { success } = require('../utils/response');
const { gpsTrackingDTO, listDTO } = require('../dto');

exports.trackPosition = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    const log = await gpsService.trackPosition(req.user.id, latitude, longitude);
    return success(res, gpsTrackingDTO(log), 'Position enregistrée', 201);
  } catch (err) { next(err); }
};

exports.getLatestPositions = async (req, res, next) => {
  try {
    const list = await gpsService.getLatestPositions();
    return success(res, listDTO(list, gpsTrackingDTO));
  } catch (err) { next(err); }
};

exports.getUserHistory = async (req, res, next) => {
  try {
    const { start, end } = req.query;
    const list = await gpsService.getUserHistory(req.params.userId, start, end);
    return success(res, listDTO(list, gpsTrackingDTO));
  } catch (err) { next(err); }
};
// 
