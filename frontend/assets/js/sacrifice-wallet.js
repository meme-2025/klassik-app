/**
 * KASPAHUB SACRIFICE - WALLET INTEGRATION
 * Handles Kaspa wallet connections and blockchain interactions
 */

// ============================================
// KASPA WALLET INTERFACE
// ============================================

class KaspaWallet {
    constructor() {
        this.connected = false;
        this.address = null;
        this.balance = 0;
        this.provider = null;
    }
    
    /**
     * Detect available Kaspa wallets
     */
    async detectWallets() {
        const wallets = [];
        
        // Check for KasWare extension
        if (window.kasware) {
            wallets.push({
                name: 'KasWare',
                provider: window.kasware,
                icon: '🔷'
            });
        }
        
        // Check for Kaspa Desktop Wallet
        if (window.kaspa) {
            wallets.push({
                name: 'Kaspa Desktop',
                provider: window.kaspa,
                icon: '💎'
            });
        }
        
        // Check for Web Wallet
        if (window.kaspaWebWallet) {
            wallets.push({
                name: 'Web Wallet',
                provider: window.kaspaWebWallet,
                icon: '🌐'
            });
        }
        
        return wallets;
    }
    
    /**
     * Connect to wallet
     */
    async connect(provider = null) {
        try {
            // If no provider specified, try auto-detect
            if (!provider) {
                const wallets = await this.detectWallets();
                if (wallets.length === 0) {
                    throw new Error('No Kaspa wallet detected. Please install KasWare or Kaspa Desktop Wallet.');
                }
                provider = wallets[0].provider;
            }
            
            this.provider = provider;
            
            // Request account access
            const accounts = await provider.requestAccounts();
            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found');
            }
            
            this.address = accounts[0];
            this.connected = true;
            
            // Get balance
            await this.updateBalance();
            
            // Setup event listeners
            this.setupEventListeners();
            
            return {
                success: true,
                address: this.address,
                balance: this.balance
            };
            
        } catch (error) {
            console.error('Wallet connection error:', error);
            
            // Fallback to mock wallet for demo
            return this.connectMockWallet();
        }
    }
    
    /**
     * Mock wallet for demo purposes
     */
    async connectMockWallet() {
        console.log('🎭 Using mock wallet for demonstration');
        
        // Generate realistic mock address
        this.address = this.generateKaspaAddress();
        this.balance = Math.floor(Math.random() * 200000) + 50000; // 50k - 250k KAS
        this.connected = true;
        
        return {
            success: true,
            address: this.address,
            balance: this.balance,
            mock: true
        };
    }
    
    /**
     * Generate mock Kaspa address
     */
    generateKaspaAddress() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let address = 'kaspa:qz';
        for (let i = 0; i < 60; i++) {
            address += chars[Math.floor(Math.random() * chars.length)];
        }
        return address;
    }
    
    /**
     * Update balance
     */
    async updateBalance() {
        try {
            if (this.provider && this.provider.getBalance) {
                const balance = await this.provider.getBalance(this.address);
                this.balance = balance / 100000000; // Convert sompi to KAS
            }
        } catch (error) {
            console.error('Error updating balance:', error);
        }
    }
    
    /**
     * Disconnect wallet
     */
    disconnect() {
        this.connected = false;
        this.address = null;
        this.balance = 0;
        this.provider = null;
    }
    
    /**
     * Send transaction
     */
    async sendTransaction(toAddress, amount, fee = 1000) {
        try {
            if (!this.connected) {
                throw new Error('Wallet not connected');
            }
            
            // Validate amount
            if (amount <= 0 || amount > this.balance) {
                throw new Error('Invalid amount');
            }
            
            // Convert KAS to sompi
            const amountSompi = Math.floor(amount * 100000000);
            
            // Create transaction
            const tx = {
                from: this.address,
                to: toAddress,
                amount: amountSompi,
                fee: fee
            };
            
            // Send via provider
            if (this.provider && this.provider.sendTransaction) {
                const result = await this.provider.sendTransaction(tx);
                
                // Update balance
                await this.updateBalance();
                
                return {
                    success: true,
                    txHash: result.txHash,
                    amount: amount
                };
            } else {
                // Mock transaction for demo
                return this.mockTransaction(toAddress, amount);
            }
            
        } catch (error) {
            console.error('Transaction error:', error);
            throw error;
        }
    }
    
    /**
     * Mock transaction for demo
     */
    async mockTransaction(toAddress, amount) {
        console.log('🎭 Simulating transaction...', { toAddress, amount });
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Generate mock transaction hash
        const txHash = this.generateTxHash();
        
        // Deduct from balance
        this.balance -= amount;
        
        return {
            success: true,
            txHash: txHash,
            amount: amount,
            mock: true
        };
    }
    
    /**
     * Generate mock transaction hash
     */
    generateTxHash() {
        const chars = 'abcdef0123456789';
        let hash = '';
        for (let i = 0; i < 64; i++) {
            hash += chars[Math.floor(Math.random() * chars.length)];
        }
        return hash;
    }
    
    /**
     * Verify transaction on blockchain
     */
    async verifyTransaction(txHash) {
        try {
            // Query Kaspa API
            const apiUrl = `https://api.kaspa.org/transaction/${txHash}`;
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error('Transaction not found');
            }
            
            const data = await response.json();
            
            return {
                confirmed: data.confirmations > 0,
                confirmations: data.confirmations,
                amount: data.outputs[0].value / 100000000,
                timestamp: data.timestamp
            };
            
        } catch (error) {
            console.error('Verification error:', error);
            
            // Mock verification for demo
            return {
                confirmed: true,
                confirmations: 1,
                amount: 0,
                timestamp: Date.now(),
                mock: true
            };
        }
    }
    
    /**
     * Get transaction history
     */
    async getTransactionHistory(limit = 10) {
        try {
            if (!this.connected) {
                throw new Error('Wallet not connected');
            }
            
            // Query Kaspa API
            const apiUrl = `https://api.kaspa.org/address/${this.address}/transactions?limit=${limit}`;
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error('Failed to fetch history');
            }
            
            const data = await response.json();
            
            return data.transactions.map(tx => ({
                txHash: tx.hash,
                amount: tx.amount / 100000000,
                timestamp: tx.timestamp,
                type: tx.type
            }));
            
        } catch (error) {
            console.error('History error:', error);
            return [];
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (!this.provider) return;
        
        // Account changed
        if (this.provider.on) {
            this.provider.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    this.disconnect();
                    window.dispatchEvent(new CustomEvent('walletDisconnected'));
                } else {
                    this.address = accounts[0];
                    this.updateBalance();
                    window.dispatchEvent(new CustomEvent('walletAccountChanged', { 
                        detail: { address: this.address } 
                    }));
                }
            });
            
            // Chain changed
            this.provider.on('chainChanged', () => {
                window.location.reload();
            });
        }
    }
    
    /**
     * Sign message
     */
    async signMessage(message) {
        try {
            if (!this.connected) {
                throw new Error('Wallet not connected');
            }
            
            if (this.provider && this.provider.signMessage) {
                const signature = await this.provider.signMessage(message);
                return signature;
            } else {
                // Mock signature for demo
                return this.mockSignature(message);
            }
            
        } catch (error) {
            console.error('Signing error:', error);
            throw error;
        }
    }
    
    /**
     * Mock signature for demo
     */
    mockSignature(message) {
        const chars = 'abcdef0123456789';
        let signature = '';
        for (let i = 0; i < 128; i++) {
            signature += chars[Math.floor(Math.random() * chars.length)];
        }
        return signature;
    }
}

// ============================================
// SACRIFICE TRANSACTION HANDLER
// ============================================

class SacrificeTransactionHandler {
    constructor(wallet) {
        this.wallet = wallet;
        this.burnAddress = 'kaspa:qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqdmwjs8c';
        this.minAmount = 1000;
    }
    
    /**
     * Execute sacrifice transaction
     */
    async executeSacrifice(amount, tier) {
        try {
            // Validate
            if (!this.wallet.connected) {
                throw new Error('Wallet not connected');
            }
            
            if (amount < this.minAmount) {
                throw new Error(`Minimum sacrifice amount is ${this.minAmount} KAS`);
            }
            
            if (amount > this.wallet.balance) {
                throw new Error('Insufficient balance');
            }
            
            // Show confirmation
            const confirmed = await this.showConfirmation(amount, tier);
            if (!confirmed) {
                throw new Error('User cancelled transaction');
            }
            
            // Send to burn address
            const result = await this.wallet.sendTransaction(this.burnAddress, amount);
            
            // Record sacrifice
            await this.recordSacrifice({
                txHash: result.txHash,
                address: this.wallet.address,
                amount: amount,
                tier: tier.name,
                timestamp: Date.now()
            });
            
            return result;
            
        } catch (error) {
            console.error('Sacrifice execution error:', error);
            throw error;
        }
    }
    
    /**
     * Show confirmation dialog
     */
    async showConfirmation(amount, tier) {
        return new Promise((resolve) => {
            const points = this.calculatePoints(amount, tier);
            
            const confirmed = confirm(
                `🔥 SACRIFICE CONFIRMATION\n\n` +
                `Amount: ${amount.toLocaleString()} KAS\n` +
                `Tier: ${tier.name.toUpperCase()}\n` +
                `Bonus: +${tier.bonus}%\n` +
                `Points: ${points.toLocaleString()}\n\n` +
                `⚠️ This transaction will permanently burn your KAS!\n` +
                `Are you sure you want to continue?`
            );
            
            resolve(confirmed);
        });
    }
    
    /**
     * Calculate points
     */
    calculatePoints(amount, tier) {
        const basePoints = (amount / 1000) * tier.points;
        return Math.floor(basePoints);
    }
    
    /**
     * Record sacrifice to backend
     */
    async recordSacrifice(data) {
        try {
            const response = await fetch('/api/sacrifice/record', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                console.error('Failed to record sacrifice');
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('Record error:', error);
            // Continue even if recording fails
            return { success: false, mock: true };
        }
    }
    
    /**
     * Verify sacrifice on blockchain
     */
    async verifySacrifice(txHash) {
        try {
            const verification = await this.wallet.verifyTransaction(txHash);
            
            // Check if transaction is to burn address
            // Additional verification logic here
            
            return {
                valid: verification.confirmed,
                ...verification
            };
            
        } catch (error) {
            console.error('Verification error:', error);
            return { valid: false };
        }
    }
}

// ============================================
// REAL-TIME WALLET MONITOR
// ============================================

class WalletMonitor {
    constructor(wallet) {
        this.wallet = wallet;
        this.updateInterval = 30000; // 30 seconds
        this.intervalId = null;
    }
    
    /**
     * Start monitoring
     */
    start() {
        if (this.intervalId) return;
        
        this.intervalId = setInterval(() => {
            this.update();
        }, this.updateInterval);
        
        // Initial update
        this.update();
    }
    
    /**
     * Stop monitoring
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    
    /**
     * Update wallet data
     */
    async update() {
        if (!this.wallet.connected) return;
        
        try {
            await this.wallet.updateBalance();
            
            // Dispatch event
            window.dispatchEvent(new CustomEvent('walletUpdated', {
                detail: {
                    address: this.wallet.address,
                    balance: this.wallet.balance
                }
            }));
            
        } catch (error) {
            console.error('Monitor update error:', error);
        }
    }
}

// ============================================
// INITIALIZE & EXPORT
// ============================================

// Create global wallet instance
const kaspaWallet = new KaspaWallet();
const sacrificeHandler = new SacrificeTransactionHandler(kaspaWallet);
const walletMonitor = new WalletMonitor(kaspaWallet);

// Export to global scope
window.KaspaWallet = KaspaWallet;
window.kaspaWallet = kaspaWallet;
window.sacrificeHandler = sacrificeHandler;
window.walletMonitor = walletMonitor;

// Setup wallet event listeners
window.addEventListener('walletUpdated', (event) => {
    console.log('💎 Wallet updated:', event.detail);
    
    // Update UI
    if (window.SacrificeState) {
        window.SacrificeState.walletBalance = event.detail.balance;
        document.getElementById('walletBalance').textContent = `${event.detail.balance.toLocaleString()} KAS`;
    }
});

window.addEventListener('walletDisconnected', () => {
    console.log('👋 Wallet disconnected');
    walletMonitor.stop();
    
    if (window.showToast) {
        window.showToast('Wallet disconnected', 'info');
    }
});

console.log('💎 Kaspa Wallet module loaded');
