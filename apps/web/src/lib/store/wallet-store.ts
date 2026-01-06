import { create } from 'zustand';
import { kaspaWallet, type KaspaWallet } from '../kaspa/wallet';

interface WalletStore {
  wallet: KaspaWallet | null;
  isConnecting: boolean;
  error: string | null;
  
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  setError: (error: string | null) => void;
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  wallet: null,
  isConnecting: false,
  error: null,

  connect: async () => {
    set({ isConnecting: true, error: null });
    try {
      const wallet = await kaspaWallet.connect();
      set({ wallet, isConnecting: false });
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to connect wallet',
        isConnecting: false 
      });
      throw error;
    }
  },

  disconnect: () => {
    kaspaWallet.disconnect();
    set({ wallet: null, error: null });
  },

  refreshBalance: async () => {
    const { wallet } = get();
    if (!wallet) return;

    try {
      const balance = await kaspaWallet.getBalance(wallet.address);
      set({ 
        wallet: { ...wallet, balance } 
      });
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    }
  },

  setError: (error) => set({ error }),
}));
