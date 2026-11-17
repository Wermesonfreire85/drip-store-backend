const { Router } = require('express');
const controller = require('../controllers/categoryController');
const authenticate = require('../middleware/auth');

const router = Router();

router.get('/search', controller.search); // precisa vir antes de "/:id"
router.get('/:id', controller.show);
router.post('/', authenticate, controller.create);
router.put('/:id', authenticate, controller.update);
router.delete('/:id', authenticate, controller.remove);

module.exports = router;
