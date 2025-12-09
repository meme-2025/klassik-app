# 🎯 Frontend Integration Plan - Wallet-Auth & Dashboard

## 📋 Schritt-für-Schritt Anleitung

Dieses Dokument zeigt dir **GENAU**, wie du die Backend verstehst und über das Frontend steuerst.

---

## 🎯 ZIEL

**Wallet-basierte Authentifizierung:**
1. User verbindet Wallet (MetaMask)
2. System prüft: Ist Wallet registriert?
3. **NEIN** → Registrierung mit Wallet-Signatur + Username
4. **JA** → Login mit Wallet-Signatur
5. User erhält JWT Token
6. Alle weiteren API-Calls nutzen diesen Token

---

## 🔧 SCHRITT 1: Backend Datenbank fixen

### Problem verstehen
```javascript
// ❌ AKTUELL (FALSCH):
users.email = '0x123abc...'      // Wallet-Adresse
users.password = 'max_mustermann' // Username (UNHASHED!)
users.address = NULL              // Leer!

// ✅ RICHTIG:
users.email = 'max@example.com'   // Echte Email (optional)
users.password = null             // Kein Passwort bei Wallet-Auth
users.address = '0x123abc...'     // Wallet-Adresse
users.username = 'max_mustermann' // Username in eigener Spalte
```

### SQL Migration erstellen

**Datei:** `backend/migrations/003_fix_wallet_auth.js`

```javascript
exports.up = async (pgm) => {
  // 1. Username Spalte hinzufügen
  pgm.addColumn('users', {
    username: {
      type: 'VARCHAR(100)',
      unique: true
    }
  }, { ifNotExists: true });

  // 2. Daten migrieren: Wenn email mit 0x startet → ist Wallet
  pgm.sql(`
    UPDATE users 
    SET username = password,
        address = LOWER(email),
        email = NULL,
        password = NULL
    WHERE email LIKE '0x%'
  `);

  // 3. Address Spalte NOT NULL machen (nur für Wallet-User)
  // ACHTUNG: Erst nach Migration!
  
  console.log('✅ Wallet-Auth Daten migriert');
};

exports.down = (pgm) => {
  // Rollback
  pgm.sql(`
    UPDATE users
    SET email = address,
        password = username
    WHERE address IS NOT NULL
  `);
  
  pgm.dropColumn('users', 'username', { ifExists: true });
};
```

### Migration ausführen

```bash
# Auf Ubuntu Server
cd /home/klassikapp/klassik-app/backend
npm run migrate:up
```

---

## 🔧 SCHRITT 2: Backend Auth Routes aufräumen

### Datei: `backend/src/routes/auth.js`

**Neue Endpunkte:**

```javascript
// ===============================================
// WALLET-ONLY AUTHENTICATION (Neue Logik)
// ===============================================

/**
 * GET /api/auth/wallet/check?address=0x123
 * Prüft ob Wallet bereits registriert ist
 */
router.get('/wallet/check', async (req, res) => {
  try {
    const { address } = req.query;
    
    if (!address || !ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Valid address required' });
    }

    const normalized = address.toLowerCase();
    
    const result = await db.query(
      'SELECT id, username, address, created_at FROM users WHERE LOWER(address) = $1',
      [normalized]
    );
    
    if (result.rows.length === 0) {
      return res.json({ 
        registered: false,
        address: normalized 
      });
    }
    
    return res.json({
      registered: true,
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        address: result.rows[0].address,
        created_at: result.rows[0].created_at
      }
    });
    
  } catch (err) {
    console.error('wallet/check error:', err);
    res.status(500).json({ error: 'Check failed' });
  }
});

/**
 * POST /api/auth/wallet/register
 * Wallet-Registrierung mit Signatur
 * Body: { address, signature, username }
 */
router.post('/wallet/register', async (req, res) => {
  try {
    const { address, signature, username } = req.body;

    // Validierung
    if (!address || !signature || !username) {
      return res.status(400).json({ 
        error: 'address, signature and username required' 
      });
    }

    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }

    // Username Validierung
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ 
        error: 'Username must be 3-30 characters' 
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ 
        error: 'Username: only letters, numbers, underscore' 
      });
    }

    const normalized = address.toLowerCase();

    // Nonce holen
    const nonceRes = await db.query(
      'SELECT nonce, expires_at FROM nonces WHERE address = $1',
      [normalized]
    );

    if (nonceRes.rows.length === 0) {
      return res.status(400).json({ 
        error: 'No nonce found. Request nonce first.' 
      });
    }

    const { nonce, expires_at } = nonceRes.rows[0];

    if (new Date(expires_at) < new Date()) {
      return res.status(401).json({ error: 'Nonce expired' });
    }

    // Signatur verifizieren
    const message = `Sign this message to authenticate with Klassik:\n\nNonce: ${nonce}\nTimestamp: ${new Date(expires_at).toISOString()}`;

    let recoveredAddress;
    try {
      recoveredAddress = ethers.utils.verifyMessage(message, signature);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    if (recoveredAddress.toLowerCase() !== normalized) {
      return res.status(401).json({ 
        error: 'Signature does not match address' 
      });
    }

    // Prüfen ob Wallet schon registriert
    const exists = await db.query(
      'SELECT id FROM users WHERE LOWER(address) = $1',
      [normalized]
    );

    if (exists.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Wallet already registered' 
      });
    }

    // Prüfen ob Username schon vergeben
    const usernameExists = await db.query(
      'SELECT id FROM users WHERE LOWER(username) = $1',
      [username.toLowerCase()]
    );

    if (usernameExists.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Username already taken' 
      });
    }

    // User erstellen
    const result = await db.query(
      `INSERT INTO users (address, username, created_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Berlin') 
       RETURNING id, address, username, created_at`,
      [normalized, username]
    );

    const user = result.rows[0];

    // Nonce löschen
    await db.query('DELETE FROM nonces WHERE address = $1', [normalized]);

    // JWT Token generieren
    const token = jwt.sign(
      { 
        userId: user.id,
        address: user.address,
        username: user.username
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    console.log(`✅ Wallet registered: ${normalized} → ${username}`);

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        address: user.address,
        username: user.username,
        created_at: user.created_at
      },
      token,
      expiresIn: JWT_EXPIRY
    });

  } catch (err) {
    console.error('wallet/register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/wallet/login
 * Wallet-Login mit Signatur
 * Body: { address, signature }
 */
router.post('/wallet/login', async (req, res) => {
  try {
    const { address, signature } = req.body;

    if (!address || !signature) {
      return res.status(400).json({ 
        error: 'address and signature required' 
      });
    }

    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const normalized = address.toLowerCase();

    // Nonce holen
    const nonceRes = await db.query(
      'SELECT nonce, expires_at FROM nonces WHERE address = $1',
      [normalized]
    );

    if (nonceRes.rows.length === 0) {
      return res.status(400).json({ 
        error: 'No nonce found. Request nonce first.' 
      });
    }

    const { nonce, expires_at } = nonceRes.rows[0];

    if (new Date(expires_at) < new Date()) {
      return res.status(401).json({ error: 'Nonce expired' });
    }

    // Signatur verifizieren
    const message = `Sign this message to authenticate with Klassik:\n\nNonce: ${nonce}\nTimestamp: ${new Date(expires_at).toISOString()}`;

    let recoveredAddress;
    try {
      recoveredAddress = ethers.utils.verifyMessage(message, signature);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    if (recoveredAddress.toLowerCase() !== normalized) {
      return res.status(401).json({ 
        error: 'Signature verification failed' 
      });
    }

    // User finden
    const userRes = await db.query(
      'SELECT id, address, username, created_at FROM users WHERE LOWER(address) = $1',
      [normalized]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Wallet not registered. Please register first.' 
      });
    }

    const user = userRes.rows[0];

    // Nonce löschen
    await db.query('DELETE FROM nonces WHERE address = $1', [normalized]);

    // JWT Token generieren
    const token = jwt.sign(
      { 
        userId: user.id,
        address: user.address,
        username: user.username
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    console.log(`✅ Wallet login: ${user.username} (${normalized})`);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        address: user.address,
        username: user.username,
        created_at: user.created_at
      },
      token,
      expiresIn: JWT_EXPIRY
    });

  } catch (err) {
    console.error('wallet/login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});
```

---

## 🎨 SCHRITT 3: Frontend - Wallet Connect

### Datei: `frontend/wallet-dashboard.html`

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Klassik - Wallet Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .container {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 600px;
      width: 100%;
      padding: 40px;
    }
    
    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 28px;
    }
    
    .subtitle {
      color: #666;
      margin-bottom: 30px;
    }
    
    .status {
      padding: 15px;
      border-radius: 10px;
      margin-bottom: 20px;
      display: none;
    }
    
    .status.info { background: #e3f2fd; color: #1976d2; display: block; }
    .status.success { background: #e8f5e9; color: #388e3c; display: block; }
    .status.error { background: #ffebee; color: #c62828; display: block; }
    
    .btn {
      width: 100%;
      padding: 15px;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      margin-bottom: 10px;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(102,126,234,0.4); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    
    .input-group {
      margin-bottom: 20px;
    }
    
    label {
      display: block;
      margin-bottom: 8px;
      color: #555;
      font-weight: 600;
    }
    
    input {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
      transition: border 0.3s;
    }
    
    input:focus {
      outline: none;
      border-color: #667eea;
    }
    
    .user-info {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 10px;
      margin-top: 20px;
      display: none;
    }
    
    .user-info.show { display: block; }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid #ddd;
    }
    
    .info-row:last-child { border-bottom: none; margin-bottom: 0; }
    
    .info-label { font-weight: 600; color: #555; }
    .info-value { color: #333; font-family: monospace; }
    
    #registerForm { display: none; }
    #registerForm.show { display: block; }
    
    .loading {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-left: 10px;
      vertical-align: middle;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎵 Klassik Wallet Auth</h1>
    <p class="subtitle">Connect your wallet to get started</p>
    
    <div id="status" class="status"></div>
    
    <!-- Connect Button -->
    <button id="connectBtn" class="btn btn-primary">
      🦊 Connect MetaMask
    </button>
    
    <!-- Registration Form -->
    <div id="registerForm">
      <div class="input-group">
        <label for="username">Choose Username:</label>
        <input 
          type="text" 
          id="username" 
          placeholder="max_mustermann" 
          pattern="[a-zA-Z0-9_]{3,30}"
          required
        >
        <small style="color: #999;">3-30 characters, letters, numbers, underscore only</small>
      </div>
      <button id="registerBtn" class="btn btn-primary">
        ✍️ Sign & Register
      </button>
    </div>
    
    <!-- Login Button -->
    <button id="loginBtn" class="btn btn-primary" style="display: none;">
      ✍️ Sign & Login
    </button>
    
    <!-- User Info -->
    <div id="userInfo" class="user-info">
      <h3>✅ Authenticated</h3>
      <div class="info-row">
        <span class="info-label">Username:</span>
        <span class="info-value" id="infoUsername">-</span>
      </div>
      <div class="info-row">
        <span class="info-label">Wallet:</span>
        <span class="info-value" id="infoAddress">-</span>
      </div>
      <div class="info-row">
        <span class="info-label">User ID:</span>
        <span class="info-value" id="infoUserId">-</span>
      </div>
      <div class="info-row">
        <span class="info-label">Token:</span>
        <span class="info-value" id="infoToken" style="font-size: 10px; word-break: break-all;">-</span>
      </div>
      <button id="logoutBtn" class="btn btn-primary" style="margin-top: 20px;">
        🚪 Logout
      </button>
    </div>
  </div>

  <script src="https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js"></script>
  <script>
    const API_URL = 'http://157.173.222.140:8130';
    
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
      username: document.getElementById('username')
    };
    
    // Status anzeigen
    function showStatus(message, type = 'info') {
      elements.status.textContent = message;
      elements.status.className = `status ${type}`;
    }
    
    // MetaMask verbinden
    async function connectWallet() {
      try {
        if (!window.ethereum) {
          showStatus('❌ MetaMask not installed!', 'error');
          return;
        }
        
        showStatus('Connecting wallet...', 'info');
        
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        
        currentAddress = accounts[0];
        showStatus(`✅ Connected: ${currentAddress}`, 'success');
        
        // Prüfen ob Wallet registriert ist
        await checkWalletRegistration();
        
      } catch (err) {
        showStatus(`❌ Connection failed: ${err.message}`, 'error');
      }
    }
    
    // Wallet-Registrierung prüfen
    async function checkWalletRegistration() {
      try {
        const response = await fetch(
          `${API_URL}/api/auth/wallet/check?address=${currentAddress}`
        );
        
        const data = await response.json();
        
        if (data.registered) {
          // Bereits registriert → Login anzeigen
          showStatus(`✅ Wallet found! Welcome back, ${data.user.username}`, 'success');
          elements.connectBtn.style.display = 'none';
          elements.loginBtn.style.display = 'block';
        } else {
          // Nicht registriert → Registrierung anzeigen
          showStatus('⚠️ Wallet not registered. Please choose a username.', 'info');
          elements.connectBtn.style.display = 'none';
          elements.registerForm.classList.add('show');
        }
      } catch (err) {
        showStatus(`❌ Check failed: ${err.message}`, 'error');
      }
    }
    
    // Nonce holen
    async function getNonce() {
      const response = await fetch(
        `${API_URL}/api/auth/nonce?address=${currentAddress}`
      );
      
      if (!response.ok) throw new Error('Failed to get nonce');
      
      return await response.json();
    }
    
    // Message signieren
    async function signMessage(message) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      return await signer.signMessage(message);
    }
    
    // Registrierung
    async function register() {
      try {
        const username = elements.username.value.trim();
        
        if (!username || username.length < 3) {
          showStatus('❌ Username must be at least 3 characters', 'error');
          return;
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
          showStatus('❌ Username: only letters, numbers, underscore', 'error');
          return;
        }
        
        showStatus('Getting nonce...', 'info');
        elements.registerBtn.disabled = true;
        elements.registerBtn.innerHTML = '⏳ Processing...';
        
        // 1. Nonce holen
        const nonceData = await getNonce();
        
        // 2. Signieren
        showStatus('Please sign the message in MetaMask...', 'info');
        const signature = await signMessage(nonceData.message);
        
        // 3. Registrieren
        showStatus('Registering...', 'info');
        const response = await fetch(`${API_URL}/api/auth/wallet/register`, {
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
        
        // Erfolg!
        currentToken = data.token;
        showStatus(`✅ Registration successful! Welcome, ${data.user.username}`, 'success');
        displayUserInfo(data.user, data.token);
        
      } catch (err) {
        showStatus(`❌ Registration failed: ${err.message}`, 'error');
        elements.registerBtn.disabled = false;
        elements.registerBtn.innerHTML = '✍️ Sign & Register';
      }
    }
    
    // Login
    async function login() {
      try {
        showStatus('Getting nonce...', 'info');
        elements.loginBtn.disabled = true;
        elements.loginBtn.innerHTML = '⏳ Processing...';
        
        // 1. Nonce holen
        const nonceData = await getNonce();
        
        // 2. Signieren
        showStatus('Please sign the message in MetaMask...', 'info');
        const signature = await signMessage(nonceData.message);
        
        // 3. Login
        showStatus('Logging in...', 'info');
        const response = await fetch(`${API_URL}/api/auth/wallet/login`, {
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
        
        // Erfolg!
        currentToken = data.token;
        showStatus(`✅ Login successful! Welcome back, ${data.user.username}`, 'success');
        displayUserInfo(data.user, data.token);
        
      } catch (err) {
        showStatus(`❌ Login failed: ${err.message}`, 'error');
        elements.loginBtn.disabled = false;
        elements.loginBtn.innerHTML = '✍️ Sign & Login';
      }
    }
    
    // User Info anzeigen
    function displayUserInfo(user, token) {
      elements.registerForm.style.display = 'none';
      elements.loginBtn.style.display = 'none';
      elements.userInfo.classList.add('show');
      
      document.getElementById('infoUsername').textContent = user.username;
      document.getElementById('infoAddress').textContent = user.address;
      document.getElementById('infoUserId').textContent = user.id;
      document.getElementById('infoToken').textContent = token.substring(0, 50) + '...';
      
      // Token in localStorage speichern
      localStorage.setItem('klassik_token', token);
      localStorage.setItem('klassik_user', JSON.stringify(user));
    }
    
    // Logout
    function logout() {
      currentAddress = null;
      currentToken = null;
      localStorage.removeItem('klassik_token');
      localStorage.removeItem('klassik_user');
      
      elements.userInfo.classList.remove('show');
      elements.connectBtn.style.display = 'block';
      showStatus('👋 Logged out', 'info');
    }
    
    // Event Listeners
    elements.connectBtn.addEventListener('click', connectWallet);
    elements.registerBtn.addEventListener('click', register);
    elements.loginBtn.addEventListener('click', login);
    elements.logoutBtn.addEventListener('click', logout);
    
    // Auto-login bei gespeichertem Token
    window.addEventListener('load', () => {
      const savedToken = localStorage.getItem('klassik_token');
      const savedUser = localStorage.getItem('klassik_user');
      
      if (savedToken && savedUser) {
        try {
          currentToken = savedToken;
          const user = JSON.parse(savedUser);
          displayUserInfo(user, savedToken);
          showStatus(`✅ Welcome back, ${user.username}!`, 'success');
        } catch (err) {
          localStorage.clear();
        }
      }
    });
  </script>
</body>
</html>
```

---

## 🎨 SCHRITT 4: Dashboard zum Testen der API

### Datei: `frontend/api-dashboard.html`

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Klassik API Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 10px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    h1 {
      color: #333;
      margin-bottom: 10px;
    }
    
    .auth-status {
      padding: 15px;
      background: #e3f2fd;
      border-left: 4px solid #2196f3;
      margin-bottom: 30px;
      border-radius: 5px;
    }
    
    .auth-status.authenticated {
      background: #e8f5e9;
      border-left-color: #4caf50;
    }
    
    .section {
      margin-bottom: 30px;
      padding-bottom: 30px;
      border-bottom: 1px solid #eee;
    }
    
    .section:last-child { border-bottom: none; }
    
    h2 {
      color: #555;
      margin-bottom: 15px;
      font-size: 20px;
    }
    
    .endpoint {
      background: #f9f9f9;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 15px;
    }
    
    .endpoint-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .method {
      padding: 4px 8px;
      border-radius: 3px;
      font-weight: 600;
      font-size: 12px;
      color: white;
    }
    
    .method.get { background: #4caf50; }
    .method.post { background: #2196f3; }
    
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s;
    }
    
    .btn-primary {
      background: #667eea;
      color: white;
    }
    
    .btn-primary:hover {
      background: #5568d3;
    }
    
    .response {
      background: #263238;
      color: #aed581;
      padding: 15px;
      border-radius: 5px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      max-height: 300px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin-top: 10px;
      display: none;
    }
    
    .response.show { display: block; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎵 Klassik API Dashboard</h1>
    <p style="color: #999; margin-bottom: 20px;">Test all backend endpoints</p>
    
    <div id="authStatus" class="auth-status">
      🔓 Not authenticated - <a href="wallet-dashboard.html">Login here</a>
    </div>
    
    <!-- Health Check -->
    <div class="section">
      <h2>🏥 Health Check</h2>
      <div class="endpoint">
        <div class="endpoint-header">
          <div>
            <span class="method get">GET</span>
            <code>/health</code>
          </div>
          <button class="btn btn-primary" onclick="callAPI('GET', '/health', null, 'health-response')">
            Test
          </button>
        </div>
        <div id="health-response" class="response"></div>
      </div>
    </div>
    
    <!-- Kaspa Stats -->
    <div class="section">
      <h2>📊 Kaspa Stats</h2>
      <div class="endpoint">
        <div class="endpoint-header">
          <div>
            <span class="method get">GET</span>
            <code>/api/kaspa/stats</code>
          </div>
          <button class="btn btn-primary" onclick="callAPI('GET', '/api/kaspa/stats', null, 'stats-response')">
            Test
          </button>
        </div>
        <div id="stats-response" class="response"></div>
      </div>
    </div>
    
    <!-- Products -->
    <div class="section">
      <h2>🛍️ Products</h2>
      <div class="endpoint">
        <div class="endpoint-header">
          <div>
            <span class="method get">GET</span>
            <code>/api/products</code>
          </div>
          <button class="btn btn-primary" onclick="callAPI('GET', '/api/products', null, 'products-response')">
            Test
          </button>
        </div>
        <div id="products-response" class="response"></div>
      </div>
    </div>
    
    <!-- Orders (Protected) -->
    <div class="section">
      <h2>🔒 Orders (Protected)</h2>
      <div class="endpoint">
        <div class="endpoint-header">
          <div>
            <span class="method get">GET</span>
            <code>/api/orders</code>
          </div>
          <button class="btn btn-primary" onclick="callAPIAuth('GET', '/api/orders', null, 'orders-response')">
            Test
          </button>
        </div>
        <div id="orders-response" class="response"></div>
      </div>
    </div>
    
    <!-- Events -->
    <div class="section">
      <h2>🎭 Events</h2>
      <div class="endpoint">
        <div class="endpoint-header">
          <div>
            <span class="method get">GET</span>
            <code>/api/events</code>
          </div>
          <button class="btn btn-primary" onclick="callAPI('GET', '/api/events', null, 'events-response')">
            Test
          </button>
        </div>
        <div id="events-response" class="response"></div>
      </div>
    </div>
  </div>

  <script>
    const API_URL = 'http://157.173.222.140:8130';
    
    // Auth Status prüfen
    function checkAuthStatus() {
      const token = localStorage.getItem('klassik_token');
      const user = localStorage.getItem('klassik_user');
      
      if (token && user) {
        const userData = JSON.parse(user);
        document.getElementById('authStatus').innerHTML = `
          ✅ Authenticated as <strong>${userData.username}</strong> (${userData.address})
        `;
        document.getElementById('authStatus').classList.add('authenticated');
      }
    }
    
    // API Call (öffentlich)
    async function callAPI(method, endpoint, body, responseId) {
      const responseEl = document.getElementById(responseId);
      responseEl.textContent = 'Loading...';
      responseEl.classList.add('show');
      
      try {
        const options = {
          method,
          headers: { 'Content-Type': 'application/json' }
        };
        
        if (body) {
          options.body = JSON.stringify(body);
        }
        
        const response = await fetch(API_URL + endpoint, options);
        const data = await response.json();
        
        responseEl.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        responseEl.textContent = `Error: ${err.message}`;
      }
    }
    
    // API Call (mit Auth)
    async function callAPIAuth(method, endpoint, body, responseId) {
      const token = localStorage.getItem('klassik_token');
      
      if (!token) {
        alert('Please login first!');
        window.location.href = 'wallet-dashboard.html';
        return;
      }
      
      const responseEl = document.getElementById(responseId);
      responseEl.textContent = 'Loading...';
      responseEl.classList.add('show');
      
      try {
        const options = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        };
        
        if (body) {
          options.body = JSON.stringify(body);
        }
        
        const response = await fetch(API_URL + endpoint, options);
        const data = await response.json();
        
        responseEl.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        responseEl.textContent = `Error: ${err.message}`;
      }
    }
    
    // On Load
    checkAuthStatus();
  </script>
</body>
</html>
```

---

## 📝 ZUSAMMENFASSUNG

### Was du jetzt hast:

1. ✅ **Vollständiges Verständnis** der Backend-Architektur
2. ✅ **DB Schema** erklärt (users, events, bookings, products, orders, payments, nonces)
3. ✅ **Alle API Endpunkte** dokumentiert
4. ✅ **Problem identifiziert**: Wallet-Adresse in falscher Spalte
5. ✅ **Lösung bereit**: Migration + neue Auth Routes
6. ✅ **Frontend fertig**: Wallet-Dashboard + API-Tester

### Nächste Schritte:

```bash
# 1. Migration erstellen
# Datei: backend/migrations/003_fix_wallet_auth.js (siehe oben)

# 2. Auth Routes updaten
# Datei: backend/src/routes/auth.js (neue Endpunkte hinzufügen)

# 3. Frontend testen
# http://157.173.222.140:8130/wallet-dashboard.html

# 4. Backend neu starten
sudo systemctl restart klassik
```

### Workflow:

```
User → wallet-dashboard.html → Connect MetaMask
   ↓
   Prüft: Wallet registriert?
   ↓
   NEIN → Username eingeben → Sign Message → POST /api/auth/wallet/register
   JA   → Sign Message → POST /api/auth/wallet/login
   ↓
   Erhält JWT Token → Speichert in localStorage
   ↓
   Nutzt Token für alle API-Calls → api-dashboard.html
```

---

**Status**: ✅ Komplett dokumentiert  
**Nächster Schritt**: Migration ausführen & Frontend deployen  
**Autor**: GitHub Copilot  
**Datum**: 2025-12-09
