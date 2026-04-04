const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, restaurantController.getAll);
router.get('/:id', authenticate, restaurantController.getById);
router.post('/', authenticate, authorize('owner'), restaurantController.create);
router.put('/:id', authenticate, authorize('owner', 'manager'), restaurantController.update);
router.delete('/:id', authenticate, authorize('owner'), restaurantController.remove);

module.exports = router;
