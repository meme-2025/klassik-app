const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');

// Ensure JWT_SECRET is set
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set!');
  process.exit(1);
}

/**
 * JWT Authentication Middleware
 * Verifies Bearer token and attaches user to req.user
 * Also tracks session activity for Admin Panel V2
 */
module.exports = async (req, res, next) => {
  const auth = req.headers.authorization;
  
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }
  
  const token = auth.split(' ')[1];
  
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    
    // Attach user to request with normalized structure
    req.user = {
      userId: payload.userId || payload.id,
      id: payload.userId || payload.id,
      email: payload.email,
      address: payload.address
    };
    
    // Track session activity (non-blocking)
    setImmediate(async () => {
      try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const userId = payload.userId || payload.id;
        
        // Update session last_activity
        await db.query(`
          UPDATE user_sessions 
          SET last_activity = CURRENT_TIMESTAMP 
          WHERE token_hash = $1 AND user_id = $2 AND is_active = TRUE
        `, [tokenHash, userId]);
        
        // Update user last_seen
        await db.query(`
          UPDATE users 
          SET last_seen = CURRENT_TIMESTAMP, is_online = TRUE
          WHERE id = $1
        `, [userId]);
        
      } catch (err) {
        // Don't block request on tracking errors
        console.warn('⚠️ Session tracking error:', err.message);
      }
    });
    
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};
