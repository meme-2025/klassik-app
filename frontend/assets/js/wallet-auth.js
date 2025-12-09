// Minimal Wallet Auth + API tester for Klassik backend
(function(){
  const el = id => document.getElementById(id);
  const baseUrlInput = el('baseUrl');
  const addressInput = el('addr');
  const connectedLabel = el('connected');
  const msgArea = el('message');
  const sigInput = el('signature');
  const tokenView = el('tokenView');
  const apiResp = el('apiResp');

  // helpers
  function baseUrl(){ return (baseUrlInput.value || '').replace(/\/$/, '') }
  function setToken(t){ if(t) localStorage.setItem('klassik_token', t); else localStorage.removeItem('klassik_token'); tokenView.textContent = t || '(none)'; }
  function getToken(){ return localStorage.getItem('klassik_token'); }
  function showResp(o){ try { apiResp.textContent = JSON.stringify(o,null,2) } catch(e){ apiResp.textContent = String(o) } }

  // Wallet connect (MetaMask)
  el('btnConnect').addEventListener('click', async ()=>{
    if (!window.ethereum) { alert('No Ethereum provider found. Install MetaMask.'); return }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const a = accounts[0];
      addressInput.value = a; connectedLabel.textContent = 'Connected';
    } catch(err){ console.error(err); alert('Failed to connect wallet') }
  });

  // Get SIWE message (server builds message including nonce)
  el('btnNonce').addEventListener('click', async ()=>{
    const addr = addressInput.value || prompt('Enter address to request nonce for');
    if(!addr) return;
    try{
      const res = await fetch(`${baseUrl()}/api/auth/siwe/message?address=${encodeURIComponent(addr)}`);
      const data = await res.json();
      if(!res.ok) { showResp(data); return }
      msgArea.value = data.message || '';
      showResp(data);
    }catch(e){ console.error(e); showResp({error:'Request failed', detail:String(e)}) }
  });

  // Sign message helper using ethereum provider
  async function signMessage(message){
    if(window.ethereum && (addressInput.value || (await window.ethereum.request({method:'eth_accounts'}))[0])){
      const addr = addressInput.value || (await window.ethereum.request({method:'eth_accounts'}))[0];
      try{
        // personal_sign params [message, address]
        const sig = await window.ethereum.request({ method: 'personal_sign', params: [message, addr] });
        return sig;
      }catch(e){ throw e }
    }
    throw new Error('No wallet available to sign');
  }

  // Sign & Verify (SIWE) - this endpoint will create the user if needed, or login
  async function signAndVerify(){
    const message = msgArea.value;
    if(!message) return alert('Get SIWE message first');
    try{
      const sig = await signMessage(message);
      sigInput.value = sig;
      const body = { message, signature: sig };
      const res = await fetch(`${baseUrl()}/api/auth/siwe/verify`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const data = await res.json();
      showResp(data);
      if(res.ok && data.token){ setToken(data.token); }
    }catch(e){ console.error(e); showResp({error:String(e)}) }
  }

  el('btnSignRegister').addEventListener('click', signAndVerify);
  el('btnSignLogin').addEventListener('click', signAndVerify);

  // Token controls
  el('btnShowToken').addEventListener('click', ()=>{ tokenView.textContent = getToken() || '(none)'; });
  el('btnClearToken').addEventListener('click', ()=>{ setToken(null); showResp({info:'token cleared'}); });

  // GET products
  el('btnProducts').addEventListener('click', async ()=>{
    try{
      const res = await fetch(`${baseUrl()}/api/products`);
      const data = await res.json();
      showResp(data);
    }catch(e){ showResp({error:String(e)}) }
  });

  // Debug endpoints (require admin token)
  el('btnDebugUsers') && el('btnDebugUsers').addEventListener('click', async ()=>{
    const token = el('adminToken').value;
    if(!token) return alert('Set admin token to use debug endpoints');
    try{
      const res = await fetch(`${baseUrl()}/api/debug/users`, { headers: { 'X-ADMIN-TOKEN': token } });
      const data = await res.json(); showResp(data);
    }catch(e){ showResp({error:String(e)}) }
  });

  el('btnDebugProducts') && el('btnDebugProducts').addEventListener('click', async ()=>{
    const token = el('adminToken').value;
    if(!token) return alert('Set admin token to use debug endpoints');
    try{
      const res = await fetch(`${baseUrl()}/api/debug/products`, { headers: { 'X-ADMIN-TOKEN': token } });
      const data = await res.json(); showResp(data);
    }catch(e){ showResp({error:String(e)}) }
  });

  el('btnDebugNonces') && el('btnDebugNonces').addEventListener('click', async ()=>{
    const token = el('adminToken').value;
    if(!token) return alert('Set admin token to use debug endpoints');
    try{
      const res = await fetch(`${baseUrl()}/api/debug/nonces`, { headers: { 'X-ADMIN-TOKEN': token } });
      const data = await res.json(); showResp(data);
    }catch(e){ showResp({error:String(e)}) }
  });

  // GET product by id
  el('btnProductsOne').addEventListener('click', async ()=>{
    const id = el('productId').value || prompt('Enter product id');
    if(!id) return;
    try{
      const res = await fetch(`${baseUrl()}/api/products/${encodeURIComponent(id)}`);
      const data = await res.json();
      showResp(data);
    }catch(e){ showResp({error:String(e)}) }
  });

  // POST orders (protected) - simple sample payload
  el('btnCreateOrder').addEventListener('click', async ()=>{
    const token = getToken();
    if(!token) return alert('No token. Login or register first.');
    const payload = {
      fromChain: 'ETH',
      toChain: 'KASPA',
      fromAmount: '0.01',
      toAmount: '10',
      fromAddress: addressInput.value,
      toAddress: 'kaspa:your_kaspa_addr_here'
    };
    try{
      const res = await fetch(`${baseUrl()}/api/orders`, {
        method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer '+token }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      showResp(data);
    }catch(e){ showResp({error:String(e)}) }
  });

  // initialize token view
  tokenView.textContent = getToken() || '(none)';
  if(window.ethereum){
    window.ethereum.on && window.ethereum.on('accountsChanged', (accounts)=>{
      if(accounts && accounts.length) { addressInput.value = accounts[0]; connectedLabel.textContent='Connected'; }
      else { addressInput.value = ''; connectedLabel.textContent='Not connected'; }
    });
  }

})();
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
