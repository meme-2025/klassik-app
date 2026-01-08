const axios = require('axios');
const db = require('../db');
const { SacrificeSystem } = require('../controllers/sacrifice-auth');
const { KaspaPaymentProcessor } = require('../controllers/kaspa-payments');
const liveMonitor = require('../middleware/live-monitor');

/**
 * Comprehensive Blockchain Monitoring System
 * - Monitors Kaspa blockchain for payments and sacrifices
 * - Real-time processing of transactions
 * - WebSocket notifications for users
 */

const KASPA_API = {
  server: process.env.KASPA_API_SERVER || 'https://api.kaspa.org'
};

const POLL_INTERVAL = parseInt(process.env.KASPA_POLL_INTERVAL || '30000'); // 30 seconds
const SACRIFICE_ADDRESS = process.env.KASPA_SACRIFICE_ADDRESS || 'kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc';
const SOMPI_PER_KAS = 100000000; // 1 KAS = 100M Sompi

class BlockchainMonitor {
  constructor(io) {
    this.io = io; // WebSocket server instance
    this.isRunning = false;
    this.lastProcessedBlock = 0;
    this.sacrificeSystem = new SacrificeSystem();
    this.kaspaProcessor = new KaspaPaymentProcessor();
    this.pendingPayments = new Map(); // Cache pending payments
    this.processedTxs = new Set(); // Prevent duplicate processing
  }

  /**
   * Start the monitoring system
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Blockchain monitor already running');
      return;
    }

    console.log('🔍 Starting Kaspa blockchain monitor...');
    
    try {
      // Get initial state
      await this.initializeState();
      
      this.isRunning = true;
      
      // Start monitoring loops
      this.startKaspaMonitoring();
      this.startPaymentChecking();
      this.startSacrificeMonitoring();
      
      console.log('✅ Blockchain monitor started successfully');
      console.log(`   Poll Interval: ${POLL_INTERVAL}ms`);
      console.log(`   Sacrifice Address: ${SACRIFICE_ADDRESS}`);
      
    } catch (error) {
      console.error('❌ Failed to start blockchain monitor:', error);
      this.isRunning = false;
    }
  }

  /**
   * Stop the monitoring system
   */
  stop() {
    console.log('🛑 Stopping blockchain monitor...');
    this.isRunning = false;
  }

  /**
   * Initialize monitoring state from database (DISABLED - not needed for UTXO polling)
   */
  async initializeState() {
    try {
      // Disabled: processed_blocks table doesn't exist in production
      // UTXO polling handles state automatically via tx_hash uniqueness
      this.lastProcessedBlock = 0;
      
      // Load pending payments
      await this.loadPendingPayments();
      
      console.log(`📊 Monitor initialized: ${this.pendingPayments.size} pending payments`);
      
    } catch (error) {
      console.warn('Failed to initialize monitor state:', error);
    }
  }

  /**
   * Load pending payments from database
   */
  async loadPendingPayments() {
    try {
      const result = await db.query(`
        SELECT o.id, o.deposit_address, kp.expected_amount, kp.payment_address
        FROM orders o
        JOIN kaspa_payments kp ON o.id = kp.order_id
        WHERE o.status = 'awaiting_payment' AND o.payment_method = 'kaspa'
      `);
      
      for (const payment of result.rows) {
        this.pendingPayments.set(payment.payment_address, {
          orderId: payment.id,
          expectedAmount: parseFloat(payment.expected_amount),
          address: payment.payment_address
        });
      }
      
    } catch (error) {
      console.error('Failed to load pending payments:', error);
    }
  }

  /**
   * Main Kaspa monitoring loop
   */
  startKaspaMonitoring() {
    const monitor = async () => {
      if (!this.isRunning) return;
      
      try {
        await this.processNewTransactions();
      } catch (error) {
        console.error('Kaspa monitoring error:', error);
      }
      
      if (this.isRunning) {
        setTimeout(monitor, POLL_INTERVAL);
      }
    };
    
    monitor();
  }

  /**
   * Payment-specific monitoring loop
   */
  startPaymentChecking() {
    const checkPayments = async () => {
      if (!this.isRunning) return;
      
      try {
        await this.checkPendingPayments();
      } catch (error) {
        console.error('Payment checking error:', error);
      }
      
      if (this.isRunning) {
        setTimeout(checkPayments, POLL_INTERVAL * 2); // Check every 20 seconds
      }
    };
    
    checkPayments();
  }

  /**
   * Sacrifice monitoring loop (DISABLED - handled by processNewTransactions)
   */
  startSacrificeMonitoring() {
    // Disabled: Sacrifices are now detected via UTXO polling in processNewTransactions
    // This old method tried to check users.last_sacrifice_check which doesn't exist
    console.log('ℹ️ Sacrifice monitoring via UTXO polling (dedicated user check disabled)');
  }

  /**
   * Process new transactions (UTXOs) from Kaspa blockchain
   */
  async processNewTransactions() {
    try {
      const utxos = await this.getRecentTransactions();
      
      for (const utxo of utxos) {
        const txid = utxo.outpoint?.transactionId;
        
        if (!txid || this.processedTxs.has(txid)) {
          continue; // Skip duplicates
        }
        
        await this.processSingleUTXO(utxo);
        this.processedTxs.add(txid);
        
        // Limit processed tx cache size
        if (this.processedTxs.size > 10000) {
          const oldTxs = Array.from(this.processedTxs).slice(0, 5000);
          oldTxs.forEach(hash => this.processedTxs.delete(hash));
        }
      }
      
    } catch (error) {
      console.error('Failed to process new transactions:', error);
    }
  }

  /**
   * Process a single UTXO (represents a payment to sacrifice address)
   */
  async processSingleUTXO(utxo) {
    try {
      const txid = utxo.outpoint?.transactionId;
      const amount = parseInt(utxo.utxoEntry?.amount || 0);
      
      if (!txid || amount <= 0) return;
      
      // This UTXO is to the sacrifice address, so process it
      await this.processSacrificeReceived(txid, null, amount);
      
    } catch (error) {
      console.error('Failed to process UTXO:', error);
    }
  }

  /**
   * Process confirmed payment
   */
  async processPaymentReceived(txHash, paymentAddress, amount, tx) {
    try {
      const pendingPayment = this.pendingPayments.get(paymentAddress);
      if (!pendingPayment) return;
      
      console.log(`💰 Payment received: ${amount} KAS to ${paymentAddress} (Order ${pendingPayment.orderId})`);
      
      // Check if amount is sufficient
      if (amount >= pendingPayment.expectedAmount) {
        // Process payment
        await this.kaspaProcessor.processPaymentReceived(pendingPayment.orderId, amount);
        
        // Remove from pending
        this.pendingPayments.delete(paymentAddress);
        
        // Track in live monitor
        liveMonitor.trackPayment({
          orderId: pendingPayment.orderId,
          amount,
          currency: 'KAS',
          txHash
        });
        
        // Notify via WebSocket
        this.io.emit('payment:confirmed', {
          orderId: pendingPayment.orderId,
          txHash,
          amount,
          timestamp: new Date().toISOString()
        });
        
        console.log(`✅ Payment processed for order ${pendingPayment.orderId}`);
        
      } else {
        console.log(`⚠️ Partial payment: ${amount}/${pendingPayment.expectedAmount} KAS`);
        
        // Notify of partial payment
        this.io.emit('payment:partial', {
          orderId: pendingPayment.orderId,
          txHash,
          received: amount,
          expected: pendingPayment.expectedAmount,
          remaining: pendingPayment.expectedAmount - amount
        });
      }
      
    } catch (error) {
      console.error('Failed to process payment:', error);
    }
  }

  /**
   * Process sacrifice transaction with sender address from change output
   */
  async processSacrificeReceived(txHash, tx, amount) {
    try {
      // Get full transaction to find sender
      let fullTx = tx;
      if (!tx || !tx.outputs || !tx.outputs.length) {
        fullTx = await this.getTransaction(txHash);
      }
      
      if (!fullTx || !fullTx.outputs) {
        console.warn('⚠️ Could not load transaction details for:', txHash);
        console.warn('   API may be rate-limiting. Will retry on next poll.');
        return;
      }
      
      // Get sender from change output (non-sacrifice address)
      const senderAddress = this.getSenderAddress(fullTx);
      
      if (!senderAddress) {
        console.warn('⚠️ Could not determine sender for sacrifice:', txHash);
        console.warn('   Transaction may have only one output (no change).');
        return;
      }
      
      // Convert sompi to KAS
      const amountKAS = amount / SOMPI_PER_KAS;
      const blockTime = fullTx.block_time || fullTx.accepting_block_time || Date.now();
      
      console.log(`🔥 Sacrifice detected: ${amountKAS} KAS from ${senderAddress} (tx: ${txHash})`);
      
      // Process sacrifice
      await this.processSacrificeTransaction(txHash, senderAddress, amountKAS, fullTx, blockTime);
      
      // Track in live monitor
      liveMonitor.trackWalletTransaction(txHash, amountKAS, senderAddress, 'sacrifice');
      
      // Notify via WebSocket
      this.io.emit('sacrifice:received', {
        txHash,
        sender: senderAddress,
        amount: amountKAS,
        timestamp: blockTime
      });
      
    } catch (error) {
      console.error('Failed to process sacrifice:', error);
    }
  }

  /**
   * Process sacrifice transaction in database
   */
  async processSacrificeTransaction(txHash, senderAddress, amount, tx, blockTime) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const pointsEarned = Math.floor(amount * 100); // 1 KAS = 100 points
      
      // Insert sacrifice transaction (exact schema: tx_hash, kaspa_address, amount, points_earned, verified, verified_at)
      await client.query(`
        INSERT INTO sacrifice_transactions 
        (tx_hash, kaspa_address, amount, points_earned, verified, verified_at)
        VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
        ON CONFLICT (tx_hash) DO NOTHING
      `, [txHash, senderAddress, amount, pointsEarned]);
      
      // Update user points if user exists (but don't require last_sacrifice_check column)
      const userResult = await client.query(`
        UPDATE users 
        SET sacrifice_points = COALESCE(sacrifice_points, 0) + $1
        WHERE kaspa_address = $2
        RETURNING id, username, sacrifice_points
      `, [pointsEarned, senderAddress]);
      
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        
        // Update user_points table
        await client.query(`
          INSERT INTO user_points (user_id, points_total, points_weekly)
          VALUES ($1, $2, $2)
          ON CONFLICT (user_id) DO UPDATE SET
            points_total = user_points.points_total + $2,
            points_weekly = user_points.points_weekly + $2
        `, [user.id, pointsEarned]);
        
        console.log(`✅ Updated user ${user.username}: +${pointsEarned} points (Total: ${user.sacrifice_points})`);
        
        // Notify user specifically
        this.io.emit('user:sacrifice:updated', {
          userId: user.id,
          username: user.username,
          pointsAdded: pointsAwarded,
          totalPoints: user.sacrifice_points,
          txHash
        });
      }
      
      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to process sacrifice transaction:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check pending payments manually
   */
  async checkPendingPayments() {
    for (const [address, payment] of this.pendingPayments) {
      try {
        const balance = await this.getAddressBalance(address);
        
        if (balance >= payment.expectedAmount) {
          console.log(`🔍 Found sufficient balance for order ${payment.orderId}: ${balance} KAS`);
          
          // Process payment (without transaction hash since we're checking balance)
          await this.kaspaProcessor.processPaymentReceived(payment.orderId, balance);
          
          // Remove from pending
          this.pendingPayments.delete(address);
          
          // Notify
          this.io.emit('payment:confirmed', {
            orderId: payment.orderId,
            amount: balance,
            method: 'balance_check',
            timestamp: new Date().toISOString()
          });
        }
        
      } catch (error) {
        console.error(`Failed to check payment ${payment.orderId}:`, error);
      }
    }
  }

  /**
   * Check for new sacrifice transactions
   */
  async checkSacrificeTransactions() {
    try {
      // Get users who need sacrifice check updates
      const users = await db.query(`
        SELECT kaspa_address, last_sacrifice_check 
        FROM users 
        WHERE kaspa_address IS NOT NULL 
        AND (last_sacrifice_check IS NULL OR last_sacrifice_check < NOW() - INTERVAL '1 hour')
        LIMIT 10
      `);
      
      for (const user of users.rows) {
        try {
          const sacrificeData = await this.sacrificeSystem.checkSacrificeAmount(user.kaspa_address);
          
          if (sacrificeData.transactions.length > 0) {
            await this.sacrificeSystem.processSacrificeTransactions(user.kaspa_address, sacrificeData);
          }
          
          // Update check timestamp
          await db.query(
            'UPDATE users SET last_sacrifice_check = CURRENT_TIMESTAMP WHERE kaspa_address = $1',
            [user.kaspa_address]
          );
          
        } catch (error) {
          console.error(`Failed to check sacrifices for ${user.kaspa_address}:`, error);
        }
      }
      
    } catch (error) {
      console.error('Failed to check sacrifice transactions:', error);
    }
  }

  /**
   * Get UTXOs (transactions) for address using Kaspa REST API
   */
  async getAddressTransactions(address) {
    try {
      const url = `${KASPA_API.server}/addresses/${address}/utxos`;
      const response = await axios.get(url, { timeout: 10000 });
      
      // Response is array of UTXOs: [{address, outpoint: {transactionId, index}, utxoEntry: {amount, blockDaaScore, ...}}]
      return response.data || [];
    } catch (error) {
      console.warn('❌ Failed to get address UTXOs:', error.message);
      return [];
    }
  }

  /**
   * Get full transaction details including sender address
   */
  async getTransaction(txid) {
    try {
      const url = `${KASPA_API.server}/transactions/${txid}`;
      const response = await axios.get(url, { timeout: 10000 });
      
      // Response: {transaction_id, inputs: [...], outputs: [{script_public_key_address, amount}, ...], block_time, ...}
      return response.data || null;
    } catch (error) {
      console.warn(`❌ Failed to get transaction ${txid}:`, error.message);
      return null;
    }
  }

  /**
   * Extract sender address from transaction (finds non-sacrifice output address = change address = sender)
   */
  getSenderAddress(tx) {
    if (!tx || !tx.outputs) return null;
    
    // Find the output that is NOT the sacrifice address (that's the sender's change address)
    const senderOutput = tx.outputs.find(out => 
      out.script_public_key_address && 
      out.script_public_key_address !== SACRIFICE_ADDRESS
    );
    
    return senderOutput ? senderOutput.script_public_key_address : null;
  }

  /**
   * Get balance for specific address using Kaspa REST API
   */
  async getAddressBalance(address) {
    try {
      const url = `${KASPA_API.server}/addresses/${address}/balance`;
      const response = await axios.get(url, { timeout: 5000 });
      
      // Response: {address: "...", balance: "200000000"} in Sompi
      const balanceSompi = parseInt(response.data.balance || 0);
      const balanceKAS = balanceSompi / SOMPI_PER_KAS;
      
      return balanceKAS;
    } catch (error) {
      console.warn(`❌ Failed to get balance for ${address}:`, error.message);
      return 0;
    }
  }

  /**
   * Get recent transactions (UTXOs for sacrifice address)
   */
  async getRecentTransactions(limit = 100) {
    try {
      const utxos = await this.getAddressTransactions(SACRIFICE_ADDRESS);
      return utxos.slice(0, limit);
    } catch (error) {
      console.error('Failed to get recent transactions:', error);
      return [];
    }
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      lastProcessedBlock: this.lastProcessedBlock,
      pendingPayments: this.pendingPayments.size,
      processedTxsCache: this.processedTxs.size,
      pollInterval: POLL_INTERVAL,
      sacrificeAddress: SACRIFICE_ADDRESS
    };
  }
}

module.exports = BlockchainMonitor;