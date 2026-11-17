// Funções pequenas para ler e validar parâmetros que chegam na requisição.
const AppError = require('./AppError');

// Converte o :id da URL em número. Se não for um número válido, o recurso não existe (404).
function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new AppError(404, 'Recurso não encontrado');
  return id;
}

// Lê ?limit= e ?page=. Padrão: 12 itens por página, página 1. limit=-1 traz tudo.
function parsePagination(query) {
  const limit = query.limit === undefined ? 12 : Number(query.limit);
  const page = query.page === undefined ? 1 : Number(query.page);
  if (!Number.isInteger(limit) || (limit < 1 && limit !== -1)) {
    throw new AppError(400, 'limit deve ser um número inteiro maior que 0 (ou -1 para trazer tudo)');
  }
  if (!Number.isInteger(page) || page < 1) throw new AppError(400, 'page deve ser um número inteiro maior que 0');
  if (limit === -1) return { limit: -1, page: 1, offset: 0, all: true };
  return { limit, page, offset: (page - 1) * limit, all: false };
}

// Lê ?fields=name,slug e confere se todos os campos existem.
function parseFields(value, allowed) {
  if (value === undefined) return null;
  const fields = String(value).split(',').map((f) => f.trim()).filter(Boolean);
  if (!fields.length) throw new AppError(400, 'fields está vazio');
  const invalid = fields.filter((f) => !allowed.includes(f));
  if (invalid.length) throw new AppError(400, `Campos inválidos em fields: ${invalid.join(', ')}`);
  return fields;
}

// Mantém só os campos pedidos em ?fields= (se nenhum foi pedido, devolve o objeto inteiro).
function pick(obj, fields) {
  if (!fields) return obj;
  return Object.fromEntries(fields.map((f) => [f, obj[f]]));
}

// Aceita "true" ou "false" (texto) e devolve boolean.
function parseBoolean(value, name) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new AppError(400, `${name} deve ser true ou false`);
}

// Lê uma lista de ids separados por vírgula, como "15,24".
function parseIdList(value, name) {
  const ids = String(value).split(',').map((v) => Number(v.trim()));
  if (!ids.length || ids.some((id) => !Number.isInteger(id) || id < 1)) {
    throw new AppError(400, `${name} deve ser uma lista de números inteiros separados por vírgula`);
  }
  return [...new Set(ids)];
}

// Lê filtros no formato option[45]=GG,PP direto da URL.
// (O parser padrão do Express transformaria option[45] em uma lista e perderia o número 45.)
function parseOptionFilters(url) {
  const params = new URLSearchParams(String(url).split('?')[1] || '');
  const filters = {};
  for (const [key, value] of params) {
    const match = /^option\[(.*)\]$/.exec(key);
    if (match) filters[match[1]] = value;
  }
  return Object.keys(filters).length ? filters : undefined;
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isFilledString = (v) => typeof v === 'string' && v.trim().length > 0;

module.exports = { parseId, parsePagination, parseFields, pick, parseBoolean, parseIdList, parseOptionFilters, isObject, isFilledString };
