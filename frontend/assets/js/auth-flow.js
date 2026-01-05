/**
 * ============================================
 * KLASSIK AUTH FLOW - WORLD CUP LEVEL UX
 * ============================================
 * 
 * Perfect user experience from wallet connection to registration
 */

const API_URL = window.location.origin;
const SACRIFICE_ADDRESS = 'kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc';

let currentStep = 1;
let walletAddress = null;
let kaspaAddress = null;
let sacrificeData = null;

// ============================================
// STEP MANAGEMENT
// ============================================

function setStep(step) {
    currentStep = step;
    
    // Update step indicator
    for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById(`step-${i}`);
        stepEl.classList.remove('active', 'completed');
        
        if (i < step) {
            stepEl.classList.add('completed');
        } else if (i === step) {
            stepEl.classList.add('active');
        }
    }
    
    // Update progress bar
    const progress = (step / 4) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    
    // Show correct section
    document.querySelectorAll('.form-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`section-${getSectionName(step)}`).classList.add('active');
}

function getSectionName(step) {
    const sections = ['connect', 'sacrifice', 'register', 'success'];
    return sections[step - 1];
}

// ============================================
// ALERTS
// ============================================

function showAlert(message, type = 'info') {
    const container = document.getElementById('alert-container');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} show`;
    alert.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        ${message}
    `;
    container.innerHTML = '';
    container.appendChild(alert);
    
    if (type === 'success') {
        setTimeout(() => alert.classList.remove('show'), 5000);
    }
}

// ============================================
// STEP 1: CONNECT WALLET
// ============================================

document.getElementById('connect-wallet-btn').addEventListener('click', async () => {
    const btn = document.getElementById('connect-wallet-btn');
    
    try {
        // Check MetaMask
        if (!window.ethereum) {
            showAlert('Please install MetaMask to continue!', 'error');
            window.open('https://metamask.io/download/', '_blank');
            return;
        }
        
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span> Connecting...';
        
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        walletAddress = accounts[0];
        
        showAlert(`Connected: ${walletAddress.substring(0, 10)}...`, 'success');
        
        // Check if user exists
        const response = await fetch(`${API_URL}/api/auth/check?address=${walletAddress}`);
        const data = await response.json();
        
        if (data.registered) {
            // User exists - proceed to login
            showAlert(`Welcome back, ${data.user.username}! Logging you in...`, 'success');
            await loginUser(walletAddress, data.user);
        } else {
            // New user - proceed to sacrifice check
            showAlert('New user detected. Checking sacrifice status...', 'info');
            setStep(2);
            await checkSacrifice();
        }
        
    } catch (error) {
        console.error('Wallet connection error:', error);
        showAlert(error.message || 'Failed to connect wallet', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-wallet"></i> Connect MetaMask';
    }
});

// ============================================
// LOGIN EXISTING USER
// ============================================

async function loginUser(address, user) {
    try {
        // Get nonce
        const nonceRes = await fetch(`${API_URL}/api/auth/nonce?address=${address}`);
        const { nonce, message } = await nonceRes.json();
        
        // Sign message
        const signature = await window.ethereum.request({
            method: 'personal_sign',
            params: [message, address]
        });
        
        // Login
        const loginRes = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, signature })
        });
        
        if (!loginRes.ok) {
            throw new Error('Login failed');
        }
        
        const loginData = await loginRes.json();
        
        // Save token
        localStorage.setItem('klassik_token', loginData.token);
        localStorage.setItem('klassik_user', JSON.stringify(loginData.user));
        
        // Redirect to explorer
        showAlert('Login successful! Redirecting...', 'success');
        setTimeout(() => {
            window.location.href = 'kaspa-explorerv5.21.html';
        }, 1500);
        
    } catch (error) {
        console.error('Login error:', error);
        showAlert('Login failed: ' + error.message, 'error');
    }
}

// ============================================
// STEP 2: SACRIFICE CHECK
// ============================================

document.getElementById('check-sacrifice-btn').addEventListener('click', checkSacrifice);

async function checkSacrifice() {
    const btn = document.getElementById('check-sacrifice-btn');
    const statusEl = document.getElementById('sacrifice-status');
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span> Checking...';
        
        // Prompt for Kaspa address if not provided
        if (!kaspaAddress) {
            kaspaAddress = prompt('Enter your Kaspa wallet address (the one you sent from):');
            if (!kaspaAddress) {
                throw new Error('Kaspa address required');
            }
            document.getElementById('kaspa-address').value = kaspaAddress;
        }
        
        // Check sacrifice
        const response = await fetch(`${API_URL}/api/auth/check-sacrifice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                kaspaAddress,
                ethAddress: walletAddress
            })
        });
        
        sacrificeData = await response.json();
        
        console.log('Sacrifice data:', sacrificeData);
        
        if (sacrificeData.eligible) {
            // Eligible - proceed to registration
            statusEl.innerHTML = `
                <div style="background: rgba(0, 255, 0, 0.2); padding: 1.5rem; border-radius: 10px; border: 2px solid rgba(0, 255, 0, 0.5);">
                    <h3 style="color: #51cf66; margin-bottom: 1rem;">
                        <i class="fas fa-check-circle"></i> Sacrifice Verified!
                    </h3>
                    <p><strong>Total Sacrificed:</strong> ${sacrificeData.totalSacrificed} KAS</p>
                    <p><strong>Points Earned:</strong> ${sacrificeData.currentPoints}</p>
                    <p><strong>Status:</strong> Eligible for registration!</p>
                </div>
            `;
            document.getElementById('sacrifice-instructions').style.display = 'none';
            
            showAlert('Sacrifice verified! You can now register.', 'success');
            
            setTimeout(() => setStep(3), 2000);
        } else {
            // Not eligible - show instructions
            statusEl.innerHTML = `
                <div style="background: rgba(255, 165, 0, 0.2); padding: 1.5rem; border-radius: 10px; border: 2px solid rgba(255, 165, 0, 0.5);">
                    <h3 style="color: #ffa500; margin-bottom: 1rem;">
                        <i class="fas fa-exclamation-triangle"></i> Sacrifice Not Found
                    </h3>
                    <p><strong>Current Points:</strong> ${sacrificeData.currentPoints}</p>
                    <p><strong>Required:</strong> ${sacrificeData.requiredPoints} points (1 KAS)</p>
                    <p style="margin-top: 1rem;">${sacrificeData.message}</p>
                </div>
            `;
            document.getElementById('sacrifice-instructions').style.display = 'block';
            
            showAlert('Please send 1 KAS to the sacrifice address below.', 'error');
        }
        
    } catch (error) {
        console.error('Sacrifice check error:', error);
        showAlert('Failed to check sacrifice: ' + error.message, 'error');
        statusEl.innerHTML = `<p style="color: #ff6b6b;">Error: ${error.message}</p>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync"></i> Check Sacrifice Status';
    }
}

// ============================================
// STEP 3: REGISTRATION
// ============================================

document.getElementById('register-btn').addEventListener('click', async () => {
    const btn = document.getElementById('register-btn');
    const username = document.getElementById('username').value.trim();
    const kaspaAddr = document.getElementById('kaspa-address').value.trim();
    
    // Validation
    if (!username || username.length < 3) {
        showAlert('Username must be at least 3 characters', 'error');
        return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        showAlert('Username can only contain letters, numbers, and underscores', 'error');
        return;
    }
    
    if (!kaspaAddr) {
        showAlert('Kaspa address is required', 'error');
        return;
    }
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span> Registering...';
        
        // Get nonce
        const nonceRes = await fetch(`${API_URL}/api/auth/nonce?address=${walletAddress}`);
        const { nonce, message } = await nonceRes.json();
        
        // Sign message
        const signature = await window.ethereum.request({
            method: 'personal_sign',
            params: [message, walletAddress]
        });
        
        // Register
        const registerRes = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ethAddress: walletAddress,
                kaspaAddress: kaspaAddr,
                username,
                signature,
                nonce
            })
        });
        
        if (!registerRes.ok) {
            const error = await registerRes.json();
            throw new Error(error.error || 'Registration failed');
        }
        
        const data = await registerRes.json();
        
        // Save token
        localStorage.setItem('klassik_token', data.token);
        localStorage.setItem('klassik_user', JSON.stringify(data.user));
        
        // Show success
        document.getElementById('success-username').textContent = data.user.username;
        document.getElementById('success-wallet').textContent = `${data.user.address.substring(0, 10)}...`;
        document.getElementById('success-points').textContent = data.user.sacrifice_points || sacrificeData.currentPoints;
        
        setStep(4);
        
    } catch (error) {
        console.error('Registration error:', error);
        showAlert('Registration failed: ' + error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-user-check"></i> Complete Registration';
    }
});

// ============================================
// UTILITIES
// ============================================

function copyAddress() {
    const address = document.getElementById('sacrifice-address').textContent;
    navigator.clipboard.writeText(address);
    showAlert('Address copied to clipboard!', 'success');
}

// Check if already logged in
window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('klassik_token');
    const user = localStorage.getItem('klassik_user');
    
    if (token && user) {
        const userData = JSON.parse(user);
        showAlert(`Already logged in as ${userData.username}. Redirecting...`, 'success');
        setTimeout(() => {
            window.location.href = 'kaspa-explorerv5.21.html';
        }, 2000);
    }
});
