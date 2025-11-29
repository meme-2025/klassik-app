/**
 * Authentication Module
 * Handles Email/Password and Wallet authentication
 */

const API_URL = window.location.origin;

// State
let currentUser = null;

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
  // Show/hide modals
  document.getElementById('showLoginBtn')?.addEventListener('click', () => showModal('loginModal'));
  document.getElementById('showRegisterBtn')?.addEventListener('click', () => showModal('registerModal'));
  
  // Close modals
  document.getElementById('closeLoginModal')?.addEventListener('click', () => hideModal('loginModal'));
  document.getElementById('closeRegisterModal')?.addEventListener('click', () => hideModal('registerModal'));
  
  // Switch between modals
  document.getElementById('switchToRegister')?.addEventListener('click', (e) => {
    e.preventDefault();
    hideModal('loginModal');
    showModal('registerModal');
  });
  
  document.getElementById('switchToLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    hideModal('registerModal');
    showModal('loginModal');
  });
  
  // Forms
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
  
  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  
  // Wallet connect
  document.getElementById('connectWalletBtn')?.addEventListener('click', connectWallet);

  // Profile edit
  document.getElementById('editProfileBtn')?.addEventListener('click', () => showModal('profileModal'));
  document.getElementById('closeProfileModal')?.addEventListener('click', () => hideModal('profileModal'));
  document.getElementById('profileForm')?.addEventListener('submit', handleProfileSave);
}

/**
 * Fetch /api/users/me and update local stored user
 */
async function fetchProfileMe() {
  const token = getAuthToken();
  if (!token) return;
  const res = await fetch(`${API_URL}/api/users/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return;
  const data = await res.json();
  if (data && data.user) {
    currentUser = data.user;
    localStorage.setItem('klassik_user', JSON.stringify(currentUser));
    updateUIForLoggedInUser(currentUser);
    // prefill profile modal
    const pe = document.getElementById('profileEmail'); if (pe) pe.value = currentUser.email || '';
  }
}

/**
 * Handle profile save (update email)
 */
async function handleProfileSave(e) {
  e.preventDefault();
  const email = document.getElementById('profileEmail').value.trim();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (!email) return showModalError('profileModal', 'Email required');

  submitBtn.disabled = true; submitBtn.innerHTML = 'Speichern... <span class="spinner"></span>';
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
    if (!res.ok) throw new Error(data.error || 'Update failed');

    // update local storage and UI
    currentUser = data.user;
    localStorage.setItem('klassik_user', JSON.stringify(currentUser));
    updateUIForLoggedInUser(currentUser);
    hideModal('profileModal');
    showToast('Profil aktualisiert', 'success');
  } catch (err) {
    console.error('Profile save error', err);
    showModalError('profileModal', err.message || 'Speicherfehler');
  } finally {
    submitBtn.disabled = false; submitBtn.textContent = 'Speichern';
  }
}

/**
 * Show modal
 */
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
    
    // Clear any previous errors
    const errorEl = modal.querySelector('.error-message');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('show');
    }
  }
}

/**
 * Hide modal
 */
function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

/**
 * Show error in modal
 */
function showModalError(modalId, message) {
  const modal = document.getElementById(modalId);
  const errorEl = modal?.querySelector('.error-message');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add('show');
  }
}

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
    showModalError('loginModal', 'Please fill in all fields');
    return;
  }
  
  // Disable button and show loading
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Logging in... <span class="spinner"></span>';
  
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
    hideModal('loginModal');
    showToast('Login successful! Welcome back.', 'success');
    
    // Reset form
    document.getElementById('loginForm').reset();
    
  } catch (error) {
    console.error('Login error:', error);
    showModalError('loginModal', error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Login';
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
    showModalError('registerModal', 'Please fill in all fields');
    return;
  }
  
  if (password !== passwordConfirm) {
    showModalError('registerModal', 'Passwords do not match');
    return;
  }
  
  if (password.length < 8) {
    showModalError('registerModal', 'Password must be at least 8 characters');
    return;
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showModalError('registerModal', 'Please enter a valid email address');
    return;
  }
  
  // Disable button and show loading
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Creating account... <span class="spinner"></span>';
  
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
    hideModal('registerModal');
    showToast('Account created successfully! Welcome to Klassik.', 'success');
    
    // Reset form
    document.getElementById('registerForm').reset();
    
  } catch (error) {
    console.error('Register error:', error);
    showModalError('registerModal', error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Account';
  }
}

/**
 * Connect wallet (MetaMask)
 */
async function connectWallet() {
  if (!window.ethereum) {
    showToast('Please install MetaMask to connect your wallet', 'error');
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
        showToast('Registration cancelled', 'info');
        return;
      }
      
      await registerWallet(address, email);
    }
    
  } catch (error) {
    console.error('Wallet connection error:', error);
    showToast(error.message || 'Failed to connect wallet', 'error');
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
    showToast('Wallet connected successfully!', 'success');
    
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
  showToast('Logged out successfully', 'info');
}

/**
 * Update UI for logged-in user
 */
function updateUIForLoggedInUser(user) {
  // Show/hide elements
  document.getElementById('notLoggedIn').style.display = 'none';
  document.getElementById('loggedIn').style.display = 'flex';
  
  // Update user info
  const emailEl = document.getElementById('userEmail');
  const addressEl = document.getElementById('userAddress');
  
  if (emailEl) {
    emailEl.textContent = user.email || 'No email';
  }
  
  if (addressEl && user.address) {
    addressEl.textContent = `${user.address.substring(0, 6)}...${user.address.substring(38)}`;
    addressEl.title = user.address;
  } else if (addressEl) {
    addressEl.textContent = '';
  }
  
  console.log('✅ UI updated for user:', user);
}

/**
 * Update UI for logged-out user
 */
function updateUIForLoggedOutUser() {
  document.getElementById('notLoggedIn').style.display = 'flex';
  document.getElementById('loggedIn').style.display = 'none';
  console.log('ℹ️ User logged out');
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  // Remove existing toast if any
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // Create new toast
  const toast = document.createElement('div');
  toast.className = `toast ${type} show`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
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
