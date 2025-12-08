const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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
      id: user.id, // backward compatibility
      email: user.email,
      address: user.address || null
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, signature, address } = req.body;

    const identifier = email || address;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'email/address and password required' });
    }

    // Wallet-based registration when identifier is an Ethereum address
    if (ethers.utils.isAddress(identifier)) {
      const normalized = identifier.toLowerCase();

      if (!signature) {
        return res.status(400).json({ error: 'signature required for wallet registration' });
      }

      // Get nonce
      const nonceRes = await db.query('SELECT nonce, expires_at FROM nonces WHERE address = $1 LIMIT 1', [normalized]);
      if (nonceRes.rows.length === 0) {
        return res.status(400).json({ error: 'Nonce not found. Request a nonce first.' });
      }

      const nonceRow = nonceRes.rows[0];
      if (!nonceRow.nonce || !nonceRow.expires_at || new Date(nonceRow.expires_at) < new Date()) {
        return res.status(401).json({ error: 'Nonce expired. Request a new one.' });
      }

      const message = `Sign this message to authenticate with Klassik:\n\nNonce: ${nonceRow.nonce}\nTimestamp: ${new Date(nonceRow.expires_at).toISOString()}`;

      let recovered;
      try {
        recovered = ethers.utils.verifyMessage(message, signature);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      if (recovered.toLowerCase() !== normalized) {
        return res.status(401).json({ error: 'Signature verification failed' });
      }

      // Ensure wallet not already registered
      const exists = await db.query('SELECT id FROM users WHERE LOWER(address) = $1', [normalized]);
      if (exists.rows.length) {
        return res.status(409).json({ error: 'Wallet already registered' });
      }

      // Hash the provided secret (username) and save as password, store address in email column as requested
      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) {
        return res.status(400).json({ error: passwordCheck.message });
      }

      const hashed = await bcrypt.hash(password, 10);
      const result = await db.query(
        'INSERT INTO users (email, password, address, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING id, email, created_at, address',
        [normalized, hashed, normalized]
      );

      // Remove nonce after successful registration
      await db.query('DELETE FROM nonces WHERE address = $1', [normalized]);

      const user = result.rows[0];
      const token = generateToken(user);
      return res.status(201).json({ user, token, expiresIn: JWT_EXPIRY });
    }

    // Traditional email registration path
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.message });
    }

    const exists = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, hashed]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    res.json({ user, token, expiresIn: JWT_EXPIRY });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const result = await db.query('SELECT id, email, password FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    
    res.json({ 
      user: { id: user.id, email: user.email }, 
      token,
      expiresIn: JWT_EXPIRY
    });
  } catch (err) {
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

// Import wallet auth controller functions
const authController = require('../controllers/auth');

// GET /api/auth/nonce?address=0x...
router.get('/nonce', authController.getNonce);

// POST /api/auth/signin-with-wallet
router.post('/signin-with-wallet', authController.signInWithWallet);

module.exports = router;
