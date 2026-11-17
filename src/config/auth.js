// Configuração do token JWT (login).
module.exports = {
  secret: process.env.JWT_SECRET || 'troque-este-segredo',
  expiresIn: process.env.JWT_EXPIRES_IN || '1d',
};
