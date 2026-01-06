import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { KaspaTransaction } from './entities/kaspa-transaction.entity';

export interface DepositInfo {
  txId: string;
  fromAddress: string;
  amount: number;
  lobbyId?: string;
  userId?: string;
}

export interface PayoutInfo {
  toAddress: string;
  amount: number;
  lobbyId: string;
  userId: string;
}

@Injectable()
export class KaspaPaymentService {
  private readonly logger = new Logger(KaspaPaymentService.name);
  private readonly kaspaApi: string;
  private readonly network: string;
  private readonly casinoAddress: string;
  private readonly confirmations: number;
  private readonly pollInterval: number;
  
  private pendingDeposits = new Map<string, DepositInfo>();
  private processedTxs = new Set<string>();
  private isMonitoring = false;
  private monitorInterval: NodeJS.Timeout;

  constructor(
    @InjectRepository(KaspaTransaction)
    private txRepository: Repository<KaspaTransaction>,
    private configService: ConfigService,
  ) {
    this.kaspaApi = this.configService.get('KASPA_REST_API') || 'https://api.kaspa.org';
    this.network = this.configService.get('KASPA_NETWORK') || 'testnet-10';
    this.casinoAddress = this.configService.get('CASINO_KASPA_ADDRESS');
    this.confirmations = parseInt(this.configService.get('REQUIRED_CONFIRMATIONS') || '6');
    this.pollInterval = parseInt(this.configService.get('KASPA_POLL_INTERVAL_MS') || '1000');

    this.logger.log(`🔧 Kaspa Payment Service initialized`);
    this.logger.log(`📍 Casino Address: ${this.casinoAddress}`);
    this.logger.log(`🌐 Network: ${this.network}`);
    this.logger.log(`✅ Required Confirmations: ${this.confirmations}`);
  }

  /**
   * Start monitoring Kaspa blockchain for incoming deposits
   */
  async startMonitoring(onDepositConfirmed: (deposit: DepositInfo) => void) {
    if (this.isMonitoring) {
      this.logger.warn('⚠️ Monitoring already active');
      return;
    }

    this.isMonitoring = true;
    this.logger.log('🔍 Starting Kaspa payment monitoring...');

    this.monitorInterval = setInterval(async () => {
      try {
        await this.checkForNewDeposits(onDepositConfirmed);
      } catch (error) {
        this.logger.error(`❌ Monitoring error: ${error.message}`);
      }
    }, this.pollInterval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.isMonitoring = false;
      this.logger.log('🛑 Stopped Kaspa monitoring');
    }
  }

  /**
   * Check for new deposits to casino address
   */
  private async checkForNewDeposits(onDepositConfirmed: (deposit: DepositInfo) => void) {
    try {
      // Get UTXOs for casino address
      const response = await axios.get(
        `${this.kaspaApi}/addresses/${this.casinoAddress}/utxos`,
        { timeout: 5000 }
      );

      const utxos = response.data?.utxos || [];

      for (const utxo of utxos) {
        const txId = utxo.outpoint?.transactionId;
        if (!txId || this.processedTxs.has(txId)) continue;

        // Get transaction details
        const txInfo = await this.getTransactionInfo(txId);
        if (!txInfo) continue;

        const confirmations = txInfo.confirmations || 0;
        const amountSompi = parseInt(utxo.utxoEntry?.amount || '0');
        const amountKAS = amountSompi / 100000000;

        // Check if meets confirmation requirement
        if (confirmations >= this.confirmations) {
          this.processedTxs.add(txId);

          // Find sender address
          const fromAddress = txInfo.inputs?.[0]?.previousOutpoint?.address || 'unknown';

          const deposit: DepositInfo = {
            txId,
            fromAddress,
            amount: amountKAS,
          };

          // Save to database
          await this.saveTransaction({
            txId,
            type: 'deposit',
            fromAddress,
            toAddress: this.casinoAddress,
            amountKas: amountKAS,
            amountSompi,
            confirmations,
            status: 'confirmed',
          });

          this.logger.log(`✅ Deposit confirmed: ${amountKAS} KAS from ${fromAddress.substring(0, 20)}... (tx: ${txId.substring(0, 10)}...)`);

          // Notify callback
          if (onDepositConfirmed) {
            onDepositConfirmed(deposit);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error checking deposits: ${error.message}`);
    }
  }

  /**
   * Get transaction information from Kaspa API
   */
  async getTransactionInfo(txId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.kaspaApi}/transactions/${txId}`,
        { timeout: 5000 }
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching tx ${txId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Verify a lobby entry payment
   */
  async verifyLobbyPayment(txId: string, expectedAmount: number): Promise<boolean> {
    try {
      const tx = await this.txRepository.findOne({ where: { txId } });
      
      if (!tx) {
        this.logger.warn(`Transaction ${txId} not found in database`);
        return false;
      }

      if (tx.status !== 'confirmed') {
        this.logger.warn(`Transaction ${txId} not confirmed yet`);
        return false;
      }

      // Check amount matches (with small tolerance for fees)
      const tolerance = 0.001; // 0.001 KAS tolerance
      const amountMatch = Math.abs(tx.amountKas - expectedAmount) < tolerance;

      if (!amountMatch) {
        this.logger.warn(`Amount mismatch: expected ${expectedAmount}, got ${tx.amountKas}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Error verifying payment: ${error.message}`);
      return false;
    }
  }

  /**
   * Send payout to winner
   */
  async sendPayout(payout: PayoutInfo): Promise<string> {
    try {
      this.logger.log(`💰 Sending payout: ${payout.amount} KAS to ${payout.toAddress.substring(0, 20)}...`);

      // TODO: Implement actual transaction sending
      // This requires private key management and transaction construction
      // For now, return mock transaction ID
      
      const mockTxId = `payout_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Save payout transaction
      await this.saveTransaction({
        txId: mockTxId,
        type: 'payout',
        fromAddress: this.casinoAddress,
        toAddress: payout.toAddress,
        amountKas: payout.amount,
        amountSompi: Math.floor(payout.amount * 100000000),
        confirmations: 0,
        status: 'pending',
        lobbyId: payout.lobbyId,
        userId: payout.userId,
      });

      this.logger.log(`✅ Payout initiated: ${mockTxId}`);
      return mockTxId;
    } catch (error) {
      this.logger.error(`❌ Payout failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get account balance
   */
  async getBalance(address: string): Promise<number> {
    try {
      const response = await axios.get(
        `${this.kaspaApi}/addresses/${address}/balance`,
        { timeout: 5000 }
      );
      
      const balanceSompi = parseInt(response.data?.balance || '0');
      return balanceSompi / 100000000;
    } catch (error) {
      this.logger.error(`Error getting balance for ${address}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Save transaction to database
   */
  private async saveTransaction(data: {
    txId: string;
    type: 'deposit' | 'payout';
    fromAddress: string;
    toAddress: string;
    amountKas: number;
    amountSompi: number;
    confirmations: number;
    status: string;
    lobbyId?: string;
    userId?: string;
  }) {
    try {
      const transaction = this.txRepository.create({
        txId: data.txId,
        type: data.type,
        fromAddress: data.fromAddress,
        toAddress: data.toAddress,
        amountKas: data.amountKas,
        amountSompi: data.amountSompi,
        confirmations: data.confirmations,
        status: data.status,
        lobbyId: data.lobbyId,
        userId: data.userId,
      });

      await this.txRepository.save(transaction);
    } catch (error) {
      this.logger.error(`Error saving transaction: ${error.message}`);
    }
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(txId: string): Promise<KaspaTransaction> {
    return this.txRepository.findOne({ where: { txId } });
  }

  /**
   * Get all transactions for a user
   */
  async getUserTransactions(userId: string): Promise<KaspaTransaction[]> {
    return this.txRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
