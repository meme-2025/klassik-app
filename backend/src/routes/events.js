const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/events
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM events ORDER BY date ASC');
    res.json(result.rows);
  } catch (err) { next(err); }
});

// POST /api/events (protected)
router.post('/', auth, async (req, res, next) => {
  try {
    const { title, description, date, capacity } = req.body;
    const result = await db.query(
      'INSERT INTO events (title, description, date, capacity) VALUES ($1,$2,$3,$4) RETURNING *',
      [title, description, date, capacity || 0]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
