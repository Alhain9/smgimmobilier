const { Sequelize } = require('sequelize');
require('dotenv').config();

const dialect = process.env.DB_DIALECT || (process.env.DATABASE_URL ? 'postgres' : 'mysql');
let sequelize;

if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    define: { timestamps: true, underscored: true },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'postgres',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || (dialect === 'postgres' ? 5432 : 3306),
      dialect: dialect,
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
      define: { timestamps: true, underscored: true },
      dialectOptions: dialect === 'postgres' ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : {}
    }
  );
}

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(`✅ Base de données (${dialect}) connectée avec succès`);
  } catch (error) {
    console.error(`❌ Erreur connexion base de données (${dialect}):`, error.message);
  }
};

module.exports = { sequelize, connectDB };
