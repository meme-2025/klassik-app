// ============================================
// KLASSIK DASHBOARD - LOGIC
// ============================================

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8130'
  : `http://${window.location.hostname}:8130`;

let token = null;
let user = null;
let currentEndpoint = 'me';

// ============================================
// INITIALIZATION
// ============================================

window.addEventListener('load', () => {
  // Check authentication
  token = localStorage.getItem('klassik_token');
  const savedUser = localStorage.getItem('klassik_user');
  
  if (!token || !savedUser) {
    // Not logged in - redirect to login page
    window.location.href = 'index.html';
    return;
  }
  
  try {
    user = JSON.parse(savedUser);
    displayUserInfo();
    setupEventListeners();
  } catch (err) {
    console.error('Invalid user data:', err);
    logout();
  }
});

// ============================================
// USER INFO DISPLAY
// ============================================

function displayUserInfo() {
  document.getElementById('username').textContent = user.username || '-';
  document.getElementById('address').textContent = user.address || '-';
  document.getElementById('userId').textContent = user.id || '-';
  
  const tokenDisplay = token.substring(0, 80) + '...';
  document.getElementById('token').textContent = tokenDisplay;
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Logout button
  document.getElementById('logoutBtn').addEventListener('click', logout);
  
  // Endpoint selector buttons
  document.querySelectorAll('.endpoint-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.endpoint-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentEndpoint = btn.dataset.endpoint;
    });
  });
  
  // Test button
  document.getElementById('testBtn').addEventListener('click', executeApiCall);
  
  // Copy button
  document.getElementById('copyBtn').addEventListener('click', copyResponse);
  
  // Create event form
  document.getElementById('createEventForm').addEventListener('submit', createEvent);
  
  // Create booking form
  document.getElementById('createBookingForm').addEventListener('submit', createBooking);
}

// ============================================
// API CALLS
// ============================================

async function executeApiCall() {
  const testBtn = document.getElementById('testBtn');
  const statusEl = document.getElementById('apiStatus');
  const responseEl = document.getElementById('response');
  
  testBtn.disabled = true;
  testBtn.innerHTML = '<span>⏳</span><span>Executing...</span>';
  statusEl.textContent = 'Loading...';
  
  try {
    let endpoint = '';
    let method = 'GET';
    let body = null;
    
    switch (currentEndpoint) {
      case 'me':
        endpoint = '/api/auth/me';
        break;
      case 'events':
        endpoint = '/api/events';
        break;
      case 'bookings':
        endpoint = '/api/bookings/my';
        break;
      case 'products':
        endpoint = '/api/products';
        break;
      case 'orders':
        endpoint = '/api/orders/my';
        break;
      default:
        throw new Error('Unknown endpoint');
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : null
    });
    
    const data = await response.json();
    
    // Display response
    responseEl.textContent = JSON.stringify(data, null, 2);
    
    if (response.ok) {
      statusEl.textContent = `Success (${response.status})`;
      statusEl.style.color = 'var(--success)';
    } else {
      statusEl.textContent = `Error (${response.status})`;
      statusEl.style.color = 'var(--danger)';
    }
    
  } catch (err) {
    console.error('API call error:', err);
    responseEl.textContent = `// Error: ${err.message}`;
    statusEl.textContent = 'Failed';
    statusEl.style.color = 'var(--danger)';
  } finally {
    testBtn.disabled = false;
    testBtn.innerHTML = '<span>⚡</span><span>Execute API Call</span>';
  }
}

// ============================================
// CREATE EVENT
// ============================================

async function createEvent(e) {
  e.preventDefault();
  
  const title = document.getElementById('eventTitle').value;
  const date = document.getElementById('eventDate').value;
  const venue = document.getElementById('eventVenue').value;
  const price = document.getElementById('eventPrice').value;
  const description = document.getElementById('eventDescription').value;
  
  const responseEl = document.getElementById('response');
  
  try {
    responseEl.textContent = '// Creating event...';
    
    const response = await fetch(`${API_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        date,
        venue,
        price: parseFloat(price),
        description
      })
    });
    
    const data = await response.json();
    responseEl.textContent = JSON.stringify(data, null, 2);
    
    if (response.ok) {
      alert(`✅ Event created successfully! ID: ${data.event?.id || 'N/A'}`);
      document.getElementById('createEventForm').reset();
    } else {
      alert(`❌ Error: ${data.error || 'Failed to create event'}`);
    }
    
  } catch (err) {
    console.error('Create event error:', err);
    responseEl.textContent = `// Error: ${err.message}`;
    alert(`❌ Error: ${err.message}`);
  }
}

// ============================================
// CREATE BOOKING
// ============================================

async function createBooking(e) {
  e.preventDefault();
  
  const eventId = document.getElementById('bookingEventId').value;
  const tickets = document.getElementById('bookingTickets').value;
  
  const responseEl = document.getElementById('response');
  
  try {
    responseEl.textContent = '// Creating booking...';
    
    const response = await fetch(`${API_URL}/api/bookings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        eventId: parseInt(eventId),
        numberOfTickets: parseInt(tickets)
      })
    });
    
    const data = await response.json();
    responseEl.textContent = JSON.stringify(data, null, 2);
    
    if (response.ok) {
      alert(`✅ Booking created successfully! ID: ${data.booking?.id || 'N/A'}`);
      document.getElementById('createBookingForm').reset();
    } else {
      alert(`❌ Error: ${data.error || 'Failed to create booking'}`);
    }
    
  } catch (err) {
    console.error('Create booking error:', err);
    responseEl.textContent = `// Error: ${err.message}`;
    alert(`❌ Error: ${err.message}`);
  }
}

// ============================================
// COPY RESPONSE
// ============================================

function copyResponse() {
  const responseEl = document.getElementById('response');
  const text = responseEl.textContent;
  
  navigator.clipboard.writeText(text).then(() => {
    const copyBtn = document.getElementById('copyBtn');
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✅';
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Copy failed:', err);
    alert('Failed to copy to clipboard');
  });
}

// ============================================
// LOGOUT
// ============================================

function logout() {
  localStorage.removeItem('klassik_token');
  localStorage.removeItem('klassik_user');
  window.location.href = 'index.html';
}

// ============================================
// AUTO-REFRESH USER INFO
// ============================================

// Refresh user info from server every 30 seconds
setInterval(async () => {
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      // Token expired or invalid
      logout();
      return;
    }
    
    const data = await response.json();
    user = data.user;
    localStorage.setItem('klassik_user', JSON.stringify(user));
    
  } catch (err) {
    console.error('Auto-refresh error:', err);
  }
}, 30000);
