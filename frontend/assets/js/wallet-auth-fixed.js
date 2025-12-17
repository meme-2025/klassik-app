// ============================================
// KLASSIK - WALLET AUTH LOGIC
// ============================================

// CSP-compliant API URL configuration
// Use HTTPS without port for production (nginx proxy)
// Use localhost with port for local development
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8130'
  : 'https://klassik.99pace.space'; // HTTPS only, no port (nginx handles routing)

let currentAddress = null;
let currentToken = null;

// Elements für login-main.html
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

// Elements für index-v0.1.html
const indexElements = {
  loginBtn: document.getElementById('loginBtn'),
  registerBtn: document.getElementById('registerBtn'),
  userMenu: document.getElementById('userMenu'),
  userName: document.getElementById('userName'),
  logoutBtn: document.getElementById('logoutBtn'),
  walletLoginBtn: document.getElementById('walletLoginBtn'),
  walletRegisterBtn: document.getElementById('walletRegisterBtn'),
  mobileLoginBtn: document.getElementById('mobileLoginBtn'),
  mobileProfileWrapper: document.getElementById('mobileProfileWrapper'),
  mobileProfileBtn: document.getElementById('mobileProfileBtn'),
  profileHoverName: document.getElementById('profileHoverName'),
  profileHoverWallet: document.getElementById('profileHoverWallet')
};

// Prüfen ob wir auf index-v0.1.html sind
const isIndexPage = !document.getElementById('connectBtn');

function showStatus(message, type = 'info', icon = 'ℹ️') {
  if (elements.status) {
    elements.status.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    elements.status.className = `status ${type} show`;
  } else {
    // Für index-v0.1.html: Toast nutzen
    if (window.AnimationHelpers && window.AnimationHelpers.showToast) {
      window.AnimationHelpers.showToast(message, type);
    } else {
      console.log(`[${type}] ${message}`);
    }
  }
}

function hideAll() {
  if (elements.connectBtn) elements.connectBtn.style.display = 'none';
  if (elements.registerForm) elements.registerForm.classList.remove('show');
  if (elements.loginBtn) elements.loginBtn.style.display = 'none';
  if (elements.userInfo) elements.userInfo.classList.remove('show');
}

async function connectWallet() {
  try {
    // Enhanced MetaMask detection with retry logic
    let retries = 0;
    const maxRetries = 3;
    
    while (!window.ethereum && retries < maxRetries) {
      console.log(`🔍 Checking for MetaMask... Attempt ${retries + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, 500));
      retries++;
    }
    
    if (!window.ethereum) {
      const message = '🦊 MetaMask nicht gefunden!\n\n' +
                     'Bitte stelle sicher, dass:\n' +
                     '• MetaMask Extension installiert ist\n' +
                     '• Der Browser neu geladen wurde (Strg+Shift+R)\n' +
                     '• MetaMask aktiviert ist\n\n' +
                     'Download: https://metamask.io/download/';
      
      console.error('❌ MetaMask not detected after', maxRetries, 'attempts');
      console.log('window.ethereum:', window.ethereum);
      console.log('Provider check:', typeof window.ethereum);
      
      if (isIndexPage) {
        // Zeige Fehler im Modal statt Alert
        const walletBtn = document.getElementById('walletLoginBtn') || document.getElementById('walletRegisterBtn');
        if (walletBtn) {
          const originalText = walletBtn.innerHTML;
          walletBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>MetaMask nicht gefunden!</span>';
          walletBtn.style.background = 'linear-gradient(135deg, #ff4d4d, #cc0000)';
          
          setTimeout(() => {
            walletBtn.innerHTML = originalText;
            walletBtn.style.background = '';
          }, 3000);
        }
        alert(message);
      } else {
        showStatus('MetaMask not installed! Please install MetaMask to continue.', 'error', '❌');
      }
      return;
    }
    
    console.log('✅ MetaMask detected!');
    
    showStatus('Connecting to MetaMask...', 'info', '🔄');
    
    // Disable button nur auf login-main.html
    if (elements.connectBtn) {
      elements.connectBtn.disabled = true;
      elements.connectBtn.innerHTML = '<span>Connecting...</span><span class="loading"></span>';
    }
    
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    currentAddress = accounts[0];
    
    showStatus(`Connected: ${currentAddress.substring(0, 6)}...${currentAddress.substring(38)}`, 'success', '✅');
    
    // Check if wallet is registered
    await checkWalletRegistration();
    
  } catch (err) {
    console.error('Connection error:', err);
    showStatus(`Connection failed: ${err.message}`, 'error', '❌');
    
    // Reset button nur auf login-main.html
    if (elements.connectBtn) {
      elements.connectBtn.disabled = false;
      elements.connectBtn.innerHTML = '<span>🦊</span><span>Connect Wallet</span>';
    }
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
  
  if (elements.userInfo) {
    // Für login-main.html
    elements.userInfo.classList.add('show');
    document.getElementById('infoUsername').textContent = user.username;
    document.getElementById('infoAddress').textContent = user.address;
    document.getElementById('infoUserId').textContent = user.id;
    document.getElementById('infoToken').textContent = token.substring(0, 60) + '...';
  }
  
  if (isIndexPage) {
    // Für index-v0.1.html - Desktop
    if (indexElements.loginBtn) indexElements.loginBtn.style.display = 'none';
    if (indexElements.registerBtn) indexElements.registerBtn.style.display = 'none';
    if (indexElements.userMenu) indexElements.userMenu.style.display = 'flex';
    if (indexElements.userName) indexElements.userName.textContent = user.username;
    
    // Für index-v0.1.html - Mobile
    if (indexElements.mobileLoginBtn) indexElements.mobileLoginBtn.style.display = 'none';
    if (indexElements.mobileProfileWrapper) indexElements.mobileProfileWrapper.style.display = 'flex';
    if (indexElements.profileHoverName) indexElements.profileHoverName.textContent = user.username;
    if (indexElements.profileHoverWallet) {
      const addr = user.address;
      indexElements.profileHoverWallet.textContent = `${addr.substring(0, 6)}...${addr.substring(38)}`;
    }
    
    // Login Modal schließen
    if (window.AnimationHelpers && window.AnimationHelpers.closeModal) {
      window.AnimationHelpers.closeModal('loginModal');
    }
  }
  
  // Save to localStorage
  localStorage.setItem('klassik_token', token);
  localStorage.setItem('klassik_user', JSON.stringify(user));
}

function logout() {
  currentAddress = null;
  currentToken = null;
  localStorage.removeItem('klassik_token');
  localStorage.removeItem('klassik_user');
  
  if (elements.connectBtn) {
    // login-main.html
    hideAll();
    elements.connectBtn.style.display = 'flex';
    elements.connectBtn.disabled = false;
    elements.connectBtn.innerHTML = '<span>🦊</span><span>Connect Wallet</span>';
    showStatus('Logged out successfully', 'info', '👋');
  }
  
  if (isIndexPage) {
    // index-v0.1.html - Desktop
    if (indexElements.loginBtn) indexElements.loginBtn.style.display = 'inline-flex';
    if (indexElements.registerBtn) indexElements.registerBtn.style.display = 'inline-flex';
    if (indexElements.userMenu) indexElements.userMenu.style.display = 'none';
    
    // index-v0.1.html - Mobile
    if (indexElements.mobileLoginBtn) indexElements.mobileLoginBtn.style.display = 'flex';
    if (indexElements.mobileProfileWrapper) indexElements.mobileProfileWrapper.style.display = 'none';
    
    showStatus('Erfolgreich ausgeloggt', 'info', '👋');
  }
}

// Event Listeners
if (elements.connectBtn) elements.connectBtn.addEventListener('click', connectWallet);
if (elements.registerBtn) elements.registerBtn.addEventListener('click', register);

// loginBtn hat unterschiedliche Funktionen je nach Seite
if (elements.loginBtn && !isIndexPage) {
  // Auf login-main.html → direkt login()
  elements.loginBtn.addEventListener('click', login);
}

if (elements.logoutBtn && !isIndexPage) {
  // Auf login-main.html
  elements.logoutBtn.addEventListener('click', logout);
}

if (elements.dashboardBtn) {
  elements.dashboardBtn.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
  });
}

// Enter key in username field
if (elements.username) {
  elements.username.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      register();
    }
  });
}

// Event Listeners für index-v0.1.html
if (isIndexPage) {
  console.log('🔧 Binding events for index-v0.1.html...');
  
  // Desktop Login Button → öffnet Modal
  if (indexElements.loginBtn) {
    indexElements.loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🖱️ Desktop Login clicked - opening modal');
      if (window.AnimationHelpers && window.AnimationHelpers.openModal) {
        window.AnimationHelpers.openModal('loginModal');
      } else {
        const modal = document.getElementById('loginModal');
        if (modal) modal.style.display = 'flex';
      }
    });
  }
  
  // Desktop Register Button → öffnet Modal
  if (indexElements.registerBtn) {
    indexElements.registerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🖱️ Desktop Register clicked - opening modal');
      if (window.AnimationHelpers && window.AnimationHelpers.openModal) {
        window.AnimationHelpers.openModal('registerModal');
      } else {
        const modal = document.getElementById('registerModal');
        if (modal) modal.style.display = 'flex';
      }
    });
  }
  
  // Wallet Login Button (im Modal) → startet Wallet-Connect
  if (indexElements.walletLoginBtn) {
    indexElements.walletLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🦊 Wallet Login clicked - connecting wallet');
      connectWallet();
    });
  }
  
  // Wallet Register Button (im Modal) → startet Wallet-Connect
  if (indexElements.walletRegisterBtn) {
    indexElements.walletRegisterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🦊 Wallet Register clicked - connecting wallet');
      connectWallet();
    });
  }
  
  // Mobile Login Button → öffnet Modal
  if (indexElements.mobileLoginBtn) {
    indexElements.mobileLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('📱 Mobile Login clicked - opening modal');
      if (window.AnimationHelpers && window.AnimationHelpers.openModal) {
        window.AnimationHelpers.openModal('loginModal');
      } else {
        const modal = document.getElementById('loginModal');
        if (modal) modal.style.display = 'flex';
      }
    });
  }
  
  // Mobile Profile Button → öffnet Dashboard
  if (indexElements.mobileProfileBtn) {
    indexElements.mobileProfileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('👤 Profile clicked - opening dashboard');
      window.location.href = 'dashboard.html';
    });
  }
  
  // Desktop/Mobile Logout
  if (indexElements.logoutBtn) {
    indexElements.logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🚪 Logout clicked');
      logout();
    });
  }
  
  console.log('✅ Events bound for index-v0.1.html');
}

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
