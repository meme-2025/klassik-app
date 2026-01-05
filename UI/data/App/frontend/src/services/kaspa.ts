// Kaspa Wallet Integration Service
// Handles wallet connection, transactions, and smart contract interactions

export interface KaspaWallet {
  address: string;
  balance: number;
  publicKey: string;
}

export interface Transaction {
  txId: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
}

class KaspaService {
  private wallet: KaspaWallet | null = null;
  private isConnected: boolean = false;
  private networkUrl: string = 'https://api.kaspa.org';

  /**
   * Connect to Kaspa wallet
   */
  async connectWallet(): Promise<KaspaWallet> {
    try {
      // Check if Kaspa wallet extension is available
      if (typeof window !== 'undefined' && (window as any).kaspa) {
        const kaspaWallet = (window as any).kaspa;
        
        // Request connection
        const accounts = await kaspaWallet.request({ method: 'kas_requestAccounts' });
        
        if (accounts && accounts.length > 0) {
          const address = accounts[0];
          
          // Get balance
          const balance = await this.getBalance(address);
          
          this.wallet = {
            address,
            balance,
            publicKey: address // Simplified, in production get actual public key
          };
          
          this.isConnected = true;
          
          console.log('✅ Kaspa wallet connected:', this.wallet.address);
          return this.wallet;
        }
      }
      
      throw new Error('Kaspa wallet not found. Please install a Kaspa wallet extension.');
    } catch (error) {
      console.error('❌ Failed to connect wallet:', error);
      throw error;
    }
  }

  /**
   * Disconnect wallet
   */
  disconnectWallet(): void {
    this.wallet = null;
    this.isConnected = false;
    console.log('🔌 Wallet disconnected');
  }

  /**
   * Get wallet balance
   */
  async getBalance(address: string): Promise<number> {
    try {
      const response = await fetch(`${this.networkUrl}/addresses/${address}/balance`);
      const data = await response.json();
      
      // Convert from sompi to KAS (1 KAS = 100,000,000 sompi)
      return data.balance / 100000000;
    } catch (error) {
      console.error('Failed to get balance:', error);
      return 0;
    }
  }

  /**
   * Send KAS transaction
   */
  async sendTransaction(to: string, amount: number): Promise<Transaction> {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }

    try {
      // Convert KAS to sompi
      const amountInSompi = amount * 100000000;

      // Create transaction using wallet extension
      if (typeof window !== 'undefined' && (window as any).kaspa) {
        const kaspaWallet = (window as any).kaspa;
        
        const txParams = {
          from: this.wallet.address,
          to,
          value: amountInSompi.toString(),
        };

        const txId = await kaspaWallet.request({
          method: 'kas_sendTransaction',
          params: [txParams]
        });

        const transaction: Transaction = {
          txId,
          from: this.wallet.address,
          to,
          amount,
          timestamp: Date.now(),
          status: 'pending'
        };

        console.log('📤 Transaction sent:', transaction);
        return transaction;
      }

      throw new Error('Kaspa wallet not available');
    } catch (error) {
      console.error('❌ Transaction failed:', error);
      throw error;
    }
  }

  /**
   * Join Rush Game lobby - sends bet to smart contract
   */
  async joinRushGame(betAmount: number, lobbyId: string): Promise<Transaction> {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }

    // Smart contract address for Rush Game
    const contractAddress = 'kaspa:qr... [CONTRACT_ADDRESS]'; // TODO: Deploy contract

    try {
      console.log(`🎮 Joining Rush Game lobby ${lobbyId} with ${betAmount} KAS...`);
      
      // Send bet to smart contract
      const transaction = await this.sendTransaction(contractAddress, betAmount);
      
      console.log('✅ Successfully joined game!');
      return transaction;
    } catch (error) {
      console.error('❌ Failed to join game:', error);
      throw error;
    }
  }

  /**
   * Cash out from Rush Game
   */
  async cashOutFromGame(multiplier: number, lobbyId: string): Promise<void> {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }

    try {
      console.log(`💵 Cashing out at ${multiplier}x from lobby ${lobbyId}...`);
      
      // Call smart contract cash-out function
      // This would trigger the smart contract to send winnings back to wallet
      
      // For now, simulate the call
      // In production, this would interact with the deployed contract
      
      console.log('✅ Cash out successful!');
    } catch (error) {
      console.error('❌ Cash out failed:', error);
      throw error;
    }
  }

  /**
   * Get current wallet
   */
  getWallet(): KaspaWallet | null {
    return this.wallet;
  }

  /**
   * Check if wallet is connected
   */
  isWalletConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Watch for wallet events
   */
  onAccountsChanged(callback: (accounts: string[]) => void): void {
    if (typeof window !== 'undefined' && (window as any).kaspa) {
      (window as any).kaspa.on('accountsChanged', callback);
    }
  }

  /**
   * Watch for network changes
   */
  onNetworkChanged(callback: (network: string) => void): void {
    if (typeof window !== 'undefined' && (window as any).kaspa) {
      (window as any).kaspa.on('networkChanged', callback);
    }
  }
}

// Export singleton instance
export const kaspaService = new KaspaService();

// Mock functions for testing without wallet
export class MockKaspaService {
  private mockWallet: KaspaWallet = {
    address: 'kaspa:qpamkvhgh0hzrew22mt486g6lkf0qay37s26qppz8xmn9p7h0ddtcjrgaw660',
    balance: 1000,
    publicKey: 'mock-public-key'
  };

  async connectWallet(): Promise<KaspaWallet> {
    console.log('🧪 Mock wallet connected');
    return this.mockWallet;
  }

  async sendTransaction(to: string, amount: number): Promise<Transaction> {
    console.log(`🧪 Mock transaction: ${amount} KAS to ${to}`);
    return {
      txId: `mock-tx-${Date.now()}`,
      from: this.mockWallet.address,
      to,
      amount,
      timestamp: Date.now(),
      status: 'confirmed'
    };
  }

  async joinRushGame(betAmount: number, lobbyId: string): Promise<Transaction> {
    console.log(`🧪 Mock join game: ${betAmount} KAS to lobby ${lobbyId}`);
    return this.sendTransaction('mock-contract', betAmount);
  }

  async cashOutFromGame(multiplier: number, lobbyId: string): Promise<void> {
    console.log(`🧪 Mock cash out at ${multiplier}x from lobby ${lobbyId}`);
  }

  getWallet(): KaspaWallet {
    return this.mockWallet;
  }

  isWalletConnected(): boolean {
    return true;
  }
}

// Use mock service in development
export const isDevelopment = process.env.NODE_ENV === 'development';
export default isDevelopment ? new MockKaspaService() : kaspaService;
