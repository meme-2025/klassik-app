const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// POST /api/bookings (protected)
router.post('/', auth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { eventId, quantity } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId required' });
    const result = await db.query(
      'INSERT INTO bookings (user_id, event_id, quantity) VALUES ($1,$2,$3) RETURNING *',
      [userId, eventId, quantity || 1]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// GET /api/bookings/user/:userId
router.get('/user/:userId', auth, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const result = await db.query(
      `SELECT b.*, e.title, e.date FROM bookings b
       JOIN events e ON e.id = b.event_id
       WHERE b.user_id = $1 ORDER BY b.created_at DESC`, [userId]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

module.exports = router;
