const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const inventoryRoutes = require('./routes/inventory');
const menuSalesRoutes = require('./routes/menuAndSales');
const organizationRoutes = require('./routes/organization');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api', menuSalesRoutes);
app.use('/api', organizationRoutes);

app.get('/', (req, res) => {
  res.json({
    service: 'restaurant-management-backend',
    status: 'ok',
    docs: {
      health: '/health',
      login: '/api/auth/login',
      profiles: '/api/auth/login-profiles',
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
