const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, orderController.getAll);
router.get('/:id', authenticate, orderController.getById);
router.post('/', authenticate, authorize('owner', 'manager', 'waiter'), orderController.create);
router.put('/:id/status', authenticate, orderController.updateStatus);
router.delete('/:id', authenticate, authorize('owner', 'manager'), orderController.remove);

module.exports = router;
