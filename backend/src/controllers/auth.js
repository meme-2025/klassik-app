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
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiryTime = new Date(Date.now() + NONCE_EXPIRY_MINUTES * 60 * 1000);

    // Upsert into nonces table so anyone (pre-registration) can request a nonce
    await db.query(
      `INSERT INTO nonces (address, nonce, expires_at) VALUES ($1, $2, $3)
       ON CONFLICT (address) DO UPDATE SET nonce = EXCLUDED.nonce, expires_at = EXCLUDED.expires_at`,
      [normalizedAddress, nonce, expiryTime]
    );

    res.json({
      nonce,
      message: `Sign this message to authenticate with Klassik:\n\nNonce: ${nonce}\nTimestamp: ${expiryTime.toISOString()}`
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

    // Get nonce from nonces table
    const nonceRes = await db.query(
      'SELECT nonce, expires_at FROM nonces WHERE address = $1 LIMIT 1',
      [normalizedAddress]
    );

    if (nonceRes.rows.length === 0) {
      return res.status(404).json({ error: 'Nonce not found. Please request a nonce first.' });
    }

    const nonceRow = nonceRes.rows[0];
    if (!nonceRow.nonce || !nonceRow.expires_at || new Date(nonceRow.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Nonce expired. Please request a new one.' });
    }

    const message = `Sign this message to authenticate with Klassik:\n\nNonce: ${nonceRow.nonce}\nTimestamp: ${new Date(nonceRow.expires_at).toISOString()}`;

    let recoveredAddress;
    try {
      recoveredAddress = ethers.utils.verifyMessage(message, signature);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    if (recoveredAddress.toLowerCase() !== normalizedAddress) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }

    // Find user by address
    const userResult = await db.query(
      'SELECT id FROM users WHERE LOWER(address) = $1 LIMIT 1',
      [normalizedAddress]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Address not registered. Please register first.' });
    }

    const userId = userResult.rows[0].id;

    // Delete nonce after successful verification
    await db.query('DELETE FROM nonces WHERE address = $1', [normalizedAddress]);

    // Generate JWT
    const token = jwt.sign(
      { userId: userId, address: normalizedAddress },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    // Fetch user details to return
    const ures = await db.query('SELECT id, email, created_at, address FROM users WHERE id = $1', [userId]);
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
