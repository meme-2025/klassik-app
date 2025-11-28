const db = require('../db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getMe(req, res, next) {
  try {
    const userId = req.user && (req.user.userId || req.user.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await db.query(
      'SELECT id, email, address, created_at FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const userId = req.user && (req.user.userId || req.user.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { email } = req.body;
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    // Ensure email is not used by another user
    const exists = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
    if (exists.rows.length) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const result = await db.query(
      'UPDATE users SET email = $1 WHERE id = $2 RETURNING id, email, address, created_at',
      [email, userId]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMe,
  updateMe
};
