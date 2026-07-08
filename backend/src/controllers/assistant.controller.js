const agent = require('../services/assistant/agent.service');
const alertesService = require('../services/assistant/alertes.service');
const { executeTool, messageSucces } = require('../services/assistant/tools');

const bearer = (req) => (req.headers.authorization || '').split(' ')[1];

module.exports = {
  // GET /assistant/status → indique si l'IA est configurée (clé présente), sans rien exposer
  status: (req, res) => {
    const configured = !!(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim());
    return res.json({ configured });
  },

  // POST /assistant/chat  { message, historique?, confirmer?, action? }
  chat: async (req, res, next) => {
    try {
      const token = bearer(req);
      const ctx = {
        userId: req.user.id, role: req.user.role, full_name: req.user.full_name,
        token, confirmer: !!req.body.confirmer,
      };

      // Confirmation d'une action en attente → on exécute directement l'outil d'écriture
      if (req.body.confirmer && req.body.action && req.body.action.tool) {
        try {
          const result = await executeTool(req.body.action.tool, req.body.action.input, ctx);
          return res.json({ reponse: messageSucces(req.body.action.tool, result) });
        } catch (e) {
          return res.json({ reponse: `❌ Échec : ${e.message}` });
        }
      }

      const message = String(req.body.message || '').trim();
      if (!message) return res.status(400).json({ reponse: 'Veuillez saisir une demande.' });

      const out = await agent.chat(message, ctx, Array.isArray(req.body.historique) ? req.body.historique : []);
      return res.json(out);
    } catch (err) {
      if (err.status === 503) return res.status(503).json({ reponse: err.message });
      next(err);
    }
  },

  // GET /assistant/alertes
  alertes: async (req, res, next) => {
    try {
      const token = bearer(req);
      const alertes = await alertesService.getAlertes({ userId: req.user.id, role: req.user.role, token });
      return res.json({ alertes });
    } catch (err) { next(err); }
  },
};
