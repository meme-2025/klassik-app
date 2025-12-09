// ============================================
// KLASSIK - WALLET AUTH LOGIC
// ============================================

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8130'
  : `http://${window.location.hostname}:8130`;

let currentAddress = null;
let currentToken = null;

const elements = {
  status: document.getElementById('status'),
  connectBtn: document.getElementById('connectBtn'),
  registerForm: document.getElementById('registerForm'),
  registerBtn: document.getElementById('registerBtn'),
  loginBtn: document.getElementById('loginBtn'),
  userInfo: document.getElementById('userInfo'),
  logoutBtn: document.getElementById('logoutBtn'),
  dashboardBtn: document.getElementById('dashboardBtn'),
  username: document.getElementById('username')
};

function showStatus(message, type = 'info', icon = 'ℹ️') {
  elements.status.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  elements.status.className = `status ${type} show`;
}

function hideAll() {
  elements.connectBtn.style.display = 'none';
  elements.registerForm.classList.remove('show');
  elements.loginBtn.style.display = 'none';
  elements.userInfo.classList.remove('show');
}

async function connectWallet() {
  try {
    if (!window.ethereum) {
      showStatus('MetaMask not installed! Please install MetaMask to continue.', 'error', '❌');
      return;
    }
    
    showStatus('Connecting to MetaMask...', 'info', '🔄');
    elements.connectBtn.disabled = true;
    elements.connectBtn.innerHTML = '<span>Connecting...</span><span class="loading"></span>';
    
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    currentAddress = accounts[0];
    
    showStatus(`Connected: ${currentAddress.substring(0, 6)}...${currentAddress.substring(38)}`, 'success', '✅');
    
    // Check if wallet is registered
    await checkWalletRegistration();
    
  } catch (err) {
    console.error('Connection error:', err);
    showStatus(`Connection failed: ${err.message}`, 'error', '❌');
    elements.connectBtn.disabled = false;
    elements.connectBtn.innerHTML = '<span>🦊</span><span>Connect Wallet</span>';
  }
}

async function checkWalletRegistration() {
  try {
    const response = await fetch(`${API_URL}/api/auth/check?address=${currentAddress}`);
    const data = await response.json();
    
    hideAll();
    
    if (data.registered) {
      showStatus(`Welcome back, ${data.user.username}! Please sign to login.`, 'info', '👋');
      elements.loginBtn.style.display = 'block';
    } else {
      showStatus('Wallet not registered. Please choose a username.', 'info', '🆕');
      elements.registerForm.classList.add('show');
      elements.username.focus();
    }
  } catch (err) {
    console.error('Check error:', err);
    showStatus(`Check failed: ${err.message}`, 'error', '❌');
  }
}

async function getNonce() {
  const response = await fetch(`${API_URL}/api/auth/nonce?address=${currentAddress}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get nonce');
  }
  return await response.json();
}

async function signMessage(message) {
  if (!window.ethers) {
    throw new Error('ethers.js not loaded. Please refresh the page.');
  }
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  return await signer.signMessage(message);
}

async function register() {
  try {
    const username = elements.username.value.trim();
    
    if (!username || username.length < 3) {
      showStatus('Username must be at least 3 characters', 'error', '❌');
      return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      showStatus('Username can only contain letters, numbers and underscore', 'error', '❌');
      return;
    }
    
    elements.registerBtn.disabled = true;
    elements.registerBtn.innerHTML = '<span>Processing...</span><span class="loading"></span>';
    
    // 1. Get nonce
    showStatus('Getting nonce...', 'info', '🔄');
    const nonceData = await getNonce();
    
    // 2. Sign message
    showStatus('Please sign the message in MetaMask...', 'info', '✍️');
    const signature = await signMessage(nonceData.message);
    
    // 3. Register
    showStatus('Creating account...', 'info', '⚙️');
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: currentAddress,
        signature,
        username
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    
    // Success!
    currentToken = data.token;
    showStatus(`Welcome, ${data.user.username}! Registration successful.`, 'success', '🎉');
    displayUserInfo(data.user, data.token);
    
  } catch (err) {
    console.error('Registration error:', err);
    showStatus(err.message, 'error', '❌');
    elements.registerBtn.disabled = false;
    elements.registerBtn.innerHTML = '<span>✍️</span><span>Sign & Register</span>';
  }
}

async function login() {
  try {
    elements.loginBtn.disabled = true;
    elements.loginBtn.innerHTML = '<span>Processing...</span><span class="loading"></span>';
    
    // 1. Get nonce
    showStatus('Getting nonce...', 'info', '🔄');
    const nonceData = await getNonce();
    
    // 2. Sign message
    showStatus('Please sign the message in MetaMask...', 'info', '✍️');
    const signature = await signMessage(nonceData.message);
    
    // 3. Login
    showStatus('Authenticating...', 'info', '🔐');
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: currentAddress,
        signature
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }
    
    // Success!
    currentToken = data.token;
    showStatus(`Welcome back, ${data.user.username}!`, 'success', '✅');
    displayUserInfo(data.user, data.token);
    
  } catch (err) {
    console.error('Login error:', err);
    showStatus(err.message, 'error', '❌');
    elements.loginBtn.disabled = false;
    elements.loginBtn.innerHTML = '<span>✨</span><span>Sign & Login</span>';
  }
}

function displayUserInfo(user, token) {
  hideAll();
  elements.userInfo.classList.add('show');
  
  document.getElementById('infoUsername').textContent = user.username;
  document.getElementById('infoAddress').textContent = user.address;
  document.getElementById('infoUserId').textContent = user.id;
  document.getElementById('infoToken').textContent = token.substring(0, 60) + '...';
  
  // Save to localStorage
  localStorage.setItem('klassik_token', token);
  localStorage.setItem('klassik_user', JSON.stringify(user));
}

function logout() {
  currentAddress = null;
  currentToken = null;
  localStorage.removeItem('klassik_token');
  localStorage.removeItem('klassik_user');
  
  hideAll();
  elements.connectBtn.style.display = 'flex';
  elements.connectBtn.disabled = false;
  elements.connectBtn.innerHTML = '<span>🦊</span><span>Connect Wallet</span>';
  showStatus('Logged out successfully', 'info', '👋');
}

// Event Listeners
elements.connectBtn.addEventListener('click', connectWallet);
elements.registerBtn.addEventListener('click', register);
elements.loginBtn.addEventListener('click', login);
elements.logoutBtn.addEventListener('click', logout);

if (elements.dashboardBtn) {
  elements.dashboardBtn.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
  });
}

// Enter key in username field
elements.username.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    register();
  }
});

// Auto-login if token exists
window.addEventListener('load', () => {
  const savedToken = localStorage.getItem('klassik_token');
  const savedUser = localStorage.getItem('klassik_user');
  
  if (savedToken && savedUser) {
    try {
      currentToken = savedToken;
      const user = JSON.parse(savedUser);
      displayUserInfo(user, savedToken);
      showStatus(`Welcome back, ${user.username}!`, 'success', '✅');
    } catch (err) {
      console.error('Auto-login error:', err);
      localStorage.clear();
    }
  }
});
