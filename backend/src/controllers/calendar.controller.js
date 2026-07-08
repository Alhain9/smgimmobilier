const calendarService = require('../services/calendar.service');
const { success } = require('../utils/response');

module.exports = {
  getAll: async (req, res, next) => {
    try { return success(res, await calendarService.getAll(req.query, req.user)); } catch (e) { next(e); }
  },
  getCalendars: async (req, res, next) => {
    try { return success(res, await calendarService.getVisibleUsers(req.user)); } catch (e) { next(e); }
  },
  getParticipantOptions: async (req, res, next) => {
    try { return success(res, await calendarService.getVisibleUsers(req.user, { forMeeting: true })); } catch (e) { next(e); }
  },
  create: async (req, res, next) => {
    try { return success(res, await calendarService.create(req.body, req.user), 'Événement créé', 201); }
    catch (e) { next(e); }
  },
  update: async (req, res, next) => {
    try { return success(res, await calendarService.update(req.params.id, req.body, req.user), 'Événement mis à jour'); }
    catch (e) { next(e); }
  },
  remove: async (req, res, next) => {
    try { await calendarService.remove(req.params.id, req.user); return success(res, null, 'Événement supprimé'); }
    catch (e) { next(e); }
  },
};
