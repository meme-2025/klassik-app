/* ============================================
   Kaspa Explorer - Professional JavaScript
   Live Data, BlockDAG Visualization, Advanced Features
   ============================================ */
const state = {
    currentView: 'home',
    isStatsActive: false, // Track if stats are active
    refreshInterval: null,
    network: {
        daaScore: null,
        blueScore: null,
        hashrate: null,
        difficulty: null,
        mempool: null,
        blockCount: null,
        virtualParentHashes: null,
        networkName: null,
        peerCount: null,
        circulatingSupply: null,
        totalSupply: null,
        maxSupply: null,
        totalTransactions: null
    },
    price: {
        current: null,
        change24h: null,
        change7d: null,
        marketCap: null,
        volume24h: null,
        rank: null
    },
    blocks: [],
    transactions: [],
    isLiveMode: false,
    refreshTimer: 60,
    refreshInterval: null,
    timerInterval: null,
    dataLoaded: false
};

// ============================================
// API Configuration
// ============================================
const API = {
    KASPA_API: 'https://api.kaspa.org',
    PRICE_API: 'https://api.coingecko.com/api/v3',
    WS_ENDPOINT: 'wss://api.kaspa.org/ws'
};

let ws = null;
let charts = {};

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Check if this is a landing page (no stats section)
    const isLandingPage = !document.getElementById('stats-section');
    
    if (isLandingPage) {
        // Landing page: only load prices and search
        initializeSearch();
        fetchLandingPagePrices();
        // handle possible query params even on landing
        handleQueryFromURL();
    } else {
        // Full explorer: load everything
        initializeNavigation();
        switchView('home'); // Show home view by default
        initializeSearch();
        initializeWebSocket();
        initializeRefreshTimer();
        fetchInitialData();
        // handle query params (e.g. ?tx=..., ?block=...)
        handleQueryFromURL();
        initializeCharts();
        initializeBlockDAG();
        updateBlockReward();
    }
});

// ============================================
// Navigation
// ============================================
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            switchView(view);
            
            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // Handle view selector for v5.01
    const viewSelector = document.getElementById('view-selector');
    if (viewSelector) {
        viewSelector.addEventListener('change', () => {
            const view = viewSelector.value;
            switchView(view);
        });
    }
}

function switchView(viewName) {
    state.currentView = viewName;
    
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Show selected view
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.add('active');
    }
    
    // Initialize view-specific features
    switch(viewName) {
        case 'blockdag':
            startBlockDAG();
            break;
        case 'analytics':
            updateCharts();
            break;
        case 'live':
            startLiveUpdates();
            break;
    }
}

// ============================================
// Explore Stats Button
// ============================================
function initializeExploreButton() {
    const exploreBtn = document.getElementById('explore-stats-btn');
    if (exploreBtn) {
        exploreBtn.addEventListener('click', activateStats);
    }
}

function activateStats() {
    if (state.isStatsActive) return; // Already active
    
    state.isStatsActive = true;
    
    // Show stats sections
    const statsSection = document.getElementById('stats-section');
    const statsContent = document.querySelectorAll('.stats-content');
    
    if (statsSection) statsSection.style.display = 'block';
    statsContent.forEach(section => section.style.display = 'block');
    
    // Hide explore button
    const exploreBtn = document.getElementById('explore-stats-btn');
    if (exploreBtn) exploreBtn.style.display = 'none';
    
    // Start API calls and timer
    initializeWebSocket();
    initializeRefreshTimer();
    fetchInitialData();
}

// ============================================
// Search Functionality
// ============================================
function initializeSearch() {
    const searchInput = document.getElementById('main-search');
    const searchBtn = document.getElementById('search-btn');
    const suggestions = document.getElementById('search-suggestions');
    
    searchBtn.addEventListener('click', performSearch);
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length > 3) {
            showSearchSuggestions(query);
        } else {
            if (suggestions) suggestions.classList.remove('active');
        }
    });
}

async function performSearch() {
    const searchInput = document.getElementById('main-search');
    const query = searchInput.value.trim();
    if (!query) return;

    // Basic query classification and SPA handling
    if (query.startsWith('kaspa:')) {
        // Address search
        history.pushState({}, '', `?address=${encodeURIComponent(query)}`);
    } else if (query.length === 64 && /^[a-fA-F0-9]+$/.test(query)) {
        // Transaction hash (64 hex characters)
        history.pushState({}, '', `?tx=${encodeURIComponent(query)}`);
    } else if (/^[a-fA-F0-9]+$/.test(query)) {
        // Block hash
        history.pushState({}, '', `?block=${encodeURIComponent(query)}`);
    } else if (/^\d+$/.test(query)) {
        // Block height
        history.pushState({}, '', `?height=${query}`);
    } else {
        showError('Invalid search query. Use: Address (kaspa:...), TX Hash (64 hex), or Block Hash/Height');
        return;
    }

    // run the handler which will fetch & render the result without navigating away
    handleQueryFromURL();
}

// Handle back/forward navigation
window.addEventListener('popstate', () => {
    handleQueryFromURL();
});

async function searchAddress(address) {
    window.location.href = `kaspa-address-details.html?address=${encodeURIComponent(address)}`;
}

async function searchTransaction(txHash) {
    window.location.href = `kaspa-transactions.html?tx=${encodeURIComponent(txHash)}`;
}

async function searchBlock(blockHash) {
    window.location.href = `kaspa-blocks.html?block=${encodeURIComponent(blockHash)}`;
}

function showError(message) {
    alert(message);
}

// ============================================
// SPA Search / URL handlers
// ============================================
async function handleQueryFromURL() {
    const params = new URLSearchParams(window.location.search);
    const resultsEl = document.getElementById('search-results');
    if (!resultsEl) return;

    // clear previous
    resultsEl.innerHTML = '';

    if (params.has('tx')) {
        const tx = params.get('tx');
        showSearchResults(`Searching for transaction ${tx}...`);
        await fetchTransaction(tx);
    } else if (params.has('address')) {
        const addr = params.get('address');
        showSearchResults(`Searching for address ${addr}...`);
        await fetchAddress(addr);
    } else if (params.has('block')) {
        const block = params.get('block');
        showSearchResults(`Searching for block ${block}...`);
        await fetchBlock(block);
    } else if (params.has('height')) {
        const h = params.get('height');
        showSearchResults(`Searching for block height ${h}...`);
        await fetchBlock(h);
    } else {
        // nothing to do - keep results hidden
        resultsEl.innerHTML = '';
    }
}

async function fetchTransaction(txHash) {
    try {
        const res = await fetch(`https://api.kaspa.org/transaction/${encodeURIComponent(txHash)}`);
        if (!res.ok) throw new Error('Transaction not found');
        const data = await res.json();
        showSearchResults(`Transaction: ${txHash}`, data);
    } catch (err) {
        showSearchResults('Transaction not found', { error: err.message });
    }
}

async function fetchAddress(address) {
    try {
        const res = await fetch(`https://api.kaspa.org/address/${encodeURIComponent(address)}`);
        if (!res.ok) throw new Error('Address not found');
        const data = await res.json();
        showSearchResults(`Address: ${address}`, data);
    } catch (err) {
        showSearchResults('Address not found', { error: err.message });
    }
}

async function fetchBlock(blockOrHeight) {
    try {
        // Try by hash first
        let res = await fetch(`https://api.kaspa.org/block/${encodeURIComponent(blockOrHeight)}`);
        if (res.status === 404) {
            // fallback: try height endpoint if numeric
            if (/^\d+$/.test(blockOrHeight)) {
                res = await fetch(`https://api.kaspa.org/block/by-height/${blockOrHeight}`);
            }
        }

        if (!res.ok) throw new Error('Block not found');
        const data = await res.json();
        showSearchResults(`Block: ${blockOrHeight}`, data);
    } catch (err) {
        showSearchResults('Block not found', { error: err.message });
    }
}

function showSearchResults(title, data) {
    const resultsEl = document.getElementById('search-results');
    if (!resultsEl) return;
    let html = `<div class="search-results-header"><strong>${title}</strong></div>`;
    if (data) {
        // pretty-print JSON for now
        html += `<pre class="search-results-pre">${escapeHtml(typeof data === 'string' ? data : JSON.stringify(data, null, 2))}</pre>`;
    }
    resultsEl.innerHTML = html;
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// On initial load, check URL for any query params
document.addEventListener('DOMContentLoaded', () => {
    handleQueryFromURL();
});

function showSearchSuggestions(query) {
    // Mock suggestions - integrate with real API
    const suggestions = document.getElementById('search-suggestions');
    if (!suggestions) return;
    suggestions.innerHTML = `
        <div class="suggestion-item">
            <i class="fas fa-search"></i>
            <span>Search for "${query}"</span>
        </div>
    `;
    suggestions.classList.add('active');
}

// ============================================
// WebSocket Connection
// ============================================
function initializeWebSocket() {
    // WebSocket for real-time updates can be added here
    console.log('WebSocket ready for implementation');
}

// ============================================
// Data Fetching
// ============================================
async function fetchInitialData() {
    await Promise.all([
        fetchNetworkInfo(),
        fetchLatestBlocks(),
        fetchLatestTransactions()
    ]);
    
    updateUI();
}

async function fetchNetworkInfo() {
    try {
        const [networkRes, hashrateRes, blockdagRes, blueScoreRes, coinSupplyRes, priceRes, marketcapRes, blockRewardRes, coingeckoRes, coingeckoFullRes, halvingRes] = await Promise.all([
            fetch('https://api.kaspa.org/info/kaspad'),
            fetch('https://api.kaspa.org/info/hashrate'),
            fetch('https://api.kaspa.org/info/blockdag'),
            fetch('https://api.kaspa.org/info/virtual-chain-blue-score'),
            fetch('https://api.kaspa.org/info/coinsupply'),
            fetch('https://api.kaspa.org/info/price'),
            fetch('https://api.kaspa.org/info/marketcap'),
            fetch('https://api.kaspa.org/info/blockreward'),
            fetch('https://api.coingecko.com/api/v3/simple/price?ids=kaspa&vs_currencies=usd&include_24hr_change=true&include_7d_change=true&include_market_cap=true&include_24hr_vol=true'),
            fetch('https://api.coingecko.com/api/v3/coins/kaspa'),
            fetch('https://api.kaspa.org/info/halving')
        ]);
        
        const network = await networkRes.json();
        const hashrate = await hashrateRes.json();
        const blockdag = await blockdagRes.json();
        const blueScore = await blueScoreRes.json();
        const coinSupply = await coinSupplyRes.json();
        const price = await priceRes.json();
        const marketcap = await marketcapRes.json();
        const blockReward = await blockRewardRes.json();
        const coingecko = coingeckoRes.ok ? await coingeckoRes.json() : null;
        const coingeckoFull = coingeckoFullRes.ok ? await coingeckoFullRes.json() : null;
        const halving = await halvingRes.json();
        
        console.log('CoinGecko API response:', coingecko);
        
        // Preserve existing transaction data before updating
        const existingTxData = {
            coinbase24h: state.network.coinbase24h,
            regularTxs24h: state.network.regularTxs24h,
            dailyTransactions: state.network.dailyTransactions
        };
        
        state.network = {
            daaScore: blockdag?.tipHashes?.length || NaN,
            blueScore: blueScore?.blueScore || NaN,
            hashrate: hashrate?.hashrate || NaN,
            difficulty: blockdag?.difficulty || NaN,
            mempool: network?.mempoolSize || 0,
            blockCount: blockdag?.blockCount || NaN,
            virtualParentHashes: blockdag?.virtualParentHashes?.length || 0,
            networkName: network?.serverVersion || 'N/A',
            peerCount: network?.p2pId ? 1 : 0,
            circulatingSupply: coinSupply?.circulatingSupply || coinSupply?.circulating || NaN,
            totalSupply: coinSupply?.totalSupply || coinSupply?.total || coinSupply?.maxSupply || NaN,
            maxSupply: coinSupply?.maxSupply || coinSupply?.max || 28700000000 || NaN,
            blockReward: blockReward?.blockreward || blockReward || NaN,
            nextHalvingDate: halving?.nextHalvingDate || 'N/A',
            nextHalvingAmount: halving?.nextHalvingAmount || NaN,
            // Restore transaction data
            coinbase24h: existingTxData.coinbase24h,
            regularTxs24h: existingTxData.regularTxs24h,
            dailyTransactions: existingTxData.dailyTransactions
        };
        
        // Calculate blocks in last 24h using binary search for timestamp
        const targetTimestamp = Date.now() - 24 * 60 * 60 * 1000;
        const oldBlueScore = await findBlueScoreForTimestamp(targetTimestamp);
        state.network.blocks24h = state.network.blueScore - (oldBlueScore || (state.network.blueScore - 86400));
        
        state.price = {
            current: price?.price || NaN,
            change24h: coingecko?.kaspa?.usd_24h_change || 0,
            change7d: coingecko?.kaspa?.usd_7d_change || 0,
            marketCap: marketcap?.marketcap || coingecko?.kaspa?.usd_market_cap || NaN,
            volume24h: coingecko?.kaspa?.usd_24h_vol || NaN,
            rank: coingeckoFull?.market_cap_rank || 'N/A'
        };
        
        console.log('Final price state:', state.price);
    } catch (error) {
        console.error('Failed to fetch network info:', error);
        // Keep null values to show Loading... instead of 0
    }
}







// Function to find the blueScore closest to a target timestamp using binary search
async function findBlueScoreForTimestamp(targetTimestamp) {
    let low = 0;
    let high = state.network.blueScore;
    let closestBlueScore = null;
    let closestDiff = Infinity;
    
    for (let i = 0; i < 25; i++) { // max 25 iterations for ~18M blueScore
        const mid = Math.floor((low + high) / 2);
        try {
            const res = await fetch(`https://api.kaspa.org/blocks-from-bluescore?blueScore=${mid}&includeTransactions=false`);
            const data = await res.json();
            if (data && data.length > 0) {
                const blockTimestamp = parseInt(data[0].header.timestamp);
                const diff = Math.abs(blockTimestamp - targetTimestamp);
                if (diff < closestDiff) {
                    closestDiff = diff;
                    closestBlueScore = mid;
                }
                if (blockTimestamp > targetTimestamp) {
                    high = mid - 1;
                } else if (blockTimestamp < targetTimestamp) {
                    low = mid + 1;
                } else {
                    return mid; // exact match
                }
            } else {
                high = mid - 1; // no block at this score
            }
        } catch (e) {
            console.error('Error fetching block for blueScore', mid, e);
            break;
        }
    }
    return closestBlueScore;
}





// Price data now fetched in fetchNetworkInfo()

async function fetchLatestBlocks() {
    try {
        // Kaspa API doesn't provide a direct "latest blocks" endpoint
        // Block data requires specific block hashes which we don't have
        state.blocks = [];
    } catch (error) {
        console.error('Failed to fetch blocks:', error);
        state.blocks = [];
    }
}

async function fetchLatestTransactions() {
    try {
        // Get current date and yesterday in YYYY-MM-DD format
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        console.log('Fetching transactions for:', today, yesterday);
        
        // Fetch hourly transaction counts for today and yesterday
        const [todayRes, yesterdayRes] = await Promise.all([
            fetch(`https://api.kaspa.org/transactions/count/${today}`),
            fetch(`https://api.kaspa.org/transactions/count/${yesterday}`)
        ]);
        
        let coinbaseTotal = 0;
        let regularTotal = 0;
        const currentHour = now.getHours();
        
        console.log('API responses:', todayRes.ok, yesterdayRes.ok);
        
        // Process yesterday's data (from current hour to end of day)
        if (yesterdayRes.ok) {
            const yesterdayData = await yesterdayRes.json();
            console.log('Yesterday data:', yesterdayData);
            if (Array.isArray(yesterdayData)) {
                for (let i = currentHour; i < 24; i++) {
                    if (yesterdayData[i]) {
                        coinbaseTotal += yesterdayData[i].coinbase || 0;
                        regularTotal += yesterdayData[i].regular || 0;
                    }
                }
            }
        }
        
        // Process today's data (from midnight to current hour)
        if (todayRes.ok) {
            const todayData = await todayRes.json();
            console.log('Today data:', todayData);
            if (Array.isArray(todayData)) {
                for (let i = 0; i <= currentHour; i++) {
                    if (todayData[i]) {
                        coinbaseTotal += todayData[i].coinbase || 0;
                        regularTotal += todayData[i].regular || 0;
                    }
                }
            }
        }
        
        console.log('Transaction totals - coinbase:', coinbaseTotal, 'regular:', regularTotal);
        
        state.network.coinbase24h = coinbaseTotal;
        state.network.regularTxs24h = regularTotal;
        state.network.dailyTransactions = coinbaseTotal + regularTotal;
        
        console.log('Final dailyTransactions:', state.network.dailyTransactions);
        
        state.transactions = [];
        state.network.mempoolSize = 0;
    } catch (error) {
        console.error('Failed to fetch transactions:', error);
        state.transactions = [];
        state.network.mempoolSize = 0;
        state.network.dailyTransactions = 0;
        state.network.coinbase24h = 0;
        state.network.regularTxs24h = 0;
    }
}

// ============================================
// UI Updates
// ============================================

// Block Reward (1R) + Halving Info
async function updateBlockReward() {
    // Block Reward (optional, falls benötigt)
    try {
        const rewardRes = await fetch('https://api.kaspa.org/info/blockreward');
        const rewardData = await rewardRes.json();
        if(document.getElementById('block-reward'))
            document.getElementById('block-reward').textContent = rewardData.reward + ' KAS';
    } catch (e) {
        if(document.getElementById('block-reward'))
            document.getElementById('block-reward').textContent = 'Error';
    }
    // Halving Info
    try {
        const halvingRes = await fetch('https://api.kaspa.org/info/halving');
        const halvingData = await halvingRes.json();
        document.getElementById('halving-amount').textContent = `${halvingData.nextHalvingAmount} KAS`;
        function updateCountdown() {
            const now = Math.floor(Date.now() / 1000);
            const diff = halvingData.nextHalvingTimestamp - now;
            if (diff > 0) {
                const d = Math.floor(diff / 86400);
                const h = Math.floor((diff % 86400) / 3600);
                const m = Math.floor((diff % 3600) / 60);
                const s = diff % 60;
                document.getElementById('halving-countdown').textContent = `in ${d}d ${h}h ${m}m ${s}s`;
            } else {
                document.getElementById('halving-countdown').textContent = 'Halving!';
            }
        }
        updateCountdown();
        setInterval(updateCountdown, 1000);
    } catch (e) {
        document.getElementById('halving-amount').textContent = 'Error';
        document.getElementById('halving-countdown').textContent = 'Error';
    }
}

function updateUI() {
    updateQuickStats();
    updateBlocksTable();
    updateTransactionsTable();
}

function updateQuickStats() {
    // Update Header Price
    const headerPriceValue = document.getElementById('header-price-value');
    const headerPriceChange = document.getElementById('header-price-change');
    if (headerPriceValue && !isNaN(state.price.current) && state.price.current > 0) {
        const truncated = truncateDecimals(state.price.current, 2);
        headerPriceValue.textContent = `$${truncated.toFixed(2)}`;
    }
    if (headerPriceChange && !isNaN(state.price.change24h)) {
        const change = state.price.change24h;
        headerPriceChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
        headerPriceChange.className = `price-change ${change >= 0 ? 'positive' : 'negative'}`;
    }
    
    // 1L: KAS Price with 24h change
    const priceElem = document.getElementById('price-stat');
    const priceChange24hElem = document.getElementById('price-change-24h');
    if (priceElem) {
        if (!isNaN(state.price.current) && state.price.current !== null && state.price.current > 0) {
            const truncated = truncateDecimals(state.price.current, 2);
            priceElem.textContent = `$${truncated.toFixed(2)}`;
        } else {
            priceElem.textContent = 'Loading...';
        }
        
        if (priceChange24hElem) {
            if (!isNaN(state.price.change24h) && state.price.change24h !== null) {
                const change = state.price.change24h;
                priceChange24hElem.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
                priceChange24hElem.className = `stat-change ${change >= 0 ? 'positive' : 'negative'}`;
            } else {
                priceChange24hElem.textContent = 'N/A';
                priceChange24hElem.className = 'stat-change';
            }
        }
    }
    
    // 2L: Market Cap
    const mcapElem = document.getElementById('mcap-stat');
    if (mcapElem) {
        if (!isNaN(state.price.marketCap) && state.price.marketCap !== null && state.price.marketCap > 0) {
            mcapElem.textContent = `$${formatNumber(state.price.marketCap)}`;
        } else {
            mcapElem.textContent = 'Loading...';
        }
    }

    // Rank
    const rankElem = document.getElementById('info-stat');
    if (rankElem) {
        if (state.price.rank && state.price.rank !== 'N/A') {
            rankElem.textContent = `Rank #${state.price.rank}`;
        } else {
            rankElem.textContent = 'Loading...';
        }
    }
    
    // 3L: Transactions & TPS
    const totalTxsStatElem = document.getElementById('total-txs-stat');
    const tpsStatElem = document.getElementById('tps-stat');
    if (totalTxsStatElem) {
        // Use dailyTransactions (coinbase + regular) for total count
        const txCount = state.network.dailyTransactions || state.network.regularTxs24h || 0;
        console.log('Updating TX display with:', txCount, 'dailyTransactions:', state.network.dailyTransactions);
        if (!isNaN(txCount) && txCount > 0) {
            const mintingPercent = state.network.coinbase24h && state.network.dailyTransactions ? (state.network.coinbase24h / state.network.dailyTransactions * 100).toFixed(1) : 0;
            totalTxsStatElem.textContent = `${txCount.toLocaleString()} (${mintingPercent}% mint.)`;
            
            // Calculate TPS: transactions / 86400 seconds in 24h
            const tps = (txCount / 86400).toFixed(2);
            if (tpsStatElem) {
                tpsStatElem.textContent = `TPS: ${tps}`;
            }
        } else {
            totalTxsStatElem.textContent = 'Loading...';
            if (tpsStatElem) {
                tpsStatElem.textContent = 'TPS: Loading...';
            }
        }
    }
    
    // 4L: Last Finalized Block
    const finalizedBlockElem = document.getElementById('finalized-block');
    const finalizedTimeElem = document.getElementById('finalized-time');
    if (finalizedBlockElem) {
        if (!isNaN(state.network.blueScore) && state.network.blueScore !== null && state.network.blueScore > 0) {
            finalizedBlockElem.textContent = state.network.blueScore.toLocaleString();
            if (finalizedTimeElem) {
                finalizedTimeElem.textContent = 'Just now';
            }
        } else {
            finalizedBlockElem.textContent = 'Loading...';
            if (finalizedTimeElem) {
                finalizedTimeElem.textContent = 'Loading...';
            }
        }
    }





    // Finalized Blocks (2R)
    const finalizedBlocks24hElem = document.getElementById('finalized-blocks-24h');
    const finalizedBlocksTotalElem = document.getElementById('finalized-blocks-total');
    if (finalizedBlocks24hElem) {
        // Use calculated blocks from last 24h based on API timestamps
        const blocks24h = state.network.blocks24h || 86400;
        finalizedBlocks24hElem.textContent = blocks24h.toLocaleString();
    }
    if (finalizedBlocksTotalElem) {
        if (!isNaN(state.network.blueScore) && state.network.blueScore !== null && state.network.blueScore > 0) {
            finalizedBlocksTotalElem.textContent = 'Total: ' + state.network.blueScore.toLocaleString();
        } else {
            finalizedBlocksTotalElem.textContent = 'Total: Loading...';
        }
    }


    
    // 3R: Gas Price (Kaspa uses Mass Units - calculate based on network)
    const gasPriceSompiElem = document.getElementById('gas-price-sompi');
    const gasPriceUsdElem = document.getElementById('gas-price-usd');
    if (gasPriceSompiElem) {
        // Kaspa typical fee is ~1000 sompi per gram of mass
        // Average transaction is ~1000 grams = ~1,000,000 sompi = 0.01 KAS
        const avgFeeSompi = 1000000; // 1M sompi = 0.01 KAS
        gasPriceSompiElem.textContent = `${avgFeeSompi.toLocaleString()} Sompi`;
        
        if (gasPriceUsdElem && !isNaN(state.price.current) && state.price.current > 0) {
            const feeInKas = avgFeeSompi / 1e8;
            const feeInUsd = feeInKas * state.price.current;
            gasPriceUsdElem.textContent = `($${feeInUsd.toFixed(6)})`;
        } else if (gasPriceUsdElem) {
            gasPriceUsdElem.textContent = '($0.00)';
        }
    }
    
    // 4R: Latest Safe Block (same as finalized for now)
    const safeBlockElem = document.getElementById('safe-block');
    const safeBlockTimeElem = document.getElementById('safe-block-time');
    if (safeBlockElem) {
        if (!isNaN(state.network.blueScore) && state.network.blueScore !== null && state.network.blueScore > 0) {
            // Safe block is typically a few blocks behind finalized
            const safeBlock = state.network.blueScore - 10;
            safeBlockElem.textContent = formatNumber(safeBlock);
            if (safeBlockTimeElem) {
                safeBlockTimeElem.textContent = '~10s ago';
            }
        } else {
            safeBlockElem.textContent = 'Loading...';
            if (safeBlockTimeElem) {
                safeBlockTimeElem.textContent = 'Loading...';
            }
        }
    }
    
    // DAA Score
    const daaElem = document.getElementById('daa-stat');
    const daaInfoElem = document.getElementById('daa-info');
    if (daaElem) {
        if (!isNaN(state.network.daaScore) && state.network.daaScore !== null && state.network.daaScore > 0) {
            daaElem.textContent = formatNumber(state.network.daaScore);
            if (daaInfoElem) {
                daaInfoElem.textContent = `Virtual Parents: ${state.network.virtualParentHashes || 0}`;
            }
        } else {
            daaElem.textContent = 'Loading...';
            if (daaInfoElem) {
                daaInfoElem.textContent = 'Loading...';
            }
        }
    }
    
    // Hashrate
    const hashrateElem = document.getElementById('hashrate-stat');
    const difficultyInfoElem = document.getElementById('difficulty-info');
    if (hashrateElem) {
        if (!isNaN(state.network.hashrate) && state.network.hashrate !== null && state.network.hashrate > 0) {
            hashrateElem.textContent = `${state.network.hashrate.toFixed(2)} PH/s`;
            if (difficultyInfoElem && !isNaN(state.network.difficulty)) {
                difficultyInfoElem.textContent = `Diff: ${formatCompact(state.network.difficulty)}`;
            }
        } else {
            hashrateElem.textContent = 'Loading...';
            if (difficultyInfoElem) {
                difficultyInfoElem.textContent = 'Loading...';
            }
        }
    }
    
    // Mempool
    const mempoolElem = document.getElementById('mempool-stat');
    if (mempoolElem) {
        if (state.network.mempool !== null && !isNaN(state.network.mempool)) {
            mempoolElem.textContent = formatNumber(state.network.mempool);
        } else {
            mempoolElem.textContent = 'Loading...';
        }
    }
    
    // Volume
    const volumeElem = document.getElementById('volume-stat');
    const txCountElem = document.getElementById('tx-count');
    if (volumeElem) {
        if (!isNaN(state.price.volume24h) && state.price.volume24h !== null && state.price.volume24h > 0) {
            volumeElem.textContent = `$${formatNumber(state.price.volume24h)}`;
            if (txCountElem) {
                txCountElem.textContent = `${state.transactions.length} TXs`;
            }
        } else {
            volumeElem.textContent = 'Loading...';
        }
    }
    
    // Blue Score
    const blueElem = document.getElementById('blue-stat');
    const blockRateElem = document.getElementById('block-rate');
    if (blueElem) {
        if (!isNaN(state.network.blueScore) && state.network.blueScore !== null && state.network.blueScore > 0) {
            blueElem.textContent = formatNumber(state.network.blueScore);
            if (blockRateElem) {
                blockRateElem.textContent = '~1s/block';
            }
        } else {
            blueElem.textContent = 'Loading...';
            if (blockRateElem) {
                blockRateElem.textContent = 'Loading...';
            }
        }
    }
    
    // 7d Change
    const change7dElem = document.getElementById('change7d-stat');
    const athInfoElem = document.getElementById('ath-info');
    if (change7dElem) {
        if (!isNaN(state.price.change7d) && state.price.change7d !== null) {
            const change = state.price.change7d;
            change7dElem.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
            change7dElem.className = `stat-value stat-change ${change >= 0 ? 'positive' : 'negative'}`;
        } else {
            change7dElem.textContent = 'Loading...';
            change7dElem.className = 'stat-value stat-change';
        }
        if (athInfoElem) {
            athInfoElem.textContent = 'vs last week';
        }
    }
    
    // Update Data Blocks
    updateDataBlocks();
}

function updateDataBlocks() {
    // Total Supply
    const totalSupplyElem = document.getElementById('total-supply');
    if (totalSupplyElem && !isNaN(state.network.totalSupply) && state.network.totalSupply > 0) {
        const totalKAS = Math.floor(state.network.totalSupply / 1e8);
        totalSupplyElem.textContent = `${totalKAS.toLocaleString()} KAS`;
    } else if (totalSupplyElem) {
        totalSupplyElem.textContent = 'Loading...';
    }
    
    // Circulating Supply
    const circSupplyElem = document.getElementById('circ-supply');
    if (circSupplyElem && !isNaN(state.network.circulatingSupply) && state.network.circulatingSupply > 0) {
        const circKAS = Math.floor(state.network.circulatingSupply / 1e8);
        circSupplyElem.textContent = `${circKAS.toLocaleString()} KAS`;
    } else if (circSupplyElem) {
        circSupplyElem.textContent = 'Loading...';
    }
    
    // Mineable Remaining (Max Supply - Circulating Supply)
    const mineableSupplyElem = document.getElementById('mineable-supply');
    if (mineableSupplyElem) {
        if (!isNaN(state.network.maxSupply) && !isNaN(state.network.circulatingSupply) && 
            state.network.maxSupply > 0 && state.network.circulatingSupply > 0) {
            const mineableKAS = Math.floor((state.network.maxSupply - state.network.circulatingSupply) / 1e8);
            mineableSupplyElem.textContent = `${mineableKAS.toLocaleString()} KAS`;
        } else {
            mineableSupplyElem.textContent = 'Loading...';
        }
    }
    
    // Block Reward
    const blockRewardElem = document.getElementById('block-reward');
    if (blockRewardElem) {
        if (!isNaN(state.network.blockReward) && state.network.blockReward > 0) {
            blockRewardElem.textContent = `${state.network.blockReward.toFixed(2)} KAS`;
        } else {
            blockRewardElem.textContent = 'Loading...';
        }
    }
        // Halving Date
    const halvingDateElem = document.getElementById('halving-date');
    if (halvingDateElem) {
        if (state.network.nextHalvingDate && state.network.nextHalvingDate !== 'N/A') {
            halvingDateElem.textContent = state.network.nextHalvingDate;
        } else {
            halvingDateElem.textContent = 'Loading...';
        }
    }
        // Halving Amount
    const halvingAmountElem = document.getElementById('halving-amount');
    if (halvingAmountElem) {
        if (!isNaN(state.network.nextHalvingAmount) && state.network.nextHalvingAmount > 0) {
            halvingAmountElem.textContent = `${state.network.nextHalvingAmount.toFixed(2)} KAS`;
        } else {
            halvingAmountElem.textContent = 'Loading...';
        }
    }
    
    // Avg Block Time
    const avgBlocktimeElem = document.getElementById('avg-blocktime');
    if (avgBlocktimeElem) {
        // Kaspa protocol target is 1 second per block
        // Without real block timestamp data, we show the protocol specification
        avgBlocktimeElem.textContent = '1.0s (target)';
    }
    
    // Miner Rewards (24h) - Coinbase transactions
    const coinbase24hElem = document.getElementById('coinbase-24h');
    if (coinbase24hElem) {
        if (!isNaN(state.network.coinbase24h) && state.network.coinbase24h > 0) {
            coinbase24hElem.textContent = formatNumber(state.network.coinbase24h);
        } else {
            coinbase24hElem.textContent = 'Loading...';
        }
    }
    
    // Regular TXs (24h)
    const regularTxs24hElem = document.getElementById('regular-txs-24h');
    if (regularTxs24hElem) {
        if (!isNaN(state.network.regularTxs24h) && state.network.regularTxs24h > 0) {
            regularTxs24hElem.textContent = formatNumber(state.network.regularTxs24h);
        } else {
            regularTxs24hElem.textContent = 'Loading...';
        }
    }
    
    // Network Nodes
    const networkNodesElem = document.getElementById('network-nodes');
    if (networkNodesElem) {
        if (!isNaN(state.network.peerCount) && state.network.peerCount > 0) {
            networkNodesElem.textContent = formatNumber(state.network.peerCount);
        } else {
            networkNodesElem.textContent = 'N/A';
        }
    }
    
    // Total Blocks
    const totalBlocksElem = document.getElementById('total-blocks');
    if (totalBlocksElem && !isNaN(state.network.blockCount) && state.network.blockCount > 0) {
        totalBlocksElem.textContent = formatNumber(state.network.blockCount);
    } else if (totalBlocksElem) {
        totalBlocksElem.textContent = 'Loading...';
    }
    
    // Total Transactions
    const totalTxsElem = document.getElementById('total-txs');
    if (totalTxsElem && !isNaN(state.network.totalTransactions) && state.network.totalTransactions > 0) {
        totalTxsElem.textContent = formatNumber(state.network.totalTransactions);
    } else if (totalTxsElem) {
        totalTxsElem.textContent = 'Loading...';
    }
    
    // Daily Transactions
    const dailyTxsElem = document.getElementById('daily-txs');
    if (dailyTxsElem) {
        if (!isNaN(state.network.dailyTransactions) && state.network.dailyTransactions > 0) {
            dailyTxsElem.textContent = formatNumber(state.network.dailyTransactions);
        } else {
            dailyTxsElem.textContent = 'Loading...';
        }
    }
    
    // Avg Fee
    const avgFeeElem = document.getElementById('avg-fee');
    if (avgFeeElem) {
        // Kaspa has very low fees, typically < 0.0001 KAS
        avgFeeElem.textContent = '< 0.0001 KAS';
    }
    
    // Peak TPS
    const peakTpsElem = document.getElementById('peak-tps');
    if (peakTpsElem) {
        peakTpsElem.textContent = 'Loading...';
    }
    
    // Current TPS
    const currentTpsElem = document.getElementById('current-tps');
    if (currentTpsElem) {
        currentTpsElem.textContent = 'N/A';
    }
    
    // Chain Work
    const chainWorkElem = document.getElementById('chain-work');
    if (chainWorkElem && !isNaN(state.network.difficulty)) {
        chainWorkElem.textContent = formatCompact(state.network.difficulty);
    } else if (chainWorkElem) {
        chainWorkElem.textContent = 'N/A';
    }
    
    // Network Version
    const networkVersionElem = document.getElementById('network-version');
    if (networkVersionElem && state.network.networkName) {
        networkVersionElem.textContent = state.network.networkName;
    } else if (networkVersionElem) {
        networkVersionElem.textContent = 'N/A';
    }
    
    // New Data Blocks - Hashrate, Difficulty, DAA Score
    const hashrateDataElem = document.getElementById('hashrate-data');
    if (hashrateDataElem) {
        if (!isNaN(state.network.hashrate) && state.network.hashrate > 0) {
            hashrateDataElem.textContent = `${state.network.hashrate.toFixed(2)} PH/s`;
        } else {
            hashrateDataElem.textContent = 'Loading...';
        }
    }
    
    const difficultyDataElem = document.getElementById('difficulty-data');
    if (difficultyDataElem) {
        if (!isNaN(state.network.difficulty) && state.network.difficulty > 0) {
            difficultyDataElem.textContent = formatCompact(state.network.difficulty);
        } else {
            difficultyDataElem.textContent = 'Loading...';
        }
    }
    
    const daaDataElem = document.getElementById('daa-data');
    if (daaDataElem) {
        if (!isNaN(state.network.daaScore) && state.network.daaScore > 0) {
            daaDataElem.textContent = formatNumber(state.network.daaScore);
        } else {
            daaDataElem.textContent = 'Loading...';
        }
    }
}

function formatCompact(num) {
    if (num >= 1e12) return (num / 1e12).toFixed(1) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
}

function updateBlocksTable() {
    const tbody = document.getElementById('latest-blocks');
    if (!tbody) return;
    
    if (state.blocks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">No blocks available</td></tr>';
        return;
    }
    
    tbody.innerHTML = state.blocks.map(block => `
        <tr>
            <td><span class="hash">${block.hash ? truncateHash(block.hash) : 'N/A'}</span></td>
            <td>${block.timestamp ? formatTime(block.timestamp) : 'N/A'}</td>
            <td>${block.transactions || 0}</td>
            <td>${block.size ? formatBytes(block.size) : 'N/A'}</td>
            <td>${!isNaN(block.blueScore) ? formatNumber(block.blueScore) : 'N/A'}</td>
        </tr>
    `).join('');
}

function updateTransactionsTable() {
    const tbody = document.getElementById('latest-txs');
    if (!tbody) return;
    
    if (state.transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">No transactions available</td></tr>';
        return;
    }
    
    tbody.innerHTML = state.transactions.map(tx => `
        <tr>
            <td><span class="hash">${tx.hash ? truncateHash(tx.hash) : 'N/A'}</span></td>
            <td><span class="hash">${tx.from ? truncateHash(tx.from) : 'N/A'}</span></td>
            <td><span class="hash">${tx.to ? truncateHash(tx.to) : 'N/A'}</span></td>
            <td>${tx.amount || '0'} KAS</td>
            <td>${tx.timestamp ? formatTime(tx.timestamp) : 'N/A'}</td>
        </tr>
    `).join('');
}

function updateLiveStats() {
    // Update all live stat elements
    const updates = {
        'live-daa': formatNumber(state.network.daaScore),
        'live-blue': formatNumber(state.network.blueScore),
        'live-parents': state.network.virtualParentHashes,
        'live-difficulty': formatNumber(state.network.difficulty),
        'live-blocks': formatNumber(state.network.blockCount),
        'live-mempool': state.network.mempool,
        'live-mempool-size': `${(state.network.mempool * 0.5).toFixed(2)} KB`,
        'live-fee': '0.0001 KAS',
        'live-hashrate': `${state.network.hashrate.toFixed(2)} PH/s`,
        'live-next-diff': formatNumber(state.network.difficulty * 1.02),
        'live-blocktime': '1s',
        'live-bph': '3600',
        'live-price': `$${truncateDecimals(state.price.current || 0, 4).toFixed(4)}`,
        'live-change-24h': `${state.price.change24h >= 0 ? '+' : ''}${state.price.change24h.toFixed(2)}%`,
        'live-change-7d': `${state.price.change7d >= 0 ? '+' : ''}${state.price.change7d.toFixed(2)}%`,
        'live-volume': `$${formatNumber(state.price.volume24h)}`,
        'live-mcap': `$${formatNumber(state.price.marketCap)}`
    };
    
    Object.entries(updates).forEach(([id, value]) => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.textContent = value;
            
            // Add color classes for changes
            if (id.includes('change')) {
                const isPositive = value.startsWith('+');
                elem.style.color = isPositive ? 'var(--success)' : 'var(--danger)';
            }
        }
    });
}

// ============================================
// Live Updates
// ============================================
function startLiveUpdates() {
    state.isLiveMode = true;
    updateLiveStats();
}

function addActivityItem(type, message) {
    const feed = document.getElementById('activity-feed');
    if (!feed) return;
    
    const icons = {
        block: 'fa-cube',
        transaction: 'fa-exchange-alt',
        price: 'fa-dollar-sign'
    };
    
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `
        <div class="activity-icon">
            <i class="fas ${icons[type] || 'fa-info'}"></i>
        </div>
        <div class="activity-content">
            <div class="activity-text">${message}</div>
            <div class="activity-time">Just now</div>
        </div>
    `;
    
    feed.insertBefore(item, feed.firstChild);
    
    // Limit to 50 items
    while (feed.children.length > 50) {
        feed.removeChild(feed.lastChild);
    }
}

// ============================================
// Charts
// ============================================
function initializeCharts() {
    const chartConfigs = {
        'price-chart': {
            type: 'line',
            label: 'Price (USD)',
            color: '#0ea5e9',
            data: { labels: [], values: [] }
        },
        'hashrate-chart': {
            type: 'line',
            label: 'Hashrate (PH/s)',
            color: '#8b5cf6',
            data: { labels: [], values: [] }
        },
        'tx-chart': {
            type: 'bar',
            label: 'Transactions',
            color: '#10b981',
            data: { labels: [], values: [] }
        },
        'difficulty-chart': {
            type: 'line',
            label: 'Difficulty',
            color: '#f59e0b',
            data: { labels: [], values: [] }
        }
    };
    
    Object.entries(chartConfigs).forEach(([id, config]) => {
        const canvas = document.getElementById(id);
        if (canvas) {
            charts[id] = createChart(canvas, config);
        }
    });
}

function createChart(canvas, config) {
    const ctx = canvas.getContext('2d');
    
    return new Chart(ctx, {
        type: config.type,
        data: {
            labels: config.data.labels,
            datasets: [{
                label: config.label,
                data: config.data.values,
                backgroundColor: config.type === 'bar' 
                    ? `${config.color}80` 
                    : `${config.color}20`,
                borderColor: config.color,
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#94a3b8'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#94a3b8'
                    }
                }
            }
        }
    });
}

function updateCharts() {
    // Update chart data with fresh information
    Object.keys(charts).forEach(chartId => {
        const chart = charts[chartId];
        if (chart) {
            // Update with new data
            chart.update();
        }
    });
}

// ============================================
// BlockDAG Visualization
// ============================================
let blockDAGAnimation = null;
let dagNodes = [];
let dagEdges = [];

function initializeBlockDAG() {
    const canvas = document.getElementById('blockdag-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    const resize = () => {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    
    // Initialize controls
    document.getElementById('dag-play')?.addEventListener('click', startBlockDAG);
    document.getElementById('dag-pause')?.addEventListener('click', pauseBlockDAG);
    document.getElementById('dag-reset')?.addEventListener('click', resetBlockDAG);
}

function startBlockDAG() {
    if (blockDAGAnimation) return;
    
    const canvas = document.getElementById('blockdag-canvas');
    const ctx = canvas.getContext('2d');
    
    // Generate initial DAG structure
    generateDAGNodes();
    
    let frame = 0;
    blockDAGAnimation = setInterval(() => {
        drawBlockDAG(ctx, canvas.width, canvas.height, frame);
        frame++;
        
        // Update stats
        document.getElementById('dag-nodes').textContent = dagNodes.length;
        document.getElementById('dag-edges').textContent = dagEdges.length;
        document.getElementById('dag-fps').textContent = '60';
        
        // Add new node occasionally
        if (frame % 60 === 0) {
            addDAGNode();
        }
    }, 1000 / 60);
}

function pauseBlockDAG() {
    if (blockDAGAnimation) {
        clearInterval(blockDAGAnimation);
        blockDAGAnimation = null;
    }
}

function resetBlockDAG() {
    pauseBlockDAG();
    dagNodes = [];
    dagEdges = [];
    const canvas = document.getElementById('blockdag-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function generateDAGNodes() {
    dagNodes = [];
    dagEdges = [];
    
    for (let i = 0; i < 50; i++) {
        addDAGNode();
    }
}

function addDAGNode() {
    const canvas = document.getElementById('blockdag-canvas');
    if (!canvas) return;
    
    const node = {
        id: dagNodes.length,
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: 5,
        color: '#0ea5e9'
    };
    
    dagNodes.push(node);
    
    // Connect to previous nodes
    if (dagNodes.length > 1) {
        const numConnections = Math.min(3, dagNodes.length - 1);
        for (let i = 0; i < numConnections; i++) {
            const targetIndex = Math.floor(Math.random() * (dagNodes.length - 1));
            dagEdges.push({
                from: dagNodes.length - 1,
                to: targetIndex
            });
        }
    }
}

function drawBlockDAG(ctx, width, height, frame) {
    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, width, height);
    
    // Update node positions
    dagNodes.forEach(node => {
        node.x += node.vx;
        node.y += node.vy;
        
        // Bounce off edges
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;
    });
    
    // Draw edges
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.2)';
    ctx.lineWidth = 1;
    dagEdges.forEach(edge => {
        const from = dagNodes[edge.from];
        const to = dagNodes[edge.to];
        if (from && to) {
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
        }
    });
    
    // Draw nodes
    dagNodes.forEach(node => {
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = node.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    });
}

// ============================================
// Data Refresh
// ============================================
function initializeRefreshTimer() {
    // Start initial countdown
    startRefreshTimer();
    
    // Initial data fetch
    refreshAllData();
}

function startRefreshTimer() {
    // Clear any existing timer
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
    }
    
    // Reset to 60 seconds
    state.refreshTimer = 60;
    updateTimerDisplay();
    
    // Update every second
    state.timerInterval = setInterval(() => {
        state.refreshTimer--;
        updateTimerDisplay();
        
        // When timer hits 0, refresh and restart
        if (state.refreshTimer <= 0) {
            refreshAllData();
            state.refreshTimer = 60;
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerText = document.getElementById('timer-text');
    const timerProgress = document.getElementById('timer-progress');
    
    if (timerText) {
        timerText.textContent = state.refreshTimer;
    }
    
    if (timerProgress) {
        // Calculate percentage (60s = 100%)
        const percentage = (state.refreshTimer / 60) * 100;
        timerProgress.setAttribute('stroke-dasharray', `${percentage}, 100`);
    }
}

function refreshAllData() {
    console.log('Refreshing all data...');
    
    // Fetch all data (fetchPriceData is now included in fetchNetworkInfo)
    Promise.all([
        fetchNetworkInfo(),
        fetchLatestBlocks(),
        fetchLatestTransactions()
    ]).then(() => {
        updateUI();
        console.log('Data refresh complete');
    }).catch(error => {
        console.error('Error refreshing data:', error);
    });
}

function startDataRefresh() {
    // Refresh data every 10 seconds
    setInterval(() => {
        fetchNetworkInfo();
        fetchPriceData();
        fetchLatestBlocks();
        fetchLatestTransactions();
        updateUI();
    }, 10000);
}

// ============================================
// Utility Functions
// ============================================
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toLocaleString();
}

// Truncate a number to a fixed number of decimal places without rounding
function truncateDecimals(num, decimals) {
    if (num === null || num === undefined || isNaN(num)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.floor(num * factor) / factor;
}

function formatBytes(bytes) {
    if (bytes >= 1e6) return (bytes / 1e6).toFixed(2) + ' MB';
    if (bytes >= 1e3) return (bytes / 1e3).toFixed(2) + ' KB';
    return bytes + ' B';
}

function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return Math.floor(diff / 1000) + 's ago';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return new Date(timestamp).toLocaleDateString();
}

function truncateHash(hash) {
    if (!hash || hash.length < 16) return hash;
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 6)}`;
}

function generateMockHash() {
    return Array.from({ length: 64 }, () => 
        Math.floor(Math.random() * 16).toString(16)
    ).join('');
}

function showError(message) {
    console.error(message);
}

function displayAddressInfo(address, data) {
    console.log('Address:', address, data);
}

function displayTransactionInfo(data) {
    console.log('Transaction:', data);
}

function displayBlockInfo(data) {
    console.log('Block:', data);
}

// ============================================
// Landing Page Price Loading
// ============================================
async function fetchLandingPagePrices() {
    try {
        const [priceRes, coingeckoRes] = await Promise.all([
            fetch('https://api.kaspa.org/info/price'),
            fetch('https://api.coingecko.com/api/v3/simple/price?ids=kaspa&vs_currencies=usd&include_24hr_change=true&include_7d_change=true&include_market_cap=true&include_24hr_vol=true')
        ]);
        
        const price = await priceRes.json();
        const coingecko = coingeckoRes.ok ? await coingeckoRes.json() : null;
        
        // Update price state
        if (coingecko && coingecko.kaspa) {
            state.price.current = coingecko.kaspa.usd || price?.price || 0;
            state.price.change24h = coingecko.kaspa.usd_24h_change || 0;
            state.price.change7d = coingecko.kaspa.usd_7d_change || 0;
            state.price.marketCap = coingecko.kaspa.usd_market_cap || 0;
            state.price.volume24h = coingecko.kaspa.usd_24h_vol || 0;
        } else if (price?.price) {
            state.price.current = price.price;
            state.price.change24h = 0;
        }
        
        updateQuickStats();
    } catch (error) {
        console.error('Error fetching landing page prices:', error);
    }
}

// ============================================
// Export for debugging
// ============================================
window.KaspaExplorer = {
    state,
    switchView,
    updateUI,
    charts,
    refreshAllData,
    fetchLandingPagePrices
};
