// Normalise l'objet user pour le frontend : role.name = code interne, role.label = libellé
const shapeUser = (user) => {
  if (!user) return null;
  const data = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  if (data.role) {
    const code = user.role && typeof user.role.code === 'function'
      ? user.role.code()
      : (require('../models/Role').CODES[data.role.role_name] || data.role.role_name);
    data.role = { id: data.role.id, name: code, label: data.role.role_name };
  }
  return data;
};
module.exports = { shapeUser };
