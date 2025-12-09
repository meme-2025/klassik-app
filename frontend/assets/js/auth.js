/**
 * 🔐 Klassik Wallet-Only Authentication
 * Krasse MetaMask Integration mit geilen Animations
 */

const API_URL = window.location.origin;

// State
let currentUser = null;
let connectedWallet = null;

/**
 * 🚀 Initialize
 */
function initAuth() {
  console.log('🔐 Initializing Wallet Auth...');
  
  // Check if already logged in
  const token = localStorage.getItem('klassik_token');
  const userStr = localStorage.getItem('klassik_user');
  
  if (token && userStr) {
    try {
      currentUser = JSON.parse(userStr);
      updateUILoggedIn(currentUser);
      console.log('✅ Auto-logged in:', currentUser.username);
    } catch (e) {
      logout();
    }
  } else {
    updateUILoggedOut();
  }
  
  bindEvents();
}

/**
 * 🎯 Bind all events
 */
function bindEvents() {
  // Login button -> open modal
  document.getElementById('loginBtn')?.addEventListener('click', () => {
    window.AnimationHelpers?.openModal('loginModal');
  });
  
  // Register button -> open modal  
  document.getElementById('registerBtn')?.addEventListener('click', () => {
    window.AnimationHelpers?.openModal('registerModal');
  });
  
  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  
  // Wallet Login Button (in login modal)
  document.getElementById('walletLoginBtn')?.addEventListener('click', handleWalletLogin);
  
  // Email/Password Login Form (fallback)
  document.getElementById('loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    window.AnimationHelpers?.showToast('Please use "Login with Wallet" for secure authentication', 'info');
  });
  
  // Email/Password Register Form (fallback)
  document.getElementById('registerForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    window.AnimationHelpers?.showToast('Please use the Wallet registration flow', 'info');
  });
}

/**
 * 🌟 WALLET LOGIN FLOW
 */
async function handleWalletLogin() {
  const btn = document.getElementById('walletLoginBtn');
  
  try {
    // Check MetaMask
    if (!window.ethereum) {
      window.AnimationHelpers?.showToast('Please install MetaMask to continue', 'error');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }
    
    window.AnimationHelpers?.setLoadingState(btn, true);
    
    // Step 1: Connect Wallet
    console.log('📱 Requesting wallet connection...');
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    connectedWallet = accounts[0];
    
    if (!connectedWallet) {
      throw new Error('No wallet found');
    }
    
    console.log('✅ Wallet connected:', connectedWallet);
    window.AnimationHelpers?.showToast(`Wallet connected: ${connectedWallet.substring(0, 6)}...${connectedWallet.substring(38)}`, 'success');
    
    // Step 2: Check if wallet is registered
    console.log('🔍 Checking if wallet is registered...');
    const checkRes = await fetch(`${API_URL}/api/auth/user?address=${connectedWallet}`);
    
    if (checkRes.ok) {
      // Wallet exists -> Login
      const { user } = await checkRes.json();
      console.log('✅ Wallet found! Username:', user.username);
      
      await performWalletSignIn(connectedWallet, user);
      
    } else {
      // Wallet not registered -> Show registration
      console.log('ℹ️ Wallet not registered, showing registration...');
      window.AnimationHelpers?.closeModal('loginModal');
      showWalletRegistration(connectedWallet);
    }
    
  } catch (error) {
    console.error('❌ Wallet login error:', error);
    window.AnimationHelpers?.showToast(error.message || 'Failed to connect wallet', 'error');
  } finally {
    window.AnimationHelpers?.setLoadingState(btn, false);
  }
}

/**
 * 🔑 Perform Wallet Sign-In (with Nonce)
 */
async function performWalletSignIn(address, user) {
  try {
    // Step 1: Get Nonce
    console.log('🎲 Getting nonce...');
    const nonceRes = await fetch(`${API_URL}/api/auth/nonce?address=${address}`);
    const { nonce, message } = await nonceRes.json();
    
    if (!nonce) throw new Error('Failed to get nonce');
    
    // Step 2: Sign Message
    console.log('✍️ Requesting signature...');
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, address]
    });
    
    console.log('✅ Message signed!');
    
    // Step 3: Verify & Get JWT
    console.log('🔐 Verifying signature...');
    const authRes = await fetch(`${API_URL}/api/auth/signin-with-wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, signature })
    });
    
    if (!authRes.ok) {
      const err = await authRes.json();
      throw new Error(err.error || 'Authentication failed');
    }
    
    const authData = await authRes.json();
    
    // Save to localStorage
    localStorage.setItem('klassik_token', authData.token);
    localStorage.setItem('klassik_user', JSON.stringify(authData.user));
    currentUser = authData.user;
    
    // Update UI
    updateUILoggedIn(currentUser);
    window.AnimationHelpers?.closeModal('loginModal');
    window.AnimationHelpers?.showToast(`🎉 Welcome back, ${currentUser.username}!`, 'success');
    
    console.log('✅ Login successful!');
    
  } catch (error) {
    console.error('❌ Sign-in error:', error);
    window.AnimationHelpers?.showToast(error.message || 'Sign-in failed', 'error');
    throw error;
  }
}

/**
 * 📝 Show Wallet Registration UI
 */
function showWalletRegistration(address) {
  const modal = `
    <div id="walletRegisterModal" class="modal" style="display: flex;">
      <div class="modal-content glass">
        <button class="modal-close" onclick="closeWalletRegister()">&times;</button>
        <h2>🎉 Create Your Account</h2>
        
        <div style="text-align: center; margin: 1.5rem 0;">
          <div style="background: rgba(73, 195, 231, 0.1); padding: 1rem; border-radius: 12px; border: 2px solid rgba(73, 195, 231, 0.3);">
            <small style="display: block; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem;">Connected Wallet</small>
            <div style="font-family: monospace; color: #49C3E7; font-weight: bold; word-break: break-all;">
              ${address.substring(0, 6)}...${address.substring(38)}
            </div>
          </div>
        </div>
        
        <form id="walletRegisterForm" onsubmit="handleWalletRegister(event)">
          <div class="form-group">
            <label>Choose Your Username</label>
            <input type="text" id="walletUsername" placeholder="crypto_king" 
                   pattern="[a-zA-Z0-9_]{3,30}" required
                   style="text-align: center; font-size: 1.1rem; font-weight: 600;">
            <small style="display: block; margin-top: 0.5rem; color: rgba(255,255,255,0.5); font-size: 0.85rem;">
              3-30 characters • Letters, numbers, and underscores only
            </small>
          </div>
          
          <div id="walletRegisterError" class="form-error"></div>
          
          <button type="submit" class="btn-kaspa btn-block" style="margin-top: 1.5rem;">
            <span>🚀 Sign & Create Account</span>
          </button>
        </form>
        
        <div class="modal-footer">
          Already have an account? <a href="#" onclick="closeWalletRegister(); AnimationHelpers.openModal('loginModal')">Login</a>
        </div>
      </div>
    </div>
  `;
  
  // Remove old modal if exists
  document.getElementById('walletRegisterModal')?.remove();
  
  // Add new modal
  document.body.insertAdjacentHTML('beforeend', modal);
}

/**
 * ✅ Handle Wallet Registration
 */
window.handleWalletRegister = async function(e) {
  e.preventDefault();
  
  const username = document.getElementById('walletUsername').value.trim();
  const errorDiv = document.getElementById('walletRegisterError');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  
  if (!username) {
    errorDiv.textContent = 'Please enter a username';
    return;
  }
  
  if (username.length < 3 || username.length > 30) {
    errorDiv.textContent = 'Username must be 3-30 characters';
    return;
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errorDiv.textContent = 'Only letters, numbers, and underscores allowed';
    return;
  }
  
  try {
    window.AnimationHelpers?.setLoadingState(submitBtn, true);
    errorDiv.textContent = '';
    
    // Step 1: Register wallet + username
    console.log('📝 Registering wallet with username...');
    const regRes = await fetch(`${API_URL}/api/auth/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        address: connectedWallet, 
        username: username 
      })
    });
    
    if (!regRes.ok) {
      const err = await regRes.json();
      throw new Error(err.error || 'Registration failed');
    }
    
    const { user } = await regRes.json();
    console.log('✅ Wallet registered!');
    
    // Step 2: Sign in with wallet
    await performWalletSignIn(connectedWallet, user);
    
    // Close registration modal
    document.getElementById('walletRegisterModal')?.remove();
    
  } catch (error) {
    console.error('❌ Registration error:', error);
    errorDiv.textContent = error.message;
  } finally {
    window.AnimationHelpers?.setLoadingState(submitBtn, false);
  }
};

/**
 * 🚪 Close Wallet Register Modal
 */
window.closeWalletRegister = function() {
  document.getElementById('walletRegisterModal')?.remove();
};

/**
 * 🔓 Logout
 */
function logout() {
  localStorage.removeItem('klassik_token');
  localStorage.removeItem('klassik_user');
  currentUser = null;
  connectedWallet = null;
  updateUILoggedOut();
  window.AnimationHelpers?.showToast('Logged out successfully', 'info');
}

/**
 * 🎨 Update UI - Logged In
 */
function updateUILoggedIn(user) {
  document.getElementById('loginBtn').style.display = 'none';
  document.getElementById('registerBtn').style.display = 'none';
  document.getElementById('userMenu').style.display = 'flex';
  document.getElementById('userName').textContent = user.username || 'User';
  
  console.log('✅ UI updated for:', user.username);
}

/**
 * 🎨 Update UI - Logged Out
 */
function updateUILoggedOut() {
  document.getElementById('loginBtn').style.display = 'inline-flex';
  document.getElementById('registerBtn').style.display = 'inline-flex';
  document.getElementById('userMenu').style.display = 'none';
}

/**
 * 📦 Utility Functions
 */
function getAuthToken() {
  return localStorage.getItem('klassik_token');
}

function getCurrentUser() {
  return currentUser;
}

function isAuthenticated() {
  const token = getAuthToken();
  if (!token) return false;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

// 🌍 Export to window
window.initAuth = initAuth;
window.getAuthToken = getAuthToken;
window.getCurrentUser = getCurrentUser;
window.isAuthenticated = isAuthenticated;
window.logout = logout;

// 🚀 Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}
