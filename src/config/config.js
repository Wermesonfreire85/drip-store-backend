// Configuração do banco de dados.
// É usada pela aplicação (models) e também pelo Sequelize CLI (migrations).
require('dotenv').config({ quiet: true });

const base = {
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || null,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  dialect: 'mysql',
  logging: false,
  // underscored: colunas ficam em snake_case (created_at, updated_at, product_id...)
  define: { underscored: true },
};

module.exports = {
  development: { ...base, database: process.env.DB_NAME || 'drip_store' },
  test: { ...base, database: process.env.DB_NAME_TEST || 'drip_store_test' },
  production: { ...base, database: process.env.DB_NAME || 'drip_store' },
};
