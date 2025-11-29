// Merch Store JavaScript

// Category Filter
let currentCategory = 'all';

document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all buttons
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        
        // Add active class to clicked button
        btn.classList.add('active');
        
        // Get category
        currentCategory = btn.getAttribute('data-category');
        
        // Filter products
        filterProducts();
    });
});

function filterProducts() {
    const products = document.querySelectorAll('.product-card');
    
    products.forEach(product => {
        const category = product.getAttribute('data-category');
        
        if (currentCategory === 'all' || category === currentCategory) {
            product.style.display = 'block';
            setTimeout(() => {
                product.style.opacity = '1';
                product.style.transform = 'translateY(0)';
            }, 10);
        } else {
            product.style.opacity = '0';
            product.style.transform = 'translateY(20px)';
            setTimeout(() => {
                product.style.display = 'none';
            }, 300);
        }
    });
}

// Sort Products
document.querySelector('.filter-select')?.addEventListener('change', (e) => {
    const sortBy = e.target.value;
    const productsGrid = document.querySelector('.products-grid');
    const products = Array.from(document.querySelectorAll('.product-card'));
    
    products.sort((a, b) => {
        const priceA = parseFloat(a.querySelector('.price-kas').textContent.replace(/[^\d.]/g, ''));
        const priceB = parseFloat(b.querySelector('.price-kas').textContent.replace(/[^\d.]/g, ''));
        
        if (sortBy.includes('Low to High')) {
            return priceA - priceB;
        } else if (sortBy.includes('High to Low')) {
            return priceB - priceA;
        }
        
        return 0;
    });
    
    // Re-append sorted products
    products.forEach(product => productsGrid.appendChild(product));
});

// Size Selection
document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        
        // Remove active from siblings
        const siblings = this.parentElement.querySelectorAll('.size-btn');
        siblings.forEach(s => s.classList.remove('active'));
        
        // Add active to clicked
        this.classList.add('active');
    });
});

// Shopping Cart
const cart = {
    items: [],
    total: 0
};

function updateCartUI() {
    const cartCount = document.querySelector('.cart-count');
    const cartItems = document.querySelector('.cart-items');
    const totalAmount = document.querySelector('.total-amount');
    
    if (cartCount) {
        cartCount.textContent = cart.items.length;
    }
    
    if (cart.items.length === 0) {
        if (cartItems) {
            cartItems.innerHTML = `
                <div class="cart-empty">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Your cart is empty</p>
                </div>
            `;
        }
        if (totalAmount) {
            totalAmount.textContent = '0 KAS ($0)';
        }
    } else {
        // Update cart items display
        if (cartItems) {
            cartItems.innerHTML = cart.items.map(item => `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}">
                    <div class="cart-item-info">
                        <h4>${item.name}</h4>
                        <p>${item.price}</p>
                    </div>
                    <button class="remove-item-btn" onclick="removeFromCart('${item.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');
        }
        
        // Update total
        const totalKAS = cart.items.reduce((sum, item) => {
            const price = parseFloat(item.price.match(/[\d.]+/)[0]);
            return sum + price;
        }, 0);
        
        const totalUSD = (totalKAS / 0.1843).toFixed(2);
        
        if (totalAmount) {
            totalAmount.textContent = `${totalKAS.toFixed(3)} KAS ($${totalUSD})`;
        }
    }
}

function addToCart(productCard) {
    const name = productCard.querySelector('.product-name').textContent;
    const price = productCard.querySelector('.price-kas').textContent;
    const image = productCard.querySelector('.product-image img').src;
    const selectedSize = productCard.querySelector('.size-btn.active');
    const size = selectedSize ? selectedSize.textContent : 'One Size';
    
    const item = {
        id: Date.now().toString(),
        name: name,
        price: price,
        image: image,
        size: size
    };
    
    cart.items.push(item);
    updateCartUI();
    
    // Show cart
    document.getElementById('cart-sidebar').classList.add('active');
    
    // Animation feedback
    const btn = productCard.querySelector('.add-to-cart-btn');
    btn.innerHTML = '<i class="fas fa-check"></i>';
    btn.style.background = 'linear-gradient(135deg, #00ff88, #00D9C5)';
    
    setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-cart-plus"></i>';
        btn.style.background = '';
    }, 1500);
}

function removeFromCart(itemId) {
    cart.items = cart.items.filter(item => item.id !== itemId);
    updateCartUI();
}

// Add to Cart Buttons
document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const productCard = btn.closest('.product-card');
        addToCart(productCard);
    });
});

// Cart Sidebar Toggle
document.querySelector('.cart-btn')?.addEventListener('click', () => {
    document.getElementById('cart-sidebar').classList.toggle('active');
});

document.querySelector('.cart-close-btn')?.addEventListener('click', () => {
    document.getElementById('cart-sidebar').classList.remove('active');
});

// Quick View Modal (placeholder)
document.querySelectorAll('.quick-view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const productCard = btn.closest('.product-card');
        const productName = productCard.querySelector('.product-name').textContent;
        
        alert(`Quick view for: ${productName}\n\n(Full modal implementation coming soon)`);
    });
});

// Newsletter Form
document.querySelector('.newsletter-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.querySelector('.newsletter-input');
    const email = input.value;
    
    if (email) {
        alert(`Thank you for subscribing!\n\nWe'll send exclusive drops to: ${email}`);
        input.value = '';
    }
});

// Checkout Button
document.querySelector('.checkout-btn')?.addEventListener('click', () => {
    if (cart.items.length === 0) {
        alert('Your cart is empty!');
        return;
    }
    
    alert('Checkout functionality coming soon!\n\nTotal items: ' + cart.items.length);
});

// Mobile Menu Toggle
document.querySelector('.mobile-menu-toggle')?.addEventListener('click', () => {
    const navLinks = document.querySelector('.nav-links');
    navLinks.classList.toggle('active');
});

// Dropdown Menu
document.querySelectorAll('.dropdown-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
        e.preventDefault();
        const dropdown = trigger.nextElementSibling;
        dropdown.classList.toggle('active');
    });
});

// Initialize
updateCartUI();

console.log('Merch store loaded successfully');
