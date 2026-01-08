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

const KASPA_APIs = {
  restServer: process.env.KASPA_REST_SERVER || null,
  primary: 'https://api.kaspa.org',
  explorer: 'https://explorer.kaspa.org/api'
};

const POLL_INTERVAL = parseInt(process.env.KASPA_POLL_INTERVAL || '10000'); // 10 seconds
const SACRIFICE_ADDRESS = process.env.KASPA_SACRIFICE_ADDRESS || 'kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc';

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
   * Initialize monitoring state from database
   */
  async initializeState() {
    try {
      // Get last processed block/transaction
      const result = await db.query(`
        SELECT MAX(block_height) as last_block 
        FROM processed_blocks 
        WHERE chain = 'kaspa'
      `);
      
      this.lastProcessedBlock = result.rows[0]?.last_block || 0;
      
      // Load pending payments
      await this.loadPendingPayments();
      
      console.log(`📊 Monitor state initialized: Last block ${this.lastProcessedBlock}, ${this.pendingPayments.size} pending payments`);
      
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
   * Sacrifice monitoring loop
   */
  startSacrificeMonitoring() {
    const checkSacrifices = async () => {
      if (!this.isRunning) return;
      
      try {
        await this.checkSacrificeTransactions();
      } catch (error) {
        console.error('Sacrifice monitoring error:', error);
      }
      
      if (this.isRunning) {
        setTimeout(checkSacrifices, POLL_INTERVAL * 3); // Check every 30 seconds
      }
    };
    
    checkSacrifices();
  }

  /**
   * Process new transactions from Kaspa blockchain
   */
  async processNewTransactions() {
    try {
      const transactions = await this.getRecentTransactions();
      
      for (const tx of transactions) {
        const txHash = tx.hash || tx.id || tx.transaction_id;
        
        if (!txHash || this.processedTxs.has(txHash)) {
          continue; // Skip duplicates
        }
        
        await this.processSingleTransaction(tx);
        this.processedTxs.add(txHash);
        
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
   * Process a single transaction
   */
  async processSingleTransaction(tx) {
    try {
      const txHash = tx.hash || tx.id || tx.transaction_id;
      const outputs = tx.outputs || tx.vout || [];
      
      for (const output of outputs) {
        const address = output.address || output.scriptPubKey?.addresses?.[0];
        const amount = parseFloat(output.value || output.amount || 0);
        
        if (!address || amount <= 0) continue;
        
        // Check if this is a payment
        if (this.pendingPayments.has(address)) {
          await this.processPaymentReceived(txHash, address, amount, tx);
        }
        
        // Check if this is a sacrifice
        if (address === SACRIFICE_ADDRESS) {
          await this.processSacrificeReceived(txHash, tx, amount);
        }
      }
      
    } catch (error) {
      console.error('Failed to process single transaction:', error);
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
   * Process sacrifice transaction
   */
  async processSacrificeReceived(txHash, tx, amount) {
    try {
      const inputs = tx.inputs || tx.vin || [];
      
      // Determine sender address
      let senderAddress = null;
      for (const input of inputs) {
        const addr = input.address || input.scriptSig?.addresses?.[0];
        if (addr) {
          senderAddress = addr;
          break;
        }
      }
      
      if (!senderAddress) {
        console.warn('Could not determine sender for sacrifice transaction:', txHash);
        return;
      }
      
      console.log(`🔥 Sacrifice detected: ${amount} KAS from ${senderAddress}`);
      
      // Process sacrifice
      await this.processSacrificeTransaction(txHash, senderAddress, amount, tx);
      
      // Track in live monitor
      liveMonitor.trackWalletTransaction(txHash, amount, senderAddress, 'sacrifice');
      
      // Notify via WebSocket
      this.io.emit('sacrifice:received', {
        txHash,
        senderAddress,
        amount,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Failed to process sacrifice:', error);
    }
  }

  /**
   * Process sacrifice transaction in database
   */
  async processSacrificeTransaction(txHash, senderAddress, amount, tx) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const pointsAwarded = Math.floor(amount * 100); // 1 KAS = 100 points
      const blockTime = new Date((tx.timestamp || tx.time || Date.now()) / 1000);
      
      // Insert sacrifice transaction
      await client.query(`
        INSERT INTO sacrifice_transactions 
        (kaspa_address, tx_hash, amount_kas, points_awarded, block_time, processed_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (tx_hash) DO NOTHING
      `, [senderAddress, txHash, amount, pointsAwarded, blockTime]);
      
      // Update user points if user exists
      const userResult = await client.query(`
        UPDATE users 
        SET sacrifice_points = sacrifice_points + $1, last_sacrifice_check = CURRENT_TIMESTAMP
        WHERE kaspa_address = $2
        RETURNING id, username, sacrifice_points
      `, [pointsAwarded, senderAddress]);
      
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        
        // Update user_points table
        await client.query(`
          INSERT INTO user_points (user_id, points_total, points_weekly)
          VALUES ($1, $2, $2)
          ON CONFLICT (user_id) DO UPDATE SET
            points_total = user_points.points_total + $2,
            points_weekly = user_points.points_weekly + $2
        `, [user.id, pointsAwarded]);
        
        console.log(`✅ Updated user ${user.username}: +${pointsAwarded} points (Total: ${user.sacrifice_points})`);
        
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
   * Get recent transactions from Kaspa APIs
   */
  async getRecentTransactions(limit = 100) {
    try {
      // Try local node first
      if (KASPA_APIs.restServer) {
        try {
          const response = await axios.get(`${KASPA_APIs.restServer}/transactions`, {
            params: { limit },
            timeout: 10000
          });
          return response.data || [];
        } catch (error) {
          console.warn('Local node unavailable, using public API');
        }
      }
      
      // Fallback to public API
      const response = await axios.get(`${KASPA_APIs.explorer}/transactions`, {
        params: { limit },
        timeout: 15000
      });
      
      return response.data || [];
      
    } catch (error) {
      console.error('Failed to get recent transactions:', error);
      return [];
    }
  }

  /**
   * Get balance for specific address
   */
  async getAddressBalance(address) {
    try {
      // Try local node first
      if (KASPA_APIs.restServer) {
        try {
          const response = await axios.get(`${KASPA_APIs.restServer}/addresses/${address}/balance`, { timeout: 5000 });
          return parseFloat(response.data.balance || 0);
        } catch (error) {
          // Fallback to public API
        }
      }
      
      const response = await axios.get(`${KASPA_APIs.explorer}/addresses/${address}/balance`, { timeout: 10000 });
      return parseFloat(response.data.balance || 0);
      
    } catch (error) {
      console.warn(`Failed to get balance for ${address}:`, error.message);
      return 0;
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