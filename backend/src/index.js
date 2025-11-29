const require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');
const bookingsRoutes = require('./routes/bookings');
const usersRoutes = require('./routes/users');
const ordersController = require('./controllers/orders');
const productsController = require('./controllers/products');
const paymentsController = require('./controllers/payments');
const authMiddleware = require('./middleware/auth');
const rateLimit = require('./middleware/rateLimit');
const { validateOrderRequest, validateProductRequest } = require('./middleware/validation');
const { startWatcher } = require('./watcher');

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Request logging middleware (development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Health check
app.get('/health', (req, res) => res.json({ 
  status: 'ok',
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development'
}));

// Auth routes (public with rate limiting)
app.use('/api/auth', rateLimit(60000, 20), authRoutes);

// Events routes
app.use('/api/events', eventsRoutes);

// Bookings routes (protected)
app.use('/api/bookings', bookingsRoutes);
// User profile routes (me)
app.use('/api/users', usersRoutes);

// Orders routes (protected with validation)
app.post('/api/orders', authMiddleware, validateOrderRequest, ordersController.createOrder);
app.get('/api/orders/:id', authMiddleware, ordersController.getOrder);
app.get('/api/orders', authMiddleware, ordersController.listOrders);

// Products routes
app.get('/api/products/categories', productsController.getCategories);
app.get('/api/products/countries', productsController.getCountries);
app.get('/api/products/:id', productsController.getProduct);
app.get('/api/products', productsController.listProducts);
app.post('/api/products', authMiddleware, validateProductRequest, productsController.createProduct); // Admin only (add role check later)
app.put('/api/products/:id', authMiddleware, validateProductRequest, productsController.updateProduct); // Admin only
app.delete('/api/products/:id', authMiddleware, productsController.deleteProduct); // Admin only

// Payments routes
app.post('/api/payments/invoice', authMiddleware, rateLimit(60000, 5), paymentsController.createInvoice);
app.post('/api/payments/webhook', paymentsController.handleWebhook); // Public webhook
app.get('/api/payments/:orderId', authMiddleware, paymentsController.getPaymentStatus);
app.get('/api/payments/status/:paymentId', authMiddleware, paymentsController.checkPaymentStatus);

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// Catch-all for SPA (serve index.html for all non-API routes)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'index.html'));
  } else {
    res.status(404).json({ error: 'Endpoint not found' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  // Don't leak stack traces in production
  const errorResponse = {
    error: err.message || 'Internal server error'
  };
  
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }
  
  res.status(err.status || 500).json(errorResponse);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🎵 Klassik Backend Server');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Port:        ${PORT}`);
  console.log(`  URL:         http://localhost:${PORT}`);
  console.log(`  Health:      http://localhost:${PORT}/health`);
  console.log('');
  console.log('  API Endpoints:');
  console.log('  - POST   /api/auth/register');
  console.log('  - POST   /api/auth/login');
  console.log('  - GET    /api/products');
  console.log('  - POST   /api/payments/invoice');
  console.log('  - POST   /api/orders');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  // Start blockchain watcher
  if (process.env.ENABLE_WATCHER !== 'false') {
    startWatcher().catch(err => {
      console.error('Failed to start watcher:', err);
    });
  }
});
