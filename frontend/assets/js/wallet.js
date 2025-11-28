const provider = window.ethereum ? new ethers.providers.Web3Provider(window.ethereum) : null;
let signer = null;
let userAddress = null;

const ETH_CHAIN_ID = '0x1'; // mainnet

async function connectWallet(){
  if(!provider){
    alert('Bitte installiere MetaMask oder einen kompatiblen Wallet-Provider.');
    return;
  }

  try {
    await provider.send('eth_requestAccounts', []);
    const network = await provider.getNetwork();
    // Ensure Ethereum mainnet (chainId 1) — adjust if you want testnets
    if (network.chainId !== 1) {
      alert('Bitte mit dem Ethereum-Netzwerk verbinden (Mainnet).');
      // still continue but warn
    }

    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    document.getElementById('connectBtn').innerText = `${userAddress}`;
    document.getElementById('accountArea').style.display = 'block';
    document.getElementById('accountAddress').innerText = userAddress;

    // Query backend for user
    await fetchAndShowUser(userAddress);
  } catch (err) {
    console.error('connect error', err);
    alert('Wallet connection failed: ' + (err.message || err));
  }
}

async function fetchAndShowUser(address) {
  try {
    const res = await fetch(`${API_URL}/auth/user?address=${address}`);
    if (res.ok) {
      const { user } = await res.json();
      showUserInfo(user);
      return user;
    }
    // not found -> show register form
    showRegisterForm(address);
    return null;
  } catch (err) {
    console.error('fetch user error', err);
  }
}

function showUserInfo(user) {
  const infoEl = document.getElementById('accountInfo');
  infoEl.innerHTML = `
    <div><strong>Email:</strong> ${user.email || '—'}</div>
    <div><strong>Created:</strong> ${user.created_at || '—'}</div>
  `;
}

function showRegisterForm(address) {
  const infoEl = document.getElementById('accountInfo');
  infoEl.innerHTML = `
    <div>Wallet nicht registriert. Bitte Email eingeben, um Account zu erstellen:</div>
    <input id="registerEmail" type="email" placeholder="email@example.com" />
    <button id="doRegister">Register</button>
  `;

  document.getElementById('doRegister').addEventListener('click', async () => {
    const email = document.getElementById('registerEmail').value;
    if (!email) return alert('Bitte Email angeben');
    try {
      const r = await fetch(`${API_URL}/auth/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, email })
      });
      if (!r.ok) {
        const err = await r.json();
        return alert('Registrierung fehlgeschlagen: ' + (err.error || JSON.stringify(err)));
      }
        const { user } = await r.json();
        // After registration, automatically sign the user in
        showUserInfo(user);
        // perform automatic signin flow
        await performSigninFlow(user.address);
    } catch (err) {
      console.error('registration error', err);
      alert('Registration failed');
    }
  });
}

async function authenticateWallet(address) {
  try {
    // Step 1: Get nonce
    const nonceRes = await fetch(`${API_URL}/auth/nonce?address=${address}`);
    const { nonce, message } = await nonceRes.json();
    
    if (!nonce) throw new Error('Failed to get nonce');
    
    // Step 2: Sign message
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, address]
    });
    
    // Step 3: Verify signature and get JWT
    const authRes = await fetch(`${API_URL}/auth/signin-with-wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, signature })
    });
    
    if (!authRes.ok) {
      throw new Error('Authentication failed');
    }
    
      const payload = await authRes.json();
      const { token, user } = payload;

      // Store JWT and address
      localStorage.setItem('klassik_token', token);
      localStorage.setItem('klassik_address', address);

      // show returned user info
      if (user) showUserInfo(user);
      console.log('✅ Authenticated successfully');
  } catch (error) {
    console.error('Authentication error:', error);
    showToast('Authentication failed. Please try again.', 'error');
  }
}

  async function performSigninFlow(address) {
    try {
      // Request nonce (only possible if address is registered)
      const nonceRes = await fetch(`${API_URL}/auth/nonce?address=${address}`);
      if (!nonceRes.ok) {
        const e = await nonceRes.json();
        throw new Error(e.error || 'nonce request failed');
      }
      const { message } = await nonceRes.json();

      // sign
      const signature = await signer.signMessage(message);

      // send signin
      const authRes = await fetch(`${API_URL}/auth/signin-with-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, signature })
      });

      if (!authRes.ok) {
        const e = await authRes.json();
        throw new Error(e.error || 'signin failed');
      }

      const { token, user } = await authRes.json();
      localStorage.setItem('klassik_token', token);
      localStorage.setItem('klassik_address', address);
      if (user) showUserInfo(user);
      return { token, user };
    } catch (err) {
      console.error('performSigninFlow error', err);
      throw err;
    }
  }

function getAuthToken() {
  return localStorage.getItem('klassik_token');
}

function isAuthenticated() {
  const token = getAuthToken();
  if (!token) return false;
  
  // Basic JWT expiry check (decode payload)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

document.getElementById('connectBtn').addEventListener('click', connectWallet);

// Mode switch: auth vs booking
const modeSelect = document.getElementById('modeSelect');
if (modeSelect) {
  modeSelect.addEventListener('change', (e) => {
    const mode = e.target.value;
    const swapSection = document.getElementById('swap');
    if (mode === 'booking') {
      swapSection.style.display = 'block';
    } else {
      swapSection.style.display = 'none';
    }
  });
  // initialize
  modeSelect.dispatchEvent(new Event('change'));
}

// API_URL fallback
if (typeof API_URL === 'undefined' || !API_URL) {
  window.API_URL = window.location.origin; // use same origin as fallback
}
