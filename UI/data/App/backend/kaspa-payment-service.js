/**
 * Kaspa Payment Service - Direct Blockchain Integration
 * No smart contracts needed - pure UTXO transaction handling
 * 
 * Handles:
 * - Player buy-ins (Kaspa → Casino wallet)
 * - Automatic payouts (Casino wallet → Winners)
 * - Transaction monitoring & confirmation
 * - UTXO selection for optimal fee management
 */

const axios = require('axios');
const crypto = require('crypto');

class KaspaPaymentService {
  constructor(config = {}) {
    this.kaspaApi = config.kaspaApi || process.env.KASPA_REST_API || 'https://api.kaspa.org';
    this.network = config.network || process.env.KASPA_NETWORK || 'testnet';
    this.casinoAddress = config.casinoAddress || process.env.CASINO_KASPA_ADDRESS;
    this.confirmations = parseInt(config.confirmations || process.env.REQUIRED_CONFIRMATIONS || 6);
    this.pollInterval = parseInt(config.pollInterval || process.env.KASPA_POLL_INTERVAL_MS || 1000);
    
    // Transaction tracking
    this.pendingDeposits = new Map(); // txId -> depositInfo
    this.pendingPayouts = new Map(); // txId -> payoutInfo
    this.processedTxs = new Set(); // Prevent duplicate processing
    
    // Monitoring state
    this.isMonitoring = false;
    this.lastCheckedBlock = null;
  }

  /**
   * Start monitoring Kaspa blockchain for incoming deposits
   */
  async startMonitoring(onDepositConfirmed) {
    if (this.isMonitoring) {
      console.log('⚠️ Kaspa monitoring already running');
      return;
    }

    this.isMonitoring = true;
    this.onDepositConfirmed = onDepositConfirmed;

    console.log(`🔍 Starting Kaspa payment monitoring on ${this.network}`);
    console.log(`📍 Casino address: ${this.casinoAddress}`);

    this._monitorLoop();
  }

  /**
   * Internal monitoring loop
   */
  async _monitorLoop() {
    while (this.isMonitoring) {
      try {
        await this._checkForNewDeposits();
        await this._updatePendingTransactions();
      } catch (error) {
        console.error('❌ Monitoring error:', error.message);
      }

      await this._sleep(this.pollInterval);
    }
  }

  /**
   * Check for new deposits to casino address
   */
  async _checkForNewDeposits() {
    try {
      // Get UTXOs for casino address (these are incoming payments)
      const response = await axios.get(
        `${this.kaspaApi}/addresses/${this.casinoAddress}/utxos`
      );

      const utxos = response.data.utxos || [];

      for (const utxo of utxos) {
        const txId = utxo.outpoint.transactionId;

        // Skip if already processed
        if (this.processedTxs.has(txId)) continue;

        // Check confirmations
        const txInfo = await this.getTransactionInfo(txId);
        
        if (!txInfo) continue;

        const confirmations = txInfo.confirmations || 0;
        const amountKAS = utxo.utxoEntry.amount / 100000000; // Convert sompis to KAS

        if (confirmations >= this.confirmations) {
          // Transaction confirmed!
          this.processedTxs.add(txId);

          console.log(`✅ Deposit confirmed: ${amountKAS} KAS (tx: ${txId.substring(0, 10)}...)`);

          // Notify game server
          if (this.onDepositConfirmed) {
            await this.onDepositConfirmed({
              txId,
              fromAddress: txInfo.inputs[0]?.previousOutpoint?.address || 'unknown',
              toAddress: this.casinoAddress,
              amount: amountKAS,
              confirmations,
              timestamp: Date.now()
            });
          }
        } else if (!this.pendingDeposits.has(txId)) {
          // Track new pending deposit
          this.pendingDeposits.set(txId, {
            txId,
            amount: amountKAS,
            confirmations,
            firstSeen: Date.now()
          });

          console.log(`⏳ New deposit pending: ${amountKAS} KAS (${confirmations}/${this.confirmations} confirmations)`);
        }
      }
    } catch (error) {
      console.error('Error checking deposits:', error.message);
    }
  }

  /**
   * Update confirmation count for pending transactions
   */
  async _updatePendingTransactions() {
    for (const [txId, deposit] of this.pendingDeposits.entries()) {
      try {
        const txInfo = await this.getTransactionInfo(txId);
        if (!txInfo) continue;

        const confirmations = txInfo.confirmations || 0;

        if (confirmations >= this.confirmations) {
          // Now confirmed!
          this.pendingDeposits.delete(txId);
          this.processedTxs.add(txId);

          console.log(`✅ Deposit confirmed: ${deposit.amount} KAS`);

          if (this.onDepositConfirmed) {
            await this.onDepositConfirmed({
              txId,
              fromAddress: txInfo.inputs[0]?.previousOutpoint?.address || 'unknown',
              toAddress: this.casinoAddress,
              amount: deposit.amount,
              confirmations,
              timestamp: Date.now()
            });
          }
        } else {
          // Update confirmation count
          deposit.confirmations = confirmations;
        }
      } catch (error) {
        console.error(`Error updating tx ${txId}:`, error.message);
      }
    }
  }

  /**
   * Get transaction information from Kaspa API
   */
  async getTransactionInfo(txId) {
    try {
      const response = await axios.get(
        `${this.kaspaApi}/transactions/${txId}`
      );

      return response.data;
    } catch (error) {
      console.error(`Error fetching tx ${txId}:`, error.message);
      return null;
    }
  }

  /**
   * Send payout to winner
   * @param {string} toAddress - Winner's Kaspa address
   * @param {number} amountKAS - Amount in KAS
   * @returns {Promise<string>} Transaction ID
   */
  async sendPayout(toAddress, amountKAS) {
    try {
      console.log(`💸 Sending payout: ${amountKAS} KAS to ${toAddress.substring(0, 20)}...`);

      // TODO: Implement actual transaction signing and broadcasting
      // This requires:
      // 1. UTXO selection from casino wallet
      // 2. Transaction construction
      // 3. Signing with private key
      // 4. Broadcasting to network

      // For now, return mock transaction
      const mockTxId = crypto.randomBytes(32).toString('hex');

      this.pendingPayouts.set(mockTxId, {
        txId: mockTxId,
        toAddress,
        amount: amountKAS,
        status: 'pending',
        timestamp: Date.now()
      });

      console.log(`📤 Payout transaction created: ${mockTxId.substring(0, 10)}...`);

      return mockTxId;
    } catch (error) {
      console.error('❌ Payout error:', error);
      throw error;
    }
  }

  /**
   * Batch payout for multiple winners (gas optimization)
   */
  async sendBatchPayout(payouts) {
    console.log(`💰 Processing batch payout for ${payouts.length} winners`);

    const results = [];

    for (const payout of payouts) {
      try {
        const txId = await this.sendPayout(payout.address, payout.amount);
        results.push({ success: true, txId, ...payout });
      } catch (error) {
        results.push({ success: false, error: error.message, ...payout });
      }
    }

    return results;
  }

  /**
   * Get current Kaspa price (for USD conversion)
   */
  async getKaspaPrice() {
    try {
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=kaspa&vs_currencies=usd'
      );

      return response.data.kaspa?.usd || 0;
    } catch (error) {
      console.error('Error fetching Kaspa price:', error.message);
      return 0;
    }
  }

  /**
   * Get casino wallet balance
   */
  async getCasinoBalance() {
    try {
      const response = await axios.get(
        `${this.kaspaApi}/addresses/${this.casinoAddress}/balance`
      );

      const balanceSompis = response.data.balance || 0;
      const balanceKAS = balanceSompis / 100000000;

      return balanceKAS;
    } catch (error) {
      console.error('Error fetching balance:', error.message);
      return 0;
    }
  }

  /**
   * Verify a transaction exists and is valid
   */
  async verifyTransaction(txId) {
    const txInfo = await this.getTransactionInfo(txId);
    
    if (!txInfo) return { valid: false, reason: 'Transaction not found' };

    const confirmations = txInfo.confirmations || 0;
    const isConfirmed = confirmations >= this.confirmations;

    return {
      valid: true,
      confirmed: isConfirmed,
      confirmations,
      required: this.confirmations
    };
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false;
    console.log('🛑 Kaspa payment monitoring stopped');
  }

  /**
   * Helper: Sleep
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get monitoring stats
   */
  getStats() {
    return {
      isMonitoring: this.isMonitoring,
      pendingDeposits: this.pendingDeposits.size,
      pendingPayouts: this.pendingPayouts.size,
      processedTransactions: this.processedTxs.size,
      casinoAddress: this.casinoAddress,
      network: this.network
    };
  }
}

module.exports = KaspaPaymentService;
