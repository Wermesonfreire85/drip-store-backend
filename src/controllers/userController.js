// Controller: recebe a requisição, chama o serviço e devolve a resposta HTTP.
const userService = require('../services/userService');
const { parseId } = require('../utils/params');

exports.show = async (req, res) => {
  res.status(200).json(await userService.getById(parseId(req.params.id)));
};

exports.create = async (req, res) => {
  res.status(201).json(await userService.create(req.body));
};

exports.update = async (req, res) => {
  await userService.update(parseId(req.params.id), req.body);
  res.status(204).send();
};

exports.remove = async (req, res) => {
  await userService.remove(parseId(req.params.id));
  res.status(204).send();
};

exports.token = async (req, res) => {
  res.status(200).json({ token: await userService.generateToken(req.body) });
};
