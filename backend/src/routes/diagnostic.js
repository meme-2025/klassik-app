/**
 * API Diagnostic & Health Monitoring
 * Tests all critical endpoints and provides detailed error reporting
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const axios = require('axios');

/**
 * GET /api/diagnostic/status
 * Comprehensive system health check
 */
router.get('/status', async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    status: 'checking',
    components: {}
  };

  try {
    // Database Check
    try {
      const dbResult = await db.query('SELECT NOW() as current_time');
      results.components.database = {
        status: 'healthy',
        latency: 'OK',
        currentTime: dbResult.rows[0].current_time
      };
    } catch (err) {
      results.components.database = {
        status: 'error',
        error: err.message
      };
    }

    // Check User Count
    try {
      const userCount = await db.query('SELECT COUNT(*) as count FROM users');
      results.components.users = {
        status: 'healthy',
        totalUsers: parseInt(userCount.rows[0].count)
      };
    } catch (err) {
      results.components.users = {
        status: 'error',
        error: err.message
      };
    }

    // Check Orders
    try {
      const orderCount = await db.query('SELECT COUNT(*) as count FROM orders');
      results.components.orders = {
        status: 'healthy',
        totalOrders: parseInt(orderCount.rows[0].count)
      };
    } catch (err) {
      results.components.orders = {
        status: 'error',
        error: err.message
      };
    }

    // Kaspa API Check
    try {
      const kaspaCheck = await axios.get('https://api.kaspa.org/info/network', {
        timeout: 5000
      });
      results.components.kaspaAPI = {
        status: 'healthy',
        blockCount: kaspaCheck.data?.blockCount || 'unknown'
      };
    } catch (err) {
      results.components.kaspaAPI = {
        status: 'degraded',
        error: err.message
      };
    }

    // Environment Variables Check
    const requiredEnvVars = [
      'JWT_SECRET',
      'DATABASE_URL',
      'KASPA_SACRIFICE_ADDRESS'
    ];
    
    const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
    results.components.environment = {
      status: missingEnvVars.length === 0 ? 'healthy' : 'warning',
      missing: missingEnvVars
    };

    // Overall Status
    const hasErrors = Object.values(results.components).some(c => c.status === 'error');
    const hasWarnings = Object.values(results.components).some(c => c.status === 'warning' || c.status === 'degraded');
    
    results.status = hasErrors ? 'error' : hasWarnings ? 'warning' : 'healthy';

    res.json(results);

  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      components: results.components
    });
  }
});

/**
 * GET /api/diagnostic/endpoints
 * Test all critical API endpoints
 */
router.get('/endpoints', async (req, res) => {
  const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
  const endpoints = [
    { method: 'GET', path: '/health', expectedStatus: 200 },
    { method: 'GET', path: '/api/products', expectedStatus: 200 },
    { method: 'GET', path: '/api/kaspa/stats', expectedStatus: 200 },
    { method: 'GET', path: '/api/auth/check?address=0x0000000000000000000000000000000000000000', expectedStatus: 200 }
  ];

  const results = [];

  for (const endpoint of endpoints) {
    try {
      const start = Date.now();
      const response = await axios({
        method: endpoint.method,
        url: baseUrl + endpoint.path,
        timeout: 5000,
        validateStatus: () => true // Accept any status
      });
      const duration = Date.now() - start;

      results.push({
        endpoint: `${endpoint.method} ${endpoint.path}`,
        status: response.status === endpoint.expectedStatus ? 'pass' : 'fail',
        expectedStatus: endpoint.expectedStatus,
        actualStatus: response.status,
        duration: `${duration}ms`
      });
    } catch (error) {
      results.push({
        endpoint: `${endpoint.method} ${endpoint.path}`,
        status: 'error',
        error: error.message
      });
    }
  }

  const passing = results.filter(r => r.status === 'pass').length;
  const failing = results.filter(r => r.status !== 'pass').length;

  res.json({
    summary: {
      total: results.length,
      passing,
      failing,
      successRate: `${Math.round((passing / results.length) * 100)}%`
    },
    results
  });
});

/**
 * GET /api/diagnostic/database
 * Detailed database diagnostics
 */
router.get('/database', async (req, res) => {
  try {
    const results = {};

    // Check tables
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    results.tables = tables.rows.map(r => r.table_name);

    // Check indexes
    const indexes = await db.query(`
      SELECT 
        tablename, 
        indexname, 
        indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);
    results.indexes = indexes.rows.length;

    // Check active connections
    const connections = await db.query(`
      SELECT COUNT(*) as count 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    results.activeConnections = parseInt(connections.rows[0].count);

    // Check database size
    const size = await db.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    results.databaseSize = size.rows[0].size;

    // Check for missing columns (common migration issues)
    const userColumns = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    results.userTableColumns = userColumns.rows;

    res.json({
      status: 'healthy',
      diagnostics: results
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * POST /api/diagnostic/test-auth
 * Test authentication flow
 */
router.post('/test-auth', async (req, res) => {
  try {
    const testAddress = '0x0000000000000000000000000000000000000001';
    
    // Step 1: Get nonce
    const nonceCheck = await db.query(
      'SELECT nonce FROM nonces WHERE address = $1',
      [testAddress]
    );

    // Step 2: Check if table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'nonces'
      ) as exists
    `);

    res.json({
      status: 'test_complete',
      results: {
        noncesTableExists: tableCheck.rows[0].exists,
        testNonceExists: nonceCheck.rows.length > 0,
        recommendation: nonceCheck.rows.length === 0 
          ? 'Create nonce via GET /api/auth/nonce?address=' + testAddress
          : 'Authentication flow working'
      }
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/diagnostic/common-issues
 * List common API issues and fixes
 */
router.get('/common-issues', (req, res) => {
  res.json({
    commonIssues: [
      {
        issue: 'Admin panel blocked',
        symptoms: ['403 Forbidden', 'Not authorized'],
        causes: [
          'Admin wallet address not in ADMIN_WALLETS env variable',
          'JWT token expired or invalid',
          'IP not whitelisted (if IP whitelist enabled)'
        ],
        fixes: [
          'Check ADMIN_WALLETS in .env file',
          'Login again to get fresh JWT token',
          'Add your IP to ADMIN_IPS or disable IP whitelist'
        ]
      },
      {
        issue: 'Database connection errors',
        symptoms: ['Connection timeout', 'ECONNREFUSED'],
        causes: [
          'PostgreSQL not running',
          'Wrong DATABASE_URL',
          'Network/firewall blocking connection'
        ],
        fixes: [
          'Start PostgreSQL: sudo systemctl start postgresql',
          'Verify DATABASE_URL in .env',
          'Check firewall rules'
        ]
      },
      {
        issue: 'JWT token errors',
        symptoms: ['Invalid token', 'Token expired'],
        causes: [
          'JWT_SECRET not set',
          'Token expired (7 days default)',
          'Clock skew between client/server'
        ],
        fixes: [
          'Set JWT_SECRET in .env',
          'Login again to refresh token',
          'Check system time sync'
        ]
      },
      {
        issue: 'CORS errors',
        symptoms: ['CORS policy blocked', 'No Access-Control-Allow-Origin'],
        causes: [
          'Origin not in ALLOWED_ORIGINS',
          'Credentials mode mismatch'
        ],
        fixes: [
          'Add origin to CORS_ORIGIN env variable',
          'Check ALLOWED_ORIGINS in index.js'
        ]
      },
      {
        issue: 'WebSocket connection failed',
        symptoms: ['WebSocket error', 'Connection refused'],
        causes: [
          'Server not running Socket.io',
          'Invalid auth token',
          'Port/firewall blocking'
        ],
        fixes: [
          'Verify server running and Socket.io initialized',
          'Use correct JWT token in socket.io connection',
          'Check firewall allows WebSocket connections'
        ]
      }
    ],
    quickChecks: [
      'Is server running? Check with: curl http://localhost:3000/health',
      'Is database connected? Check /api/diagnostic/database',
      'Are env variables set? Check /api/diagnostic/status',
      'Is JWT_SECRET configured? Should be 32+ character random string'
    ]
  });
});

module.exports = router;
