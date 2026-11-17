// Middleware de autenticação: só deixa passar quem enviar um token JWT válido.
// O cliente envia o token no cabeçalho:  Authorization: Bearer <token>
const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth');
const AppError = require('../utils/AppError');

module.exports = function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'Token de autorização não enviado');
  }

  try {
    req.auth = jwt.verify(token, authConfig.secret); // guarda quem é o usuário logado
  } catch {
    throw new AppError(401, 'Token de autorização inválido ou expirado');
  }

  next();
};
