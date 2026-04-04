const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, inventoryController.getAll);
router.get('/:id', authenticate, inventoryController.getById);
router.post('/', authenticate, authorize('owner', 'manager'), inventoryController.create);
router.put('/:id', authenticate, authorize('owner', 'manager'), inventoryController.update);
router.get('/logs/:restaurantId', authenticate, authorize('owner', 'manager'), inventoryController.getLogs);

module.exports = router;
