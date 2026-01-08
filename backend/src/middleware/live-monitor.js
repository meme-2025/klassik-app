/**
 * 🔥 LIVE MONITORING MIDDLEWARE
 * Trackt alle Events in Echtzeit und pusht sie via WebSocket
 * 
 * Features:
 * - Live Visitor Tracking
 * - User Status (Surfing, Registered, Logged In)
 * - Gaming Activity
 * - Wallet Transactions
 * - API Request Flow
 */

// Optional: GeoIP (fallback to Unknown if not installed)
let geoip;
try {
  geoip = require('geoip-lite');
} catch (err) {
  console.warn('⚠️ geoip-lite not installed, location tracking disabled');
  geoip = { lookup: () => null };
}

class LiveMonitor {
  constructor() {
    this.io = null;
    this.activeVisitors = new Map(); // IP -> Visitor Info
    this.activeGames = new Map(); // userId -> Game Session
    this.recentEvents = []; // Last 100 events
    this.stats = {
      totalRequests: 0,
      totalErrors: 0,
      apiCalls: {},
      registrations: 0,
      logins: 0,
      payments: 0,
      gamesSessions: 0
    };
  }

  // Initialisiere WebSocket Server
  init(io) {
    this.io = io;
    console.log('✅ Live Monitor initialized');
    
    // Broadcast stats every 5 seconds
    setInterval(() => {
      this.broadcastStats();
    }, 5000);
  }

  // Middleware für Request-Tracking
  trackRequest() {
    const self = this; // Save reference to this
    
    return (req, res, next) => {
      const startTime = Date.now();
      const visitorId = self.getVisitorId(req);

      // Update visitor info
      self.updateVisitor(req, visitorId);

      // Track response
      const originalSend = res.send;
      res.send = function(data) {
        const duration = Date.now() - startTime;
        
        // Log event
        self.logEvent({
          type: 'api_request',
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration,
          ip: req.ip,
          user: req.user?.id || null
        });

        // Update stats
        self.stats.totalRequests++;
        if (res.statusCode >= 400) {
          self.stats.totalErrors++;
        }

        const endpoint = `${req.method} ${req.path}`;
        self.stats.apiCalls[endpoint] = (self.stats.apiCalls[endpoint] || 0) + 1;

        return originalSend.call(this, data);
      };

      next();
    };
  }

  // Get unique visitor ID
  getVisitorId(req) {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  // Update visitor information
  updateVisitor(req, visitorId) {
    const geo = geoip.lookup(req.ip) || { country: 'Unknown', city: 'Unknown' };
    
    const visitor = {
      id: visitorId,
      ip: req.ip,
      lastSeen: Date.now(),
      userAgent: req.get('user-agent'),
      location: `${geo.city || 'Unknown'}, ${geo.country || 'Unknown'}`,
      userId: req.user?.id || null,
      isLoggedIn: !!req.user,
      currentPath: req.path
    };

    this.activeVisitors.set(visitorId, visitor);

    // Cleanup old visitors (>5 minutes inactive)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    for (const [id, v] of this.activeVisitors.entries()) {
      if (v.lastSeen < fiveMinutesAgo) {
        this.activeVisitors.delete(id);
      }
    }

    this.broadcastVisitors();
  }

  // Track user registration
  trackRegistration(userId, email, address) {
    this.stats.registrations++;
    this.logEvent({
      type: 'user_registered',
      userId,
      email,
      address,
      timestamp: Date.now()
    });
  }

  // Track user login
  trackLogin(userId, email) {
    this.stats.logins++;
    this.logEvent({
      type: 'user_login',
      userId,
      email,
      timestamp: Date.now()
    });
  }

  // Track game session
  trackGameStart(userId, gameType) {
    this.stats.gamesSessions++;
    this.activeGames.set(userId, {
      userId,
      gameType,
      startTime: Date.now(),
      active: true
    });

    this.logEvent({
      type: 'game_started',
      userId,
      gameType,
      timestamp: Date.now()
    });

    this.broadcastGameSessions();
  }

  trackGameEnd(userId) {
    const session = this.activeGames.get(userId);
    if (session) {
      session.active = false;
      session.duration = Date.now() - session.startTime;
      
      this.logEvent({
        type: 'game_ended',
        userId,
        duration: session.duration,
        timestamp: Date.now()
      });

      this.activeGames.delete(userId);
      this.broadcastGameSessions();
    }
  }

  // Track payment/transaction
  trackPayment(data) {
    this.stats.payments++;
    this.logEvent({
      type: 'payment_received',
      ...data,
      timestamp: Date.now()
    });
  }

  // Track wallet transaction
  trackWalletTransaction(txHash, amount, address, type = 'sacrifice') {
    this.logEvent({
      type: 'wallet_transaction',
      txHash,
      amount,
      address,
      transactionType: type,
      timestamp: Date.now()
    });
  }

  // Log event to history
  logEvent(event) {
    event.id = Date.now() + Math.random();
    this.recentEvents.unshift(event);
    
    // Keep only last 100 events
    if (this.recentEvents.length > 100) {
      this.recentEvents = this.recentEvents.slice(0, 100);
    }

    // Broadcast to monitor dashboard
    if (this.io) {
      this.io.to('monitor').emit('event', event);
    }
  }

  // Broadcast current visitors
  broadcastVisitors() {
    if (!this.io) return;
    
    const visitors = Array.from(this.activeVisitors.values());
    this.io.to('monitor').emit('visitors:update', {
      count: visitors.length,
      visitors: visitors.map(v => ({
        id: v.id.substring(0, 10) + '...',
        location: v.location,
        isLoggedIn: v.isLoggedIn,
        userId: v.userId,
        currentPath: v.currentPath,
        lastSeen: v.lastSeen
      }))
    });
  }

  // Broadcast game sessions
  broadcastGameSessions() {
    if (!this.io) return;
    
    const sessions = Array.from(this.activeGames.values());
    this.io.to('monitor').emit('games:update', {
      count: sessions.length,
      sessions: sessions.map(s => ({
        userId: s.userId,
        gameType: s.gameType,
        duration: Date.now() - s.startTime,
        active: s.active
      }))
    });
  }

  // Broadcast stats
  broadcastStats() {
    if (!this.io) return;
    
    this.io.to('monitor').emit('stats:update', {
      totalRequests: this.stats.totalRequests,
      totalErrors: this.stats.totalErrors,
      registrations: this.stats.registrations,
      logins: this.stats.logins,
      payments: this.stats.payments,
      gamesSessions: this.stats.gamesSessions,
      activeVisitors: this.activeVisitors.size,
      activeGames: this.activeGames.size,
      topEndpoints: this.getTopEndpoints(5)
    });
  }

  // Get top API endpoints
  getTopEndpoints(limit = 5) {
    return Object.entries(this.stats.apiCalls)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([endpoint, count]) => ({ endpoint, count }));
  }

  // Get all current state (for initial load)
  getCurrentState() {
    return {
      visitors: Array.from(this.activeVisitors.values()),
      games: Array.from(this.activeGames.values()),
      recentEvents: this.recentEvents.slice(0, 20),
      stats: {
        ...this.stats,
        activeVisitors: this.activeVisitors.size,
        activeGames: this.activeGames.size,
        topEndpoints: this.getTopEndpoints(5)
      }
    };
  }
}

// Singleton instance
const monitor = new LiveMonitor();

module.exports = monitor;
