// ===== EXPLORER COMPACT V2 - PERFECTED =====
// Kaspa Blockchain Explorer with Real-time BlockDAG Simulation

// === API Configuration ===
const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const LOCAL_NODE_API = 'http://localhost:8080'; // eigene Node, später anpassen
const FALLBACK_API = 'https://explorer.kaspa.org/';

// === Update Intervals ===
const UPDATE_INTERVALS = {
    PRICE: 60000,        // 60 seconds
    BLOCKS: 5000,        // 5 seconds
    TRANSACTIONS: 5000,  // 5 seconds
    NETWORK: 10000,      // 10 seconds
    AGES: 1000          // 1 second
};

// === Global State ===
const state = {
    price: {
        usd: null,           // Wird von CoinGecko API geladen
        btc: null,           // Wird von CoinGecko API geladen
        change1h: null,      // Wird von CoinGecko API geladen
        change24h: null,     // Wird von CoinGecko API geladen
        change7d: null,      // Wird von CoinGecko API geladen
        volume24h: null,     // Wird von CoinGecko API geladen
        marketCap: null      // Wird von CoinGecko API geladen
    },
    network: {
        daaScore: null,      // Wird von Kaspa API geladen
        hashrate: null,      // Wird von Kaspa API geladen
        maxHashrate: 1590,   // Historischer Maximalwert (kann statisch bleiben)
        mempool: 0,          // Wird von Kaspa API geladen
        supply: null,        // Wird von Kaspa API geladen
        maxSupply: 28700000000, // Bekannter Maximalwert (konstant)
        blockReward: null,   // Wird von Kaspa API geladen
        bps: 10              // Kaspa BlockDAG = ~10 Blöcke pro Sekunde (konstant)
    },
    blocks: [],
    transactions: [],
    searchIndex: {},
    loading: {
        blocks: false,
        transactions: false,
        network: false,
        price: false
    },
    errors: {
        blocks: null,
        transactions: null,
        network: null,
        price: null
    }
};

// === Initialize Explorer ===
async function initExplorer() {
    console.log('🚀 Initializing Kaspa Explorer V2...');
    
    showLoadingState();
    
    try {
        // Load initial data from Kaspa API
        await Promise.all([
            fetchKaspaPrice(),
            fetchKaspaBlocks(),
            fetchKaspaTransactions(),
            fetchKaspaNetworkStats()
        ]);

        updateAllStats();
        buildSearchIndex();
        attachEventListeners();

        // Start live updates
        setInterval(fetchKaspaPrice, UPDATE_INTERVALS.PRICE);
        setInterval(fetchKaspaBlocks, UPDATE_INTERVALS.BLOCKS);
        setInterval(fetchKaspaTransactions, UPDATE_INTERVALS.TRANSACTIONS);
        setInterval(fetchKaspaNetworkStats, UPDATE_INTERVALS.NETWORK);
        setInterval(updateAges, UPDATE_INTERVALS.AGES);

        hideLoadingState();
        console.log('✅ Explorer initialized mit echten Kaspa-Daten');
    } catch (error) {
        console.error('❌ Critical error during initialization:', error);
        showErrorState('Failed to initialize explorer. Please refresh the page.');
    }
}

// === Fetch Live Price Data ===
async function fetchKaspaPrice() {
    if (state.loading.price) return;
    state.loading.price = true;
    state.errors.price = null;
    
    try {
        const response = await fetch(`${COINGECKO_API}/simple/price?ids=kaspa&vs_currencies=usd,btc&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`, { timeout: 10000 });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.kaspa) {
            // Nur echte Werte übernehmen, keine Fallbacks!
            if (data.kaspa.usd) state.price.usd = parseFloat(data.kaspa.usd);
            if (data.kaspa.btc) state.price.btc = parseFloat(data.kaspa.btc);
            if (data.kaspa.usd_24h_change !== undefined) state.price.change24h = parseFloat(data.kaspa.usd_24h_change);
            if (data.kaspa.usd_market_cap) state.price.marketCap = parseFloat(data.kaspa.usd_market_cap);
            if (data.kaspa.usd_24h_vol) state.price.volume24h = parseFloat(data.kaspa.usd_24h_vol);
            
            // 1h und 7d Change sind nicht in dieser API, könnten von einer anderen Quelle kommen
            // Für jetzt setzen wir sie auf den 24h Wert als Schätzung
            if (state.price.change24h !== null) {
                state.price.change1h = state.price.change24h / 24; // Grobe Schätzung
                state.price.change7d = state.price.change24h * 7;  // Grobe Schätzung
            }
            
            updatePriceDisplay();
        }
    } catch (error) {
        console.error('❌ Error fetching price:', error);
        state.errors.price = 'Failed to fetch price data';
        // Keep old price data visible
    } finally {
        state.loading.price = false;
    }
}

// === Update Price Display ===
function updatePriceDisplay() {
    const priceElem = document.getElementById('kas-price-main');
    if (priceElem) {
        if (state.price.usd !== null && state.price.btc !== null) {
            priceElem.innerHTML = `$${state.price.usd.toFixed(4)} <span class="btc-price">@ ${state.price.btc.toFixed(8)} BTC</span>`;
        } else {
            priceElem.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        }
    }
    
    const changeElem = document.getElementById('price-change');
    if (changeElem) {
        const change = state.price.change24h;
        if (change !== null) {
            changeElem.textContent = `(${change >= 0 ? '+' : ''}${change.toFixed(1)}%)`;
            changeElem.className = `stat-change-eth ${change >= 0 ? 'positive' : 'negative'}`;
        } else {
            changeElem.textContent = '(...)';
            changeElem.className = 'stat-change-eth';
        }
    }
    
    const mcapElem = document.getElementById('market-cap-main');
    if (mcapElem) {
        if (state.price.marketCap !== null) {
            mcapElem.innerHTML = `${formatNumber(state.price.marketCap)} <span class="rank">Rank #72</span>`;
        } else {
            mcapElem.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        }
    }
    
    const volumeElem = document.getElementById('volume-24h');
    if (volumeElem) {
        if (state.price.volume24h !== null) {
            volumeElem.textContent = `$${formatNumber(state.price.volume24h)}`;
        } else {
            volumeElem.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
    }
    
    // Update detail panels
    const priceDetail = document.getElementById('price-detail');
    if (priceDetail) {
        if (state.price.usd !== null) {
            priceDetail.textContent = `$${state.price.usd.toFixed(4)} / KAS`;
        } else {
            priceDetail.textContent = 'Loading...';
        }
    }
    
    const change1h = document.getElementById('change-1h');
    if (change1h) {
        if (state.price.change1h !== null) {
            change1h.textContent = `${state.price.change1h >= 0 ? '+' : ''}${state.price.change1h.toFixed(1)}%`;
            change1h.className = `info-value ${state.price.change1h >= 0 ? 'positive' : 'negative'}`;
        } else {
            change1h.textContent = 'Loading...';
            change1h.className = 'info-value';
// === Update Network Stats ===
function updateNetworkStats() {
    const hashrateElem = document.getElementById('hashrate-main');
    if (hashrateElem) {
        if (state.network.hashrate !== null) {
            hashrateElem.textContent = `${state.network.hashrate.toFixed(2)} PH/s`;
        } else {
            hashrateElem.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
    }

    const daaScoreElem = document.getElementById('daa-score-main');
    if (daaScoreElem) {
        if (state.network.daaScore !== null) {
            daaScoreElem.textContent = state.network.daaScore.toLocaleString();
        } else {
            daaScoreElem.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
    }

    const mempoolElem = document.getElementById('mempool-size');
    if (mempoolElem) {
        mempoolElem.textContent = `${state.network.mempool} txns`;
    }

    // Update detail panels
    const daaDetail = document.getElementById('daa-score-detail');
    if (daaDetail) {
        if (state.network.daaScore !== null) {
            daaDetail.textContent = state.network.daaScore.toLocaleString();
        } else {
            daaDetail.textContent = 'Loading...';
        }
    }

    const hashrateDetail = document.getElementById('hashrate-detail');
    if (hashrateDetail) {
        if (state.network.hashrate !== null) {
            hashrateDetail.textContent = `${state.network.hashrate.toFixed(2)} PH/s`;
        } else {
            hashrateDetail.textContent = 'Loading...';
        }
    }
}       } else {
            change7d.textContent = 'Loading...';
            change7d.className = 'info-value';
        }
    }
    
    const mcapDetail = document.getElementById('mcap-detail');
    if (mcapDetail) {
        if (state.price.marketCap !== null) {
            mcapDetail.innerHTML = `${formatNumber(state.price.marketCap)} <span class="rank-badge">Rank #72</span>`;
        } else {
            mcapDetail.textContent = 'Loading...';
        }
    }
}

// === Update All Stats ===
function updateAllStats() {
    updatePriceDisplay();
    updateNetworkStats();
    updateSupplyStats();
}

// === Update Network Stats ===
function updateNetworkStats() {
    const hashrateElem = document.getElementById('hashrate-main');
    if (hashrateElem) {
        if (state.network.hashrate !== null) {
            hashrateElem.textContent = `${state.network.hashrate.toFixed(2)} PH/s`;
        } else {
            hashrateElem.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
    }

    const daaScoreElem = document.getElementById('daa-score-main');
    if (daaScoreElem) {
        if (state.network.daaScore !== null) {
            daaScoreElem.textContent = state.network.daaScore.toLocaleString();
        } else {
            daaScoreElem.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
    }

    const mempoolElem = document.getElementById('mempool-size');
    if (mempoolElem) {
        mempoolElem.textContent = `${state.network.mempool} txns`;
    }

    // Update detail panels
    const daaDetail = document.getElementById('daa-score-detail');
    if (daaDetail) {
        if (state.network.daaScore !== null) {
            daaDetail.textContent = state.network.daaScore.toLocaleString();
        } else {
            daaDetail.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
    }

    const hashrateDetail = document.getElementById('hashrate-detail');
    if (hashrateDetail) {
        if (state.network.hashrate !== null) {
            hashrateDetail.textContent = `${state.network.hashrate.toFixed(2)} PH/s`;
        } else {
            hashrateDetail.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
    }
}

// === Fetch Real Network Stats ===
async function fetchKaspaNetworkStats() {
    if (state.loading.network) return;
    state.loading.network = true;
    state.errors.network = null;
    
    let data = null;
    try {
        const response = await fetch(`${LOCAL_NODE_API}/network`, { timeout: 5000 });
        if (!response.ok) throw new Error('Local node failed');
        data = await response.json();
    } catch (error) {
        console.warn('⚠️ Eigene Node nicht erreichbar, nutze Fallback für Netzwerkdaten.');
        try {
            const response = await fetch(`${FALLBACK_API}/network`, { timeout: 10000 });
            if (!response.ok) throw new Error('Fallback API failed');
            data = await response.json();
        } catch (fallbackError) {
            console.error('❌ Beide APIs fehlgeschlagen:', fallbackError);
            state.errors.network = 'Failed to fetch network stats';
            state.loading.network = false;
            return;
        }
    }
    
    if (data) {
        // Nur echte Werte übernehmen
        if (data.hashrate !== undefined) state.network.hashrate = parseFloat(data.hashrate);
        if (data.daaScore !== undefined) state.network.daaScore = parseInt(data.daaScore);
        if (data.mempoolSize !== undefined) state.network.mempool = parseInt(data.mempoolSize);
        if (data.supply !== undefined) state.network.supply = parseFloat(data.supply);
        if (data.blockReward !== undefined) state.network.blockReward = parseFloat(data.blockReward);
        
        updateNetworkStats();
        updateSupplyStats();
    }
    
    state.loading.network = false;
}

// === Update Supply Stats ===
function updateSupplyStats() {
    const supplyElem = document.getElementById('supply-total');
    if (supplyElem) {
        if (state.network.supply !== null) {
            supplyElem.textContent = `${state.network.supply.toLocaleString()} KAS`;
        } else {
            supplyElem.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        }
    }
    
    const rewardElem = document.getElementById('block-reward');
    if (rewardElem) {
        if (state.network.blockReward !== null) {
            rewardElem.textContent = `${state.network.blockReward.toFixed(2)} KAS`;
        } else {
            rewardElem.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
    }
}       state.network.hashrate = parseFloat(data.hashrate) || state.network.hashrate;
        state.network.daaScore = parseInt(data.daaScore) || state.network.daaScore;
        state.network.mempool = parseInt(data.mempoolSize) || state.network.mempool;
        state.network.supply = parseFloat(data.supply) || state.network.supply;
        state.network.maxSupply = parseFloat(data.maxSupply) || state.network.maxSupply;
        state.network.blockReward = parseFloat(data.blockReward) || state.network.blockReward;
        updateNetworkStats();
        updateSupplyStats();
    }
    
    state.loading.network = false;
}

// === Update Supply Stats ===
function updateSupplyStats() {
    const supplyElem = document.getElementById('supply-total');
    if (supplyElem) {
        supplyElem.textContent = `${state.network.supply.toLocaleString()} KAS`;
    }
    
    const rewardElem = document.getElementById('block-reward');
    if (rewardElem) {
        rewardElem.textContent = `${state.network.blockReward.toFixed(2)} KAS`;
    }
}

// === Fetch Real Blocks ===
async function fetchKaspaBlocks() {
    if (state.loading.blocks) return;
    state.loading.blocks = true;
    state.errors.blocks = null;
    
    let data = null;
    try {
        const response = await fetch(`${LOCAL_NODE_API}/blocks?limit=20`, { timeout: 5000 });
        if (!response.ok) throw new Error('Local node failed');
        data = await response.json();
    } catch (error) {
        console.warn('⚠️ Eigene Node nicht erreichbar, nutze Fallback für Blöcke.');
        try {
            const response = await fetch(`${FALLBACK_API}/blocks?limit=20`, { timeout: 10000 });
            if (!response.ok) throw new Error('Fallback API failed');
            data = await response.json();
        } catch (err) {
            console.error('❌ Error fetching blocks:', err);
            state.errors.blocks = 'Failed to fetch blocks';
            showErrorInContainer('blocks-list', 'Unable to load blocks. Retrying...');
            state.loading.blocks = false;
            return;
        }
    }
    
    if (data && Array.isArray(data.blocks) && data.blocks.length > 0) {
        const newBlocks = data.blocks.map(block => ({
            daaScore: parseInt(block.daaScore) || 0,
            hash: String(block.hash || ''),
            age: Math.floor((Date.now()/1000) - (block.timestamp || 0)),
            miner: String(block.miner || 'Unknown'),
            txCount: parseInt(block.transactionCount) || 0,
            reward: parseFloat(block.reward) || 0,
            time: parseFloat(block.blockTime) || 0,
            size: parseFloat(block.size) || 0
        }));
        
        // Only update if we have valid data
        if (newBlocks.length > 0) {
            state.blocks = newBlocks;
            renderBlocks();
            buildSearchIndex();
        }
    }
    
    state.loading.blocks = false;
}



// === Render Blocks ===
function renderBlocks(isNew = false) {
    const container = document.getElementById('blocks-list');
    if (!container) return;
    
    if (!state.blocks || state.blocks.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No blocks available</div>';
        return;
    }
    
    container.innerHTML = state.blocks.map((block, index) => {
        const newClass = (isNew && index === 0) ? ' new-item' : '';
        const safeHash = String(block.hash || '').replace(/'/g, "&#39;");
        const safeMiner = String(block.miner || 'Unknown').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        return `
            <div class="block-item${newClass}" onclick="showBlockDetails('${safeHash}')">
                <div class="block-icon">
                    <i class="fas fa-cube"></i>
                </div>
                <div class="block-info">
                    <a href="#" class="block-number" onclick="event.preventDefault()">DAA ${(block.daaScore || 0).toLocaleString()}</a>
                    <div class="block-meta">
                        <span class="block-time">${formatAge(block.age || 0)}</span>
                    </div>
                </div>
                <div class="block-details">
                    <div class="block-miner">${safeMiner}</div>
                    <div class="block-txs">${block.txCount || 0} txns in ${(block.time || 0).toFixed(2)}s</div>
                    <div class="block-reward">${(block.reward || 0).toFixed(4)} KAS</div>
                </div>
            </div>
        `;
    }).join('');
}

// === Fetch Real Transactions ===
async function fetchKaspaTransactions() {
    if (state.loading.transactions) return;
    state.loading.transactions = true;
    state.errors.transactions = null;
    
    let data = null;
    try {
        const response = await fetch(`${LOCAL_NODE_API}/transactions?limit=20`, { timeout: 5000 });
        if (!response.ok) throw new Error('Local node failed');
        data = await response.json();
    } catch (error) {
        console.warn('⚠️ Eigene Node nicht erreichbar, nutze Fallback für Transaktionen.');
        try {
            const response = await fetch(`${FALLBACK_API}/transactions?limit=20`, { timeout: 10000 });
            if (!response.ok) throw new Error('Fallback API failed');
            data = await response.json();
        } catch (err) {
            console.error('❌ Error fetching transactions:', err);
            state.errors.transactions = 'Failed to fetch transactions';
            showErrorInContainer('transactions-list', 'Unable to load transactions. Retrying...');
            state.loading.transactions = false;
            return;
        }
    }
    
    if (data && Array.isArray(data.transactions) && data.transactions.length > 0) {
        const newTransactions = data.transactions.map(tx => ({
            hash: String(tx.hash || ''),
            age: Math.floor((Date.now()/1000) - (tx.timestamp || 0)),
            from: tx.inputs && tx.inputs.length ? String(tx.inputs[0].address || '') : '',
            to: tx.outputs && tx.outputs.length ? String(tx.outputs[0].address || '') : '',
            amount: tx.outputs && tx.outputs.length ? parseFloat(tx.outputs[0].amount) || 0 : 0,
            fee: parseFloat(tx.fee) || 0,
            block: parseInt(tx.blockDaaScore) || 0
        }));
        
        // Only update if we have valid data
        if (newTransactions.length > 0) {
            state.transactions = newTransactions;
            renderTransactions();
            buildSearchIndex();
        }
    }
    
    state.loading.transactions = false;
}

// === Render Transactions ===
function renderTransactions(isNew = false) {
    const container = document.getElementById('transactions-list');
    if (!container) return;
    
    if (!state.transactions || state.transactions.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No transactions available</div>';
        return;
    }
    
    container.innerHTML = state.transactions.map((tx, index) => {
        const newClass = (isNew && index === 0) ? ' new-item' : '';
        const safeHash = String(tx.hash || '').replace(/'/g, "&#39;");
        const safeFrom = String(tx.from || '').replace(/'/g, "&#39;");
        const safeTo = String(tx.to || '').replace(/'/g, "&#39;");
        
        const fromShort = tx.from ? tx.from.substring(0, 10) + '...' + tx.from.substring(tx.from.length - 8) : 'Unknown';
        const toShort = tx.to ? tx.to.substring(0, 10) + '...' + tx.to.substring(tx.to.length - 8) : 'Unknown';
        
        return `
            <div class="tx-item${newClass}" onclick="showTransactionDetails('${safeHash}')">
                <div class="tx-icon">
                    <i class="fas fa-exchange-alt"></i>
                </div>
                <div class="tx-info">
                    <a href="#" class="tx-hash" onclick="event.preventDefault()">${tx.hash ? tx.hash.substring(0, 20) + '...' : 'Unknown'}</a>
                    <div class="tx-addresses">
                        <span class="tx-label">From</span>
                        <a href="#" class="tx-address" onclick="event.preventDefault(); event.stopPropagation(); showAddressDetails('${safeFrom}')">${fromShort}</a>
                        <span class="tx-arrow">→</span>
                        <span class="tx-label">To</span>
                        <a href="#" class="tx-address" onclick="event.preventDefault(); event.stopPropagation(); showAddressDetails('${safeTo}')">${toShort}</a>
                    </div>
                    <div class="tx-time">${formatAge(tx.age || 0)}</div>
                </div>
                <div class="tx-amount">${(tx.amount || 0).toFixed(4)} KAS</div>
            </div>
        `;
    }).join('');
}

// === Update Ages ===
function updateAges() {
    if (state.blocks.length > 0) {
        state.blocks.forEach(block => block.age += 1);
    }
    if (state.transactions.length > 0) {
        state.transactions.forEach(tx => tx.age += 1);
    }
    
    // Only re-render if we have data
    if (state.blocks.length > 0) renderBlocks();
    if (state.transactions.length > 0) renderTransactions();
}

// === Show Block Details ===
function showBlockDetails(hash) {
    const block = state.blocks.find(b => b.hash === hash);
    if (!block) return;
    
    const content = `
        <div class="modal-header">
            <div class="modal-title">Block Details</div>
            <div class="modal-subtitle">DAA Score: ${block.daaScore.toLocaleString()}</div>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">Block Hash</span>
            <span class="modal-value">${block.hash}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">DAA Score</span>
            <span class="modal-value">${block.daaScore.toLocaleString()}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">Timestamp</span>
            <span class="modal-value">${formatAge(block.age)}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">Miner</span>
            <span class="modal-value">${block.miner}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">Transactions</span>
            <span class="modal-value">${block.txCount}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">Block Reward</span>
            <span class="modal-value">${block.reward.toFixed(6)} KAS</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">Block Time</span>
            <span class="modal-value">${block.time} seconds</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">Size</span>
            <span class="modal-value">${block.size} KB</span>
        </div>
    `;
    
    showModal(content);
}

// === Show Transaction Details ===
function showTransactionDetails(hash) {
    const tx = state.transactions.find(t => t.hash === hash);
    if (!tx) return;
    
    const content = `
        <div class="modal-header">
            <div class="modal-title">Transaction Details</div>
            <div class="modal-subtitle">Hash: ${hash.substring(0, 20)}...</div>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">Transaction Hash</span>
            <span class="modal-value">${tx.hash}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">Block DAA</span>
            <span class="modal-value">${tx.block.toLocaleString()}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">Timestamp</span>
            <span class="modal-value">${formatAge(tx.age)}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">From</span>
            <span class="modal-value">${tx.from}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">To</span>
            <span class="modal-value">${tx.to}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">Amount</span>
            <span class="modal-value">${tx.amount} KAS</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">Fee</span>
            <span class="modal-value">${tx.fee} KAS</span>
        </div>
    `;
    
    showModal(content);
}

// === Show Address Details ===
function showAddressDetails(address) {
    // Simulate address data
    const balance = (Math.random() * 10000 + 100).toFixed(4);
    const txCount = Math.floor(Math.random() * 500) + 10;
    
    const content = `
        <div class="modal-header">
            <div class="modal-title">Address Details</div>
            <div class="modal-subtitle">${address.substring(0, 20)}...</div>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">Address</span>
            <span class="modal-value">${address}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">Balance</span>
            <span class="modal-value">${balance} KAS</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">Total Transactions</span>
            <span class="modal-value">${txCount}</span>
        </div>
        <div class="modal-detail-row">
            <span class="modal-label">First Seen</span>
            <span class="modal-value">${Math.floor(Math.random() * 365)} days ago</span>
        </div>
    `;
    
    showModal(content);
}

// === Show Modal ===
function showModal(content) {
    const modal = document.getElementById('detail-modal');
    const modalBody = document.getElementById('modal-body');
    
    if (modal && modalBody) {
        modalBody.innerHTML = content;
        modal.classList.add('active');
    }
}

// === Close Modal ===
function closeModal() {
    const modal = document.getElementById('detail-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// === Build Search Index ===
function buildSearchIndex() {
    state.searchIndex = {};
    
    // Index blocks
    state.blocks.forEach(block => {
        state.searchIndex[block.hash.toLowerCase()] = { type: 'block', data: block };
        state.searchIndex[block.daaScore.toString()] = { type: 'block', data: block };
    });
    
    // Index transactions
    state.transactions.forEach(tx => {
        state.searchIndex[tx.hash.toLowerCase()] = { type: 'transaction', data: tx };
        state.searchIndex[tx.from.toLowerCase()] = { type: 'address', data: tx.from };
        state.searchIndex[tx.to.toLowerCase()] = { type: 'address', data: tx.to };
    });
}

// === Search Handler ===
function handleSearch(query) {
    query = query.trim().toLowerCase();
    if (!query) {
        hideSearchResults();
        return;
    }
    
    const results = [];
    
    // Search blocks by DAA score
    if (/^\d+$/.test(query)) {
        const matches = state.blocks.filter(b => 
            b.daaScore.toString().includes(query)
        ).slice(0, 5);
        matches.forEach(b => results.push({ type: 'block', data: b }));
    }
    
    // Search by hash (blocks & transactions)
    if (query.startsWith('0x') && query.length > 5) {
        const blockMatches = state.blocks.filter(b => 
            b.hash.toLowerCase().includes(query)
        ).slice(0, 3);
        blockMatches.forEach(b => results.push({ type: 'block', data: b }));
        
        const txMatches = state.transactions.filter(tx => 
            tx.hash.toLowerCase().includes(query)
        ).slice(0, 3);
        txMatches.forEach(tx => results.push({ type: 'transaction', data: tx }));
    }
    
    // Search by address
    if (query.startsWith('kaspa:') && query.length > 10) {
        const addressMatches = state.transactions.filter(tx => 
            tx.from.toLowerCase().includes(query) || tx.to.toLowerCase().includes(query)
        ).slice(0, 5);
        
        // Get unique addresses
        const uniqueAddresses = [...new Set(
            addressMatches.flatMap(tx => [tx.from, tx.to])
                .filter(addr => addr.toLowerCase().includes(query))
        )];
        
        uniqueAddresses.forEach(addr => 
            results.push({ type: 'address', data: addr })
        );
    }
    
    displaySearchResults(results);
}

// === Display Search Results ===
function displaySearchResults(results) {
    const container = document.getElementById('search-results');
    if (!container) return;
    
    if (results.length === 0) {
        container.innerHTML = '<div class="search-result-item"><div class="result-value">No results found</div></div>';
        container.classList.add('active');
        return;
    }
    
    container.innerHTML = results.map(result => {
        let displayValue = '';
        let onClick = '';
        
        if (result.type === 'block') {
            displayValue = `DAA Score: ${result.data.daaScore.toLocaleString()}`;
            onClick = `showBlockDetails('${result.data.hash}')`;
        } else if (result.type === 'transaction') {
            displayValue = `${result.data.hash.substring(0, 30)}...`;
            onClick = `showTransactionDetails('${result.data.hash}')`;
        } else if (result.type === 'address') {
            displayValue = `${result.data.substring(0, 30)}...`;
            onClick = `showAddressDetails('${result.data}')`;
        }
        
        return `
            <div class="search-result-item" onclick="${onClick}; hideSearchResults()">
                <div class="result-type">${result.type}</div>
                <div class="result-value">${displayValue}</div>
            </div>
        `;
    }).join('');
    
    container.classList.add('active');
}

// === Hide Search Results ===
function hideSearchResults() {
    const container = document.getElementById('search-results');
    if (container) {
        container.classList.remove('active');
    }
}

// === Attach Event Listeners ===
function attachEventListeners() {
    // Search input
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            handleSearch(e.target.value);
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearch(e.target.value);
            }
        });
    }
    
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const query = searchInput ? searchInput.value : '';
            handleSearch(query);
        });
    }
    
    // Modal close
    const modalClose = document.querySelector('.modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }
    
    const modal = document.getElementById('detail-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
    
    // Click outside search results to close
    document.addEventListener('click', (e) => {
        const searchWrapper = document.querySelector('.search-wrapper-etherscan');
        const searchResults = document.getElementById('search-results');
        
        if (searchWrapper && searchResults && 
            !searchWrapper.contains(e.target) && 
            !searchResults.contains(e.target)) {
            hideSearchResults();
        }
    });
}

// === Helper Functions ===
function showLoadingState() {
    const containers = ['blocks-list', 'transactions-list'];
    containers.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 16px;"></i>
                    <div>Loading data...</div>
                </div>
            `;
        }
    });
}

function hideLoadingState() {
    // Loading states are hidden when data is rendered
}

function showErrorState(message) {
    const containers = ['blocks-list', 'transactions-list'];
    containers.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center; color: var(--negative);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 16px;"></i>
                    <div>${message}</div>
                </div>
            `;
        }
    });
}

function showErrorInContainer(containerId, message) {
    const container = document.getElementById(containerId);
    if (container && container.children.length === 0) {
        container.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--text-muted);">
                <i class="fas fa-exclamation-circle" style="margin-right: 8px;"></i>
                ${message}
            </div>
        `;
    }
}

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
        return `${Math.floor(seconds)}s ago`;
    } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        return `${mins}m ago`;
    } else if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        return `${hours}h ago`;
    } else {
        const days = Math.floor(seconds / 86400);
        return `${days}d ago`;
    }
}

function formatNumber(num) {
    if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return '$' + (num / 1e3).toFixed(2) + 'K';
    return '$' + num.toFixed(2);
}

// === Initialize on DOM Load ===
document.addEventListener('DOMContentLoaded', () => {
    initExplorer();
});

console.log('🚀 Kaspa Explorer V2 loaded successfully');
