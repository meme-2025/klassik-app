/**
 * ============================================
 * KLASSIK - WALLET-ONLY AUTHENTICATION
 * ============================================
 * 
 * Pure wallet-based authentication using Ethereum signatures.
 * No email/password authentication.
 * 
 * Flow:
 * 1. GET /nonce?address=0x... → Get signing nonce
 * 2. User signs message with MetaMask
 * 3. POST /register or /login with signature
 * 4. Backend verifies signature → Issues JWT
 * 5. All protected routes use JWT token
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { ethers } = require('ethers');
const sacrificeAuth = require('../controllers/sacrifice-auth');
const liveMonitor = require('../middleware/live-monitor');

const router = express.Router();

// Ensure JWT_SECRET is configured
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set!');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const NONCE_EXPIRY_MINUTES = 10;

/**
 * Generate JWT token for authenticated user
 */
function generateToken(user) {
  return jwt.sign(
    { 
      userId: user.id,
      id: user.id,
      address: user.address,
      username: user.username
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Validate username
 */
function validateUsername(username) {
  if (!username) {
    return { valid: false, message: 'Username is required' };
  }
  
  if (username.length < 3 || username.length > 30) {
    return { valid: false, message: 'Username must be 3-30 characters' };
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, message: 'Username can only contain letters, numbers and underscore' };
  }
  
  return { valid: true };
}

/**
 * Verify Ethereum signature
 */
async function verifySignature(address, signature, nonce, expiresAt) {
  // CRITICAL: Message MUST match exactly what /nonce endpoint sent
  // expiresAt is already an ISO string from DB, don't re-parse it
  const message = `Sign this message to authenticate with Klassik:\n\nNonce: ${nonce}\nTimestamp: ${expiresAt}`;
  
  console.log('🔐 Verifying signature:');
  console.log('  Address:', address);
  console.log('  Nonce:', nonce);
  console.log('  Timestamp:', expiresAt);
  console.log('  Message:', message);
  console.log('  Signature:', signature.substring(0, 20) + '...');
  
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    console.log('  Recovered:', recoveredAddress);
    console.log('  Match:', recoveredAddress.toLowerCase() === address.toLowerCase());
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (err) {
    console.error('❌ Signature verification error:', err);
    return false;
  }
}

// ============================================
// PUBLIC ENDPOINTS
// ============================================

/**
 * GET /api/auth/nonce?address=0x...
 * Generate and return a nonce for wallet signing
 */
router.get('/nonce', async (req, res) => {
  try {
    const { address } = req.query;

    // Simplified validation for testing - accept any address-like string  
    if (!address || address.length < 10) {
      return res.status(400).json({ error: 'Address required' });
    }

    const normalizedAddress = address.toLowerCase();
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiryTime = new Date(Date.now() + NONCE_EXPIRY_MINUTES * 60 * 1000);

    // Store nonce in database
    await db.query(
      `INSERT INTO nonces (address, nonce, expires_at, created_at) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (address) 
       DO UPDATE SET nonce = EXCLUDED.nonce, expires_at = EXCLUDED.expires_at`,
      [normalizedAddress, nonce, expiryTime]
    );

    const message = `Sign this message to authenticate with Klassik:\n\nNonce: ${nonce}\nTimestamp: ${expiryTime.toISOString()}`;

    res.json({
      nonce,
      message,
      expiresAt: expiryTime.toISOString()
    });
  } catch (error) {
    console.error('GET /nonce error:', error);
    res.status(500).json({ error: 'Failed to generate nonce' });
  }
});

/**
 * GET /api/auth/check?address=0x...
 * Check if wallet is registered
 */
router.get('/check', async (req, res) => {
  try {
    const { address } = req.query;
    
    // Simplified validation for testing - accept any address-like string
    if (!address || address.length < 10) {
      return res.status(400).json({ error: 'Address required' });
    }

    const normalized = address.toLowerCase();
    
    const result = await db.query(
      'SELECT id, username, address, created_at FROM users WHERE LOWER(address) = $1',
      [normalized]
    );
    
    if (result.rows.length === 0) {
      return res.json({ 
        registered: false,
        address: normalized 
      });
    }
    
    return res.json({
      registered: true,
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        address: result.rows[0].address,
        created_at: result.rows[0].created_at
      }
    });
    
  } catch (err) {
    console.error('GET /check error:', err);
    res.status(500).json({ error: 'Check failed' });
  }
});

/**
 * POST /api/auth/register
 * Register new user with wallet signature (SACRIFICE-BASED)
 */
router.post('/register', async (req, res) => {
  return sacrificeAuth.registerWithSacrifice(req, res);
});

/**
 * POST /api/auth/register-legacy
 * Legacy registration without sacrifice requirement
 */
router.post('/register-legacy', async (req, res) => {
  try {
    const { address, signature, username } = req.body;

    // Validation
    if (!address || !signature || !username) {
      return res.status(400).json({ 
        error: 'address, signature and username are required' 
      });
    }

    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }

    // Username validation
    const usernameCheck = validateUsername(username);
    if (!usernameCheck.valid) {
      return res.status(400).json({ error: usernameCheck.message });
    }

    const normalized = address.toLowerCase();

    // Get nonce from database
    const nonceRes = await db.query(
      'SELECT nonce, expires_at FROM nonces WHERE address = $1',
      [normalized]
    );

    if (nonceRes.rows.length === 0) {
      return res.status(400).json({ 
        error: 'No nonce found. Please request a nonce first.' 
      });
    }

    const { nonce, expires_at } = nonceRes.rows[0];

    if (new Date(expires_at) < new Date()) {
      return res.status(401).json({ error: 'Nonce expired. Request a new one.' });
    }

    // Convert DB timestamp to ISO string (to match /nonce endpoint format)
    const expiresAtISO = new Date(expires_at).toISOString();

    // Verify signature
    const isValid = await verifySignature(normalized, signature, nonce, expiresAtISO);
    if (!isValid) {
      return res.status(401).json({ 
        error: 'Signature verification failed' 
      });
    }

    // Check if wallet already registered
    const exists = await db.query(
      'SELECT id FROM users WHERE LOWER(address) = $1',
      [normalized]
    );

    if (exists.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Wallet already registered' 
      });
    }

    // Check if username already taken
    const usernameExists = await db.query(
      'SELECT id FROM users WHERE LOWER(username) = $1',
      [username.toLowerCase()]
    );

    if (usernameExists.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Username already taken. Please choose another one.' 
      });
    }

    // Create user
    const result = await db.query(
      `INSERT INTO users (address, username, created_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Berlin') 
       RETURNING id, address, username, created_at`,
      [normalized, username]
    );

    const user = result.rows[0];

    // Delete used nonce
    await db.query('DELETE FROM nonces WHERE address = $1', [normalized]);

    // Generate JWT token
    const token = generateToken(user);

    console.log(`✅ Wallet registered: ${normalized} → ${username}`);

    // Track registration in live monitor
    liveMonitor.trackRegistration(user.id, username, user.address);

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        address: user.address,
        username: user.username,
        created_at: user.created_at
      },
      token,
      expiresIn: JWT_EXPIRY
    });

  } catch (err) {
    console.error('POST /register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/check-sacrifice
 * Check sacrifice eligibility for registration
 */
router.post('/check-sacrifice', sacrificeAuth.checkSacrificeEligibility);

/**
 * GET /api/auth/sacrifice/:kaspaAddress/stats
 * Get sacrifice statistics
 */
router.get('/sacrifice/:kaspaAddress/stats', sacrificeAuth.getSacrificeStats);

/**
 * POST /api/auth/login
 * Login with wallet signature
 * Body: { address, signature }
 */
router.post('/login', async (req, res) => {
  try {
    const { address, signature } = req.body;

    if (!address || !signature) {
      return res.status(400).json({ 
        error: 'address and signature are required' 
      });
    }

    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }

    const normalized = address.toLowerCase();

    // Get nonce
    const nonceRes = await db.query(
      'SELECT nonce, expires_at FROM nonces WHERE address = $1',
      [normalized]
    );

    if (nonceRes.rows.length === 0) {
      return res.status(400).json({ 
        error: 'No nonce found. Please request a nonce first.' 
      });
    }

    const { nonce, expires_at } = nonceRes.rows[0];

    if (new Date(expires_at) < new Date()) {
      return res.status(401).json({ error: 'Nonce expired. Request a new one.' });
    }

    // Convert DB timestamp to ISO string (to match /nonce endpoint format)
    const expiresAtISO = new Date(expires_at).toISOString();

    // Verify signature
    const isValid = await verifySignature(normalized, signature, nonce, expiresAtISO);
    if (!isValid) {
      return res.status(401).json({ 
        error: 'Signature verification failed' 
      });
    }

    // Find user
    const userRes = await db.query(
      'SELECT id, address, username, created_at, is_admin, sacrifice_points FROM users WHERE LOWER(address) = $1',
      [normalized]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Wallet not registered. Please register first.' 
      });
    }

    const user = userRes.rows[0];

    // Delete used nonce
    await db.query('DELETE FROM nonces WHERE address = $1', [normalized]);

    // Generate JWT token
    const token = generateToken(user);

    // Create session tracking (Admin Panel V2)
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await db.query(`
        INSERT INTO user_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [user.id, tokenHash, ipAddress, userAgent, expiresAt]);

      // Set user as online
      await db.query(`
        UPDATE users SET is_online = TRUE, last_seen = CURRENT_TIMESTAMP WHERE id = $1
      `, [user.id]);

      console.log(`📊 Session created for ${user.username} from ${ipAddress}`);
    } catch (sessionErr) {
      console.warn('⚠️ Failed to create session tracking:', sessionErr.message);
    }

    console.log(`✅ Wallet login: ${user.username} (${normalized})`);

    // Track login in live monitor
    liveMonitor.trackLogin(user.id, user.username);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        address: user.address,
        username: user.username,
        created_at: user.created_at,
        is_admin: user.is_admin || false,
        sacrifice_points: user.sacrifice_points || 0
      },
      token,
      expiresIn: JWT_EXPIRY
    });

  } catch (err) {
    console.error('POST /login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (requires JWT token)
 */
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    
    const result = await db.query(
      'SELECT id, address, username, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('GET /me error:', err);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

module.exports = router;
