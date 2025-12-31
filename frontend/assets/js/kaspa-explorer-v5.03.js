/**
 * ============================================
 * KLASSIK KASPA EXPLORER V5.03
 * Vollständige Integration mit kaspa-rest-server API
 * ============================================
 */

// ✅ API Configuration
const API_CONFIG = {
    base: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : 'https://klassik.99pace.space',
    endpoints: {
        stats: '/api/kaspa-enhanced/stats',
        blocks: '/api/kaspa-enhanced/blocks/latest',
        transactions: '/api/kaspa-enhanced/transactions/latest',
        mempool: '/api/kaspa-enhanced/mempool',
        address: '/api/kaspa-enhanced/address',
        txCount: '/api/kaspa-enhanced/transactions/count',
        feeEstimate: '/api/kaspa-enhanced/fee-estimate'
    },
    refreshInterval: 30000, // 30 Sekunden
    blockLimit: 10,
    txLimit: 10
};

// State Management
const state = {
    stats: null,
    blocks: [],
    transactions: [],
    lastUpdate: null,
    refreshTimer: null,
    countdownTimer: null,
    countdown: 30
};

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Fetch network stats from backend
 */
async function fetchStats() {
    try {
        console.log('📊 Fetching Kaspa stats...');
        const response = await fetch(`${API_CONFIG.base}${API_CONFIG.endpoints.stats}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        state.stats = data;
        state.lastUpdate = new Date();
        
        console.log('✅ Stats fetched:', data);
        return data;
    } catch (error) {
        console.error('❌ Failed to fetch stats:', error);
        showError('Failed to load network statistics');
        return null;
    }
}

/**
 * Fetch latest blocks
 */
async function fetchBlocks(limit = API_CONFIG.blockLimit) {
    try {
        console.log('🔷 Fetching latest blocks...');
        const response = await fetch(`${API_CONFIG.base}${API_CONFIG.endpoints.blocks}?limit=${limit}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        state.blocks = data.blocks || [];
        
        console.log(`✅ Fetched ${state.blocks.length} blocks`);
        return state.blocks;
    } catch (error) {
        console.error('❌ Failed to fetch blocks:', error);
        return [];
    }
}

/**
 * Fetch latest transactions
 */
async function fetchTransactions(limit = API_CONFIG.txLimit) {
    try {
        console.log('💸 Fetching latest transactions...');
        const response = await fetch(`${API_CONFIG.base}${API_CONFIG.endpoints.transactions}?limit=${limit}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        state.transactions = data.transactions || [];
        
        console.log(`✅ Fetched ${state.transactions.length} transactions`);
        return state.transactions;
    } catch (error) {
        console.error('❌ Failed to fetch transactions:', error);
        return [];
    }
}

/**
 * Fetch 24h transaction count
 */
async function fetchTxCount() {
    try {
        const response = await fetch(`${API_CONFIG.base}${API_CONFIG.endpoints.txCount}`);
        if (!response.ok) return null;
        
        const data = await response.json();
        return data.count || 0;
    } catch (error) {
        console.error('❌ Failed to fetch tx count:', error);
        return null;
    }
}

// ============================================
// UI UPDATE FUNCTIONS
// ============================================

/**
 * Update all statistics in the header stats bars
 */
function updateStats(stats) {
    if (!stats) return;
    
    console.log('📊 Updating stats UI with:', stats);
    
    // LEFT STATS BAR (First 6 metrics)
    updateStatElement('price-stat', stats.price, (val) => formatPrice(val));
    updateStatElement('price-change-24h', stats.priceChange24h || 0, (val) => formatPercentage(val));
    
    updateStatElement('mcap-stat', stats.marketCap, (val) => formatMarketCap(val));
    updateStatElement('total-txs-stat', stats.transactions24h || 216000, (val) => formatNumber(val));
    updateStatElement('hashrate-stat', stats.hashrate, (val) => formatHashrate(val));
    updateStatElement('difficulty-stat', stats.difficulty, (val) => formatDifficulty(val));
    updateStatElement('block-reward-stat', stats.blockReward, (val) => `${formatNumber(val)} KAS`);
    updateStatElement('block-height-stat', stats.blockHeight, (val) => formatNumber(val));
    
    // RIGHT STATS BAR (Next 7 metrics) - mit "-2" suffix
    updateStatElement('price-stat-2', stats.price, (val) => formatPrice(val));
    updateStatElement('price-change-24h-2', stats.priceChange24h || 0, (val) => formatPercentage(val));
    updateStatElement('mcap-stat-2', stats.marketCap, (val) => formatMarketCap(val));
    updateStatElement('total-txs-stat-2', stats.transactions24h || 216000, (val) => formatNumber(val));
    updateStatElement('hashrate-stat-2', stats.hashrate, (val) => formatHashrate(val));
    updateStatElement('difficulty-stat-2', stats.difficulty, (val) => formatDifficulty(val));
    updateStatElement('block-reward-stat-2', stats.blockReward, (val) => `${formatNumber(val)} KAS`);
    
    // Additional metrics for extended stats
    updateStatElement('total-supply-stat', stats.totalSupply, (val) => `${formatLargeNumber(val)} KAS`);
    updateStatElement('mineable-remaining-stat', stats.mineableRemaining, (val) => `${formatLargeNumber(val)} KAS`);
    updateStatElement('avg-blocktime-stat', stats.avgBlockTime || 1.0, (val) => `${val.toFixed(2)}s`);
    
    // Miner Rewards (24h) = Block Reward * Blocks per day
    const blocksPerDay = 86400; // 1 block/second * 86400 seconds
    const minerRewards24h = stats.blockReward ? stats.blockReward * blocksPerDay : 0;
    updateStatElement('miner-rewards-stat', minerRewards24h, (val) => `${formatLargeNumber(val)} KAS`);
    
    updateStatElement('daily-tx-stat', stats.transactions24h || 216000, (val) => formatNumber(val));
    updateStatElement('total-blocks-stat', stats.blockHeight, (val) => formatNumber(val));
    updateStatElement('daily-transactions-stat', stats.transactions24h || 216000, (val) => formatNumber(val));
    
    // Update page title with price
    if (stats.price) {
        document.title = `$${stats.price.toFixed(4)} | Kaspa Explorer`;
    }
}

/**
 * Helper: Update a stat element
 */
function updateStatElement(id, value, formatter) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`⚠️ Element not found: ${id}`);
        return;
    }
    
    if (value === null || value === undefined) {
        element.textContent = 'N/A';
        return;
    }
    
    const formatted = formatter ? formatter(value) : value;
    element.textContent = formatted;
    
    // Add animation class
    element.classList.add('updated');
    setTimeout(() => element.classList.remove('updated'), 500);
}

/**
 * Update blocks table
 */
function updateBlocksTable(blocks) {
    const tbody = document.getElementById('latest-blocks');
    if (!tbody) return;
    
    if (!blocks || blocks.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="loading-cell">
                    <i class="fas fa-exclamation-triangle"></i> No blocks available
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = blocks.map(block => `
        <tr>
            <td>
                <a href="kaspa-block.html?hash=${block.blockHash || block.hash}" class="hash-link">
                    ${truncateHash(block.blockHash || block.hash)}
                </a>
            </td>
            <td>${formatTimestamp(block.timestamp)}</td>
            <td>${block.transactionCount || block.txCount || 0}</td>
            <td>${formatSize(block.size || 0)}</td>
            <td>${formatNumber(block.blueScore || 0)}</td>
        </tr>
    `).join('');
}

/**
 * Update transactions table
 */
function updateTransactionsTable(transactions) {
    const tbody = document.getElementById('latest-transactions');
    if (!tbody) return;
    
    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="loading-cell">
                    <i class="fas fa-exclamation-triangle"></i> No transactions available
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = transactions.map(tx => `
        <tr>
            <td>
                <a href="kaspa-transaction.html?id=${tx.transactionId || tx.hash}" class="hash-link">
                    ${truncateHash(tx.transactionId || tx.hash)}
                </a>
            </td>
            <td>${formatTimestamp(tx.blockTime || tx.timestamp)}</td>
            <td>
                ${tx.inputs ? tx.inputs.length : 0} → ${tx.outputs ? tx.outputs.length : 0}
            </td>
            <td>${formatAmount(calculateTxAmount(tx))}</td>
            <td>${formatSize(tx.mass || 0)}</td>
        </tr>
    `).join('');
}

/**
 * Calculate total transaction amount
 */
function calculateTxAmount(tx) {
    if (!tx.outputs) return 0;
    
    return tx.outputs.reduce((sum, output) => {
        const amount = parseFloat(output.amount || output.value || 0);
        return sum + amount;
    }, 0);
}

// ============================================
// FORMATTING FUNCTIONS
// ============================================

function formatPrice(price) {
    if (!price) return '$0.0000';
    return `$${price.toFixed(4)}`;
}

function formatPercentage(value) {
    if (!value && value !== 0) return 'N/A';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
}

function formatMarketCap(marketCap) {
    if (!marketCap) return 'N/A';
    
    if (marketCap >= 1e9) {
        return `$${(marketCap / 1e9).toFixed(2)}B`;
    } else if (marketCap >= 1e6) {
        return `$${(marketCap / 1e6).toFixed(2)}M`;
    }
    return `$${formatNumber(marketCap)}`;
}

function formatHashrate(hashrate) {
    if (!hashrate) return 'N/A';
    
    // Convert to PH/s (Petahashes per second)
    const ph = hashrate / 1e15;
    
    if (ph >= 1000) {
        return `${(ph / 1000).toFixed(2)} EH/s`;
    } else if (ph >= 1) {
        return `${ph.toFixed(2)} PH/s`;
    } else {
        return `${(ph * 1000).toFixed(2)} TH/s`;
    }
}

function formatDifficulty(difficulty) {
    if (!difficulty) return 'N/A';
    
    if (difficulty >= 1e15) {
        return `${(difficulty / 1e15).toFixed(2)}P`;
    } else if (difficulty >= 1e12) {
        return `${(difficulty / 1e12).toFixed(2)}T`;
    } else if (difficulty >= 1e9) {
        return `${(difficulty / 1e9).toFixed(2)}B`;
    }
    return formatNumber(difficulty);
}

function formatNumber(num) {
    if (!num && num !== 0) return 'N/A';
    return num.toLocaleString('en-US');
}

function formatLargeNumber(num) {
    if (!num && num !== 0) return 'N/A';
    
    if (num >= 1e9) {
        return `${(num / 1e9).toFixed(2)}B`;
    } else if (num >= 1e6) {
        return `${(num / 1e6).toFixed(2)}M`;
    }
    return formatNumber(num);
}

function formatAmount(amount) {
    if (!amount && amount !== 0) return '0 KAS';
    return `${formatNumber(amount.toFixed(2))} KAS`;
}

function formatSize(bytes) {
    if (!bytes) return '0 B';
    
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else if (bytes >= 1024) {
        return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${bytes} B`;
}

function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds
    
    if (diff < 60) {
        return `${diff}s ago`;
    } else if (diff < 3600) {
        return `${Math.floor(diff / 60)}m ago`;
    } else if (diff < 86400) {
        return `${Math.floor(diff / 3600)}h ago`;
    } else {
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

function truncateHash(hash, start = 8, end = 8) {
    if (!hash) return 'N/A';
    if (hash.length <= start + end) return hash;
    return `${hash.substring(0, start)}...${hash.substring(hash.length - end)}`;
}

// ============================================
// REFRESH & TIMER
// ============================================

/**
 * Refresh all data
 */
async function refreshData() {
    console.log('🔄 Refreshing all data...');
    
    try {
        // Fetch all data in parallel
        const [stats, blocks, transactions] = await Promise.all([
            fetchStats(),
            fetchBlocks(),
            fetchTransactions()
        ]);
        
        // Update UI
        if (stats) {
            updateStats(stats);
        }
        
        if (blocks && blocks.length > 0) {
            updateBlocksTable(blocks);
        }
        
        if (transactions && transactions.length > 0) {
            updateTransactionsTable(transactions);
        }
        
        // Update last refresh time
        updateLastRefreshTime();
        
        console.log('✅ Data refresh complete');
        
        // Reset countdown
        state.countdown = 30;
        updateCountdownDisplay();
        
    } catch (error) {
        console.error('❌ Refresh failed:', error);
        showError('Failed to refresh data');
    }
}

/**
 * Start auto-refresh timer
 */
function startAutoRefresh() {
    // Clear existing timers
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    if (state.countdownTimer) clearInterval(state.countdownTimer);
    
    // Initial load
    refreshData();
    
    // Countdown timer (every second)
    state.countdownTimer = setInterval(() => {
        state.countdown--;
        
        if (state.countdown <= 0) {
            state.countdown = 30;
        }
        
        updateCountdownDisplay();
    }, 1000);
    
    // Refresh timer (every 30 seconds)
    state.refreshTimer = setInterval(() => {
        refreshData();
    }, API_CONFIG.refreshInterval);
    
    console.log('⏰ Auto-refresh started (30s interval)');
}

/**
 * Update countdown display
 */
function updateCountdownDisplay() {
    const timerText = document.getElementById('timer-text');
    const timerProgress = document.getElementById('timer-progress');
    
    if (timerText) {
        timerText.textContent = state.countdown;
    }
    
    if (timerProgress) {
        const percentage = (state.countdown / 30) * 100;
        timerProgress.setAttribute('stroke-dasharray', `${percentage}, 100`);
    }
}

/**
 * Update last refresh time display
 */
function updateLastRefreshTime() {
    const lastUpdateElement = document.getElementById('last-update');
    if (lastUpdateElement && state.lastUpdate) {
        lastUpdateElement.textContent = `Last update: ${state.lastUpdate.toLocaleTimeString()}`;
    }
}

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

function initializeSearch() {
    const searchInput = document.getElementById('main-search');
    const searchBtn = document.getElementById('header-search-btn');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
}

function performSearch() {
    const searchInput = document.getElementById('main-search');
    if (!searchInput) return;
    
    const query = searchInput.value.trim();
    if (!query) {
        showError('Please enter a search query');
        return;
    }
    
    // Detect search type
    if (query.startsWith('kaspa:')) {
        // Address search
        window.location.href = `kaspa-address.html?address=${query}`;
    } else if (query.length === 64) {
        // Transaction or block hash
        window.location.href = `kaspa-transaction.html?id=${query}`;
    } else if (/^\d+$/.test(query)) {
        // Block number
        window.location.href = `kaspa-block.html?height=${query}`;
    } else {
        showError('Invalid search query. Enter a Kaspa address, transaction hash, or block number.');
    }
}

// ============================================
// UI HELPERS
// ============================================

function showError(message) {
    console.error('❌', message);
    
    // You can implement a toast notification here
    alert(message);
}

function showSuccess(message) {
    console.log('✅', message);
    
    // You can implement a toast notification here
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Kaspa Explorer V5.03 Initializing...');
    
    // Initialize search
    initializeSearch();
    
    // Start auto-refresh
    startAutoRefresh();
    
    console.log('✅ Kaspa Explorer V5.03 Ready');
});

// Export for use in other scripts
window.KaspaExplorer = {
    refreshData,
    fetchStats,
    fetchBlocks,
    fetchTransactions,
    state
};
