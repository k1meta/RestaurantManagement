require('dotenv').config();

const express     = require('express');
const cors        = require('cors');

const authRoutes        = require('./routes/auth');
const orderRoutes       = require('./routes/orders');
const inventoryRoutes   = require('./routes/inventory');
const menuSalesRoutes   = require('./routes/menuAndSales');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());                  // Allow requests from React Native dev client
app.use(express.json());          // Parse JSON bodies

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/orders',    orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api',           menuSalesRoutes);  // /api/menu and /api/sales

// ─── Health check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global error handler ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🍽️  Restaurant API running on http://localhost:${PORT}`);
});
