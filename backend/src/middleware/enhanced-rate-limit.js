/**
 * ============================================
 * ENHANCED RATE LIMITING MIDDLEWARE
 * ============================================
 * 
 * Implementiert differenzierte Rate-Limits für verschiedene Route-Typen:
 * - Auth-Routes: Schutz vor Brute-Force
 * - Payment-Routes: Schutz vor Spam
 * - Blockchain-Queries: API-Schutz
 * - Admin-Routes: Zusätzliche Sicherheit
 */

const rateLimit = require('express-rate-limit');

/**
 * ✅ Auth Routes Rate Limiter
 * Schutz vor Brute-Force-Angriffen
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 10, // Max 10 Anfragen
  message: {
    error: 'Too many authentication attempts',
    retryAfter: 'Please try again in 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Identifizierung nach IP + User-Agent
  keyGenerator: (req) => {
    return `${req.ip}-${req.headers['user-agent']}`;
  },
  // Skip für Whitelisted IPs
  skip: (req) => {
    const whitelist = (process.env.RATE_LIMIT_WHITELIST || '').split(',');
    return whitelist.includes(req.ip);
  },
  handler: (req, res) => {
    console.warn(`⚠️ Rate limit exceeded for auth: ${req.ip}`);
    res.status(429).json({
      error: 'Too many authentication attempts',
      retryAfter: Math.ceil(req.rateLimit.resetTime.getTime() / 1000),
      message: 'Please wait before trying again'
    });
  }
});

/**
 * ✅ Registration Rate Limiter
 * Noch striktere Limits für Registrierungen
 */
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 Stunde
  max: 3, // Max 3 Registrierungen
  message: {
    error: 'Too many registration attempts',
    retryAfter: 'Please try again in 1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Reset nach erfolgreicher Registrierung
  handler: (req, res) => {
    console.warn(`⚠️ Registration limit exceeded: ${req.ip}`);
    res.status(429).json({
      error: 'Registration limit exceeded',
      message: 'Too many registration attempts from this IP. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime.getTime() / 1000)
    });
  }
});

/**
 * ✅ Payment Routes Rate Limiter
 * Schutz vor Payment-Spam
 */
const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 Minuten
  max: 5, // Max 5 Zahlungen
  message: {
    error: 'Too many payment requests',
    retryAfter: 'Please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Payment limit exceeded: ${req.ip}`);
    res.status(429).json({
      error: 'Payment request limit exceeded',
      message: 'Too many payment requests. Please wait a moment.',
      retryAfter: Math.ceil(req.rateLimit.resetTime.getTime() / 1000)
    });
  }
});

/**
 * ✅ Blockchain Query Rate Limiter
 * Schutz der Blockchain-API-Calls
 */
const blockchainLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 Minute
  max: 60, // Max 60 Anfragen = 1/Sekunde
  message: {
    error: 'Blockchain API rate limit exceeded',
    retryAfter: 'Please reduce request frequency'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Blockchain API limit exceeded: ${req.ip}`);
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many blockchain queries. Maximum 60 requests per minute.',
      retryAfter: Math.ceil(req.rateLimit.resetTime.getTime() / 1000)
    });
  }
});

/**
 * ✅ Admin Routes Rate Limiter
 * Moderate Limits für Admin-Operationen
 */
const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 Minute
  max: 30, // Max 30 Anfragen
  message: {
    error: 'Admin rate limit exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Admin limit exceeded: ${req.ip} - ${req.user?.address}`);
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many admin requests',
      retryAfter: Math.ceil(req.rateLimit.resetTime.getTime() / 1000)
    });
  }
});

/**
 * ✅ General API Rate Limiter
 * Standard-Schutz für alle anderen Routes
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 100, // Max 100 Anfragen
  message: {
    error: 'Rate limit exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ General rate limit exceeded: ${req.ip}`);
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please slow down.',
      retryAfter: Math.ceil(req.rateLimit.resetTime.getTime() / 1000)
    });
  }
});

/**
 * ✅ Strict Limiter für kritische Operationen
 * Sehr strenge Limits (z.B. Password-Reset, Account-Deletion)
 */
const strictLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 Stunden
  max: 5, // Max 5 Anfragen pro Tag
  message: {
    error: 'Daily limit exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Strict limit exceeded: ${req.ip}`);
    res.status(429).json({
      error: 'Daily operation limit exceeded',
      message: 'You have exceeded the daily limit for this operation.',
      retryAfter: Math.ceil(req.rateLimit.resetTime.getTime() / 1000)
    });
  }
});

/**
 * ✅ Dynamic Rate Limiter Factory
 * Erstellt Custom Rate Limiter
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = 'Rate limit exceeded',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;
  
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    skipFailedRequests,
    handler: (req, res) => {
      console.warn(`⚠️ Custom rate limit exceeded: ${req.ip}`);
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(req.rateLimit.resetTime.getTime() / 1000)
      });
    }
  });
}

module.exports = {
  authLimiter,
  registrationLimiter,
  paymentLimiter,
  blockchainLimiter,
  adminLimiter,
  generalLimiter,
  strictLimiter,
  createRateLimiter
};
