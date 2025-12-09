const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { ethers } = require('ethers');

const router = express.Router();

// Ensure JWT_SECRET is configured
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set!');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const NONCE_EXPIRY_MINUTES = 10;

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate email format
 */
function validateEmail(email) {
  return EMAIL_REGEX.test(email);
}

/**
 * Validate password strength
 */
function validatePassword(password) {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  return { valid: true };
}

/**
 * Generate JWT token with consistent payload structure
 */
function generateToken(user) {
  return jwt.sign(
    { 
      userId: user.id,
      id: user.id,
      email: user.email || null,
      address: user.address || null
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.message });
    }

    // Check if user already exists
    const exists = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password and create user
    const hashed = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (email, password, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING id, email, created_at',
      [email, hashed]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    res.status(201).json({ 
      message: 'User registered successfully',
      user, 
      token, 
      expiresIn: JWT_EXPIRY 
    });
  } catch (err) {
    console.error('Register error:', err);
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const result = await db.query(
      'SELECT id, email, password, address, created_at FROM users WHERE email = $1', 
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user);
    
    res.json({ 
      message: 'Login successful',
      user: { 
        id: user.id, 
        email: user.email,
        address: user.address,
        created_at: user.created_at
      }, 
      token,
      expiresIn: JWT_EXPIRY
    });
  } catch (err) {
    console.error('Login error:', err);
    next(err);
  }
});

// GET /auth/user?address=0x...
// Try to match wallet address
router.get('/user', async (req, res, next) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: 'address is required' });
    }
    
    const normalized = address.toLowerCase();
    const result = await db.query(
      `SELECT id, email, created_at, address FROM users 
       WHERE LOWER(address) = $1 LIMIT 1`,
      [normalized]
    );
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// POST /auth/user
// Register wallet address (for wallet-only users)
router.post('/user', async (req, res, next) => {
  try {
    const { address, email } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'address is required' });
    }
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    // Validate email
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const normalized = address.toLowerCase();

    // Check if wallet already exists
    const exists = await db.query(
      `SELECT id, email, created_at, address FROM users WHERE LOWER(address) = $1 LIMIT 1`,
      [normalized]
    );
    
    if (exists.rows.length) {
      return res.status(409).json({ 
        error: 'Wallet already registered', 
        user: exists.rows[0] 
      });
    }

    // Check if email already exists
    const emailExists = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (emailExists.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Create wallet user (no password field, will use wallet authentication)
    const insert = await db.query(
      `INSERT INTO users (address, email, created_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP) 
       RETURNING id, email, created_at, address`,
      [normalized, email]
    );
    
    const user = insert.rows[0];
    const token = generateToken(user);
    
    res.status(201).json({ user, token, expiresIn: JWT_EXPIRY });
  } catch (err) {
    next(err);
  }
});

// ============================================
// WALLET AUTHENTICATION ENDPOINTS
// ============================================

/**
 * GET /api/auth/nonce?address=0x...
 * Generate and return a nonce for wallet signing
 */
router.get('/nonce', async (req, res) => {
  try {
    const { address } = req.query;

    if (!address || !ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Valid Ethereum address required' });
    }

    const normalizedAddress = address.toLowerCase();
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiryTime = new Date(Date.now() + NONCE_EXPIRY_MINUTES * 60 * 1000);

    // Store nonce in nonces table
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
    console.error('getNonce error:', error);
    res.status(500).json({ error: 'Failed to generate nonce' });
  }
});

/**
 * POST /api/auth/register-wallet
 * Register a new user with wallet address
 * Body: { address, signature, email? }
 */
router.post('/register-wallet', async (req, res) => {
  try {
    const { address, signature, email } = req.body;

    if (!address || !signature) {
      return res.status(400).json({ error: 'Address and signature required' });
    }

    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }

    const normalizedAddress = address.toLowerCase();

    // Verify signature
    const nonceRes = await db.query(
      'SELECT nonce, expires_at FROM nonces WHERE address = $1',
      [normalizedAddress]
    );

    if (nonceRes.rows.length === 0) {
      return res.status(400).json({ error: 'Nonce not found. Request a nonce first.' });
    }

    const { nonce, expires_at } = nonceRes.rows[0];
    
    if (new Date(expires_at) < new Date()) {
      return res.status(401).json({ error: 'Nonce expired. Request a new nonce.' });
    }

    const message = `Sign this message to authenticate with Klassik:\n\nNonce: ${nonce}\nTimestamp: ${new Date(expires_at).toISOString()}`;

    let recoveredAddress;
    try {
      recoveredAddress = ethers.utils.verifyMessage(message, signature);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    if (recoveredAddress.toLowerCase() !== normalizedAddress) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }

    // Check if wallet already registered
    const exists = await db.query(
      'SELECT id, email, address, created_at FROM users WHERE LOWER(address) = $1',
      [normalizedAddress]
    );

    if (exists.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Wallet already registered',
        user: exists.rows[0]
      });
    }

    // Validate email if provided
    if (email && !validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if email already used
    if (email) {
      const emailExists = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (emailExists.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }
    }

    // Create wallet user (no password needed)
    const result = await db.query(
      `INSERT INTO users (address, email, created_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP) 
       RETURNING id, email, address, created_at`,
      [normalizedAddress, email || null]
    );

    const user = result.rows[0];

    // Delete used nonce
    await db.query('DELETE FROM nonces WHERE address = $1', [normalizedAddress]);

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      message: 'Wallet registered successfully',
      user,
      token,
      expiresIn: JWT_EXPIRY
    });

  } catch (error) {
    console.error('register-wallet error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login-wallet
 * Login with wallet signature
 * Body: { address, signature }
 */
router.post('/login-wallet', async (req, res) => {
  try {
    const { address, signature } = req.body;

    if (!address || !signature) {
      return res.status(400).json({ error: 'Address and signature required' });
    }

    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }

    const normalizedAddress = address.toLowerCase();

    // Get and verify nonce
    const nonceRes = await db.query(
      'SELECT nonce, expires_at FROM nonces WHERE address = $1',
      [normalizedAddress]
    );

    if (nonceRes.rows.length === 0) {
      return res.status(400).json({ error: 'Nonce not found. Request a nonce first.' });
    }

    const { nonce, expires_at } = nonceRes.rows[0];

    if (new Date(expires_at) < new Date()) {
      return res.status(401).json({ error: 'Nonce expired. Request a new nonce.' });
    }

    const message = `Sign this message to authenticate with Klassik:\n\nNonce: ${nonce}\nTimestamp: ${new Date(expires_at).toISOString()}`;

    // Verify signature
    let recoveredAddress;
    try {
      recoveredAddress = ethers.utils.verifyMessage(message, signature);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    if (recoveredAddress.toLowerCase() !== normalizedAddress) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }

    // Find user
    const userResult = await db.query(
      'SELECT id, email, address, created_at FROM users WHERE LOWER(address) = $1',
      [normalizedAddress]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Wallet not registered. Please register first.',
        needsRegistration: true
      });
    }

    const user = userResult.rows[0];

    // Delete used nonce
    await db.query('DELETE FROM nonces WHERE address = $1', [normalizedAddress]);

    // Generate token
    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      user,
      token,
      expiresIn: JWT_EXPIRY
    });

  } catch (error) {
    console.error('login-wallet error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Test endpoint to verify auth routes are working
router.get('/test', (req, res) => {
  res.json({ 
    status: 'Auth routes active',
    timestamp: new Date().toISOString(),
    endpoints: {
      email_password: {
        'POST /api/auth/register': 'Register with email & password',
        'POST /api/auth/login': 'Login with email & password'
      },
      wallet: {
        'GET /api/auth/nonce?address=0x...': 'Get nonce for wallet signing',
        'POST /api/auth/register-wallet': 'Register with wallet signature',
        'POST /api/auth/login-wallet': 'Login with wallet signature'
      },
      legacy: {
        'GET /api/auth/user?address=0x...': 'Get user by address',
        'POST /api/auth/user': 'Create wallet user (deprecated)'
      }
    }
  });
});

module.exports = router;
