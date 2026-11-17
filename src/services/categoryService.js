// Regras de negócio das categorias.
const { Category } = require('../models');
const AppError = require('../utils/AppError');
const { parsePagination, parseFields, pick, parseBoolean, isObject, isFilledString } = require('../utils/params');

const FIELDS = ['id', 'name', 'slug', 'use_in_menu'];
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/; // ex.: "black-friday"

const toJSON = (category) => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  use_in_menu: category.use_in_menu,
});

// Valida os dados da categoria. Em "parcial" (PUT) só valida o que foi enviado.
function validate(data, { partial }) {
  if (!isObject(data)) throw new AppError(400, 'Corpo da requisição inválido');
  const clean = {};

  if (data.name !== undefined || !partial) {
    if (!isFilledString(data.name)) throw new AppError(400, 'name é obrigatório');
    clean.name = data.name.trim();
  }
  if (data.slug !== undefined || !partial) {
    if (!isFilledString(data.slug) || !SLUG_REGEX.test(data.slug)) {
      throw new AppError(400, 'slug é obrigatório e deve usar apenas letras minúsculas, números e hífen');
    }
    clean.slug = data.slug;
  }
  if (data.use_in_menu !== undefined) clean.use_in_menu = parseBoolean(data.use_in_menu, 'use_in_menu');

  if (partial && Object.keys(clean).length === 0) throw new AppError(400, 'Envie ao menos um campo para atualizar');
  return clean;
}

async function assertSlugFree(slug, ignoreId) {
  const found = await Category.findOne({ where: { slug } });
  if (found && found.id !== ignoreId) throw new AppError(400, 'Já existe uma categoria com este slug');
}

// Lista com paginação, filtro de menu e escolha de campos.
async function search(query) {
  const { limit, page, offset, all } = parsePagination(query);
  const fields = parseFields(query.fields, FIELDS);

  const where = {};
  if (query.use_in_menu !== undefined) where.use_in_menu = parseBoolean(query.use_in_menu, 'use_in_menu');

  const { rows, count } = await Category.findAndCountAll({
    where,
    attributes: fields || FIELDS,
    order: [['id', 'ASC']],
    ...(all ? {} : { limit, offset }),
  });

  return { data: rows.map((row) => pick(row.toJSON(), fields)), total: count, limit, page };
}

async function getById(id) {
  const category = await Category.findByPk(id);
  if (!category) throw new AppError(404, 'Categoria não encontrada');
  return toJSON(category);
}

async function create(data) {
  const clean = validate(data, { partial: false });
  await assertSlugFree(clean.slug);
  const category = await Category.create(clean);
  return toJSON(category);
}

async function update(id, data) {
  const category = await Category.findByPk(id);
  if (!category) throw new AppError(404, 'Categoria não encontrada');

  const clean = validate(data, { partial: true });
  if (clean.slug) await assertSlugFree(clean.slug, id);
  await category.update(clean);
}

async function remove(id) {
  const category = await Category.findByPk(id);
  if (!category) throw new AppError(404, 'Categoria não encontrada');
  await category.destroy();
}

module.exports = { search, getById, create, update, remove };
