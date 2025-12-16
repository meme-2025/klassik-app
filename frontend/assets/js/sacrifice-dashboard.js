/**
 * KASPAHUB SACRIFICE DASHBOARD - MAIN CONTROLLER
 * Handles core dashboard functionality, state management, and UI updates
 */

// ============================================
// STATE MANAGEMENT
// ============================================

const SacrificeState = {
    // User Data
    walletConnected: false,
    walletAddress: null,
    walletBalance: 0,
    
    // Sacrifice Data
    userSacrifices: [],
    userTotalSacrificed: 0,
    userPoints: 0,
    userRank: null,
    
    // Global Stats
    totalSacrificed: 0,
    totalParticipants: 0,
    avgSacrifice: 0,
    medianSacrifice: 0,
    
    // Sacrifice Event
    eventEndTime: new Date('2024-12-31T23:59:59').getTime(),
    
    // Selected Values
    selectedTier: null,
    sacrificeAmount: 0,
    
    // Live Data
    recentTransactions: [],
    leaderboard: []
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔥 Sacrifice Dashboard Initialized');
    
    initializeCountdown();
    initializeEventListeners();
    loadGlobalStats();
    startLiveUpdates();
    initializeAnimations();
    
    // Check for existing wallet connection
    checkWalletConnection();
});

// ============================================
// COUNTDOWN TIMER
// ============================================

function initializeCountdown() {
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

function updateCountdown() {
    const now = new Date().getTime();
    const distance = SacrificeState.eventEndTime - now;
    
    if (distance < 0) {
        document.getElementById('countdownDisplay').innerHTML = '<div class="countdown-ended">EVENT ENDED</div>';
        return;
    }
    
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    
    document.getElementById('days').textContent = String(days).padStart(2, '0');
    document.getElementById('hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
}

// ============================================
// EVENT LISTENERS
// ============================================

function initializeEventListeners() {
    // Wallet Connection
    document.getElementById('connectWalletBtn')?.addEventListener('click', connectWallet);
    document.getElementById('connectWalletBtnMain')?.addEventListener('click', connectWallet);
    document.getElementById('disconnectBtn')?.addEventListener('click', disconnectWallet);
    document.getElementById('copyAddressBtn')?.addEventListener('click', copyAddress);
    
    // Tier Selection
    document.querySelectorAll('.tier-card').forEach(card => {
        card.addEventListener('click', () => selectTier(card));
    });
    
    // Amount Input
    const amountInput = document.getElementById('sacrificeAmountInput');
    amountInput?.addEventListener('input', updateCalculation);
    
    // Quick Amount Buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
        if (btn.id === 'maxBtn') {
            btn.addEventListener('click', setMaxAmount);
        } else {
            btn.addEventListener('click', () => {
                const amount = parseInt(btn.dataset.amount);
                amountInput.value = amount;
                updateCalculation();
            });
        }
    });
    
    // Sacrifice Button
    document.getElementById('executeSacrificeBtn')?.addEventListener('click', executeSacrifice);
    
    // Refresh Button
    document.getElementById('refreshHistoryBtn')?.addEventListener('click', loadUserHistory);
    
    // Pagination
    document.getElementById('prevPage')?.addEventListener('click', () => changePage(-1));
    document.getElementById('nextPage')?.addEventListener('click', () => changePage(1));
    
    // Chart Controls
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateCharts(btn.dataset.range);
        });
    });
    
    // Modal Close
    document.getElementById('closeModalBtn')?.addEventListener('click', () => {
        document.getElementById('successModal').classList.remove('active');
        window.location.hash = '#leaderboard';
    });
}

// ============================================
// WALLET INTEGRATION
// ============================================

async function connectWallet() {
    try {
        showToast('Connecting to wallet...', 'info');
        
        // Simulate wallet connection (Replace with actual Kaspa wallet integration)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock wallet data
        const mockAddress = 'kaspa:qz7k8x9p2m3n4b5v6c7d8e9f0g1h2i3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8y9z0a1b2c3d4';
        const mockBalance = 150000;
        
        SacrificeState.walletConnected = true;
        SacrificeState.walletAddress = mockAddress;
        SacrificeState.walletBalance = mockBalance;
        
        updateWalletUI();
        loadUserHistory();
        
        showToast('Wallet connected successfully! 🎉', 'success');
        
    } catch (error) {
        console.error('Wallet connection error:', error);
        showToast('Failed to connect wallet. Please try again.', 'error');
    }
}

function disconnectWallet() {
    SacrificeState.walletConnected = false;
    SacrificeState.walletAddress = null;
    SacrificeState.walletBalance = 0;
    
    document.getElementById('walletConnectState').style.display = 'block';
    document.getElementById('sacrificeForm').style.display = 'none';
    
    showToast('Wallet disconnected', 'info');
}

function updateWalletUI() {
    const connectState = document.getElementById('walletConnectState');
    const sacrificeForm = document.getElementById('sacrificeForm');
    
    connectState.style.display = 'none';
    sacrificeForm.style.display = 'block';
    
    // Update wallet info
    const shortAddress = `${SacrificeState.walletAddress.substring(0, 10)}...${SacrificeState.walletAddress.substring(SacrificeState.walletAddress.length - 6)}`;
    document.getElementById('connectedAddress').textContent = shortAddress;
    document.getElementById('walletBalance').textContent = `${SacrificeState.walletBalance.toLocaleString()} KAS`;
    
    // Update user stats
    updateUserStats();
}

function copyAddress() {
    navigator.clipboard.writeText(SacrificeState.walletAddress);
    showToast('Address copied to clipboard!', 'success');
}

async function checkWalletConnection() {
    // Check if wallet was previously connected
    // This would integrate with actual Kaspa wallet extensions
    console.log('Checking for existing wallet connection...');
}

// ============================================
// TIER SELECTION
// ============================================

function selectTier(card) {
    // Remove previous selection
    document.querySelectorAll('.tier-card').forEach(c => c.classList.remove('selected'));
    
    // Select new tier
    card.classList.add('selected');
    
    SacrificeState.selectedTier = {
        name: card.dataset.tier,
        min: parseInt(card.dataset.min),
        max: parseInt(card.dataset.max),
        bonus: parseInt(card.dataset.bonus)
    };
    
    updateCalculation();
}

function getTierForAmount(amount) {
    if (amount >= 100000) return { name: 'diamond', bonus: 100, points: 5000 };
    if (amount >= 50000) return { name: 'gold', bonus: 75, points: 4375 };
    if (amount >= 10000) return { name: 'silver', bonus: 50, points: 3750 };
    if (amount >= 1000) return { name: 'bronze', bonus: 25, points: 2500 };
    return null;
}

// ============================================
// CALCULATION & PREVIEW
// ============================================

function updateCalculation() {
    const amountInput = document.getElementById('sacrificeAmountInput');
    const amount = parseFloat(amountInput.value) || 0;
    
    SacrificeState.sacrificeAmount = amount;
    
    if (amount < 1000) {
        clearPreview();
        return;
    }
    
    const tier = getTierForAmount(amount);
    if (!tier) {
        clearPreview();
        return;
    }
    
    // Auto-select tier based on amount
    const tierCard = document.querySelector(`[data-tier="${tier.name}"]`);
    if (tierCard) {
        document.querySelectorAll('.tier-card').forEach(c => c.classList.remove('selected'));
        tierCard.classList.add('selected');
        SacrificeState.selectedTier = tier;
    }
    
    // Calculate points
    const basePoints = (amount / 1000) * tier.points;
    const bonusMultiplier = 1 + (tier.bonus / 100);
    const totalPoints = Math.floor(basePoints * bonusMultiplier);
    
    // Estimate tokens (1 point = 10 KHUB tokens as example)
    const estimatedTokens = totalPoints * 10;
    
    // Calculate potential rank
    const potentialRank = calculatePotentialRank(SacrificeState.userPoints + totalPoints);
    
    // Update preview
    document.getElementById('previewAmount').textContent = `${amount.toLocaleString()} KAS`;
    document.getElementById('previewTier').textContent = tier.name.toUpperCase();
    document.getElementById('previewBonus').textContent = `+${tier.bonus}%`;
    document.getElementById('previewPoints').textContent = totalPoints.toLocaleString();
    document.getElementById('previewTokens').textContent = `${estimatedTokens.toLocaleString()} KHUB`;
    document.getElementById('previewRank').textContent = `#${potentialRank}`;
}

function clearPreview() {
    document.getElementById('previewAmount').textContent = '0 KAS';
    document.getElementById('previewTier').textContent = '-';
    document.getElementById('previewBonus').textContent = '+0%';
    document.getElementById('previewPoints').textContent = '0';
    document.getElementById('previewTokens').textContent = '0 KHUB';
    document.getElementById('previewRank').textContent = '#-';
}

function calculatePotentialRank(points) {
    // Simulate rank calculation based on current leaderboard
    let rank = 1;
    for (const entry of SacrificeState.leaderboard) {
        if (entry.points > points) rank++;
    }
    return rank;
}

function setMaxAmount() {
    const maxAmount = SacrificeState.walletBalance;
    document.getElementById('sacrificeAmountInput').value = maxAmount;
    updateCalculation();
}

// ============================================
// SACRIFICE EXECUTION
// ============================================

async function executeSacrifice() {
    const amount = SacrificeState.sacrificeAmount;
    
    // Validation
    if (!SacrificeState.walletConnected) {
        showToast('Please connect your wallet first', 'error');
        return;
    }
    
    if (amount < 1000) {
        showToast('Minimum sacrifice is 1,000 KAS', 'error');
        return;
    }
    
    if (amount > SacrificeState.walletBalance) {
        showToast('Insufficient balance', 'error');
        return;
    }
    
    if (!SacrificeState.selectedTier) {
        showToast('Please select a tier', 'error');
        return;
    }
    
    try {
        // Disable button
        const btn = document.getElementById('executeSacrificeBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        showToast('Processing sacrifice transaction...', 'info');
        
        // Simulate transaction (Replace with actual Kaspa transaction)
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Update state
        const tier = getTierForAmount(amount);
        const points = Math.floor((amount / 1000) * tier.points * (1 + tier.bonus / 100));
        
        SacrificeState.userTotalSacrificed += amount;
        SacrificeState.userPoints += points;
        SacrificeState.walletBalance -= amount;
        
        // Add to history
        const sacrifice = {
            timestamp: Date.now(),
            amount: amount,
            tier: tier.name,
            points: points,
            txHash: generateMockTxHash()
        };
        SacrificeState.userSacrifices.push(sacrifice);
        
        // Update global stats
        SacrificeState.totalSacrificed += amount;
        SacrificeState.totalParticipants = Math.max(SacrificeState.totalParticipants, SacrificeState.leaderboard.length + 1);
        
        // Update UI
        updateWalletUI();
        updateGlobalStats();
        loadUserHistory();
        addToLiveFeed(sacrifice);
        
        // Show success modal
        showSuccessModal(sacrifice);
        
        // Reset form
        document.getElementById('sacrificeAmountInput').value = '';
        clearPreview();
        
        showToast('Sacrifice successful! 🎉', 'success');
        
        // Re-enable button
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon"><i class="fas fa-fire-alt"></i></span><span class="btn-text">Execute Sacrifice</span><span class="btn-shine"></span>';
        
    } catch (error) {
        console.error('Sacrifice error:', error);
        showToast('Transaction failed. Please try again.', 'error');
        
        // Re-enable button
        const btn = document.getElementById('executeSacrificeBtn');
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon"><i class="fas fa-fire-alt"></i></span><span class="btn-text">Execute Sacrifice</span><span class="btn-shine"></span>';
    }
}

function generateMockTxHash() {
    return 'tx_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function showSuccessModal(sacrifice) {
    const modal = document.getElementById('successModal');
    const details = document.getElementById('successDetails');
    
    details.innerHTML = `
        <div class="success-details-grid">
            <div class="detail-item">
                <span class="detail-label">Amount:</span>
                <span class="detail-value">${sacrifice.amount.toLocaleString()} KAS</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Points Earned:</span>
                <span class="detail-value highlight-green">+${sacrifice.points.toLocaleString()}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Tier:</span>
                <span class="detail-value">${sacrifice.tier.toUpperCase()}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Total Points:</span>
                <span class="detail-value">${SacrificeState.userPoints.toLocaleString()}</span>
            </div>
        </div>
    `;
    
    modal.classList.add('active');
}

// ============================================
// GLOBAL STATS
// ============================================

async function loadGlobalStats() {
    try {
        // Simulate API call (Replace with actual backend integration)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mock data
        SacrificeState.totalSacrificed = 2847350;
        SacrificeState.totalParticipants = 486;
        SacrificeState.avgSacrifice = 5857;
        SacrificeState.medianSacrifice = 3200;
        
        updateGlobalStats();
        
    } catch (error) {
        console.error('Error loading global stats:', error);
    }
}

function updateGlobalStats() {
    // Animate counters
    animateCounter('totalSacrificed', SacrificeState.totalSacrificed);
    animateCounter('totalParticipants', SacrificeState.totalParticipants);
    animateCounter('avgSacrifice', SacrificeState.avgSacrifice);
    
    document.getElementById('medianSacrifice').textContent = SacrificeState.medianSacrifice.toLocaleString();
    
    // Update 24h trends (mock data)
    document.getElementById('sacrifice24h').textContent = '12.5';
    document.getElementById('participants24h').textContent = '23';
}

function updateUserStats() {
    document.getElementById('userTotalSacrificed').textContent = `${SacrificeState.userTotalSacrificed.toLocaleString()} KAS`;
    document.getElementById('yourPoints').querySelector('.counter').textContent = SacrificeState.userPoints.toLocaleString();
    
    // Calculate rank
    const rank = calculatePotentialRank(SacrificeState.userPoints);
    document.getElementById('yourRank').textContent = `#${rank}`;
}

// ============================================
// LIVE UPDATES
// ============================================

function startLiveUpdates() {
    // Update live feed every 5 seconds
    setInterval(updateLiveFeed, 5000);
    
    // Initial load
    updateLiveFeed();
}

function updateLiveFeed() {
    // Simulate new transaction
    const mockTx = {
        address: generateMockAddress(),
        amount: Math.floor(Math.random() * 50000) + 1000,
        timestamp: Date.now()
    };
    
    addToLiveFeed(mockTx);
}

function addToLiveFeed(tx) {
    const feed = document.getElementById('liveTransactionsFeed');
    
    const shortAddress = `${tx.address || generateMockAddress()}`.substring(0, 15) + '...';
    const timeAgo = getTimeAgo(tx.timestamp);
    
    const feedItem = document.createElement('div');
    feedItem.className = 'feed-item glass-mini';
    feedItem.innerHTML = `
        <div class="feed-icon">
            <i class="fas fa-fire"></i>
        </div>
        <div class="feed-content">
            <div class="feed-address">${shortAddress}</div>
            <div class="feed-amount">+${tx.amount.toLocaleString()} KAS</div>
        </div>
        <div class="feed-time">${timeAgo}</div>
    `;
    
    // Add to top of feed
    feed.insertBefore(feedItem, feed.firstChild);
    
    // Keep only last 10 items
    while (feed.children.length > 10) {
        feed.removeChild(feed.lastChild);
    }
    
    // Animate in
    feedItem.style.animation = 'slide-in-right 0.3s ease';
}

function generateMockAddress() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let address = 'kaspa:qz';
    for (let i = 0; i < 50; i++) {
        address += chars[Math.floor(Math.random() * chars.length)];
    }
    return address;
}

function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

// ============================================
// USER HISTORY
// ============================================

async function loadUserHistory() {
    const historyList = document.getElementById('userHistoryList');
    
    if (SacrificeState.userSacrifices.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No sacrifices yet. Be the first!</p>
            </div>
        `;
        return;
    }
    
    historyList.innerHTML = '';
    
    SacrificeState.userSacrifices.reverse().forEach(sacrifice => {
        const item = document.createElement('div');
        item.className = 'feed-item glass-mini';
        item.innerHTML = `
            <div class="feed-icon">
                <i class="fas fa-fire"></i>
            </div>
            <div class="feed-content">
                <div class="feed-amount">${sacrifice.amount.toLocaleString()} KAS</div>
                <div class="feed-address">+${sacrifice.points.toLocaleString()} points • ${sacrifice.tier.toUpperCase()}</div>
            </div>
            <div class="feed-time">${getTimeAgo(sacrifice.timestamp)}</div>
        `;
        historyList.appendChild(item);
    });
}

// ============================================
// ANIMATIONS
// ============================================

function initializeAnimations() {
    // Initialize particles
    if (typeof particlesJS !== 'undefined') {
        particlesJS('particles-sacrifice', {
            particles: {
                number: { value: 80, density: { enable: true, value_area: 800 } },
                color: { value: '#49D9D9' },
                shape: { type: 'circle' },
                opacity: { value: 0.5, random: true },
                size: { value: 3, random: true },
                line_linked: { enable: true, distance: 150, color: '#49D9D9', opacity: 0.2, width: 1 },
                move: { enable: true, speed: 2, direction: 'none', random: true, out_mode: 'out' }
            },
            interactivity: {
                detect_on: 'canvas',
                events: { onhover: { enable: true, mode: 'repulse' }, onclick: { enable: true, mode: 'push' } },
                modes: { repulse: { distance: 100 }, push: { particles_nb: 4 } }
            }
        });
    }
    
    // Initialize neural network canvas
    initializeNeuralNetwork();
    
    // Scroll reveal animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.scroll-reveal').forEach(el => {
        observer.observe(el);
    });
}

function initializeNeuralNetwork() {
    const canvas = document.getElementById('neural-network');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const nodes = [];
    const nodeCount = 50;
    
    // Create nodes
    for (let i = 0; i < nodeCount; i++) {
        nodes.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5
        });
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Update and draw nodes
        nodes.forEach(node => {
            node.x += node.vx;
            node.y += node.vy;
            
            if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
            if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
            
            // Draw connections
            nodes.forEach(otherNode => {
                const dx = node.x - otherNode.x;
                const dy = node.y - otherNode.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 150) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(73, 217, 217, ${0.2 * (1 - distance / 150)})`;
                    ctx.lineWidth = 1;
                    ctx.moveTo(node.x, node.y);
                    ctx.lineTo(otherNode.x, otherNode.y);
                    ctx.stroke();
                }
            });
        });
        
        requestAnimationFrame(animate);
    }
    
    animate();
    
    // Resize handler
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const counterElement = element.querySelector('.counter');
    if (!counterElement) return;
    
    const duration = 2000;
    const steps = 60;
    const increment = targetValue / steps;
    let current = 0;
    let step = 0;
    
    const timer = setInterval(() => {
        current += increment;
        step++;
        
        counterElement.textContent = Math.floor(current).toLocaleString();
        
        if (step >= steps) {
            counterElement.textContent = targetValue.toLocaleString();
            clearInterval(timer);
        }
    }, duration / steps);
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${iconMap[type]}"></i>
        <div>
            <strong>${type.toUpperCase()}</strong>
            <p>${message}</p>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slide-out-right 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ============================================
// PAGINATION
// ============================================

let currentPage = 1;
const itemsPerPage = 20;

function changePage(direction) {
    const totalPages = Math.ceil(SacrificeState.leaderboard.length / itemsPerPage);
    currentPage = Math.max(1, Math.min(currentPage + direction, totalPages));
    
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages;
    
    loadLeaderboardPage(currentPage);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatKAS(amount) {
    return `${amount.toLocaleString()} KAS`;
}

function formatNumber(num) {
    return num.toLocaleString();
}

function shortenAddress(address) {
    if (!address) return '...';
    return `${address.substring(0, 10)}...${address.substring(address.length - 6)}`;
}

// ============================================
// EXPORT FOR OTHER MODULES
// ============================================

window.SacrificeState = SacrificeState;
window.showToast = showToast;
window.updateGlobalStats = updateGlobalStats;
