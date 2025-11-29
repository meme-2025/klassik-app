// Explorer Compact - Etherscan Style with Live Kaspa Data

// API Endpoints
const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const KASPA_API = 'https://api.kaspa.org';

// Global State
let currentPrice = 0;
let latestBlocks = [];
let latestTransactions = [];

// Initialize Explorer
async function initExplorer() {
    console.log('Initializing Kaspa Explorer (Etherscan Style)...');
    
    // Load initial data
    await Promise.all([
        fetchKaspaPrice(),
        generateInitialBlocks(),
        generateInitialTransactions()
    ]);
    
    // Start live updates
    setInterval(fetchKaspaPrice, 30000); // Every 30 seconds
    setInterval(updateBlocks, 5000); // Every 5 seconds
    setInterval(updateTransactions, 3000); // Every 3 seconds
}

// Fetch Live Kaspa Price
async function fetchKaspaPrice() {
    try {
        const response = await fetch(`${COINGECKO_API}/simple/price?ids=kaspa&vs_currencies=usd,btc&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`);
        const data = await response.json();
        
        if (data.kaspa) {
            currentPrice = data.kaspa.usd;
            const btcPrice = data.kaspa.btc;
            const change24h = data.kaspa.usd_24h_change || 0;
            const marketCap = data.kaspa.usd_market_cap || 0;
            
            // Update price display
            const priceElem = document.getElementById('kas-price-main');
            if (priceElem) {
                priceElem.innerHTML = `$${currentPrice.toFixed(4)} <span class="btc-price">@ ${btcPrice.toFixed(5)} BTC</span>`;
            }
            
            // Update change
            const changeElem = document.querySelector('.stat-change-eth');
            if (changeElem) {
                changeElem.textContent = `(${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%)`;
                changeElem.className = `stat-change-eth ${change24h >= 0 ? 'positive' : 'negative'}`;
            }
            
            // Update market cap
            const mcapElem = document.getElementById('market-cap-main');
            if (mcapElem) {
                mcapElem.textContent = `$${formatNumber(marketCap)}`;
            }
        }
    } catch (error) {
        console.error('Error fetching Kaspa price:', error);
        currentPrice = 0.1843; // Fallback
    }
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
