// Explorer Compact - Etherscan Style with Live Kaspa Data

// API Endpoints
const API_CONFIG = {
    // Primary: Own backend API
    primary: 'http://localhost:3000/api/kaspa',
    // Fallbacks: Public APIs
    fallback: {
        coingecko: 'https://api.coingecko.com/api/v3',
        kaspa: 'https://api.kaspa.org',
        explorer: 'https://explorer.kaspa.org/api'
    }
};

// Global State
let currentPrice = 0;
let latestBlocks = [];
let latestTransactions = [];
let updateTimer = 30;
let timerInterval = null;
let updateInterval = null;
let usingFallback = false;

// Initialize Explorer
async function initExplorer() {
    console.log('🚀 Initializing Kaspa Explorer (Etherscan Style)...');
    
    // Load initial data
    await fetchAllData();
    
    // Start timer animation
    startUpdateTimer();
    
    // Start automatic updates every 30 seconds
    updateInterval = setInterval(async () => {
        await fetchAllData();
        resetTimer();
    }, 30000);
}

// Start Update Timer (30s countdown with animation)
function startUpdateTimer() {
    updateTimer = 30;
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        updateTimer--;
        updateTimerDisplay();
        
        if (updateTimer <= 0) {
            updateTimer = 30;
        }
    }, 1000);
}

// Update Timer Display
function updateTimerDisplay() {
    const timerText = document.getElementById('timer-countdown');
    const timerCircle = document.getElementById('timer-circle');
    
    if (timerText) {
        timerText.textContent = updateTimer;
    }
    
    if (timerCircle) {
        // Calculate progress (0 to 100)
        const progress = ((30 - updateTimer) / 30) * 100;
        timerCircle.style.strokeDashoffset = 100 - progress;
    }
}

// Reset Timer
function resetTimer() {
    updateTimer = 30;
    updateTimerDisplay();
}

// Fetch All Data
async function fetchAllData() {
    try {
        console.log('📊 Fetching Kaspa data...');
        
        // Try primary API first
        const stats = await fetchFromPrimaryAPI();
        
        if (stats) {
            updateAllStats(stats);
            usingFallback = false;
            console.log('✅ Data loaded from primary API');
        } else {
            throw new Error('Primary API failed');
        }
        
    } catch (error) {
        console.warn('⚠️ Primary API failed, trying fallback...', error.message);
        
        // Fallback to public APIs
        try {
            const stats = await fetchFromFallbackAPIs();
            updateAllStats(stats);
            usingFallback = true;
            console.log('✅ Data loaded from fallback APIs');
        } catch (fallbackError) {
            console.error('❌ All APIs failed:', fallbackError.message);
            showError('Unable to fetch live data. Please try again later.');
        }
    }
}

// Fetch from Primary API (Own Backend)
async function fetchFromPrimaryAPI() {
    try {
        const response = await fetch(`${API_CONFIG.primary}/stats`, {
            timeout: 5000
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        return {
            price: {
                usd: data.price?.usd || 0,
                btc: data.price?.btc || 0,
                change24h: data.price?.change24h || 0,
                marketCap: data.price?.marketCap || 0
            },
            blockchain: {
                blockCount: data.blockchain?.blockCount || 0,
                difficulty: data.blockchain?.difficulty || 0,
                virtualDaaScore: data.blockchain?.virtualDaaScore || 0
            },
            cached: data.cached || false
        };
        
    } catch (error) {
        console.error('Primary API error:', error.message);
        return null;
    }
}

// Fetch from Fallback APIs
async function fetchFromFallbackAPIs() {
    const [priceData, blockchainData] = await Promise.all([
        fetchPriceFromCoinGecko(),
        fetchBlockchainFromKaspa()
    ]);
    
    return {
        price: priceData,
        blockchain: blockchainData,
        cached: false
    };
}

// Fetch Price from CoinGecko (Fallback)
async function fetchPriceFromCoinGecko() {
    try {
        const response = await fetch(
            `${API_CONFIG.fallback.coingecko}/simple/price?ids=kaspa&vs_currencies=usd,btc&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
        );
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        const kaspa = data.kaspa;
        
        return {
            usd: kaspa.usd || 0,
            btc: kaspa.btc || 0,
            change24h: kaspa.usd_24h_change || 0,
            marketCap: kaspa.usd_market_cap || 0
        };
        
    } catch (error) {
        console.error('CoinGecko error:', error.message);
        return {
            usd: 0,
            btc: 0,
            change24h: 0,
            marketCap: 0
        };
    }
}

// Fetch Blockchain Data from Kaspa API (Fallback)
async function fetchBlockchainFromKaspa() {
    try {
        const response = await fetch(`${API_CONFIG.fallback.kaspa}/info/blockdag`);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        return {
            blockCount: data.blockCount || 0,
            difficulty: data.difficulty || 0,
            virtualDaaScore: data.virtualDaaScore || 0
        };
        
    } catch (error) {
        console.error('Kaspa API error:', error.message);
        return {
            blockCount: 0,
            difficulty: 0,
            virtualDaaScore: 0
        };
    }
}

// Update All Stats on Page
function updateAllStats(stats) {
    // Price data
    if (stats.price) {
        updatePrice(stats.price);
    }
    
    // Blockchain data
    if (stats.blockchain) {
        updateBlockchain(stats.blockchain);
    }
}

// Update Price Display
function updatePrice(price) {
    currentPrice = price.usd;
    
    // KAS Price
    const priceElem = document.getElementById('kas-price-main');
    if (priceElem) {
        flashUpdate(priceElem);
        priceElem.innerHTML = `$${price.usd.toFixed(4)} <span class="btc-price">@ ${price.btc.toFixed(8)} BTC</span>`;
    }
    
    // Price Change
    const changeElem = document.getElementById('price-change');
    if (changeElem) {
        flashUpdate(changeElem);
        const change = price.change24h;
        changeElem.textContent = `(${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`;
        changeElem.className = `stat-change-eth ${change >= 0 ? 'positive' : 'negative'}`;
    }
    
    // Market Cap
    const mcapElem = document.getElementById('market-cap-main');
    if (mcapElem) {
        flashUpdate(mcapElem);
        mcapElem.textContent = `$${formatNumber(price.marketCap)}`;
    }
}

// Update Blockchain Display
function updateBlockchain(blockchain) {
    // Last Block
    const blockElem = document.getElementById('last-block-main');
    if (blockElem) {
        flashUpdate(blockElem);
        blockElem.textContent = blockchain.blockCount.toLocaleString();
    }
    
    // Hashrate (calculated from difficulty)
    const hashrateElem = document.getElementById('hashrate');
    if (hashrateElem) {
        flashUpdate(hashrateElem);
        const hashrate = calculateHashrate(blockchain.difficulty);
        hashrateElem.textContent = formatHashrate(hashrate);
    }
    
    // Transaction count (using virtualDaaScore as approximation)
    const txElem = document.getElementById('tx-count');
    if (txElem) {
        flashUpdate(txElem);
        const txCount = blockchain.virtualDaaScore || 0;
        txElem.innerHTML = `${formatNumber(txCount)} <span class="tps">(~10 TPS)</span>`;
    }
    
    // BlockDAG Size (estimated)
    const dagElem = document.getElementById('blockdag-size');
    if (dagElem) {
        flashUpdate(dagElem);
        const sizeGB = (blockchain.blockCount * 0.001).toFixed(1); // Rough estimate
        dagElem.textContent = `${sizeGB} GB`;
    }
}

// Flash Update Animation
function flashUpdate(element) {
    element.classList.add('stat-update-flash');
    setTimeout(() => {
        element.classList.remove('stat-update-flash');
    }, 500);
}

// Calculate Hashrate from Difficulty
function calculateHashrate(difficulty) {
    // Kaspa: hashrate ≈ difficulty / block_time
    // Block time ~1 second
    return difficulty || 0;
}

// Format Hashrate
function formatHashrate(hashrate) {
    if (hashrate >= 1e15) return `${(hashrate / 1e15).toFixed(1)} PH/s`;
    if (hashrate >= 1e12) return `${(hashrate / 1e12).toFixed(1)} TH/s`;
    if (hashrate >= 1e9) return `${(hashrate / 1e9).toFixed(1)} GH/s`;
    return `${hashrate.toFixed(0)} H/s`;
}

// Show Error
function showError(message) {
    console.error('❌', message);
    // Could add UI notification here
}

// Generate Initial Blocks
function generateInitialBlocks() {
    const baseBlock = 47382901;
    const blocks = [];
    
    for (let i = 0; i < 10; i++) {
        blocks.push(generateBlock(baseBlock - i, i * 1));
    }
    
    latestBlocks = blocks;
    renderBlocks();
}

// Generate Block Data
function generateBlock(blockNumber, ageSeconds) {
    const miners = [
        'quasarbuilder',
        '0x1f9090aa...8e676c326',
        'Titan Builder',
        'BuilderNet',
        'KaspaPool',
        '0x8e4f2b...d49a1c7'
    ];
    
    return {
        number: blockNumber,
        age: ageSeconds,
        miner: miners[Math.floor(Math.random() * miners.length)],
        txCount: Math.floor(Math.random() * 100) + 150,
        reward: (Math.random() * 0.005 + 0.003).toFixed(5),
        time: Math.floor(Math.random() * 3) + 10
    };
}

// Render Blocks
function renderBlocks() {
    const container = document.getElementById('blocks-list');
    if (!container) return;
    
    container.innerHTML = latestBlocks.map(block => `
        <div class="block-item">
            <div class="block-icon">
                <i class="fas fa-cube"></i>
            </div>
            <div class="block-info">
                <a href="#" class="block-number">${block.number.toLocaleString()}</a>
                <div class="block-meta">
                    <span class="block-time">${formatAge(block.age)}</span>
                </div>
            </div>
            <div class="block-details">
                <div class="block-miner">Miner ${block.miner}</div>
                <div class="block-txs">${block.txCount} txns in ${block.time} secs</div>
                <div class="block-reward">${block.reward} KAS</div>
            </div>
        </div>
    `).join('');
}

// Update Blocks
function updateBlocks() {
    // Add new block at top
    const newBlockNumber = latestBlocks[0].number + 1;
    const newBlock = generateBlock(newBlockNumber, 0);
    
    latestBlocks.unshift(newBlock);
    
    // Keep only last 10
    if (latestBlocks.length > 10) {
        latestBlocks = latestBlocks.slice(0, 10);
    }
    
    // Increment age of existing blocks
    latestBlocks.forEach((block, index) => {
        if (index > 0) {
            block.age += 5;
        }
    });
    
    renderBlocks();
}

// Generate Initial Transactions
function generateInitialTransactions() {
    const txs = [];
    
    for (let i = 0; i < 10; i++) {
        txs.push(generateTransaction(i * 1));
    }
    
    latestTransactions = txs;
    renderTransactions();
}

// Generate Transaction Data
function generateTransaction(ageSeconds) {
    return {
        hash: '0x' + generateRandomHash(40),
        age: ageSeconds,
        from: '0x' + generateRandomHash(8) + '...' + generateRandomHash(8),
        to: '0x' + generateRandomHash(8) + '...' + generateRandomHash(8),
        amount: (Math.random() * 10).toFixed(5)
    };
}

// Render Transactions
function renderTransactions() {
    const container = document.getElementById('transactions-list');
    if (!container) return;
    
    container.innerHTML = latestTransactions.map(tx => `
        <div class="tx-item">
            <div class="tx-icon">
                <i class="fas fa-file-alt"></i>
            </div>
            <div class="tx-info">
                <a href="#" class="tx-hash">${tx.hash.substring(0, 18)}...</a>
                <div class="tx-addresses">
                    <span class="tx-label">From</span>
                    <a href="#" class="tx-address">${tx.from}</a>
                    <span class="tx-arrow">→</span>
                    <span class="tx-label">To</span>
                    <a href="#" class="tx-address">${tx.to}</a>
                </div>
            </div>
            <div class="tx-time">${formatAge(tx.age)}</div>
            <div class="tx-amount">${tx.amount} KAS</div>
        </div>
    `).join('');
}

// Update Transactions
function updateTransactions() {
    // Add new transaction at top
    const newTx = generateTransaction(0);
    
    latestTransactions.unshift(newTx);
    
    // Keep only last 10
    if (latestTransactions.length > 10) {
        latestTransactions = latestTransactions.slice(0, 10);
    }
    
    // Increment age of existing transactions
    latestTransactions.forEach((tx, index) => {
        if (index > 0) {
            tx.age += 3;
        }
    });
    
    renderTransactions();
}

// Helper Functions
function generateRandomHash(length) {
    const chars = '0123456789abcdef';
    let hash = '';
    for (let i = 0; i < length; i++) {
        hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
}

function formatAge(seconds) {
    if (seconds < 60) {
        return `${Math.floor(seconds)} secs ago`;
    } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        return `${mins} min${mins > 1 ? 's' : ''} ago`;
    } else {
        const hours = Math.floor(seconds / 3600);
        return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    }
}

function formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initExplorer();
    
    // Initialize blocks and transactions (simulated for now)
    generateInitialBlocks();
    generateInitialTransactions();
    
    // Update blocks and transactions periodically
    setInterval(updateBlocks, 5000);
    setInterval(updateTransactions, 3000);
});

console.log('✅ Kaspa Explorer (Etherscan Style) loaded successfully');

// Generate Initial Blocks
function generateInitialBlocks() {
    const baseBlock = 47382901;
    const blocks = [];
    
    for (let i = 0; i < 10; i++) {
        blocks.push(generateBlock(baseBlock - i, i * 1));
    }
    
    latestBlocks = blocks;
    renderBlocks();
}

// Generate Block Data
function generateBlock(blockNumber, ageSeconds) {
    const miners = [
        'quasarbuilder',
        '0x1f9090aa...8e676c326',
        'Titan Builder',
        'BuilderNet',
        'KaspaPool',
        '0x8e4f2b...d49a1c7'
    ];
    
    return {
        number: blockNumber,
        age: ageSeconds,
        miner: miners[Math.floor(Math.random() * miners.length)],
        txCount: Math.floor(Math.random() * 100) + 150,
        reward: (Math.random() * 0.005 + 0.003).toFixed(5),
        time: Math.floor(Math.random() * 3) + 10
    };
}

// Render Blocks
function renderBlocks() {
    const container = document.getElementById('blocks-list');
    if (!container) return;
    
    container.innerHTML = latestBlocks.map(block => `
        <div class="block-item">
            <div class="block-icon">
                <i class="fas fa-cube"></i>
            </div>
            <div class="block-info">
                <a href="#" class="block-number">${block.number.toLocaleString()}</a>
                <div class="block-meta">
                    <span class="block-time">${formatAge(block.age)}</span>
                </div>
            </div>
            <div class="block-details">
                <div class="block-miner">Miner ${block.miner}</div>
                <div class="block-txs">${block.txCount} txns in ${block.time} secs</div>
                <div class="block-reward">${block.reward} KAS</div>
            </div>
        </div>
    `).join('');
}

// Update Blocks
function updateBlocks() {
    // Add new block at top
    const newBlockNumber = latestBlocks[0].number + 1;
    const newBlock = generateBlock(newBlockNumber, 0);
    
    latestBlocks.unshift(newBlock);
    
    // Keep only last 10
    if (latestBlocks.length > 10) {
        latestBlocks = latestBlocks.slice(0, 10);
    }
    
    // Increment age of existing blocks
    latestBlocks.forEach((block, index) => {
        if (index > 0) {
            block.age += 5;
        }
    });
    
    renderBlocks();
    
    // Update last block number
    const lastBlockElem = document.getElementById('last-block-main');
    if (lastBlockElem) {
        lastBlockElem.textContent = newBlockNumber.toLocaleString();
    }
}

// Generate Initial Transactions
function generateInitialTransactions() {
    const txs = [];
    
    for (let i = 0; i < 10; i++) {
        txs.push(generateTransaction(i * 1));
    }
    
    latestTransactions = txs;
    renderTransactions();
}

// Generate Transaction Data
function generateTransaction(ageSeconds) {
    return {
        hash: '0x' + generateRandomHash(40),
        age: ageSeconds,
        from: '0x' + generateRandomHash(8) + '...' + generateRandomHash(8),
        to: '0x' + generateRandomHash(8) + '...' + generateRandomHash(8),
        amount: (Math.random() * 10).toFixed(5)
    };
}

// Render Transactions
function renderTransactions() {
    const container = document.getElementById('transactions-list');
    if (!container) return;
    
    container.innerHTML = latestTransactions.map(tx => `
        <div class="tx-item">
            <div class="tx-icon">
                <i class="fas fa-file-alt"></i>
            </div>
            <div class="tx-info">
                <a href="#" class="tx-hash">${tx.hash.substring(0, 18)}...</a>
                <div class="tx-addresses">
                    <span class="tx-label">From</span>
                    <a href="#" class="tx-address">${tx.from}</a>
                    <span class="tx-arrow">→</span>
                    <span class="tx-label">To</span>
                    <a href="#" class="tx-address">${tx.to}</a>
                </div>
            </div>
            <div class="tx-time">${formatAge(tx.age)}</div>
            <div class="tx-amount">${tx.amount} KAS</div>
        </div>
    `).join('');
}

// Update Transactions
function updateTransactions() {
    // Add new transaction at top
    const newTx = generateTransaction(0);
    
    latestTransactions.unshift(newTx);
    
    // Keep only last 10
    if (latestTransactions.length > 10) {
        latestTransactions = latestTransactions.slice(0, 10);
    }
    
    // Increment age of existing transactions
    latestTransactions.forEach((tx, index) => {
        if (index > 0) {
            tx.age += 3;
        }
    });
    
    renderTransactions();
}

// Helper Functions
function generateRandomHash(length) {
    const chars = '0123456789abcdef';
    let hash = '';
    for (let i = 0; i < length; i++) {
        hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
}

function formatAge(seconds) {
    if (seconds < 60) {
        return `${Math.floor(seconds)} secs ago`;
    } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        return `${mins} min${mins > 1 ? 's' : ''} ago`;
    } else {
        const hours = Math.floor(seconds / 3600);
        return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    }
}

function formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initExplorer();
});

console.log('Kaspa Explorer (Etherscan Style) loaded successfully');
