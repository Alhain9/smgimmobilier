// ============ Migration — Table manager_properties ============
// Exécuter ce script ONCE pour créer la table d'affectation gestionnaire ↔ immeuble
const { sequelize } = require('../config/database');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion DB OK');

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS manager_properties (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        property_id BIGINT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_manager_property (user_id, property_id),
        KEY idx_user_id (user_id),
        KEY idx_property_id (property_id),
        CONSTRAINT fk_mp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_mp_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Table manager_properties créée ou déjà existante');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur migration:', err.message);
    process.exit(1);
  }
}

migrate();
