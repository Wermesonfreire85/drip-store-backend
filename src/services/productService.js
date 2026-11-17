// Regras de negócio dos produtos: validação, busca com filtros, imagens (base64 -> arquivo) e opções.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Op, literal } = require('sequelize');
const { sequelize, Product, ProductImage, ProductOption, Category } = require('../models');
const { uploadsDir } = require('../config/storage');
const AppError = require('../utils/AppError');
const {
  parsePagination, parseFields, pick, parseBoolean, parseIdList, isObject, isFilledString,
} = require('../utils/params');

const FIELDS = [
  'id', 'enabled', 'name', 'slug', 'use_in_menu', 'stock', 'description',
  'price', 'price_with_discount', 'category_ids', 'images', 'options',
];
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const OPTION_SHAPES = ['square', 'circle'];
const OPTION_TYPES = ['text', 'color'];

// ---------- Leitura e formato da resposta ----------

// O que o banco precisa carregar junto com o produto.
const includes = () => [
  { model: ProductImage, as: 'images' },
  { model: ProductOption, as: 'options' },
  { model: Category, as: 'categories', attributes: ['id'], through: { attributes: [] } },
];

const ordering = () => [
  ['id', 'ASC'],
  [{ model: ProductImage, as: 'images' }, 'id', 'ASC'],
  [{ model: ProductOption, as: 'options' }, 'id', 'ASC'],
];

// Transforma o produto do banco no JSON que a API devolve.
function serialize(product, baseUrl) {
  return {
    id: product.id,
    enabled: product.enabled,
    name: product.name,
    slug: product.slug,
    use_in_menu: product.use_in_menu,
    stock: product.stock,
    description: product.description,
    price: product.price,
    price_with_discount: product.price_with_discount,
    category_ids: product.categories.map((c) => c.id),
    images: product.images.map((i) => ({ id: i.id, content: `${baseUrl}/media/${i.path}` })),
    options: product.options.map((o) => ({
      id: o.id,
      title: o.title,
      shape: o.shape,
      radius: o.radius,
      type: o.type,
      values: o.values.split(','),
    })),
  };
}

async function getById(id, baseUrl) {
  const product = await Product.findByPk(id, { include: includes(), order: ordering() });
  if (!product) throw new AppError(404, 'Produto não encontrado');
  return serialize(product, baseUrl);
}

// ---------- Busca (GET /v1/product/search) ----------

async function search(query, baseUrl) {
  const { limit, page, offset, all } = parsePagination(query);
  const fields = parseFields(query.fields, FIELDS);
  const conditions = [];

  // match=Tênis -> procura no nome ou na descrição
  if (query.match !== undefined && String(query.match).trim()) {
    const term = `%${String(query.match).trim()}%`;
    conditions.push({ [Op.or]: [{ name: { [Op.like]: term } }, { description: { [Op.like]: term } }] });
  }

  // price-range=100-200 -> preço entre os dois valores
  if (query['price-range'] !== undefined) {
    const match = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(String(query['price-range']));
    if (!match) throw new AppError(400, 'price-range deve ter o formato 100-200');
    const [min, max] = [Number(match[1]), Number(match[2])];
    if (min > max) throw new AppError(400, 'price-range: o primeiro valor não pode ser maior que o segundo');
    conditions.push({ price: { [Op.between]: [min, max] } });
  }

  // category_ids=15,24 -> produtos de qualquer uma dessas categorias
  if (query.category_ids !== undefined) {
    const ids = parseIdList(query.category_ids, 'category_ids');
    conditions.push({ id: { [Op.in]: literal(`(SELECT product_id FROM product_categories WHERE category_id IN (${ids.join(',')}))`) } });
  }

  // option[45]=GG,PP -> produtos cuja opção 45 tenha algum desses valores
  if (query.option !== undefined) {
    if (!isObject(query.option)) throw new AppError(400, 'Use o formato option[ID]=valor1,valor2');
    for (const [optionId, raw] of Object.entries(query.option)) {
      if (!/^\d+$/.test(optionId)) throw new AppError(400, 'O ID da opção deve ser um número: option[45]=GG');
      const values = String(raw).split(',').map((v) => v.trim()).filter(Boolean);
      if (!values.length) throw new AppError(400, `option[${optionId}] está vazio`);
      // FIND_IN_SET procura o valor dentro do texto "39,40,41" (coluna values).
      const anyValue = values.map((v) => `FIND_IN_SET(${sequelize.escape(v)}, \`values\`) > 0`).join(' OR ');
      conditions.push({ id: { [Op.in]: literal(`(SELECT product_id FROM product_options WHERE id = ${Number(optionId)} AND (${anyValue}))`) } });
    }
  }

  const where = conditions.length ? { [Op.and]: conditions } : {};

  // 1) pega só os IDs da página (rápido, sem juntar tabelas)  2) carrega os produtos completos desses IDs
  const { rows, count } = await Product.findAndCountAll({
    where,
    attributes: ['id'],
    order: [['id', 'ASC']],
    ...(all ? {} : { limit, offset }),
  });
  const ids = rows.map((r) => r.id);
  const products = ids.length ? await Product.findAll({ where: { id: ids }, include: includes(), order: ordering() }) : [];

  return {
    data: products.map((p) => pick(serialize(p, baseUrl), fields)),
    total: count,
    limit,
    page,
  };
}

// ---------- Validações ----------

function validateFields(data, { partial }) {
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
  for (const field of ['price', 'price_with_discount']) {
    if (data[field] !== undefined || !partial) {
      if (typeof data[field] !== 'number' || !Number.isFinite(data[field]) || data[field] < 0) {
        throw new AppError(400, `${field} é obrigatório e deve ser um número maior ou igual a 0`);
      }
      clean[field] = data[field];
    }
  }
  if (data.stock !== undefined) {
    if (!Number.isInteger(data.stock) || data.stock < 0) throw new AppError(400, 'stock deve ser um número inteiro maior ou igual a 0');
    clean.stock = data.stock;
  }
  if (data.enabled !== undefined) clean.enabled = parseBoolean(data.enabled, 'enabled');
  if (data.use_in_menu !== undefined) clean.use_in_menu = parseBoolean(data.use_in_menu, 'use_in_menu');
  if (data.description !== undefined) {
    if (typeof data.description !== 'string') throw new AppError(400, 'description deve ser um texto');
    clean.description = data.description;
  }
  return clean;
}

// Confere se category_ids é uma lista de números e se todas as categorias existem.
async function validateCategoryIds(value) {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.some((id) => !Number.isInteger(id) || id < 1)) {
    throw new AppError(400, 'category_ids deve ser uma lista de números inteiros');
  }
  const ids = [...new Set(value)];
  if (ids.length && (await Category.count({ where: { id: ids } })) !== ids.length) {
    throw new AppError(400, 'category_ids contém categoria inexistente');
  }
  return ids;
}

// Imagem nova: { type: "image/png", content: "<base64>" }
function validateNewImage(image) {
  if (!isObject(image) || !IMAGE_TYPES[image.type]) {
    throw new AppError(400, `Imagem inválida: type deve ser um de ${Object.keys(IMAGE_TYPES).join(', ')}`);
  }
  const base64 = String(image.content || '').replace(/^data:[^;]+;base64,/, '');
  if (!base64 || !/^[A-Za-z0-9+/=\s]+$/.test(base64)) throw new AppError(400, 'Imagem inválida: content deve ser base64');
  return { type: image.type, base64 };
}

// Opção do produto. Em "parcial" (atualização) só valida o que foi enviado.
function validateOption(option, { partial }) {
  if (!isObject(option)) throw new AppError(400, 'Opção inválida');
  const clean = {};

  if (option.title !== undefined || !partial) {
    if (!isFilledString(option.title)) throw new AppError(400, 'title da opção é obrigatório');
    clean.title = option.title.trim();
  }
  const rawValues = option.values !== undefined ? option.values : option.value; // aceita "values" e "value"
  if (rawValues !== undefined || !partial) {
    if (!Array.isArray(rawValues) || !rawValues.length || rawValues.some((v) => !isFilledString(v) || v.includes(','))) {
      throw new AppError(400, 'values da opção deve ser uma lista de textos (sem vírgula)');
    }
    clean.values = rawValues.map((v) => v.trim()).join(',');
  }
  if (option.shape !== undefined) {
    if (!OPTION_SHAPES.includes(option.shape)) throw new AppError(400, 'shape deve ser square ou circle');
    clean.shape = option.shape;
  }
  if (option.type !== undefined) {
    if (!OPTION_TYPES.includes(option.type)) throw new AppError(400, 'type da opção deve ser text ou color');
    clean.type = option.type;
  }
  if (option.radius !== undefined) {
    const radius = typeof option.radius === 'string' ? parseInt(option.radius, 10) : option.radius; // aceita "4px"
    if (!Number.isInteger(radius) || radius < 0) throw new AppError(400, 'radius deve ser um número maior ou igual a 0');
    clean.radius = radius;
  }
  return clean;
}

// ---------- Arquivos de imagem ----------

function saveImage(productId, { type, base64 }) {
  const dir = path.join(uploadsDir, `product-${productId}`);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `image-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${IMAGE_TYPES[type]}`;
  fs.writeFileSync(path.join(dir, filename), Buffer.from(base64, 'base64'));
  return `product-${productId}/${filename}`; // caminho relativo, é o que vai para o banco
}

const removeFile = (relativePath) => fs.rmSync(path.join(uploadsDir, relativePath), { force: true });

// ---------- Criar ----------

async function create(data, baseUrl) {
  const fields = validateFields(data, { partial: false });
  const categoryIds = (await validateCategoryIds(data.category_ids)) || [];

  if (data.images !== undefined && !Array.isArray(data.images)) throw new AppError(400, 'images deve ser uma lista');
  if (data.options !== undefined && !Array.isArray(data.options)) throw new AppError(400, 'options deve ser uma lista');
  const images = (data.images || []).map(validateNewImage);
  const options = (data.options || []).map((o) => validateOption(o, { partial: false }));

  const written = []; // arquivos salvos, para apagar se algo der errado
  const transaction = await sequelize.transaction(); // tudo ou nada: se falhar, nada é gravado
  let productId;
  try {
    const product = await Product.create(fields, { transaction });
    productId = product.id;
    if (categoryIds.length) await product.setCategories(categoryIds, { transaction });
    for (const image of images) {
      const relative = saveImage(product.id, image);
      written.push(relative);
      await ProductImage.create({ product_id: product.id, enabled: true, path: relative }, { transaction });
    }
    for (const option of options) await ProductOption.create({ ...option, product_id: product.id }, { transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    written.forEach(removeFile);
    throw error;
  }

  return getById(productId, baseUrl);
}

// ---------- Atualizar ----------

async function update(id, data) {
  const product = await Product.findByPk(id);
  if (!product) throw new AppError(404, 'Produto não encontrado');

  const fields = validateFields(data, { partial: true });
  const categoryIds = await validateCategoryIds(data.category_ids);
  if (data.images !== undefined && !Array.isArray(data.images)) throw new AppError(400, 'images deve ser uma lista');
  if (data.options !== undefined && !Array.isArray(data.options)) throw new AppError(400, 'options deve ser uma lista');

  const written = []; // arquivos novos (apagados se der erro)
  const obsolete = []; // arquivos antigos (apagados só depois de gravar com sucesso)
  const transaction = await sequelize.transaction();
  try {
    if (Object.keys(fields).length) await product.update(fields, { transaction });
    if (categoryIds) await product.setCategories(categoryIds, { transaction });

    // Imagens: sem id = nova | id + deleted = apagar | id + base64 = trocar | id + URL = manter
    for (const item of data.images || []) {
      if (!isObject(item)) throw new AppError(400, 'Imagem inválida');
      if (item.id === undefined) {
        const relative = saveImage(id, validateNewImage(item));
        written.push(relative);
        await ProductImage.create({ product_id: id, enabled: true, path: relative }, { transaction });
        continue;
      }
      const image = await ProductImage.findOne({ where: { id: item.id, product_id: id }, transaction });
      if (!image) throw new AppError(400, `A imagem ${item.id} não pertence a este produto`);
      if (item.deleted === true) {
        obsolete.push(image.path);
        await image.destroy({ transaction });
      } else if (item.type !== undefined) {
        const relative = saveImage(id, validateNewImage(item));
        written.push(relative);
        obsolete.push(image.path);
        await image.update({ path: relative }, { transaction });
      }
    }

    // Opções: sem id = nova | id + deleted = apagar | id + campos = atualizar
    for (const item of data.options || []) {
      if (!isObject(item)) throw new AppError(400, 'Opção inválida');
      if (item.id === undefined) {
        await ProductOption.create({ ...validateOption(item, { partial: false }), product_id: id }, { transaction });
        continue;
      }
      const option = await ProductOption.findOne({ where: { id: item.id, product_id: id }, transaction });
      if (!option) throw new AppError(400, `A opção ${item.id} não pertence a este produto`);
      if (item.deleted === true) await option.destroy({ transaction });
      else await option.update(validateOption(item, { partial: true }), { transaction });
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    written.forEach(removeFile);
    throw error;
  }

  obsolete.forEach(removeFile);
}

// ---------- Apagar ----------

async function remove(id) {
  const product = await Product.findByPk(id);
  if (!product) throw new AppError(404, 'Produto não encontrado');

  const transaction = await sequelize.transaction();
  try {
    await ProductImage.destroy({ where: { product_id: id }, transaction });
    await ProductOption.destroy({ where: { product_id: id }, transaction });
    await product.setCategories([], { transaction });
    await product.destroy({ transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  fs.rmSync(path.join(uploadsDir, `product-${id}`), { recursive: true, force: true });
}

module.exports = { search, getById, create, update, remove };
