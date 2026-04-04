const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, menuController.getAll);
router.get('/:id', authenticate, menuController.getById);
router.post('/', authenticate, authorize('owner', 'manager'), menuController.create);
router.put('/:id', authenticate, authorize('owner', 'manager'), menuController.update);
router.delete('/:id', authenticate, authorize('owner', 'manager'), menuController.remove);

module.exports = router;
