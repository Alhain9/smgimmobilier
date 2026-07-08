// Crée les tables sans données (sync)
const { sequelize } = require('./database');
require('../models');

(async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Migration terminée - tables synchronisées');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur migration:', err);
    process.exit(1);
  }
})();
