const express = require('express');
const auth = require('../middleware/auth');
const usersController = require('../controllers/users');

const router = express.Router();

// GET /api/users/me - get current user's profile
router.get('/me', auth, usersController.getMe);

// PUT /api/users/me - update current user's profile (email)
router.put('/me', auth, usersController.updateMe);

module.exports = router;
