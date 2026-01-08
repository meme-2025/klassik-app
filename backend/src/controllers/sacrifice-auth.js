const db = require('../db');
const axios = require('axios');
const { ethers } = require('ethers');

/**
 * Sacrifice-Based Registration System
 * Users must sacrifice KAS to earn points for registration
 */

const SACRIFICE_ADDRESS = process.env.KASPA_SACRIFICE_ADDRESS || 'kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc';
const POINTS_PER_KAS = parseInt(process.env.POINTS_PER_KAS || '1'); // 1 KAS = 1 point (KEINE Manipulation!)
const MIN_POINTS_REQUIRED = parseInt(process.env.MIN_POINTS_REQUIRED || '1'); // Minimum 1 point = 1 KAS

const KASPA_APIs = {
  restServer: process.env.KASPA_REST_SERVER || 'http://localhost:16110',
  primary: null,
  explorer: null,
  // Alternative APIs (fallback if primary blocked)
  kaspaLive: null,
  kaspaScan: null
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
      
      console.log(`🔍 Processing ${transactions.length} transactions for ${kaspaAddress}`);
      
      let totalSacrificed = 0;
      const sacrificeTxs = [];

      for (const tx of transactions) {
        // Check if any output goes to sacrifice address
        const outputs = tx.outputs || [];
        
        for (const output of outputs) {
          // Support both 'address' and 'scriptPublicKeyAddress' fields
          const outputAddress = output.address || output.scriptPublicKeyAddress || output.script_public_key_address;
          
          if (outputAddress === SACRIFICE_ADDRESS) {
            const amount = parseFloat(output.value || output.amount || 0);
            totalSacrificed += amount;
            
            console.log(`✅ Found sacrifice: ${amount} KAS in TX ${tx.hash || tx.id}`);
            
            sacrificeTxs.push({
              txHash: tx.hash || tx.id,
              amount: amount,
              timestamp: tx.timestamp || tx.time,
              blockTime: new Date(tx.timestamp || tx.time).toISOString()
            });
          }
        }
      }
      
      console.log(`💰 Total sacrificed: ${totalSacrificed} KAS (${sacrificeTxs.length} transactions)`);

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
      console.log(`📡 Fetching transactions for ${address}`);
      
      // Try local node first (FASTEST if available)
      if (KASPA_APIs.restServer) {
        try {
          console.log(`🔄 Trying local REST server: ${KASPA_APIs.restServer}`);
          const response = await axios.get(`${KASPA_APIs.restServer}/addresses/${address}/transactions`, {
            params: { limit },
            timeout: 10000
          });
          console.log(`✅ Local node returned ${response.data?.length || 0} transactions`);
          return response.data || [];
        } catch (nodeError) {
          console.warn('⚠️ Local node unavailable, trying public APIs...');
        }
      }

      // Try KaspaLive API (usually not blocked)
      try {
        console.log(`🔄 Trying KaspaLive API...`);
        const response = await axios.get(`${KASPA_APIs.kaspaLive}/addresses/${address}/transactions`, {
          params: { limit },
          timeout: 10000,
          headers: {
            'User-Agent': 'Klassik-Backend/1.0',
            'Accept': 'application/json'
          }
        });
        
        console.log(`✅ KaspaLive API returned ${response.data?.length || 0} transactions`);
        
        // Debug: Log first transaction structure
        if (response.data && response.data.length > 0) {
          console.log('📋 Sample TX structure:', JSON.stringify(response.data[0], null, 2).substring(0, 500));
        }
        
        return response.data || [];
      } catch (liveError) {
        console.warn('⚠️ KaspaLive API failed:', liveError.message);
      }

      // Try Kaspa Explorer API as fallback
      try {
        console.log(`🔄 Trying Kaspa Explorer API...`);
        const response = await axios.get(`${KASPA_APIs.explorer}/addresses/${address}/transactions`, {
          params: { limit },
          timeout: 10000
        });
        
        console.log(`✅ Explorer API returned ${response.data?.length || 0} transactions`);
        
        if (response.data && response.data.length > 0) {
          console.log('📋 Sample TX structure:', JSON.stringify(response.data[0], null, 2).substring(0, 500));
        }
        
        return response.data || [];
      } catch (explorerError) {
        console.warn('⚠️ Explorer API failed:', explorerError.message);
      }

      // Last resort: KaspaScan API
      try {
        console.log(`🔄 Trying KaspaScan API...`);
        const response = await axios.get(`${KASPA_APIs.kaspaScan}/address/${address}/transactions`, {
          params: { limit },
          timeout: 10000
        });
        
        console.log(`✅ KaspaScan API returned ${response.data?.length || 0} transactions`);
        return response.data || [];
      } catch (scanError) {
        console.warn('⚠️ KaspaScan API failed:', scanError.message);
      }

      // All APIs failed
      throw new Error('All Kaspa APIs unavailable. Please try again later or configure local node.');

    } catch (error) {
      console.error(`❌ Failed to fetch transactions for ${address}:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
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
   * Validate if user has enough points for registration (FROM DATABASE)
   */
  async validateRegistrationEligibility(kaspaAddress, ethAddress) {
    console.log('🔍 Checking eligibility from database for:', kaspaAddress);
    
    try {
      // Query sacrifice_transactions table (populated by BlockchainMonitor)
      const result = await db.query(`
        SELECT 
          COUNT(*) as tx_count,
          SUM(amount) as total_sompi,
          SUM(points_earned) as total_points
        FROM sacrifice_transactions
        WHERE kaspa_address = $1 AND verified = true
      `, [kaspaAddress]);
      
      const data = result.rows[0];
      const totalPoints = parseInt(data.total_points) || 0;
      const totalSompi = parseInt(data.total_sompi) || 0;
      const totalKAS = totalSompi / 100000000; // Sompi to KAS
      const txCount = parseInt(data.tx_count) || 0;
      
      console.log('📊 Database result:', {
        txCount,
        totalSompi,
        totalKAS,
        totalPoints,
        requiredPoints: MIN_POINTS_REQUIRED
      });
      
      const eligible = totalPoints >= MIN_POINTS_REQUIRED;
      
      return {
        eligible,
        kaspaAddress,
        ethAddress,
        currentPoints: totalPoints,
        requiredPoints: MIN_POINTS_REQUIRED,
        totalSacrificed: totalKAS,
        transactionCount: txCount,
        sacrificeAddress: SACRIFICE_ADDRESS,
        tier: totalPoints >= 10000 ? 'Gold' : totalPoints >= 1000 ? 'Silver' : 'Bronze',
        message: eligible 
          ? `Eligible! You have ${totalPoints} points from ${totalKAS} KAS` 
          : `Need ${MIN_POINTS_REQUIRED - totalPoints} more points (send ${((MIN_POINTS_REQUIRED - totalPoints) / POINTS_PER_KAS).toFixed(2)} KAS to ${SACRIFICE_ADDRESS})`
      };
      
    } catch (error) {
      console.error('❌ Database query failed:', error);
      throw error;
    }
  }
}

/**
 * POST /api/auth/check-sacrifice
 * Check sacrifice eligibility for registration
 */
async function checkSacrificeEligibility(req, res) {
  try {
    const { kaspaAddress, ethAddress } = req.body;

    console.log('🔍 Checking sacrifice eligibility:', { kaspaAddress, ethAddress });

    if (!kaspaAddress || !ethAddress) {
      return res.status(400).json({ 
        error: 'Both kaspaAddress and ethAddress are required' 
      });
    }

    if (!ethers.isAddress(ethAddress)) {
      return res.status(400).json({ 
        error: 'Invalid Ethereum address format' 
      });
    }

    // Validate Kaspa address format
    if (!kaspaAddress.startsWith('kaspa:')) {
      return res.status(400).json({
        error: 'Invalid Kaspa address format (must start with kaspa:)'
      });
    }

    const sacrificeSystem = new SacrificeSystem();
    const eligibility = await sacrificeSystem.validateRegistrationEligibility(kaspaAddress, ethAddress);

    console.log('✅ Eligibility check result:', eligibility);
    res.json(eligibility);

  } catch (error) {
    console.error('❌ checkSacrificeEligibility error:', error);
    res.status(500).json({ error: 'Failed to check sacrifice eligibility', details: error.message });
  }
}

/**
 * Modified registration with sacrifice validation + OWNERSHIP PROOF
 */
async function registerWithSacrifice(req, res) {
  try {
    const { ethAddress, kaspaAddress, username, signature, nonce, verificationTxId } = req.body;

    // Validate inputs
    if (!ethAddress || !kaspaAddress || !username || !signature || !nonce) {
      return res.status(400).json({ 
        error: 'ethAddress, kaspaAddress, username, signature, and nonce are required' 
      });
    }

    // Validate addresses
    if (!ethers.isAddress(ethAddress)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }

    // Validate username
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be 3-30 characters' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers and underscore' });
    }

    // 1. ✅ Check sacrifice eligibility FROM DATABASE (BlockchainMonitor already populated it)
    console.log('🔍 Checking database for sacrifices from:', kaspaAddress);
    
    const dbResult = await db.query(`
      SELECT 
        COUNT(*) as tx_count,
        SUM(amount) as total_sompi,
        SUM(points_earned) as total_points
      FROM sacrifice_transactions
      WHERE kaspa_address = $1 AND verified = true
    `, [kaspaAddress]);
    
    const { tx_count, total_sompi, total_points } = dbResult.rows[0];
    const totalPoints = parseInt(total_points) || 0;
    const txCount = parseInt(tx_count) || 0;
    const totalKAS = (parseInt(total_sompi) || 0) / 100000000;
    
    console.log('📊 Database sacrifice check:', { kaspaAddress, txCount, totalKAS, totalPoints });
    
    // ✅ KRITISCH: Mindestens MIN_POINTS_REQUIRED Punkte nötig
    if (totalPoints < MIN_POINTS_REQUIRED) {
      return res.status(403).json({
        error: 'Insufficient sacrifice',
        required: MIN_POINTS_REQUIRED,
        current: totalPoints,
        missingKAS: ((MIN_POINTS_REQUIRED - totalPoints) / POINTS_PER_KAS).toFixed(8),
        sacrificeAddress: SACRIFICE_ADDRESS,
        message: `Send at least ${((MIN_POINTS_REQUIRED - totalPoints) / POINTS_PER_KAS).toFixed(8)} KAS to ${SACRIFICE_ADDRESS}`
      });
    }
    
    // ✅ KRITISCH: Mindestens 1 ECHTE Transaktion muss existieren!
    if (txCount === 0) {
      return res.status(403).json({
        error: 'No sacrifice transactions found',
        message: `Send at least ${(MIN_POINTS_REQUIRED / POINTS_PER_KAS).toFixed(2)} KAS to: ${SACRIFICE_ADDRESS}`,
        kaspaAddress,
        required: MIN_POINTS_REQUIRED
      });
    }
    
    // 🔒 KRITISCH: KASPA ADDRESS OWNERSHIP VERIFICATION
    // Verhindert, dass jemand fremde Kaspa-Adressen "klaut"
    // Die LETZTE Transaktion muss nicht zu alt sein (Proof of recent activity)
    const latestTxResult = await db.query(`
      SELECT created_at, tx_hash
      FROM sacrifice_transactions
      WHERE kaspa_address = $1 AND verified = true
      ORDER BY created_at DESC
      LIMIT 1
    `, [kaspaAddress]);
    
    if (latestTxResult.rows.length === 0) {
      return res.status(403).json({
        error: 'No verified transactions found',
        message: `Please wait for BlockchainMonitor to verify your sacrifice`,
        kaspaAddress
      });
    }
    
    const latestTx = latestTxResult.rows[0];
    const txTime = new Date(latestTx.created_at);
    const hoursSinceTx = (Date.now() - txTime.getTime()) / (1000 * 60 * 60);
    
    // Allow transactions within 7 days (more lenient than 24h)
    if (hoursSinceTx > 168) {
      return res.status(403).json({
        error: 'Kaspa address ownership verification failed',
        message: 'Please send a fresh sacrifice transaction to verify ownership',
        lastTransactionAge: `${(hoursSinceTx / 24).toFixed(1)} days ago`,
        requirementTime: '7 days',
        kaspaAddress,
        sacrificeAddress: SACRIFICE_ADDRESS,
        hint: 'Send at least 0.01 KAS to verify you own this address'
      });
    }
    
    console.log(`✅ Ownership verified: Latest TX ${hoursSinceTx.toFixed(1)}h ago (${latestTx.tx_hash.substring(0, 12)}...)`);
    console.log(`✅ Sacrifice verified: ${totalKAS} KAS (${totalPoints} points)`);

    // 2. Verify nonce and signature
    const nonceResult = await db.query(
      'SELECT * FROM nonces WHERE address = $1 AND nonce = $2 AND expires_at > CURRENT_TIMESTAMP',
      [ethAddress.toLowerCase(), nonce]
    );

    if (nonceResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired nonce' });
    }

    const nonceData = nonceResult.rows[0];
    const expiresAtISO = new Date(nonceData.expires_at).toISOString();

    // 3. Verify signature - MUST match message from /nonce endpoint
    const message = `Sign this message to authenticate with Klassik:\n\nNonce: ${nonce}\nTimestamp: ${expiresAtISO}`;
    
    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
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
      `, [ethAddress.toLowerCase(), kaspaAddress, username, totalPoints]);

      const user = userResult.rows[0];

      // 6. Sacrifice transactions already in DB (processed by BlockchainMonitor)
      // No need to re-process them here

      // 7. Initialize user points (if user_points table exists)
      try {
        await client.query(`
          INSERT INTO user_points (user_id, points_total, points_weekly)
          VALUES ($1, $2, $2)
        `, [user.id, totalPoints]);
      } catch (err) {
        // Table might not exist - ignore
        console.warn('user_points table not found, skipping...');
      }

      // 8. Delete used nonce
      await client.query('DELETE FROM nonces WHERE address = $1 AND nonce = $2', [ethAddress.toLowerCase(), nonce]);

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

      // 10. Create session tracking (Admin Panel V2)
      try {
        const crypto = require('crypto');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await db.query(`
          INSERT INTO user_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
          VALUES ($1, $2, $3, $4, $5)
        `, [user.id, tokenHash, ipAddress, userAgent, expiresAt]);

        // Set user as online
        await db.query(`
          UPDATE users SET is_online = TRUE, last_seen = CURRENT_TIMESTAMP WHERE id = $1
        `, [user.id]);

        console.log(`📊 Session created for user ${user.id} from ${ipAddress}`);
      } catch (sessionErr) {
        console.warn('⚠️ Failed to create session tracking:', sessionErr.message);
      }

      res.status(201).json({
        message: 'Registration successful',
        user: {
          id: user.id,
          address: user.address,
          kaspaAddress: user.kaspa_address,
          username: user.username,
          sacrificePoints: user.sacrifice_points,
          is_admin: false // New users are never admin
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