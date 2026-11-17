// Monta a aplicação Express (sem ligar o servidor). Separado do server.js para facilitar os testes.
require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const routes = require('./routes');
const swaggerSpec = require('./docs/swagger');
const { uploadsDir } = require('./config/storage');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors()); // deixa o front-end (outro endereço) chamar a API
app.use(express.json({ limit: '15mb' })); // limite maior porque as imagens chegam em base64

app.use('/media', express.static(uploadsDir)); // serve as imagens salvas
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec)); // documentação Swagger

app.get('/', (req, res) => res.status(200).json({ name: 'Digital Store API', docs: '/api-docs' }));
app.use('/v1', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
