const db = require('../db');
const axios = require('axios');
const { ethers } = require('ethers');

/**
 * Sacrifice-Based Registration System
 * Users must sacrifice KAS to earn points for registration
 */

const SACRIFICE_ADDRESS = process.env.KASPA_SACRIFICE_ADDRESS || 'kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc';
const POINTS_PER_KAS = parseInt(process.env.POINTS_PER_KAS || '100'); // 1 KAS = 100 points
const MIN_POINTS_REQUIRED = parseInt(process.env.MIN_POINTS_REQUIRED || '100'); // Minimum 100 points = 1 KAS

const KASPA_APIs = {
  restServer: process.env.KASPA_REST_SERVER || null,
  primary: 'https://api.kaspa.org',
  explorer: 'https://explorer.kaspa.org/api'
};

class SacrificeSystem {
  constructor() {
    this.cache = new Map();
    this.cacheDuration = 60000; // 1 minute cache for sacrifice checks
  }

  /**
   * Check total sacrifice amount for a Kaspa address
   */
  async checkSacrificeAmount(kaspaAddress) {
    const cacheKey = `sacrifice:${kaspaAddress}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheDuration) {
      return cached.data;
    }

    try {
      // Get all transactions TO the sacrifice address FROM this address
      const transactions = await this.getAddressTransactions(kaspaAddress);
      
      let totalSacrificed = 0;
      const sacrificeTxs = [];

      for (const tx of transactions) {
        // Check if any output goes to sacrifice address
        const outputs = tx.outputs || [];
        for (const output of outputs) {
          if (output.address === SACRIFICE_ADDRESS) {
            const amount = parseFloat(output.value || output.amount || 0);
            totalSacrificed += amount;
            sacrificeTxs.push({
              txHash: tx.hash || tx.id,
              amount: amount,
              timestamp: tx.timestamp || tx.time,
              blockTime: new Date(tx.timestamp || tx.time).toISOString()
            });
          }
        }
      }

      const result = {
        kaspaAddress,
        totalSacrificed,
        totalPoints: Math.floor(totalSacrificed * POINTS_PER_KAS),
        transactions: sacrificeTxs,
        lastChecked: new Date().toISOString()
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;

    } catch (error) {
      console.error('Failed to check sacrifice amount:', error);
      return {
        kaspaAddress,
        totalSacrificed: 0,
        totalPoints: 0,
        transactions: [],
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Get transactions for a Kaspa address
   */
  async getAddressTransactions(address, limit = 100) {
    try {
      // Try local node first
      if (KASPA_APIs.restServer) {
        try {
          const response = await axios.get(`${KASPA_APIs.restServer}/addresses/${address}/transactions`, {
            params: { limit },
            timeout: 10000
          });
          return response.data || [];
        } catch (nodeError) {
          console.warn('Local node unavailable, using public API');
        }
      }

      // Fallback to public API
      const response = await axios.get(`${KASPA_APIs.explorer}/addresses/${address}/transactions`, {
        params: { limit },
        timeout: 10000
      });
      
      return response.data || [];

    } catch (error) {
      console.warn('Failed to fetch transactions for', address, error.message);
      return [];
    }
  }

  /**
   * Process and store sacrifice transactions in database
   */
  async processSacrificeTransactions(kaspaAddress, sacrificeData) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      for (const tx of sacrificeData.transactions) {
        // Insert or update sacrifice transaction record
        await client.query(`
          INSERT INTO sacrifice_transactions 
          (kaspa_address, tx_hash, amount_kas, points_awarded, block_time, processed_at)
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
          ON CONFLICT (tx_hash) DO UPDATE SET
            processed_at = CURRENT_TIMESTAMP
        `, [
          kaspaAddress,
          tx.txHash,
          tx.amount,
          Math.floor(tx.amount * POINTS_PER_KAS),
          tx.blockTime
        ]);
      }

      // Update user sacrifice points
      await client.query(`
        UPDATE users 
        SET sacrifice_points = $1, last_sacrifice_check = CURRENT_TIMESTAMP
        WHERE kaspa_address = $2
      `, [sacrificeData.totalPoints, kaspaAddress]);

      await client.query('COMMIT');
      
      console.log(`✅ Processed ${sacrificeData.transactions.length} sacrifice transactions for ${kaspaAddress}`);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to process sacrifice transactions:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Validate if user has enough points for registration
   */
  async validateRegistrationEligibility(kaspaAddress, ethAddress) {
    const sacrificeData = await this.checkSacrificeAmount(kaspaAddress);
    
    const eligible = sacrificeData.totalPoints >= MIN_POINTS_REQUIRED;
    
    return {
      eligible,
      kaspaAddress,
      ethAddress,
      currentPoints: sacrificeData.totalPoints,
      requiredPoints: MIN_POINTS_REQUIRED,
      totalSacrificed: sacrificeData.totalSacrificed,
      sacrificeAddress: SACRIFICE_ADDRESS,
      message: eligible 
        ? 'Eligible for registration' 
        : `Need ${MIN_POINTS_REQUIRED - sacrificeData.totalPoints} more points (${((MIN_POINTS_REQUIRED - sacrificeData.totalPoints) / POINTS_PER_KAS).toFixed(8)} KAS)`
    };
  }
}

/**
 * POST /api/auth/check-sacrifice
 * Check sacrifice eligibility for registration
 */
async function checkSacrificeEligibility(req, res) {
  try {
    const { kaspaAddress, ethAddress } = req.body;

    if (!kaspaAddress || !ethAddress) {
      return res.status(400).json({ 
        error: 'Both kaspaAddress and ethAddress are required' 
      });
    }

    if (!ethers.utils.isAddress(ethAddress)) {
      return res.status(400).json({ 
        error: 'Invalid Ethereum address format' 
      });
    }

    // TODO: Add Kaspa address format validation

    const sacrificeSystem = new SacrificeSystem();
    const eligibility = await sacrificeSystem.validateRegistrationEligibility(kaspaAddress, ethAddress);

    res.json(eligibility);

  } catch (error) {
    console.error('checkSacrificeEligibility error:', error);
    res.status(500).json({ error: 'Failed to check sacrifice eligibility' });
  }
}

/**
 * Modified registration with sacrifice validation
 */
async function registerWithSacrifice(req, res) {
  try {
    const { ethAddress, kaspaAddress, username, signature, nonce } = req.body;

    // Validate inputs
    if (!ethAddress || !kaspaAddress || !username || !signature || !nonce) {
      return res.status(400).json({ 
        error: 'ethAddress, kaspaAddress, username, signature, and nonce are required' 
      });
    }

    // Validate addresses
    if (!ethers.utils.isAddress(ethAddress)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }

    // Validate username
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be 3-30 characters' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers and underscore' });
    }

    // 1. ✅ Check sacrifice eligibility WITH BLOCKCHAIN VALIDATION
    const sacrificeSystem = new SacrificeSystem();
    console.log('🔍 Checking Kaspa blockchain for sacrifices from:', kaspaAddress);
    const sacrificeData = await sacrificeSystem.checkSacrificeAmount(kaspaAddress);
    
    // ✅ KRITISCH: Mindestens MIN_POINTS_REQUIRED Punkte nötig
    if (sacrificeData.totalPoints < MIN_POINTS_REQUIRED) {
      return res.status(403).json({
        error: 'Insufficient sacrifice',
        required: MIN_POINTS_REQUIRED,
        current: sacrificeData.totalPoints,
        missingKAS: ((MIN_POINTS_REQUIRED - sacrificeData.totalPoints) / POINTS_PER_KAS).toFixed(8),
        sacrificeAddress: SACRIFICE_ADDRESS,
        message: `Send at least ${((MIN_POINTS_REQUIRED - sacrificeData.totalPoints) / POINTS_PER_KAS).toFixed(8)} KAS to ${SACRIFICE_ADDRESS}`
      });
    }
    
    // ✅ KRITISCH: Mindestens 1 ECHTE Transaktion muss existieren!
    if (!sacrificeData.transactions || sacrificeData.transactions.length === 0) {
      return res.status(403).json({
        error: 'No sacrifice transactions found on blockchain',
        message: `Send at least ${(MIN_POINTS_REQUIRED / POINTS_PER_KAS).toFixed(2)} KAS to: ${SACRIFICE_ADDRESS}`,
        kaspaAddress,
        explorerUrl: `https://explorer.kaspa.org/addresses/${kaspaAddress}`,
        required: MIN_POINTS_REQUIRED
      });
    }
    
    console.log(`✅ Sacrifice verified: ${sacrificeData.totalSacrificed} KAS (${sacrificeData.totalPoints} points)`);

    // 2. Verify nonce and signature
    const nonceResult = await db.query(
      'SELECT * FROM auth_nonces WHERE address = $1 AND nonce = $2 AND expires_at > CURRENT_TIMESTAMP',
      [ethAddress.toLowerCase(), nonce]
    );

    if (nonceResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired nonce' });
    }

    // 3. Verify signature
    const message = `Sign this message to register with Klassik:\n\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}\nKaspa Address: ${kaspaAddress}`;
    
    let recoveredAddress;
    try {
      recoveredAddress = ethers.utils.verifyMessage(message, signature);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    if (recoveredAddress.toLowerCase() !== ethAddress.toLowerCase()) {
      return res.status(400).json({ error: 'Signature does not match address' });
    }

    // 4. Check if addresses already exist
    const existingEth = await db.query('SELECT id FROM users WHERE LOWER(address) = $1', [ethAddress.toLowerCase()]);
    const existingKaspa = await db.query('SELECT id FROM users WHERE kaspa_address = $1', [kaspaAddress]);
    const existingUsername = await db.query('SELECT id FROM users WHERE LOWER(username) = $1', [username.toLowerCase()]);

    if (existingEth.rows.length > 0) {
      return res.status(409).json({ error: 'Ethereum address already registered' });
    }
    if (existingKaspa.rows.length > 0) {
      return res.status(409).json({ error: 'Kaspa address already registered' });
    }
    if (existingUsername.rows.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // 5. Create user
      const userResult = await client.query(`
        INSERT INTO users 
        (address, kaspa_address, username, sacrifice_points, created_at, last_sacrifice_check)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, address, kaspa_address, username, sacrifice_points
      `, [ethAddress.toLowerCase(), kaspaAddress, username, sacrificeData.totalPoints]);

      const user = userResult.rows[0];

      // 6. Process sacrifice transactions
      await sacrificeSystem.processSacrificeTransactions(kaspaAddress, sacrificeData);

      // 7. Initialize user points (if user_points table exists)
      try {
        await client.query(`
          INSERT INTO user_points (user_id, points_total, points_weekly)
          VALUES ($1, $2, $2)
        `, [user.id, sacrificeData.totalPoints]);
      } catch (err) {
        // Table might not exist - ignore
        console.warn('user_points table not found, skipping...');
      }

      // 8. Delete used nonce
      await client.query('DELETE FROM auth_nonces WHERE address = $1 AND nonce = $2', [ethAddress.toLowerCase(), nonce]);

      await client.query('COMMIT');

      // 9. Generate JWT token
      const token = require('jsonwebtoken').sign(
        {
          userId: user.id,
          id: user.id,
          address: user.address,
          kaspaAddress: user.kaspa_address,
          username: user.username
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRY || '7d' }
      );

      res.status(201).json({
        message: 'Registration successful',
        user: {
          id: user.id,
          address: user.address,
          kaspaAddress: user.kaspa_address,
          username: user.username,
          sacrificePoints: user.sacrifice_points
        },
        token,
        expiresIn: process.env.JWT_EXPIRY || '7d'
      });

      console.log(`✅ New user registered: ${username} (${ethAddress}) with ${eligibility.currentPoints} sacrifice points`);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('registerWithSacrifice error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
}

/**
 * GET /api/auth/sacrifice/:kaspaAddress/stats
 * Get sacrifice statistics for address
 */
async function getSacrificeStats(req, res) {
  try {
    const { kaspaAddress } = req.params;

    const sacrificeSystem = new SacrificeSystem();
    const stats = await sacrificeSystem.checkSacrificeAmount(kaspaAddress);

    res.json(stats);

  } catch (error) {
    console.error('getSacrificeStats error:', error);
    res.status(500).json({ error: 'Failed to get sacrifice stats' });
  }
}

module.exports = {
  SacrificeSystem,
  checkSacrificeEligibility,
  registerWithSacrifice,
  getSacrificeStats,
  SACRIFICE_ADDRESS,
  POINTS_PER_KAS,
  MIN_POINTS_REQUIRED
};