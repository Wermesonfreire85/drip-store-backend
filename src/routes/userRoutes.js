const { Router } = require('express');
const controller = require('../controllers/userController');
const authenticate = require('../middleware/auth');

const router = Router();

router.post('/token', controller.token); // login (público)
router.post('/', controller.create); // cadastro (público)
router.get('/:id', controller.show);
router.put('/:id', authenticate, controller.update); // exige token
router.delete('/:id', authenticate, controller.remove); // exige token

module.exports = router;
