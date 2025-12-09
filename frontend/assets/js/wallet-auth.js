// KLASSIK - WALLET AUTH LOGIC
const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:8130' : `http://${window.location.hostname}:8130`;
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
function showStatus(message, type, icon) {
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
  if (!window.ethereum) { showStatus('MetaMask not installed!', 'error', ''); return; }
  showStatus('Connecting...', 'info', '');
  elements.connectBtn.disabled = true;
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  currentAddress = accounts[0];
  showStatus(`Connected: ${currentAddress.substring(0, 6)}...`, 'success', '');
  const response = await fetch(`${API_URL}/api/auth/check?address=${currentAddress}`);
  const data = await response.json();
  hideAll();
  if (data.registered) {
    showStatus(`Welcome back, ${data.user.username}!`, 'info', '');
    elements.loginBtn.style.display = 'block';
  } else {
    showStatus('Not registered. Choose username.', 'info', '');
    elements.registerForm.classList.add('show');
  }
}
async function register() {
  const username = elements.username.value.trim();
  if (!username || username.length < 3) { showStatus('Username too short', 'error', ''); return; }
  const nonceRes = await fetch(`${API_URL}/api/auth/nonce?address=${currentAddress}`);
  const nonce = await nonceRes.json();
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signature = await provider.getSigner().signMessage(nonce.message);
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: currentAddress, signature, username })
  });
  const data = await response.json();
  if (!response.ok) { showStatus(data.error, 'error', ''); return; }
  localStorage.setItem('klassik_token', data.token);
  localStorage.setItem('klassik_user', JSON.stringify(data.user));
  hideAll();
  elements.userInfo.classList.add('show');
  document.getElementById('infoUsername').textContent = data.user.username;
  document.getElementById('infoAddress').textContent = data.user.address;
  document.getElementById('infoUserId').textContent = data.user.id;
  document.getElementById('infoToken').textContent = data.token.substring(0, 60) + '...';
  showStatus(`Welcome, ${data.user.username}!`, 'success', '');
}
async function login() {
  const nonceRes = await fetch(`${API_URL}/api/auth/nonce?address=${currentAddress}`);
  const nonce = await nonceRes.json();
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signature = await provider.getSigner().signMessage(nonce.message);
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: currentAddress, signature })
  });
  const data = await response.json();
  localStorage.setItem('klassik_token', data.token);
  localStorage.setItem('klassik_user', JSON.stringify(data.user));
  hideAll();
  elements.userInfo.classList.add('show');
  document.getElementById('infoUsername').textContent = data.user.username;
  document.getElementById('infoAddress').textContent = data.user.address;
  document.getElementById('infoUserId').textContent = data.user.id;
  showStatus(`Welcome, ${data.user.username}!`, 'success', '');
}
function logout() {
  localStorage.clear();
  hideAll();
  elements.connectBtn.style.display = 'flex';
  showStatus('Logged out', 'info', '');
}
elements.connectBtn.addEventListener('click', connectWallet);
elements.registerBtn.addEventListener('click', register);
elements.loginBtn.addEventListener('click', login);
elements.logoutBtn.addEventListener('click', logout);
elements.dashboardBtn.addEventListener('click', () => window.location.href = 'dashboard.html');
window.addEventListener('load', () => {
  const token = localStorage.getItem('klassik_token');
  const user = localStorage.getItem('klassik_user');
  if (token && user) {
    const userData = JSON.parse(user);
    hideAll();
    elements.userInfo.classList.add('show');
    document.getElementById('infoUsername').textContent = userData.username;
    document.getElementById('infoAddress').textContent = userData.address;
    document.getElementById('infoUserId').textContent = userData.id;
    showStatus(`Welcome back, ${userData.username}!`, 'success', '');
  }
});
