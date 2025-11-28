const jwt = require('jsonwebtoken');

// Ensure JWT_SECRET is set
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set!');
  process.exit(1);
}

/**
 * JWT Authentication Middleware
 * Verifies Bearer token and attaches user to req.user
 */
module.exports = (req, res, next) => {
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
    
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};
