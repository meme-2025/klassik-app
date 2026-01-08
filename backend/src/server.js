#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏆 KLASSIK PRODUCTION SERVER
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Production-Ready Express + Socket.io Server
 * - Autonomous Blockchain Monitoring (24/7)
 * - Server-Side Game Engine with State Persistence
 * - Real-Time Admin Dashboard
 * - Complete State Management
 * - PM2-Ready with Graceful Shutdown
 * 
 * Start: node server.js
 * PM2:   pm2 start server.js --name klassik-prod
 */

require('dotenv').config({ path: '/etc/klassik/klassik1.env' });

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const compression = require('compression');
const helmet = require('helmet');

// Database & Services
const db = require('./db');
const liveMonitor = require('./middleware/live-monitor');
const sacrificeWatcher = require('./services/sacrifice-watcher');
const GameEngine = require('./services/game-engine');
const BlockchainMonitor = require('./services/blockchain-monitor');

// Routes
const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');
const bookingsRoutes = require('./routes/bookings');
const usersRoutes = require('./routes/users');
const kaspaRoutes = require('./routes/kaspa');
const kaspaPublicRoutes = require('./routes/kaspa-public');
const kaspaEnhancedRoutes = require('./routes/kaspa-enhanced');
const adminRoutes = require('./routes/admin');
const adminV2Routes = require('./routes/admin-v2');
const searchRoutes = require('./routes/search');
const debugRoutes = require('./routes/debug');
const diagnosticRoutes = require('./routes/diagnostic');
const { router: communityRoutes, communityManager } = require('./controllers/community');
const ordersController = require('./controllers/orders');
const productsController = require('./controllers/products');
const paymentsController = require('./controllers/payments');
const kaspaPaymentsController = require('./controllers/kaspa-payments');

// Middleware
const authMiddleware = require('./middleware/auth');
const rateLimit = require('./middleware/rateLimit');
const { validateOrderRequest, validateProductRequest } = require('./middleware/validation');
const {
  authLimiter,
  registrationLimiter,
  paymentLimiter,
  blockchainLimiter,
  adminLimiter,
  generalLimiter
} = require('./middleware/enhanced-rate-limit');

// Config
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'production';

// JWT
const jwt = require('jsonwebtoken');
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET not set!');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPRESS & SOCKET.IO SETUP
// ═══════════════════════════════════════════════════════════════════════════

const app = express();
const server = http.createServer(app);

// Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZE SERVICES
// ═══════════════════════════════════════════════════════════════════════════

// Live Monitor
liveMonitor.init(io);

// Sacrifice Watcher (Autonomous 24/7)
sacrificeWatcher.io = io;

// Game Engine (Server-Side)
const gameEngine = new GameEngine(io);

// Blockchain Monitor
const blockchainMonitor = new BlockchainMonitor(io);

// Community Manager
communityManager.setWebSocket(io);

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

// Security
app.use(helmet({
  contentSecurityPolicy: false, // Allow embedding for iframe etc.
  crossOriginEmbedderPolicy: false
}));

app.use(compression());

// CORS
const ALLOWED_ORIGINS = [
  'https://klassik.99pace.space',
  'http://klassik.99pace.space',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.CORS_ORIGIN
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Live monitoring (tracks all requests)
app.use(liveMonitor.trackRequest());

// Request logging (development)
if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH CHECKS
// ═══════════════════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    services: {
      sacrificeWatcher: sacrificeWatcher.isRunning,
      gameEngine: gameEngine.getStats().activeSessions >= 0,
      blockchainMonitor: blockchainMonitor.isRunning || false
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      sacrifice: sacrificeWatcher.getStats(),
      games: gameEngine.getStats(),
      monitor: liveMonitor.getCurrentState().stats
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// Apply general rate limiting
app.use(generalLimiter);

// Auth routes
app.use('/api/auth/register', registrationLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth', authRoutes);

// Kaspa blockchain routes
app.use('/api/kaspa', blockchainLimiter, kaspaRoutes);
app.use('/api/kaspa-public', blockchainLimiter, kaspaPublicRoutes);
app.use('/api/kaspa-enhanced', authMiddleware, blockchainLimiter, kaspaEnhancedRoutes);

// Admin routes
app.use('/api/admin', adminLimiter, adminRoutes);
app.use('/api/admin-v2', authMiddleware, adminV2Routes);

// Search, community, events
app.use('/api/search', searchRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/users', usersRoutes);

// Debug & Diagnostics
app.use('/api/debug', debugRoutes);
app.use('/api/diagnostic', diagnosticRoutes);

// Orders & Products
app.post('/api/orders', authMiddleware, validateOrderRequest, ordersController.createOrder);
app.get('/api/orders/:id', authMiddleware, ordersController.getOrder);
app.get('/api/orders', authMiddleware, ordersController.listOrders);

app.get('/api/products/categories', productsController.getCategories);
app.get('/api/products/countries', productsController.getCountries);
app.get('/api/products/:id', productsController.getProduct);
app.get('/api/products', productsController.listProducts);
app.post('/api/products', authMiddleware, validateProductRequest, productsController.createProduct);
app.put('/api/products/:id', authMiddleware, validateProductRequest, productsController.updateProduct);
app.delete('/api/products/:id', authMiddleware, productsController.deleteProduct);

// Payments
app.post('/api/payments/invoice', authMiddleware, paymentLimiter, paymentsController.createInvoice);
app.post('/api/payments/webhook', paymentsController.handleWebhook);
app.get('/api/payments/:orderId', authMiddleware, paymentsController.getPaymentStatus);
app.get('/api/payments/status/:paymentId', authMiddleware, paymentsController.checkPaymentStatus);

// Kaspa Payments
app.post('/api/payments/kaspa/checkout', authMiddleware, paymentLimiter, kaspaPaymentsController.createKaspaCheckout);
app.get('/api/payments/kaspa/:orderId/status', authMiddleware, kaspaPaymentsController.checkKaspaPaymentStatus);
app.get('/api/payments/kaspa/price', kaspaPaymentsController.getKaspaPrice);

// ═══════════════════════════════════════════════════════════════════════════
// GAME API ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// Start game
app.post('/api/game/start', authMiddleware, async (req, res) => {
  try {
    const { gameType, buyInAmount } = req.body;
    const userId = req.user.userId || req.user.id;

    const session = await gameEngine.startGame(userId, gameType, buyInAmount);
    
    res.json({
      success: true,
      sessionId: session.id,
      balance: session.currentBalance,
      gameType: session.gameType
    });

  } catch (error) {
    console.error('Start game error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Place bet
app.post('/api/game/bet', authMiddleware, async (req, res) => {
  try {
    const { sessionId, betAmount } = req.body;

    const result = await gameEngine.placeBet(sessionId, parseFloat(betAmount));
    
    res.json(result);

  } catch (error) {
    console.error('Bet error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Cash out
app.post('/api/game/cashout', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;

    const result = await gameEngine.cashOut(sessionId);
    
    res.json(result);

  } catch (error) {
    console.error('Cashout error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get session state
app.get('/api/game/session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const session = await gameEngine.getSession(parseInt(req.params.sessionId));
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);

  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Recover session (for reconnection)
app.get('/api/game/recover', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const session = await gameEngine.recoverSession(userId);
    
    if (!session) {
      return res.json({ session: null });
    }

    res.json({ session });

  } catch (error) {
    console.error('Recover session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// STATIC FILES
// ═══════════════════════════════════════════════════════════════════════════

app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// Catch-all (SPA)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'index.html'));
  } else {
    res.status(404).json({ error: 'Endpoint not found' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ERROR HANDLER
// ═══════════════════════════════════════════════════════════════════════════

app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  const errorResponse = {
    error: err.message || 'Internal server error'
  };
  
  if (NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }
  
  res.status(err.status || 500).json(errorResponse);
});

// ═══════════════════════════════════════════════════════════════════════════
// WEBSOCKET AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    // Allow monitor access
    if (token === 'MONITOR_ACCESS') {
      socket.isMonitor = true;
      return next();
    }
    
    // Optional auth for regular connections
    if (!token) {
      socket.isGuest = true;
      return next();
    }
    
    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId || decoded.id;
    socket.userAddress = decoded.address;
    
    next();

  } catch (err) {
    console.error('WebSocket auth error:', err.message);
    socket.isGuest = true;
    next(); // Allow connection as guest
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// WEBSOCKET HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id} ${socket.userId ? `(User ${socket.userId})` : '(Guest)'}`);
  
  // Monitor room
  socket.on('join:monitor', () => {
    socket.join('monitor');
    console.log(`📊 Monitor connected: ${socket.id}`);
    socket.emit('monitor:state', liveMonitor.getCurrentState());
  });
  
  socket.on('monitor:request-state', () => {
    socket.emit('monitor:state', liveMonitor.getCurrentState());
  });
  
  // Game room
  socket.on('join:game', (sessionId) => {
    if (!socket.userId) {
      return socket.emit('error', { message: 'Authentication required' });
    }
    socket.join(`game:${sessionId}`);
    console.log(`🎮 User ${socket.userId} joined game ${sessionId}`);
  });
  
  // Sacrifice updates
  socket.on('subscribe:sacrifice', (address) => {
    if (socket.userAddress && address.toLowerCase() === socket.userAddress.toLowerCase()) {
      socket.join(`sacrifice:${address}`);
      console.log(`📡 User ${socket.userId} subscribed to sacrifice updates`);
    }
  });
  
  // Payment subscriptions
  socket.on('subscribe:payments', async (orderId) => {
    if (!socket.userId) {
      return socket.emit('error', { message: 'Authentication required' });
    }
    
    try {
      const orderCheck = await db.query(
        'SELECT user_id FROM orders WHERE id = $1',
        [orderId]
      );
      
      if (orderCheck.rows.length > 0 && orderCheck.rows[0].user_id === socket.userId) {
        socket.join(`order:${orderId}`);
        console.log(`📡 User ${socket.userId} subscribed to order ${orderId}`);
      } else {
        socket.emit('error', { message: 'Unauthorized' });
      }
    } catch (err) {
      console.error('Subscribe error:', err);
      socket.emit('error', { message: 'Subscription failed' });
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// STARTUP & SHUTDOWN
// ═══════════════════════════════════════════════════════════════════════════

async function startServer() {
  try {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  🏆 KLASSIK PRODUCTION SERVER');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Environment: ${NODE_ENV}`);
    console.log(`  Host:        ${HOST}`);
    console.log(`  Port:        ${PORT}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    // Test database connection
    console.log('🔍 Testing database connection...');
    const dbTest = await db.query('SELECT NOW() as time');
    console.log(`✅ Database connected: ${dbTest.rows[0].time}`);

    // Initialize game engine
    await gameEngine.initialize();

    // Start sacrifice watcher (autonomous 24/7)
    if (process.env.ENABLE_SACRIFICE_WATCHER !== 'false') {
      await sacrificeWatcher.start();
    }

    // Start blockchain monitor
    if (process.env.ENABLE_BLOCKCHAIN_MONITOR !== 'false') {
      await blockchainMonitor.start();
    }

    // Start server
    server.listen(PORT, HOST, () => {
      console.log('');
      console.log('✅ SERVER RUNNING');
      console.log('');
      console.log(`  Local:       http://localhost:${PORT}`);
      console.log(`  Network:     http://<YOUR_IP>:${PORT}`);
      console.log(`  Monitor:     http://localhost:${PORT}/monitor.html`);
      console.log(`  Health:      http://localhost:${PORT}/health`);
      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
  
  // Stop accepting new connections
  server.close(() => {
    console.log('✅ HTTP server closed');
  });

  // Stop services
  sacrificeWatcher.stop();
  gameEngine.shutdown();
  if (blockchainMonitor.stop) blockchainMonitor.stop();

  // Close database connections
  try {
    await db.end();
    console.log('✅ Database connections closed');
  } catch (err) {
    console.error('Error closing database:', err);
  }

  console.log('✅ Shutdown complete');
  process.exit(0);
}

// Signal handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// START
startServer();
