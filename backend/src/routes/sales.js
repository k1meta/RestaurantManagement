const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('owner', 'manager'), salesController.getAll);
router.get('/restaurant/:restaurantId', authenticate, authorize('owner', 'manager'), salesController.getByRestaurant);
router.get('/summary', authenticate, authorize('owner', 'manager'), salesController.getSummary);

module.exports = router;
