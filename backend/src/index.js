require('dotenv').config({ path: '/etc/klassik/klassik1.env' });
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');
const bookingsRoutes = require('./routes/bookings');
const usersRoutes = require('./routes/users');
const kaspaRoutes = require('./routes/kaspa');
const kaspaEnhancedRoutes = require('./routes/kaspa-enhanced');
const adminRoutes = require('./routes/admin');
const searchRoutes = require('./routes/search');
const { router: communityRoutes, communityManager } = require('./controllers/community');
const ordersController = require('./controllers/orders');
const productsController = require('./controllers/products');
const paymentsController = require('./controllers/payments');
const kaspaPaymentsController = require('./controllers/kaspa-payments');
const authMiddleware = require('./middleware/auth');
const rateLimit = require('./middleware/rateLimit');
const { validateOrderRequest, validateProductRequest } = require('./middleware/validation');
const { startWatcher } = require('./watcher');
const debugRoutes = require('./routes/debug');
const klassikService = require('./klassik/klassik');
const BlockchainMonitor = require('./services/blockchain-monitor');
const healthController = require('./controllers/health');

// ✅ NEW: Enhanced middleware imports
const {
  authLimiter,
  registrationLimiter,
  paymentLimiter,
  blockchainLimiter,
  adminLimiter,
  generalLimiter
} = require('./middleware/enhanced-rate-limit');
const { initRedis, cacheMiddleware, getCachedOrFetch } = require('./cache/redis-cache');
const jwt = require('jsonwebtoken'); // For WebSocket auth

const app = express();
const server = http.createServer(app);

// WebSocket setup for real-time notifications
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  }
});

// Initialize blockchain monitor with WebSocket
const blockchainMonitor = new BlockchainMonitor(io);

// Setup community manager with WebSocket
communityManager.setWebSocket(io);

// ✅ CORS configuration - SECURED
const ALLOWED_ORIGINS = [
  'https://klassik.99pace.space',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.CORS_ORIGIN
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
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

// ✅ Apply general rate limiting to ALL routes (base protection)
app.use(generalLimiter);

// ✅ Auth routes (public with ENHANCED rate limiting)
app.use('/api/auth/register', registrationLimiter); // 3 registrations per hour
app.use('/api/auth/login', authLimiter); // 10 login attempts per 15 min
app.use('/api/auth', authRoutes);

// ✅ Kaspa blockchain routes (public with blockchain limiter)
app.use('/api/kaspa', blockchainLimiter, kaspaRoutes);

// ✅ Enhanced Kaspa API proxy routes (public with caching & rate limiting)
app.use('/api/kaspa-enhanced', blockchainLimiter, kaspaEnhancedRoutes);

// ✅ Admin dashboard routes (protected by wallet address + IP whitelist + admin limiter)
app.use('/api/admin', adminLimiter, adminRoutes);

// Search routes (public)
app.use('/api/search', searchRoutes);

// Community routes (protected)
app.use('/api/community', communityRoutes);

// Events routes
app.use('/api/events', eventsRoutes);

// Debug routes (protected by ADMIN_TOKEN header)
app.use('/api/debug', debugRoutes);

// Bookings routes (protected)
app.use('/api/bookings', bookingsRoutes);
// User profile routes (me)
app.use('/api/users', usersRoutes);

// Health checks
app.get('/health', healthController.getHealth);
app.get('/api/health', healthController.getDetailedHealth);
app.get('/api/health/metrics', healthController.getMetrics);
app.get('/api/health/ready', healthController.getReadiness);
app.get('/api/health/live', healthController.getLiveness);

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
app.post('/api/payments/invoice', authMiddleware, paymentLimiter, paymentsController.createInvoice);
app.post('/api/payments/webhook', paymentsController.handleWebhook); // Public webhook
app.get('/api/payments/:orderId', authMiddleware, paymentsController.getPaymentStatus);
app.get('/api/payments/status/:paymentId', authMiddleware, paymentsController.checkPaymentStatus);

// Kaspa Native Payments
app.post('/api/payments/kaspa/checkout', authMiddleware, paymentLimiter, kaspaPaymentsController.createKaspaCheckout);
app.get('/api/payments/kaspa/:orderId/status', authMiddleware, kaspaPaymentsController.checkKaspaPaymentStatus);
app.get('/api/payments/kaspa/price', kaspaPaymentsController.getKaspaPrice);

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
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces

// ✅ Initialize Redis on startup (async)
(async () => {
  try {
    await initRedis();
    console.log('✅ Redis cache initialized successfully');
  } catch (err) {
    console.warn('⚠️ Redis initialization failed, running without cache:', err.message);
  }
})();

// ✅ WebSocket-Authentifizierung Middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      console.warn('❌ WebSocket connection without token');
      return next(new Error('Authentication required'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId || decoded.id;
    socket.userAddress = decoded.address;
    
    console.log(`✅ Authenticated WebSocket: User ${socket.userId}`);
    next();
  } catch (err) {
    console.error('❌ WebSocket auth failed:', err.message);
    next(new Error('Invalid token'));
  }
});

// WebSocket connection handling (NOW SECURED)
io.on('connection', (socket) => {
  console.log(`🔌 Authenticated client connected: ${socket.id} (User: ${socket.userId})`);
  
  socket.on('subscribe:payments', async (orderId) => {
    try {
      // ✅ Prüfe ob Order dem User gehört!
      const orderCheck = await db.query(
        'SELECT user_id FROM orders WHERE id = $1',
        [orderId]
      );
      
      if (orderCheck.rows.length === 0 || orderCheck.rows[0].user_id !== socket.userId) {
        socket.emit('error', { message: 'Unauthorized: Not your order' });
        return;
      }
      
      socket.join(`order:${orderId}`);
      console.log(`📡 User ${socket.userId} subscribed to order ${orderId}`);
    } catch (err) {
      console.error('Subscribe error:', err);
      socket.emit('error', { message: 'Subscription failed' });
    }
  });
  
  socket.on('subscribe:sacrifice', (address) => {
    // ✅ Nur eigene Adresse subscriben erlauben
    if (address.toLowerCase() !== socket.userAddress.toLowerCase()) {
      socket.emit('error', { message: 'Can only subscribe to your own address' });
      return;
    }
    
    socket.join(`sacrifice:${address}`);
    console.log(`📡 User ${socket.userId} subscribed to sacrifice updates`);
  });
  
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🎵 Klassik Backend Server');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Host:        ${HOST}`);
  console.log(`  Port:        ${PORT}`);
  console.log(`  Local:       http://localhost:${PORT}`);
  console.log(`  Network:     http://<YOUR_IP>:${PORT}`);
  console.log(`  Health:      http://localhost:${PORT}/health`);
  console.log(`  Test Suite:  http://localhost:${PORT}/test-api-flow.html`);
  console.log('');
  console.log('  API Endpoints:');
  console.log('  - POST   /api/auth/register');
  console.log('  - POST   /api/auth/login');
  console.log('  - GET    /api/kaspa/stats');
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

  // Start Klassik microservice
  if (process.env.ENABLE_KLASSIK !== 'false') {
    klassikService.start().catch(err => {
      console.error('Failed to start Klassik service:', err);
    });
    console.log('🎵 Klassik microservice integration enabled');
  }

  // Start blockchain monitoring
  if (process.env.ENABLE_BLOCKCHAIN_MONITOR !== 'false') {
    blockchainMonitor.start().catch(err => {
      console.error('Failed to start blockchain monitor:', err);
    });
    console.log('🔍 Blockchain monitoring enabled');
  }
});
