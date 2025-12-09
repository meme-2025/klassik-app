/**
 * Authentication Module - Futuristic UI Edition
 * Handles Email/Password and Wallet authentication with modern animations
 */

const API_URL = window.location.origin;

// State
let currentUser = null;
const AnimationHelpers = window.AnimationHelpers || {};

/**
 * Initialize auth on page load
 */
function initAuth() {
  // Check if user is already logged in
  const token = localStorage.getItem('klassik_token');
  const userDataStr = localStorage.getItem('klassik_user');
  
  if (token && userDataStr) {
    try {
      const userData = JSON.parse(userDataStr);
      currentUser = userData;
      updateUIForLoggedInUser(userData);
      // Try to refresh profile from backend (get canonical fields)
      fetchProfileMe().catch(() => {});
      console.log('✅ Auto-logged in:', userData.email || userData.address);
    } catch (err) {
      console.error('Failed to parse user data:', err);
      logout();
    }
  } else {
    updateUIForLoggedOutUser();
  }

  // Bind event listeners
  bindAuthEventListeners();
}

/**
 * Bind all auth-related event listeners
 */
function bindAuthEventListeners() {
  // Show/hide modals (using new modal system)
  document.getElementById('loginBtn')?.addEventListener('click', () => AnimationHelpers.openModal && AnimationHelpers.openModal('loginModal'));
  document.getElementById('registerBtn')?.addEventListener('click', () => AnimationHelpers.openModal && AnimationHelpers.openModal('registerModal'));
  
  // Forms
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
  
  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  
  // Wallet connect buttons
  document.querySelectorAll('.wallet-connect-btn').forEach(btn => {
    btn.addEventListener('click', connectWallet);
  });
}

/**
 * Fetch /api/users/me and update local stored user
 */
async function fetchProfileMe() {
  const token = getAuthToken();
  if (!token) return;
  
  try {
    const res = await fetch(`${API_URL}/api/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) return;
    
    const data = await res.json();
    if (data && data.user) {
      currentUser = data.user;
      localStorage.setItem('klassik_user', JSON.stringify(currentUser));
      updateUIForLoggedInUser(currentUser);
    }
  } catch (error) {
    console.error('Failed to fetch profile:', error);
  }
}

/**
 * Handle profile save (update email)
 */
async function handleProfileSave(e) {
  e.preventDefault();
  const email = document.getElementById('profileEmail').value.trim();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  
  if (!email) {
    AnimationHelpers.showToast && AnimationHelpers.showToast('Email required', 'error');
    return;
  }

  AnimationHelpers.setLoadingState && AnimationHelpers.setLoadingState(submitBtn, true);
  
  try {
    const res = await fetch(`${API_URL}/api/users/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ email })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Update failed');
    }

    // Update local storage and UI
    currentUser = data.user;
    localStorage.setItem('klassik_user', JSON.stringify(currentUser));
    updateUIForLoggedInUser(currentUser);
    AnimationHelpers.closeModal && AnimationHelpers.closeModal('profileModal');
    AnimationHelpers.showToast && AnimationHelpers.showToast('Profile updated successfully!', 'success');
    
  } catch (err) {
    console.error('Profile save error', err);
    AnimationHelpers.showToast && AnimationHelpers.showToast(err.message || 'Failed to update profile', 'error');
  } finally {
    AnimationHelpers.setLoadingState && AnimationHelpers.setLoadingState(submitBtn, false);
  }
}

/**
 * Switch between login and register modals
 */
function switchToRegister(e) {
  if (e) e.preventDefault();
  AnimationHelpers.closeModal && AnimationHelpers.closeModal('loginModal');
  AnimationHelpers.openModal && AnimationHelpers.openModal('registerModal');
}

function switchToLogin(e) {
  if (e) e.preventDefault();
  AnimationHelpers.closeModal && AnimationHelpers.closeModal('registerModal');
  AnimationHelpers.openModal && AnimationHelpers.openModal('loginModal');
}

// Expose switch functions globally
window.switchToRegister = switchToRegister;
window.switchToLogin = switchToLogin;

/**
 * Handle login form submission
 */
async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  
  // Validation
  if (!email || !password) {
    AnimationHelpers.showFormError && AnimationHelpers.showFormError('Please fill in all fields', e.target);
    return;
  }
  
  AnimationHelpers.setLoadingState && AnimationHelpers.setLoadingState(submitBtn, true);
  
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }
    
    // Success - save token and user data
    localStorage.setItem('klassik_token', data.token);
    localStorage.setItem('klassik_user', JSON.stringify(data.user));
    currentUser = data.user;
    
    // Update UI
    updateUIForLoggedInUser(data.user);
    AnimationHelpers.closeModal && AnimationHelpers.closeModal('loginModal');
    AnimationHelpers.showToast && AnimationHelpers.showToast('Welcome back! Login successful.', 'success');
    
    // Reset form
    document.getElementById('loginForm').reset();
    
  } catch (error) {
    console.error('Login error:', error);
    AnimationHelpers.showFormError && AnimationHelpers.showFormError(error.message, e.target);
  } finally {
    AnimationHelpers.setLoadingState && AnimationHelpers.setLoadingState(submitBtn, false);
  }
}

/**
 * Handle register form submission
 */
async function handleRegister(e) {
  e.preventDefault();
  
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  
  // Validation
  if (!email || !password || !passwordConfirm) {
    AnimationHelpers.showFormError && AnimationHelpers.showFormError('Please fill in all fields', e.target);
    return;
  }
  
  if (password !== passwordConfirm) {
    AnimationHelpers.showFormError && AnimationHelpers.showFormError('Passwords do not match', e.target);
    return;
  }
  
  if (password.length < 8) {
    AnimationHelpers.showFormError && AnimationHelpers.showFormError('Password must be at least 8 characters', e.target);
    return;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    AnimationHelpers.showFormError && AnimationHelpers.showFormError('Please enter a valid email address', e.target);
    return;
  }
  
  AnimationHelpers.setLoadingState && AnimationHelpers.setLoadingState(submitBtn, true);
  
  try {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    
    // Success - save token and user data
    localStorage.setItem('klassik_token', data.token);
    localStorage.setItem('klassik_user', JSON.stringify(data.user));
    currentUser = data.user;
    
    // Update UI
    updateUIForLoggedInUser(data.user);
    AnimationHelpers.closeModal && AnimationHelpers.closeModal('registerModal');
    AnimationHelpers.showToast && AnimationHelpers.showToast('Account created successfully! Welcome to Klassik.', 'success');
    
    // Reset form
    document.getElementById('registerForm').reset();
    
  } catch (error) {
    console.error('Register error:', error);
    AnimationHelpers.showFormError && AnimationHelpers.showFormError(error.message, e.target);
  } finally {
    AnimationHelpers.setLoadingState && AnimationHelpers.setLoadingState(submitBtn, false);
  }
}

/**
 * Connect wallet (MetaMask)
 */
async function connectWallet() {
  if (!window.ethereum) {
    AnimationHelpers.showToast && AnimationHelpers.showToast('Please install MetaMask to connect your wallet', 'error');
    return;
  }
  
  try {
    // Request account access
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const address = accounts[0];
    
    if (!address) {
      throw new Error('No account found');
    }
    
    console.log('Connected wallet:', address);
    
    // Check if wallet is already registered
    const checkResponse = await fetch(`${API_URL}/api/auth/user?address=${address}`);
    
    if (checkResponse.ok) {
      // Wallet exists, do sign-in flow
      await walletSignIn(address);
    } else {
      // Wallet not registered, show registration prompt
      const email = prompt('Please enter your email to register this wallet:');
      if (!email) {
        AnimationHelpers.showToast && AnimationHelpers.showToast('Registration cancelled', 'info');
        return;
      }
      
      await registerWallet(address, email);
    }
    
  } catch (error) {
    console.error('Wallet connection error:', error);
    AnimationHelpers.showToast && AnimationHelpers.showToast(error.message || 'Failed to connect wallet', 'error');
  }
}

/**
 * Register new wallet
 */
async function registerWallet(address, email) {
  try {
    const response = await fetch(`${API_URL}/api/auth/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, email })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Wallet registration failed');
    }
    
    // Wallet registered, now do sign-in
    await walletSignIn(address);
    
  } catch (error) {
    throw error;
  }
}

/**
 * Wallet sign-in flow (nonce-based)
 */
async function walletSignIn(address) {
  try {
    // Step 1: Get nonce
    const nonceResponse = await fetch(`${API_URL}/api/auth/nonce?address=${address}`);
    const nonceData = await nonceResponse.json();
    
    if (!nonceResponse.ok) {
      throw new Error(nonceData.error || 'Failed to get nonce');
    }
    
    const { message } = nonceData;
    
    // Step 2: Sign message
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, address]
    });
    
    // Step 3: Verify signature and get JWT
    const authResponse = await fetch(`${API_URL}/api/auth/signin-with-wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, signature })
    });
    
    const authData = await authResponse.json();
    
    if (!authResponse.ok) {
      throw new Error(authData.error || 'Authentication failed');
    }
    
    // Success - save token and user data
    localStorage.setItem('klassik_token', authData.token);
    localStorage.setItem('klassik_user', JSON.stringify(authData.user));
    currentUser = authData.user;
    
    // Update UI
    updateUIForLoggedInUser(authData.user);
    AnimationHelpers.showToast && AnimationHelpers.showToast('Wallet connected successfully!', 'success');
    
  } catch (error) {
    throw error;
  }
}

/**
 * Logout
 */
function logout() {
  localStorage.removeItem('klassik_token');
  localStorage.removeItem('klassik_user');
  currentUser = null;
  updateUIForLoggedOutUser();
  AnimationHelpers.showToast && AnimationHelpers.showToast('Logged out successfully', 'info');
}

/**
 * Update UI for logged-in user
 */
function updateUIForLoggedInUser(user) {
  // Update nav actions (hide login/register, show user menu)
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const userMenu = document.getElementById('userMenu');
  
  if (loginBtn) loginBtn.style.display = 'none';
  if (registerBtn) registerBtn.style.display = 'none';
  if (userMenu) userMenu.style.display = 'flex';
  
  // Update user display name
  const userNameEl = document.getElementById('userName');
  if (userNameEl) {
    userNameEl.textContent = user.email || 
      (user.address ? `${user.address.substring(0, 6)}...${user.address.substring(38)}` : 'User');
  }
  
  console.log('✅ UI updated for user:', user.email || user.address);
}

/**
 * Update UI for logged-out user
 */
function updateUIForLoggedOutUser() {
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const userMenu = document.getElementById('userMenu');
  
  if (loginBtn) loginBtn.style.display = 'inline-flex';
  if (registerBtn) registerBtn.style.display = 'inline-flex';
  if (userMenu) userMenu.style.display = 'none';
  
  console.log('ℹ️ User logged out');
}

/**
 * Get current auth token
 */
function getAuthToken() {
  return localStorage.getItem('klassik_token');
}

/**
 * Get current user
 */
function getCurrentUser() {
  return currentUser;
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  const token = getAuthToken();
  if (!token) return false;
  
  try {
    // Basic JWT expiry check
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

// Export functions to window
window.initAuth = initAuth;
window.getAuthToken = getAuthToken;
window.getCurrentUser = getCurrentUser;
window.isAuthenticated = isAuthenticated;
window.showToast = showToast;
window.logout = logout;

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}
