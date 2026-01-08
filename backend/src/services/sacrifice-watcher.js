/**
 * 🔥 PERSISTENT SACRIFICE WALLET MONITOR
 * 
 * Production-Ready Autonomous Blockchain Listener
 * - Runs continuously in background (10-30s intervals)
 * - Monitors SAC wallet address 24/7
 * - Automatically updates user payment status
 * - Never misses a transaction
 * - Full database persistence
 * 
 * Usage:
 *   const sacWatcher = require('./services/sacrifice-watcher');
 *   sacWatcher.start(); // Starts autonomous monitoring
 */

const axios = require('axios');
const db = require('../db');
const { SacrificeSystem } = require('../controllers/sacrifice-auth');

const SACRIFICE_ADDRESS = process.env.KASPA_SACRIFICE_ADDRESS || 'kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc';
const POLL_INTERVAL = parseInt(process.env.SAC_POLL_INTERVAL || '15000'); // 15 seconds
const KASPA_API = process.env.KASPA_REST_SERVER || 'https://api.kaspa.org';

class SacrificeWatcher {
  constructor(io = null) {
    this.io = io; // WebSocket for real-time notifications
    this.isRunning = false;
    this.sacrificeSystem = new SacrificeSystem();
    this.lastBlockTime = null;
    this.processedTxs = new Set();
    this.stats = {
      totalScans: 0,
      totalTransactions: 0,
      totalUsersUpdated: 0,
      lastScanTime: null,
      errors: 0
    };
  }

  /**
   * Start autonomous monitoring
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Sacrifice Watcher already running');
      return;
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  🔥 SACRIFICE WALLET MONITOR - Production Mode');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Sacrifice Address: ${SACRIFICE_ADDRESS}`);
    console.log(`  Poll Interval:     ${POLL_INTERVAL}ms`);
    console.log(`  Kaspa API:         ${KASPA_API}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    this.isRunning = true;

    // Load initial state
    await this.loadState();

    // Start monitoring loop
    this.monitoringLoop();

    console.log('✅ Sacrifice Watcher started - monitoring 24/7');
  }

  /**
   * Stop monitoring
   */
  stop() {
    console.log('🛑 Stopping Sacrifice Watcher...');
    this.isRunning = false;
  }

  /**
   * Load previous state from database
   */
  async loadState() {
    try {
      // Load last processed transactions
      const result = await db.query(`
        SELECT tx_hash 
        FROM sacrifice_transactions 
        ORDER BY created_at DESC 
        LIMIT 1000
      `);

      result.rows.forEach(row => {
        this.processedTxs.add(row.tx_hash);
      });

      console.log(`📊 Loaded ${this.processedTxs.size} processed transactions from database`);

    } catch (error) {
      console.warn('Failed to load state:', error.message);
    }
  }

  /**
   * Main monitoring loop
   */
  async monitoringLoop() {
    while (this.isRunning) {
      try {
        await this.scanSacrificeWallet();
        this.stats.totalScans++;
        this.stats.lastScanTime = new Date();

      } catch (error) {
        console.error('❌ Scan error:', error.message);
        this.stats.errors++;
      }

      // Wait for next interval
      await this.sleep(POLL_INTERVAL);
    }
  }

  /**
   * Scan sacrifice wallet for new transactions
   */
  async scanSacrificeWallet() {
    console.log(`🔍 Scanning sacrifice wallet... [${new Date().toLocaleTimeString()}]`);

    try {
      // Get transactions to sacrifice address
      const response = await axios.get(
        `${KASPA_API}/addresses/${SACRIFICE_ADDRESS}/transactions`,
        { timeout: 10000 }
      );

      if (!response.data || !Array.isArray(response.data)) {
        console.warn('Invalid response from Kaspa API');
        return;
      }

      const transactions = response.data;
      let newTransactions = 0;

      for (const tx of transactions) {
        // Skip if already processed
        if (this.processedTxs.has(tx.transaction_id)) {
          continue;
        }

        // Process new transaction
        await this.processTransaction(tx);
        newTransactions++;
      }

      if (newTransactions > 0) {
        console.log(`✅ Processed ${newTransactions} new transactions`);
        this.stats.totalTransactions += newTransactions;
      } else {
        console.log(`   No new transactions`);
      }

    } catch (error) {
      console.error('Failed to scan wallet:', error.message);
      throw error;
    }
  }

  /**
   * Process a single transaction
   */
  async processTransaction(tx) {
    try {
      const txHash = tx.transaction_id;
      const blockTime = new Date(tx.block_time * 1000);

      // Extract sender and amount
      const senderAddress = this.extractSenderAddress(tx);
      const amount = this.calculateReceivedAmount(tx);

      if (!senderAddress || amount <= 0) {
        console.warn(`Invalid transaction ${txHash}: no sender or zero amount`);
        return;
      }

      console.log(`💰 New sacrifice: ${amount} KAS from ${senderAddress}`);

      // Mark as processed immediately
      this.processedTxs.add(txHash);

      // Store in database
      await this.storeSacrificeTransaction(txHash, senderAddress, amount, blockTime);

      // Update user status
      await this.updateUserStatus(senderAddress, amount);

      // Broadcast via WebSocket
      this.broadcastTransaction(txHash, senderAddress, amount);

    } catch (error) {
      console.error(`Failed to process transaction ${tx.transaction_id}:`, error);
    }
  }

  /**
   * Extract sender address from transaction inputs
   */
  extractSenderAddress(tx) {
    if (!tx.inputs || tx.inputs.length === 0) {
      return null;
    }

    // Get address from first input
    const firstInput = tx.inputs[0];
    return firstInput.previous_outpoint_address || firstInput.address || null;
  }

  /**
   * Calculate received amount to sacrifice address
   */
  calculateReceivedAmount(tx) {
    if (!tx.outputs || tx.outputs.length === 0) {
      return 0;
    }

    let totalAmount = 0;

    for (const output of tx.outputs) {
      const outputAddress = output.script_public_key_address || output.address;
      
      if (outputAddress === SACRIFICE_ADDRESS) {
        totalAmount += parseInt(output.amount || 0);
      }
    }

    // Convert from sompi to KAS (1 KAS = 100,000,000 sompi)
    return totalAmount / 100000000;
  }

  /**
   * Store sacrifice transaction in database
   */
  async storeSacrificeTransaction(txHash, kaspaAddress, amount, blockTime) {
    try {
      const pointsEarned = Math.floor(amount * 100); // 1 KAS = 100 points

      await db.query(`
        INSERT INTO sacrifice_transactions 
        (tx_hash, kaspa_address, amount, points_earned, block_time, verified, created_at)
        VALUES ($1, $2, $3, $4, $5, TRUE, CURRENT_TIMESTAMP)
        ON CONFLICT (tx_hash) DO NOTHING
      `, [txHash, kaspaAddress, amount, pointsEarned, blockTime]);

      console.log(`✅ Stored transaction: ${txHash} → ${amount} KAS → ${pointsEarned} points`);

    } catch (error) {
      console.error('Failed to store transaction:', error);
      throw error;
    }
  }

  /**
   * Update user payment status automatically
   */
  async updateUserStatus(kaspaAddress, amount) {
    try {
      // Find user by kaspa_address
      const userResult = await db.query(
        'SELECT id, username, sacrifice_points FROM users WHERE kaspa_address = $1',
        [kaspaAddress]
      );

      if (userResult.rows.length === 0) {
        console.log(`   No user found with Kaspa address ${kaspaAddress}`);
        return;
      }

      const user = userResult.rows[0];
      const pointsToAdd = Math.floor(amount * 100);
      const newTotal = (user.sacrifice_points || 0) + pointsToAdd;

      // Update user points
      await db.query(`
        UPDATE users 
        SET 
          sacrifice_points = $1,
          last_sacrifice_check = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [newTotal, user.id]);

      console.log(`✅ Updated user ${user.username}: +${pointsToAdd} points → ${newTotal} total`);

      // Check if user qualifies for registration/access
      if (newTotal >= 100) { // Minimum 1 KAS = 100 points
        await db.query(`
          UPDATE users 
          SET is_verified = TRUE
          WHERE id = $1
        `, [user.id]);

        console.log(`🎉 User ${user.username} now verified (${newTotal} points)`);
      }

      this.stats.totalUsersUpdated++;

    } catch (error) {
      console.error('Failed to update user status:', error);
    }
  }

  /**
   * Broadcast transaction via WebSocket
   */
  broadcastTransaction(txHash, kaspaAddress, amount) {
    if (!this.io) return;

    this.io.to('monitor').emit('sacrifice:received', {
      txHash,
      kaspaAddress,
      amount,
      timestamp: new Date().toISOString()
    });

    // Notify specific user if connected
    this.io.to(`sacrifice:${kaspaAddress}`).emit('sacrifice:confirmed', {
      txHash,
      amount,
      points: Math.floor(amount * 100),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      processedCount: this.processedTxs.size,
      uptime: this.stats.lastScanTime 
        ? Date.now() - this.stats.lastScanTime.getTime() 
        : 0
    };
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
const watcher = new SacrificeWatcher();

module.exports = watcher;
