/**
 * Simple in-memory rate limiter
 * For production, use Redis-based limiter like express-rate-limit with Redis store
 */

const requestCounts = new Map();

/**
 * Rate limiting middleware factory
 * @param {number} windowMs - Time window in milliseconds
 * @param {number} max - Max requests per window
 */
function rateLimit(windowMs = 60000, max = 10) {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    // Get or create request log for this IP
    if (!requestCounts.has(key)) {
      requestCounts.set(key, []);
    }
    
    const requests = requestCounts.get(key);
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);
    
    // Check if limit exceeded
    if (validRequests.length >= max) {
      return res.status(429).json({ 
        error: 'Too many requests, please try again later',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    // Add current request
    validRequests.push(now);
    requestCounts.set(key, validRequests);
    
    next();
  };
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 3600000; // 1 hour
  
  for (const [key, requests] of requestCounts.entries()) {
    const validRequests = requests.filter(timestamp => now - timestamp < maxAge);
    if (validRequests.length === 0) {
      requestCounts.delete(key);
    } else {
      requestCounts.set(key, validRequests);
    }
  }
}, 300000);

module.exports = rateLimit;
