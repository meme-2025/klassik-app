const express = require('express');
const db = require('../db');

const router = express.Router();

// Debug endpoints protected by ADMIN_TOKEN env var
// To enable, set ADMIN_TOKEN in your environment. Requests must include header 'X-ADMIN-TOKEN: <token>'

function requireAdminToken(req, res, next) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return res.status(404).json({ error: 'Not found' });
  const provided = req.headers['x-admin-token'];
  if (!provided || provided !== adminToken) return res.status(403).json({ error: 'Forbidden' });
  next();
}

// GET /api/debug/users - lists recent users (limited)
router.get('/users', requireAdminToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50'), 200);
    const result = await db.query('SELECT id, email, address, created_at FROM users ORDER BY created_at DESC LIMIT $1', [limit]);
    res.json({ users: result.rows });
  } catch (err) {
    console.error('debug/users error:', err);
    res.status(500).json({ error: 'Failed to query users' });
  }
});

// GET /api/debug/products - lists products
router.get('/products', requireAdminToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100'), 500);
    const result = await db.query('SELECT id, title, active, price, currency, created_at FROM products ORDER BY created_at DESC LIMIT $1', [limit]);
    res.json({ products: result.rows });
  } catch (err) {
    console.error('debug/products error:', err);
    res.status(500).json({ error: 'Failed to query products' });
  }
});

// GET /api/debug/nonces - lists nonces (recent)
router.get('/nonces', requireAdminToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50'), 200);
    const result = await db.query('SELECT address, nonce, expires_at, created_at FROM nonces ORDER BY created_at DESC LIMIT $1', [limit]);
    res.json({ nonces: result.rows });
  } catch (err) {
    console.error('debug/nonces error:', err);
    res.status(500).json({ error: 'Failed to query nonces' });
  }
});

module.exports = router;
