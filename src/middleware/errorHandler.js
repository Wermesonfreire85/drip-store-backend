// Middlewares finais: rota não encontrada e tratamento central de erros.
// Assim, todo erro da API sai em JSON no formato { "message": "..." }.
const AppError = require('../utils/AppError');

function notFound(req, res) {
  res.status(404).json({ message: 'Rota não encontrada' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Erros que nós mesmos lançamos (400, 401, 404...)
  if (err instanceof AppError) return res.status(err.status).json({ message: err.message });

  // JSON enviado com sintaxe errada
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'JSON inválido no corpo da requisição' });
  if (err.type === 'entity.too.large') return res.status(400).json({ message: 'Corpo da requisição grande demais' });

  // Valor repetido em campo único (e-mail, slug...)
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors && err.errors[0] ? err.errors[0].path : 'campo';
    return res.status(400).json({ message: `Já existe um registro com este valor: ${field}` });
  }

  // Dados que o banco recusou
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ message: err.errors.map((e) => e.message).join('; ') });
  }

  // Qualquer outra coisa é erro nosso (500): registramos no terminal e não vazamos detalhes.
  console.error(err);
  return res.status(500).json({ message: 'Erro interno do servidor' });
}

module.exports = { notFound, errorHandler };
