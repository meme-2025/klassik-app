/**
 * Klassik Wallet Authentication Module
 * Handles MetaMask/Web3 wallet connection and authentication
 */

const WalletAuth = {
  provider: null,
  signer: null,
  address: null,

  /**
   * Check if MetaMask is installed
   */
  isMetaMaskInstalled() {
    return typeof window.ethereum !== 'undefined';
  },

  /**
   * Connect to MetaMask wallet
   */
  async connectWallet() {
    if (!this.isMetaMaskInstalled()) {
      throw new Error('Please install MetaMask to use wallet authentication');
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      this.address = accounts[0];
      
      // Initialize ethers provider
      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      this.signer = this.provider.getSigner();
      
      console.log('✅ Wallet connected:', this.address);
      return this.address;
    } catch (error) {
      console.error('Wallet connection failed:', error);
      throw new Error('Failed to connect wallet: ' + error.message);
    }
  },

  /**
   * Get nonce from backend for signing
   */
  async getNonce(address) {
    const response = await fetch(`${API_URL}/api/auth/nonce?address=${address}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get nonce');
    }

    const data = await response.json();
    return data;
  },

  /**
   * Sign message with MetaMask
   */
  async signMessage(message) {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const signature = await this.signer.signMessage(message);
      console.log('✅ Message signed');
      return signature;
    } catch (error) {
      console.error('Signing failed:', error);
      throw new Error('User rejected signature or signing failed');
    }
  },

  /**
   * Register new user with wallet
   */
  async registerWithWallet(email = null) {
    try {
      // Step 1: Connect wallet
      const address = await this.connectWallet();
      
      // Step 2: Get nonce
      const { nonce, message, expiresAt } = await this.getNonce(address);
      
      // Step 3: Sign message
      const signature = await this.signMessage(message);
      
      // Step 4: Send to backend
      const response = await fetch(`${API_URL}/api/auth/register-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          signature,
          email
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Save token and user data
      localStorage.setItem('klassik_token', data.token);
      localStorage.setItem('klassik_user', JSON.stringify(data.user));
      
      return data;
    } catch (error) {
      console.error('Wallet registration failed:', error);
      throw error;
    }
  },

  /**
   * Login with wallet
   */
  async loginWithWallet() {
    try {
      // Step 1: Connect wallet
      const address = await this.connectWallet();
      
      // Step 2: Get nonce
      const { nonce, message, expiresAt } = await this.getNonce(address);
      
      // Step 3: Sign message
      const signature = await this.signMessage(message);
      
      // Step 4: Send to backend
      const response = await fetch(`${API_URL}/api/auth/login-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          signature
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // If wallet not registered, throw specific error
        if (data.needsRegistration) {
          const error = new Error(data.error);
          error.needsRegistration = true;
          throw error;
        }
        throw new Error(data.error || 'Login failed');
      }

      // Save token and user data
      localStorage.setItem('klassik_token', data.token);
      localStorage.setItem('klassik_user', JSON.stringify(data.user));
      
      return data;
    } catch (error) {
      console.error('Wallet login failed:', error);
      throw error;
    }
  },

  /**
   * Disconnect wallet
   */
  disconnect() {
    this.provider = null;
    this.signer = null;
    this.address = null;
    localStorage.removeItem('klassik_token');
    localStorage.removeItem('klassik_user');
  }
};

// UI Helper Functions for Wallet Auth

/**
 * Handle wallet login button click
 */
async function handleWalletLogin() {
  const loginBtn = document.getElementById('walletLoginBtn');
  
  if (loginBtn) {
    const originalText = loginBtn.textContent;
    loginBtn.disabled = true;
    loginBtn.textContent = 'Connecting...';
    
    try {
      const result = await WalletAuth.loginWithWallet();
      
      // Update UI
      if (typeof updateUIForLoggedInUser === 'function') {
        updateUIForLoggedInUser(result.user);
      }
      
      // Show success message
      if (typeof AnimationHelpers !== 'undefined' && AnimationHelpers.showToast) {
        AnimationHelpers.showToast(`Welcome back, ${result.user.address}!`, 'success');
      }
      
      // Close modal
      if (typeof AnimationHelpers !== 'undefined' && AnimationHelpers.closeModal) {
        AnimationHelpers.closeModal('loginModal');
      }
      
    } catch (error) {
      // Check if user needs to register
      if (error.needsRegistration) {
        if (confirm('Wallet not registered. Would you like to register now?')) {
          await handleWalletRegister();
        }
      } else {
        // Show error
        if (typeof AnimationHelpers !== 'undefined' && AnimationHelpers.showToast) {
          AnimationHelpers.showToast(error.message, 'error');
        } else {
          alert('Login failed: ' + error.message);
        }
      }
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = originalText;
    }
  }
}

/**
 * Handle wallet register button click
 */
async function handleWalletRegister() {
  const registerBtn = document.getElementById('walletRegisterBtn');
  
  // Optionally ask for email
  const email = prompt('Enter your email (optional):');
  
  if (registerBtn) {
    const originalText = registerBtn.textContent;
    registerBtn.disabled = true;
    registerBtn.textContent = 'Connecting...';
    
    try {
      const result = await WalletAuth.registerWithWallet(email);
      
      // Update UI
      if (typeof updateUIForLoggedInUser === 'function') {
        updateUIForLoggedInUser(result.user);
      }
      
      // Show success message
      if (typeof AnimationHelpers !== 'undefined' && AnimationHelpers.showToast) {
        AnimationHelpers.showToast(`Welcome to Klassik, ${result.user.address}!`, 'success');
      }
      
      // Close modal
      if (typeof AnimationHelpers !== 'undefined' && AnimationHelpers.closeModal) {
        AnimationHelpers.closeModal('registerModal');
      }
      
    } catch (error) {
      // Show error
      if (typeof AnimationHelpers !== 'undefined' && AnimationHelpers.showToast) {
        AnimationHelpers.showToast(error.message, 'error');
      } else {
        alert('Registration failed: ' + error.message);
      }
    } finally {
      registerBtn.disabled = false;
      registerBtn.textContent = originalText;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WalletAuth;
}
