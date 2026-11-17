// Liga o servidor: confere a conexão com o banco e começa a escutar a porta.
require('dotenv').config({ quiet: true });
const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Banco de dados conectado');
    app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT} (documentação em /api-docs)`));
  } catch (error) {
    console.error('Não foi possível conectar ao banco de dados:', error.message);
    process.exit(1);
  }
}

start();
