const productService = require('../services/productService');
const { parseId, parseOptionFilters } = require('../utils/params');

// Endereço do servidor, usado para montar o link completo das imagens.
const baseUrl = (req) => `${req.protocol}://${req.get('host')}`;

exports.search = async (req, res) => {
  const query = { ...req.query, option: parseOptionFilters(req.originalUrl) };
  res.status(200).json(await productService.search(query, baseUrl(req)));
};

exports.show = async (req, res) => {
  res.status(200).json(await productService.getById(parseId(req.params.id), baseUrl(req)));
};

exports.create = async (req, res) => {
  res.status(201).json(await productService.create(req.body, baseUrl(req)));
};

exports.update = async (req, res) => {
  await productService.update(parseId(req.params.id), req.body);
  res.status(204).send();
};

exports.remove = async (req, res) => {
  await productService.remove(parseId(req.params.id));
  res.status(204).send();
};
