export interface KaspaWallet {
  address: string;
  balance: number;
  publicKey?: string;
}

export interface KaspaTransaction {
  txId: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
}

declare global {
  interface Window {
    kasware?: {
      requestAccounts: () => Promise<string[]>;
      getAccounts: () => Promise<string[]>;
      getBalance: (address: string) => Promise<{ balance: string }>;
      sendKaspa: (to: string, amount: number) => Promise<string>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}

export class KaspaWalletService {
  private static instance: KaspaWalletService;
  private wallet: KaspaWallet | null = null;

  private constructor() {}

  static getInstance(): KaspaWalletService {
    if (!KaspaWalletService.instance) {
      KaspaWalletService.instance = new KaspaWalletService();
    }
    return KaspaWalletService.instance;
  }

  /**
   * Check if Kaspa wallet is installed
   */
  isInstalled(): boolean {
    return typeof window !== 'undefined' && !!window.kasware;
  }

  /**
   * Connect to Kaspa wallet
   */
  async connect(): Promise<KaspaWallet> {
    if (!this.isInstalled()) {
      throw new Error(
        'Kaspa wallet not found. Please install KasWare or compatible wallet.',
      );
    }

    try {
      const accounts = await window.kasware!.requestAccounts();

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];
      const balanceData = await window.kasware!.getBalance(address);
      const balance = parseFloat(balanceData.balance) / 100000000; // Convert sompi to KAS

      this.wallet = {
        address,
        balance,
      };

      console.log('✅ Kaspa wallet connected:', address);
      return this.wallet;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }

  /**
   * Disconnect wallet
   */
  disconnect(): void {
    this.wallet = null;
    console.log('🔌 Wallet disconnected');
  }

  /**
   * Get current wallet
   */
  getWallet(): KaspaWallet | null {
    return this.wallet;
  }

  /**
   * Send KAS to address
   */
  async sendTransaction(to: string, amount: number): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }

    if (!this.isInstalled()) {
      throw new Error('Kaspa wallet not available');
    }

    try {
      const amountSompi = Math.floor(amount * 100000000); // Convert KAS to sompi
      const txId = await window.kasware!.sendKaspa(to, amountSompi);

      console.log('📤 Transaction sent:', txId);
      return txId;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  /**
   * Get current balance
   */
  async getBalance(address?: string): Promise<number> {
    if (!this.isInstalled()) {
      throw new Error('Kaspa wallet not available');
    }

    try {
      const addr = address || this.wallet?.address;
      if (!addr) {
        throw new Error('No address provided');
      }

      const balanceData = await window.kasware!.getBalance(addr);
      return parseFloat(balanceData.balance) / 100000000;
    } catch (error) {
      console.error('Failed to get balance:', error);
      return 0;
    }
  }

  /**
   * Watch for wallet events
   */
  onAccountsChanged(callback: (accounts: string[]) => void): void {
    if (this.isInstalled()) {
      window.kasware!.on('accountsChanged', callback);
    }
  }

  /**
   * Remove event listener
   */
  removeListener(event: string, callback: (...args: any[]) => void): void {
    if (this.isInstalled()) {
      window.kasware!.removeListener(event, callback);
    }
  }
}

export const kaspaWallet = KaspaWalletService.getInstance();
