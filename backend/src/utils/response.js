const success = (res, data = null, message = 'Succès', status = 200) => {
  return res.status(status).json({ success: true, message, data });
};

const error = (res, message = 'Erreur', status = 500, errors = null) => {
  return res.status(status).json({ success: false, message, errors });
};

module.exports = { success, error };
