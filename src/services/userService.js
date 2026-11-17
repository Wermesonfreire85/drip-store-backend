// Regras de negócio dos usuários: validar dados, criptografar senha, gerar token.
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const AppError = require('../utils/AppError');
const authConfig = require('../config/auth');
const { isObject, isFilledString } = require('../utils/params');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

// Dados que podemos mostrar (a senha NUNCA sai da API).
const publicData = (user) => ({
  id: user.id,
  firstname: user.firstname,
  surname: user.surname,
  email: user.email,
});

// Valida nome, sobrenome e e-mail. Em "parcial" (PUT) só valida o que foi enviado.
function validateProfile(data, { partial }) {
  if (!isObject(data)) throw new AppError(400, 'Corpo da requisição inválido');
  const clean = {};

  for (const field of ['firstname', 'surname']) {
    if (data[field] !== undefined || !partial) {
      if (!isFilledString(data[field])) throw new AppError(400, `${field} é obrigatório`);
      clean[field] = data[field].trim();
    }
  }

  if (data.email !== undefined || !partial) {
    if (!isFilledString(data.email) || !EMAIL_REGEX.test(data.email.trim())) {
      throw new AppError(400, 'E-mail inválido');
    }
    clean.email = data.email.trim().toLowerCase();
  }

  if (partial && Object.keys(clean).length === 0) {
    throw new AppError(400, 'Envie ao menos um campo para atualizar');
  }
  return clean;
}

async function getById(id) {
  const user = await User.findByPk(id);
  if (!user) throw new AppError(404, 'Usuário não encontrado');
  return publicData(user);
}

async function create(data) {
  const clean = validateProfile(data, { partial: false });

  if (!isFilledString(data.password) || data.password.length < MIN_PASSWORD) {
    throw new AppError(400, `A senha deve ter pelo menos ${MIN_PASSWORD} caracteres`);
  }
  if (data.password !== data.confirmPassword) {
    throw new AppError(400, 'A confirmação de senha não confere com a senha');
  }
  if (await User.findOne({ where: { email: clean.email } })) {
    throw new AppError(400, 'E-mail já cadastrado');
  }

  // O 10 é o "custo" da criptografia: quanto maior, mais difícil de quebrar (e mais lento).
  const password = await bcrypt.hash(data.password, 10);
  const user = await User.create({ ...clean, password });
  return publicData(user);
}

async function update(id, data) {
  const user = await User.findByPk(id);
  if (!user) throw new AppError(404, 'Usuário não encontrado');

  const changes = validateProfile(data, { partial: true });
  if (changes.email && changes.email !== user.email) {
    if (await User.findOne({ where: { email: changes.email } })) throw new AppError(400, 'E-mail já cadastrado');
  }
  await user.update(changes);
}

async function remove(id) {
  const user = await User.findByPk(id);
  if (!user) throw new AppError(404, 'Usuário não encontrado');
  await user.destroy();
}

// Confere e-mail e senha e devolve um token JWT.
async function generateToken(data) {
  if (!isObject(data) || !isFilledString(data.email) || !isFilledString(data.password)) {
    throw new AppError(400, 'Informe e-mail e senha');
  }

  const user = await User.findOne({ where: { email: data.email.trim().toLowerCase() } });
  const passwordOk = user && (await bcrypt.compare(data.password, user.password));
  if (!passwordOk) throw new AppError(400, 'E-mail ou senha incorretos');

  return jwt.sign({ id: user.id, email: user.email }, authConfig.secret, { expiresIn: authConfig.expiresIn });
}

module.exports = { getById, create, update, remove, generateToken };
