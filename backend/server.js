require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./src/routes/auth');
const restaurantRoutes = require('./src/routes/restaurants');
const orderRoutes = require('./src/routes/orders');
const menuRoutes = require('./src/routes/menu');
const inventoryRoutes = require('./src/routes/inventory');
const salesRoutes = require('./src/routes/sales');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/restaurants', apiLimiter, restaurantRoutes);
app.use('/api/orders', apiLimiter, orderRoutes);
app.use('/api/menu', apiLimiter, menuRoutes);
app.use('/api/inventory', apiLimiter, inventoryRoutes);
app.use('/api/sales', apiLimiter, salesRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
