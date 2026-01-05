/**
 * ============================================
 * ADMIN API ROUTES - CHAMPIONS LEAGUE LEVEL
 * ============================================
 * 
 * Real-time monitoring and analytics
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

/**
 * Admin-Only Middleware
 * Check if user is admin
 */
async function adminOnly(req, res, next) {
    try {
        const userId = req.user.userId || req.user.id;
        
        const result = await db.query(
            'SELECT is_admin FROM users WHERE id = $1',
            [userId]
        );
        
        if (!result.rows.length || !result.rows[0].is_admin) {
            return res.status(403).json({ 
                error: 'Admin access required' 
            });
        }
        
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ error: 'Admin verification failed' });
    }
}

// Apply auth + admin middleware to all routes
router.use(authMiddleware);
router.use(adminOnly);

/**
 * GET /api/admin/stats
 * Overview statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) AS total_users,
                (SELECT COUNT(*) FROM users WHERE is_online = TRUE) AS online_users,
                (SELECT COUNT(*) FROM sacrifice_transactions) AS total_sacrifices,
                (SELECT COALESCE(SUM(amount), 0) FROM sacrifice_transactions WHERE verified = TRUE) AS total_kas_sacrificed,
                (SELECT COUNT(*) FROM search_history) AS total_searches,
                (SELECT COUNT(*) FROM user_sessions WHERE is_active = TRUE) AS active_sessions
        `);
        
        res.json(stats.rows[0]);
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

/**
 * GET /api/admin/online-users
 * Get currently online users
 */
router.get('/online-users', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                u.id,
                u.username,
                u.address,
                u.kaspa_address,
                u.sacrifice_points,
                u.is_admin,
                u.last_seen,
                s.ip_address,
                s.user_agent,
                s.started_at
            FROM users u
            LEFT JOIN user_sessions s ON u.id = s.user_id AND s.is_active = TRUE
            WHERE u.is_online = TRUE
            ORDER BY u.last_seen DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Online users error:', error);
        res.status(500).json({ error: 'Failed to fetch online users' });
    }
});

/**
 * GET /api/admin/users
 * Get all users with details
 */
router.get('/users', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                u.id,
                u.username,
                u.address,
                u.kaspa_address,
                u.sacrifice_points,
                u.is_admin,
                u.is_online,
                u.last_seen,
                u.created_at,
                COUNT(DISTINCT st.id) AS total_sacrifices,
                COALESCE(SUM(st.amount), 0) AS total_kas_sacrificed,
                COUNT(DISTINCT sh.id) AS total_searches
            FROM users u
            LEFT JOIN sacrifice_transactions st ON u.id = st.user_id
            LEFT JOIN search_history sh ON u.id = sh.user_id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Users fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * GET /api/admin/sacrifices
 * Get all sacrifice transactions
 */
router.get('/sacrifices', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                st.id,
                st.tx_hash,
                st.amount,
                st.points_earned,
                st.verified,
                st.confirmations,
                st.block_time,
                st.created_at,
                u.username,
                u.address
            FROM sacrifice_transactions st
            LEFT JOIN users u ON st.user_id = u.id
            ORDER BY st.created_at DESC
            LIMIT 100
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Sacrifices fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch sacrifices' });
    }
});

/**
 * GET /api/admin/searches
 * Get search history
 */
router.get('/searches', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                sh.id,
                sh.search_query,
                sh.search_type,
                sh.result_found,
                sh.ip_address,
                sh.created_at,
                u.username,
                u.address
            FROM search_history sh
            LEFT JOIN users u ON sh.user_id = u.id
            ORDER BY sh.created_at DESC
            LIMIT 200
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Search history error:', error);
        res.status(500).json({ error: 'Failed to fetch search history' });
    }
});

/**
 * GET /api/admin/user/:id
 * Get detailed user info
 */
router.get('/user/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const user = await db.query(
            'SELECT * FROM users WHERE id = $1',
            [id]
        );
        
        if (!user.rows.length) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const sacrifices = await db.query(
            'SELECT * FROM sacrifice_transactions WHERE user_id = $1 ORDER BY created_at DESC',
            [id]
        );
        
        const searches = await db.query(
            'SELECT * FROM search_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
            [id]
        );
        
        const sessions = await db.query(
            'SELECT * FROM user_sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT 10',
            [id]
        );
        
        res.json({
            user: user.rows[0],
            sacrifices: sacrifices.rows,
            searches: searches.rows,
            sessions: sessions.rows
        });
    } catch (error) {
        console.error('User detail error:', error);
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
});

/**
 * POST /api/admin/user/:id/toggle-admin
 * Toggle admin status
 */
router.post('/user/:id/toggle-admin', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await db.query(
            'UPDATE users SET is_admin = NOT is_admin WHERE id = $1 RETURNING *',
            [id]
        );
        
        // Log admin action
        await db.query(
            'INSERT INTO admin_logs (admin_user_id, action, target_user_id, details) VALUES ($1, $2, $3, $4)',
            [req.user.userId, 'toggle_admin', id, { new_status: result.rows[0].is_admin }]
        );
        
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        console.error('Toggle admin error:', error);
        res.status(500).json({ error: 'Failed to toggle admin status' });
    }
});

module.exports = router;
