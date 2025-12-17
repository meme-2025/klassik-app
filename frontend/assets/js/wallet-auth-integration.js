/**
 * 🔐 KLASSIK WALLET AUTH - Integriert für index-v0.1.html
 * Vollständige Login-Funktion mit JWT Token Management
 */

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8130'
  : 'https://klassik.99pace.space';

let currentWalletAddress = null;
let currentJWTToken = null;
let currentUser = null;

// ========================================
// 🎯 HAUPTFUNKTIONEN
// ========================================

/**
 * Wallet verbinden (MetaMask)
 */
async function connectWallet() {
  try {
    // 1. MetaMask Check
    if (!window.ethereum) {
      showToast('❌ MetaMask nicht installiert! Bitte installieren Sie MetaMask.', 'error');
      window.open('https://metamask.io/download/', '_blank');
      return null;
    }

    showToast('🔄 Verbinde mit MetaMask...', 'info');

    // 2. Wallet verbinden
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    currentWalletAddress = accounts[0].toLowerCase();

    showToast(`✅ Wallet verbunden: ${formatAddress(currentWalletAddress)}`, 'success');
    console.log('✅ Wallet connected:', currentWalletAddress);

    return currentWalletAddress;

  } catch (error) {
    console.error('❌ Wallet connection error:', error);
    showToast('❌ Wallet-Verbindung fehlgeschlagen: ' + error.message, 'error');
    return null;
  }
}

/**
 * Prüfen ob Wallet registriert ist
 */
async function checkWalletRegistration(address) {
  try {
    const response = await fetch(`${API_URL}/api/auth/check?address=${address}`);
    const data = await response.json();
    
    console.log('📝 Registration check:', data);
    return data;

  } catch (error) {
    console.error('❌ Check error:', error);
    throw error;
  }
}

/**
 * Nonce vom Server holen
 */
async function getNonce(address) {
  try {
    const response = await fetch(`${API_URL}/api/auth/nonce?address=${address}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Nonce konnte nicht abgerufen werden');
    }
    
    const data = await response.json();
    console.log('🎲 Nonce erhalten:', data.nonce);
    
    return data;

  } catch (error) {
    console.error('❌ Nonce error:', error);
    throw error;
  }
}

/**
 * Message mit MetaMask signieren
 */
async function signMessage(message, address) {
  try {
    if (!window.ethereum) {
      throw new Error('MetaMask nicht verfügbar');
    }

    console.log('✍️ Signing message...');
    showToast('✍️ Bitte signieren Sie die Nachricht in MetaMask...', 'info');

    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, address]
    });

    console.log('✅ Message signed!');
    return signature;

  } catch (error) {
    console.error('❌ Signing error:', error);
    if (error.code === 4001) {
      throw new Error('Signierung abgebrochen');
    }
    throw error;
  }
}

/**
 * User registrieren
 */
async function registerUser(address, signature, username) {
  try {
    showToast('⚙️ Account wird erstellt...', 'info');

    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: address,
        signature: signature,
        username: username
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registrierung fehlgeschlagen');
    }

    console.log('✅ Registration successful:', data);
    return data;

  } catch (error) {
    console.error('❌ Registration error:', error);
    throw error;
  }
}

/**
 * User einloggen
 */
async function loginUser(address, signature) {
  try {
    showToast('🔐 Authentifizierung läuft...', 'info');

    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: address,
        signature: signature
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login fehlgeschlagen');
    }

    console.log('✅ Login successful:', data);
    return data;

  } catch (error) {
    console.error('❌ Login error:', error);
    throw error;
  }
}

/**
 * JWT Token und User Daten speichern
 */
function saveAuthData(token, user) {
  currentJWTToken = token;
  currentUser = user;

  // In localStorage speichern (für persistenten Login)
  localStorage.setItem('klassik_token', token);
  localStorage.setItem('klassik_user', JSON.stringify(user));

  console.log('💾 Auth data saved:', {
    token: token.substring(0, 20) + '...',
    user: user
  });
}

/**
 * Logout - Alle Daten löschen
 */
function logout() {
  currentWalletAddress = null;
  currentJWTToken = null;
  currentUser = null;

  localStorage.removeItem('klassik_token');
  localStorage.removeItem('klassik_user');

  console.log('🚪 Logged out');
  showToast('👋 Erfolgreich ausgeloggt', 'info');

  // UI zurücksetzen
  updateUILoggedOut();
}

/**
 * Prüfen ob eingeloggt
 */
function isAuthenticated() {
  const token = localStorage.getItem('klassik_token');
  
  if (!token) return false;

  try {
    // Token Payload dekodieren
    const payload = JSON.parse(atob(token.split('.')[1]));
    
    // Prüfen ob abgelaufen
    const expiryTime = payload.exp * 1000;
    const isExpired = Date.now() >= expiryTime;

    if (isExpired) {
      console.warn('⚠️ Token expired');
      logout();
      return false;
    }

    return true;

  } catch (error) {
    console.error('❌ Token validation error:', error);
    return false;
  }
}

/**
 * API Call mit JWT Token
 */
async function authenticatedFetch(url, options = {}) {
  const token = localStorage.getItem('klassik_token');

  if (!token) {
    throw new Error('Nicht eingeloggt - Token fehlt');
  }

  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // Token abgelaufen oder ungültig
    logout();
    throw new Error('Session abgelaufen - Bitte neu einloggen');
  }

  return response;
}

// ========================================
// 🎨 UI FUNKTIONEN
// ========================================

/**
 * UI Update: Eingeloggt
 */
function updateUILoggedIn(user) {
  // Desktop Buttons
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const userMenu = document.getElementById('userMenu');
  const userName = document.getElementById('userName');

  if (loginBtn) loginBtn.style.display = 'none';
  if (registerBtn) registerBtn.style.display = 'none';
  if (userMenu) userMenu.style.display = 'flex';
  if (userName) userName.textContent = user.username || 'User';

  // Mobile Buttons
  const mobileLoginBtn = document.getElementById('mobileLoginBtn');
  const mobileProfileWrapper = document.getElementById('mobileProfileWrapper');
  const profileHoverName = document.getElementById('profileHoverName');
  const profileHoverWallet = document.getElementById('profileHoverWallet');

  if (mobileLoginBtn) mobileLoginBtn.style.display = 'none';
  if (mobileProfileWrapper) mobileProfileWrapper.style.display = 'flex';
  if (profileHoverName) profileHoverName.textContent = user.username || 'User';
  if (profileHoverWallet) profileHoverWallet.textContent = formatAddress(user.address);

  console.log('✅ UI updated for logged in user:', user.username);
}

/**
 * UI Update: Ausgeloggt
 */
function updateUILoggedOut() {
  // Desktop Buttons
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const userMenu = document.getElementById('userMenu');

  if (loginBtn) loginBtn.style.display = 'inline-flex';
  if (registerBtn) registerBtn.style.display = 'inline-flex';
  if (userMenu) userMenu.style.display = 'none';

  // Mobile Buttons
  const mobileLoginBtn = document.getElementById('mobileLoginBtn');
  const mobileProfileWrapper = document.getElementById('mobileProfileWrapper');

  if (mobileLoginBtn) mobileLoginBtn.style.display = 'flex';
  if (mobileProfileWrapper) mobileProfileWrapper.style.display = 'none';

  console.log('✅ UI updated for logged out state');
}

/**
 * Toast Notification anzeigen
 */
function showToast(message, type = 'info') {
  if (window.AnimationHelpers && window.AnimationHelpers.showToast) {
    window.AnimationHelpers.showToast(message, type);
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
    alert(message);
  }
}

/**
 * Wallet Adresse formatieren
 */
function formatAddress(address) {
  if (!address) return 'Not connected';
  return `${address.substring(0, 6)}...${address.substring(38)}`;
}

// ========================================
// 🚀 WALLET LOGIN FLOW (KOMPLETT)
// ========================================

/**
 * HAUPT-LOGIN-FUNKTION
 * Diese wird vom Login-Button aufgerufen
 */
async function handleWalletLogin() {
  try {
    // 1. Wallet verbinden
    const address = await connectWallet();
    if (!address) return;

    // 2. Registrierung prüfen
    const checkResult = await checkWalletRegistration(address);

    if (checkResult.registered) {
      // === EXISTING USER: LOGIN ===
      await performLogin(address, checkResult.user);
    } else {
      // === NEW USER: REGISTRIERUNG ===
      await performRegistration(address);
    }

  } catch (error) {
    console.error('❌ Wallet login error:', error);
    showToast('❌ ' + error.message, 'error');
  }
}

/**
 * Login für existierenden User
 */
async function performLogin(address, user) {
  try {
    showToast(`👋 Willkommen zurück, ${user.username}!`, 'info');

    // 1. Nonce holen
    const nonceData = await getNonce(address);

    // 2. Message signieren
    const signature = await signMessage(nonceData.message, address);

    // 3. Login Request
    const loginData = await loginUser(address, signature);

    // 4. Token & User speichern
    saveAuthData(loginData.token, loginData.user);

    // 5. UI updaten
    updateUILoggedIn(loginData.user);

    // 6. Modal schließen
    closeLoginModal();

    showToast(`🎉 Erfolgreich eingeloggt als ${loginData.user.username}!`, 'success');

  } catch (error) {
    console.error('❌ Login flow error:', error);
    throw error;
  }
}

/**
 * Registrierung für neuen User
 */
async function performRegistration(address) {
  try {
    // Username Modal anzeigen
    const username = await promptUsername();
    
    if (!username) {
      showToast('❌ Registrierung abgebrochen', 'error');
      return;
    }

    // 1. Nonce holen
    const nonceData = await getNonce(address);

    // 2. Message signieren
    const signature = await signMessage(nonceData.message, address);

    // 3. Registrierung
    const regData = await registerUser(address, signature, username);

    // 4. Token & User speichern
    saveAuthData(regData.token, regData.user);

    // 5. UI updaten
    updateUILoggedIn(regData.user);

    // 6. Modal schließen
    closeLoginModal();

    showToast(`🎉 Willkommen, ${regData.user.username}! Account erfolgreich erstellt.`, 'success');

  } catch (error) {
    console.error('❌ Registration flow error:', error);
    throw error;
  }
}

/**
 * Username Prompt (Simple Version - kann verschönert werden)
 */
async function promptUsername() {
  // TODO: Schönes Modal erstellen
  const username = prompt('Wählen Sie einen Benutzernamen (3-30 Zeichen, nur Buchstaben, Zahlen, Unterstrich):');
  
  if (!username) return null;
  
  // Validierung
  if (username.length < 3 || username.length > 30) {
    showToast('❌ Username muss 3-30 Zeichen lang sein', 'error');
    return await promptUsername(); // Nochmal versuchen
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    showToast('❌ Nur Buchstaben, Zahlen und Unterstrich erlaubt', 'error');
    return await promptUsername();
  }
  
  return username.trim();
}

/**
 * Login Modal schließen
 */
function closeLoginModal() {
  if (window.AnimationHelpers && window.AnimationHelpers.closeModal) {
    window.AnimationHelpers.closeModal('loginModal');
  }
  const modal = document.getElementById('loginModal');
  if (modal) modal.style.display = 'none';
}

// ========================================
// 🎯 AUTO-INIT & EVENT BINDING
// ========================================

/**
 * Initialisierung beim Laden
 */
function initWalletAuth() {
  console.log('🔐 Initializing Wallet Auth for index-v0.1.html...');

  // Auto-Login wenn Token vorhanden
  checkAutoLogin();

  // Event Listeners binden
  bindEventListeners();

  console.log('✅ Wallet Auth initialized');
}

/**
 * Auto-Login Check
 */
function checkAutoLogin() {
  const token = localStorage.getItem('klassik_token');
  const userStr = localStorage.getItem('klassik_user');

  if (token && userStr && isAuthenticated()) {
    try {
      const user = JSON.parse(userStr);
      currentUser = user;
      currentJWTToken = token;
      
      updateUILoggedIn(user);
      showToast(`👋 Willkommen zurück, ${user.username}!`, 'success');
      
      console.log('✅ Auto-login successful');
    } catch (error) {
      console.error('❌ Auto-login error:', error);
      logout();
    }
  }
}

/**
 * Event Listeners
 */
function bindEventListeners() {
  // Desktop Login Button
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      // Öffne Modal mit Wallet Login Option
      if (window.AnimationHelpers && window.AnimationHelpers.openModal) {
        window.AnimationHelpers.openModal('loginModal');
      }
    });
  }

  // Wallet Login Button (im Modal)
  const walletLoginBtn = document.getElementById('walletLoginBtn');
  if (walletLoginBtn) {
    walletLoginBtn.addEventListener('click', handleWalletLogin);
  }

  // Mobile Login Button
  const mobileLoginBtn = document.getElementById('mobileLoginBtn');
  if (mobileLoginBtn) {
    mobileLoginBtn.addEventListener('click', () => {
      if (window.AnimationHelpers && window.AnimationHelpers.openModal) {
        window.AnimationHelpers.openModal('loginModal');
      }
    });
  }

  // Mobile Profile Button (öffnet Dashboard)
  const mobileProfileBtn = document.getElementById('mobileProfileBtn');
  if (mobileProfileBtn) {
    mobileProfileBtn.addEventListener('click', () => {
      if (!isAuthenticated()) {
        showToast('❌ Bitte erst einloggen', 'error');
        return;
      }
      window.location.href = 'dashboard.html';
    });
  }

  // Logout Buttons
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  console.log('✅ Event listeners bound');
}

// ========================================
// 🌍 GLOBAL EXPORTS
// ========================================

// Für andere Scripts verfügbar machen
window.WalletAuth = {
  connectWallet,
  handleWalletLogin,
  logout,
  isAuthenticated,
  authenticatedFetch,
  getCurrentUser: () => currentUser,
  getToken: () => currentJWTToken
};

// Auto-Init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWalletAuth);
} else {
  initWalletAuth();
}
