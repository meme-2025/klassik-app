const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');

const NONCE_EXPIRY_MINUTES = 10;

/**
 * GET /auth/nonce?address=0x...
 * Generate and return a nonce for signing
 */
async function getNonce(req, res) {
  try {
    const { address } = req.query;
    
    if (!address || !ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Valid Ethereum address required' });
    }

    const normalizedAddress = address.toLowerCase();
    // Only allow nonce for existing registered users (wallet connection only for members)
    const userRes = await db.query(
      `SELECT id FROM users WHERE LOWER(address) = $1 OR LOWER(password) = $1 LIMIT 1`,
      [normalizedAddress]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Address not registered. Please register first.' });
    }

    const userId = userRes.rows[0].id;
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiryTime = new Date(Date.now() + NONCE_EXPIRY_MINUTES * 60 * 1000);

    // Update user row with nonce
    await db.query(
      'UPDATE users SET nonce = $1, nonce_expiry = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [nonce, expiryTime, userId]
    );

    res.json({ 
      nonce,
      message: `Sign this message to authenticate with Klassik:\n\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`
    });
  } catch (error) {
    console.error('getNonce error:', error);
    res.status(500).json({ error: 'Failed to generate nonce' });
  }
}

/**
 * POST /auth/signin-with-wallet
 * Verify signature and issue JWT
 */
async function signInWithWallet(req, res) {
  try {
    const { address, signature } = req.body;

    if (!address || !signature) {
      return res.status(400).json({ error: 'Address and signature required' });
    }

    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }

    const normalizedAddress = address.toLowerCase();

    // Get user with nonce
    const userResult = await db.query(
      'SELECT id, nonce, nonce_expiry FROM users WHERE address = $1',
      [normalizedAddress]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Address not found. Please request a nonce first.' });
    }

    const user = userResult.rows[0];

    // Check nonce expiry
    if (!user.nonce || !user.nonce_expiry || new Date(user.nonce_expiry) < new Date()) {
      return res.status(401).json({ error: 'Nonce expired. Please request a new one.' });
    }

    // Verify signature
    const message = `Sign this message to authenticate with Klassik:\n\nNonce: ${user.nonce}\nTimestamp: ${new Date(user.nonce_expiry).toISOString()}`;
    
    let recoveredAddress;
    try {
      recoveredAddress = ethers.utils.verifyMessage(message, signature);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    if (recoveredAddress.toLowerCase() !== normalizedAddress) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }

    // Clear nonce after successful verification
    await db.query(
      'UPDATE users SET nonce = NULL, nonce_expiry = NULL WHERE id = $1',
      [user.id]
    );

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, address: normalizedAddress },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );
    // Fetch user details to return
    const ures = await db.query('SELECT id, email, created_at, address FROM users WHERE id = $1', [user.id]);
    const userRow = ures.rows[0];

    res.json({ 
      token,
      address: normalizedAddress,
      expiresIn: process.env.JWT_EXPIRY || '24h',
      user: userRow
    });
  } catch (error) {
    console.error('signInWithWallet error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware to verify JWT token
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

module.exports = {
  getNonce,
  signInWithWallet,
  authenticateToken
};
