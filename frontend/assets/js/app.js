document.getElementById('createOrder').addEventListener('click', async ()=>{
  const from = document.getElementById('fromChain').value;
  const to = document.getElementById('toChain').value;
  const amount = document.getElementById('amount').value;
  const statusLog = document.getElementById('statusLog');
  statusLog.innerText += `Creating order: ${amount} from ${from} to ${to}\n`;

  // address: prefer connected wallet state or fallback to stored address
  const address = window.walletState && window.walletState.address ? window.walletState.address : localStorage.getItem('klassik_address');

  // send to backend
  try{
    const res = await fetch('/api/orders', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization': `Bearer ${window.getAuthToken ? window.getAuthToken() : ''}`
      },
      body: JSON.stringify({fromChain: from, toChain: to, fromAmount: amount, toAmount: amount, fromAddress: address, toAddress: address})
    });
    const data = await res.json();
    statusLog.innerText += `Server response: ${JSON.stringify(data)}\n`;
    if (res.ok) {
      showDepositInstructions(data);
      pollOrderStatus(data.orderId);
    } else {
      showToast(data.error || 'Order creation failed', 'error');
    }
  }catch(e){
    statusLog.innerText += `Error: ${e.message}\n`;
  }
});

async function handleSwap(event) {
  event.preventDefault();
  
  if (!window.isAuthenticated || !window.isAuthenticated()) {
    window.showToast('Please connect your wallet first', 'error');
    return;
  }
  
  const formData = {
    fromChain: document.getElementById('fromChain').value,
    toChain: document.getElementById('toChain').value,
    fromAmount: document.getElementById('amount').value,
    toAmount: document.getElementById('amount').value,
    fromAddress: window.walletState.address || localStorage.getItem('klassik_address'),
    toAddress: document.getElementById('toChain').value // placeholder
  };
  
  try {
    const response = await fetch(`/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${window.getAuthToken ? window.getAuthToken() : ''}`
      },
      body: JSON.stringify(formData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create order');
    }
    
    const result = await response.json();
    
    // Show deposit instructions
    showDepositInstructions(result);
    
    // Start polling for order status
    pollOrderStatus(result.orderId);
    
  } catch (error) {
    console.error('Swap error:', error);
    window.showToast(error.message, 'error');
  }
}

function showDepositInstructions(orderData) {
  const statusLog = document.getElementById('statusLog');
  const { orderId, depositInstructions } = orderData;
  
  const instructionsText = [
    `Order ID: ${orderId}`,
    `Chain: ${depositInstructions.chain}`,
    `Amount: ${depositInstructions.amount}`,
    `Address: ${depositInstructions.address}`,
    depositInstructions.reference ? `Reference: ${depositInstructions.reference}` : '',
    orderData.estimatedTime ? `Estimated time: ${orderData.estimatedTime}` : ''
  ].filter(Boolean).join('\n');

  statusLog.innerText += `DEPOSIT INSTRUCTIONS:\n${instructionsText}\n`;
  window.showToast('Order created! Please deposit funds.', 'success');
}

async function pollOrderStatus(orderId) {
  const maxAttempts = 60; // 5 minutes
  let attempts = 0;
  const statusLog = document.getElementById('statusLog');

  const interval = setInterval(async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        headers: { 'Authorization': `Bearer ${window.getAuthToken ? window.getAuthToken() : ''}` }
      });
      
      const order = await response.json();
      window.updateStatusDisplay(order);
      statusLog.innerText += `Order ${orderId} status: ${order.status || 'unknown'}\n`;
      
      if (['completed', 'failed', 'refunded'].includes(order.status) || attempts++ >= maxAttempts) {
        clearInterval(interval);
      }
    } catch (error) {
      console.error('Poll error:', error);
    }
  }, 5000);
}

// Neue: einfache Produktliste (Beispielartikel)
const PRODUCTS = [
  { id: 'p1', title: 'Klassik Vinyl - Beethoven', price: 0.02, currency: 'ETH', description: 'Limited edition vinyl' },
  { id: 'p2', title: 'Klassik Poster', price: 0.005, currency: 'ETH', description: 'A2 Poster, signed' },
  { id: 'p3', title: 'Klassik Hoodie', price: 0.03, currency: 'ETH', description: 'Comfort fit, black' }
];

// Warenkorb-State
const CART = {
  items: {}, // id -> { product, qty }
  add(productId) {
    const p = PRODUCTS.find(x => x.id === productId);
    if (!p) return;
    if (!this.items[productId]) this.items[productId] = { product: p, qty: 0 };
    this.items[productId].qty += 1;
    renderCart();
  },
  remove(productId) {
    if (!this.items[productId]) return;
    this.items[productId].qty -= 1;
    if (this.items[productId].qty <= 0) delete this.items[productId];
    renderCart();
  },
  clear() {
    this.items = {};
    renderCart();
  },
  total() {
    return Object.values(this.items).reduce((s, it) => s + (it.product.price * it.qty), 0);
  },
  count() {
    return Object.values(this.items).reduce((s, it) => s + it.qty, 0);
  },
  toOrderPayload() {
    // simple mapping for backend: line items
    return {
      items: Object.values(this.items).map(it => ({ id: it.product.id, title: it.product.title, qty: it.qty, price: it.product.price }))
    };
  }
};

// Render Produkte
function renderProducts() {
  const el = document.getElementById('productList');
  if (!el) return;
  el.innerHTML = PRODUCTS.map(p => `
    <div class="product-card" data-id="${p.id}">
      <h4>${p.title}</h4>
      <p class="desc">${p.description}</p>
      <div class="price">${p.price.toFixed(6)} ${p.currency}</div>
      <button class="addToCart" data-id="${p.id}">In den Warenkorb</button>
    </div>
  `).join('');
  // bind
  el.querySelectorAll('.addToCart').forEach(btn => btn.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.id;
    CART.add(id);
  }));
}

// Render Warenkorb
function renderCart() {
  const cartEl = document.getElementById('cartItems');
  const cartCount = document.getElementById('cartCount');
  const cartTotal = document.getElementById('cartTotal');
  if (!cartEl) return;
  const items = Object.values(CART.items);
  if (items.length === 0) {
    cartEl.innerHTML = '<div class="empty">Dein Warenkorb ist leer.</div>';
  } else {
    cartEl.innerHTML = items.map(it => `
      <div class="cart-row" data-id="${it.product.id}">
        <div class="cart-title">${it.product.title} × ${it.qty}</div>
        <div class="cart-price">${(it.product.price * it.qty).toFixed(6)} ETH</div>
        <div class="cart-actions">
          <button class="cart-dec" data-id="${it.product.id}">−</button>
          <button class="cart-inc" data-id="${it.product.id}">+</button>
        </div>
      </div>
    `).join('');
    // bind inc/dec
    cartEl.querySelectorAll('.cart-inc').forEach(b => b.addEventListener('click', e => CART.add(e.currentTarget.dataset.id)));
    cartEl.querySelectorAll('.cart-dec').forEach(b => b.addEventListener('click', e => CART.remove(e.currentTarget.dataset.id)));
  }
  cartCount && (cartCount.innerText = CART.count());
  cartTotal && (cartTotal.innerText = CART.total().toFixed(6));
}

// Checkout: NOWPayments flow (backend creates invoice and returns invoice_url)
async function checkoutNowPayments() {
  if (Object.keys(CART.items).length === 0) {
    window.showToast('Warenkorb ist leer', 'error');
    return;
  }

  // ensure authenticated address available (optional)
  const buyerAddress = window.walletState && window.walletState.address ? window.walletState.address : localStorage.getItem('klassik_address');

  const payload = {
    buyerAddress,
    items: CART.toOrderPayload(),
    // currency and amount: NOWPayments expects price and currency
    amount: CART.total().toString(),
    currency: 'eth' // example, backend may map
  };

  try {
    const res = await fetch('/api/payments/nowpayment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${window.getAuthToken ? window.getAuthToken() : ''}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      window.showToast(data.error || 'Zahlungserstellung fehlgeschlagen', 'error');
      return;
    }

    // backend should return { invoice_url, payment_id, orderId }
    if (data.invoice_url) {
      // open invoice in new tab so user can complete payment
      window.open(data.invoice_url, '_blank', 'noopener');
      // show link in UI
      const ia = document.getElementById('invoiceArea');
      if (ia) ia.innerHTML = `<a href="${data.invoice_url}" target="_blank" rel="noopener">Zahlungsseite öffnen</a>`;
      // optionally save order id and poll status
      if (data.orderId) pollOrderStatus(data.orderId);
      // clear cart locally
      CART.clear();
      window.showToast('Zahlungsseite geöffnet. Vervollständige die Zahlung im neuen Tab.', 'success');
    } else {
      window.showToast('Keine Zahlungs-URL erhalten', 'error');
    }
  } catch (err) {
    console.error('checkout error', err);
    window.showToast('Fehler beim Erstellen der Zahlung', 'error');
  }
}

// UI toggles
document.getElementById('openCartBtn')?.addEventListener('click', () => {
  const c = document.getElementById('cart');
  if (!c) return;
  c.style.display = c.style.display === 'block' ? 'none' : 'block';
});
document.getElementById('closeCartBtn')?.addEventListener('click', () => {
  const c = document.getElementById('cart');
  if (!c) return;
  c.style.display = 'none';
});
document.getElementById('checkoutBtn')?.addEventListener('click', checkoutNowPayments);

// initialize shop rendering on page load and mode switch
(function initShop() {
  renderProducts();
  renderCart();

  const modeSelect = document.getElementById('modeSelect');
  if (modeSelect) {
    modeSelect.addEventListener('change', (e) => {
      const mode = e.target.value;
      document.getElementById('swap').style.display = mode === 'booking' ? 'block' : 'none';
      document.getElementById('shop').style.display = mode === 'shop' ? 'block' : 'none';
    });
  }
})();
