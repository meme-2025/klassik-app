const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 8082;

// CoinGecko for price data
const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const KASPA_API = 'https://api.kaspa.org';

app.use(cors());
app.use(express.json());

// Proxy helper
async function kaspaApiCall(endpoint) {
    try {
        const response = await axios.get(`${KASPA_API}${endpoint}`, {
            timeout: 10000
        });
        return response.data;
    } catch (error) {
        console.error(`❌ API call ${endpoint} failed:`, error.message);
        throw error;
    }
}

// Health check
app.get('/health', async (req, res) => {
    try {
        const info = await kaspaApiCall('/info/network');
        res.json({
            status: 'healthy',
            source: 'api.kaspa.org-corrected',
            kaspad: {
                connected: true,
                network: info.networkName
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Network info
app.get('/info/network', async (req, res) => {
    try {
        const data = await kaspaApiCall('/info/network');
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// BlockDAG info
app.get('/info/blockdag', async (req, res) => {
    try {
        const data = await kaspaApiCall('/info/blockdag');
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Virtual chain blue score
app.get('/info/virtual-chain-blue-score', async (req, res) => {
    try {
        const data = await kaspaApiCall('/info/virtual-chain-blue-score');
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Coin supply
app.get('/info/coinsupply', async (req, res) => {
    try {
        const data = await kaspaApiCall('/info/coinsupply/circulating');
        if (data && typeof data === 'number') {
            res.json({
                circulatingSompi: (data * 100000000).toString(),
                totalSompi: (data * 100000000).toString()
            });
        } else {
            res.json(data);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Block reward - CORRECTED CALCULATION
app.get('/info/blockreward', async (req, res) => {
    try {
        const blockdag = await kaspaApiCall('/info/blockdag');
        const daaScore = parseInt(blockdag.virtualDaaScore || blockdag.blockCount);
        
        // Kaspa emission: starts at 440 KAS, halves every 12 months
        const blocksPerHalving = 31536000; // 365.25 days * 24h * 3600s
        const halvingPhase = Math.floor(daaScore / blocksPerHalving);
        
        let currentReward = 440;
        for (let i = 0; i < halvingPhase; i++) {
            currentReward /= 2;
        }
        
        const rewardSompi = Math.floor(currentReward * 100000000);
        
        console.log(`✅ Block Reward: ${currentReward} KAS (Phase ${halvingPhase}) at DAA ${daaScore}`);
        
        res.json({
            blockreward: rewardSompi.toString(),
            blockrewardKAS: currentReward,
            halvingPhase: halvingPhase
        });
    } catch (error) {
        console.error('❌ /info/blockreward error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Halving info - CORRECTED CALCULATION
app.get('/info/halving', async (req, res) => {
    try {
        const blockdag = await kaspaApiCall('/info/blockdag');
        const daaScore = parseInt(blockdag.virtualDaaScore || blockdag.blockCount);
        
        const blocksPerHalving = 31536000;
        const currentPhase = Math.floor(daaScore / blocksPerHalving);
        const nextHalvingBlock = (currentPhase + 1) * blocksPerHalving;
        const blocksUntilHalving = nextHalvingBlock - daaScore;
        const daysUntilHalving = blocksUntilHalving / (24 * 3600);
        
        res.json({
            currentPhase: currentPhase,
            nextHalvingDaaScore: nextHalvingBlock.toString(),
            blocksUntilHalving: blocksUntilHalving.toString(),
            daysUntilHalving: daysUntilHalving.toFixed(1)
        });
    } catch (error) {
        console.error('❌ /info/halving error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Hashrate - CORRECTED CALCULATION
app.get('/info/hashrate', async (req, res) => {
    try {
        const blockdag = await kaspaApiCall('/info/blockdag');
        const difficulty = parseFloat(blockdag.difficulty);
        
        // Kaspa Hashrate: H/s = (difficulty * 2^32) / block_time
        // Block time = 1 second
        const hashrate = difficulty * Math.pow(2, 32);
        
        console.log(`✅ Hashrate: ${(hashrate / 1e15).toFixed(2)} PH/s from difficulty ${difficulty}`);
        
        res.json({
            hashrate: hashrate,
            hashrateFormatted: formatHashrate(hashrate),
            difficulty: difficulty
        });
    } catch (error) {
        console.error('❌ /info/hashrate error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Latest blocks
app.get('/blocks/latest', async (req, res) => {
    try {
        const limit = req.query.limit || 10;
        const data = await kaspaApiCall(`/blocks?limit=${limit}&resolve=light`);
        
        if (Array.isArray(data)) {
            res.json({ blocks: data });
        } else if (data.blocks) {
            res.json(data);
        } else {
            res.json({ blocks: [] });
        }
    } catch (error) {
        res.status(500).json({ error: error.message, blocks: [] });
    }
});

// Latest transactions
app.get('/transactions/latest', async (req, res) => {
    try {
        const limit = req.query.limit || 10;
        const data = await kaspaApiCall(`/transactions?limit=${limit}&resolve=light`);
        
        if (Array.isArray(data)) {
            res.json({ transactions: data });
        } else if (data.transactions) {
            res.json(data);
        } else {
            res.json({ transactions: [] });
        }
    } catch (error) {
        res.status(500).json({ error: error.message, transactions: [] });
    }
});

// Price (from CoinGecko)
app.get('/info/price', async (req, res) => {
    try {
        const response = await axios.get(`${COINGECKO_API}/simple/price`, {
            params: {
                ids: 'kaspa',
                vs_currencies: 'usd',
                include_24hr_change: 'true',
                include_24hr_vol: 'true'
            },
            timeout: 5000
        });
        res.json(response.data);
    } catch (error) {
        console.error('❌ /info/price error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Market cap (from CoinGecko)
app.get('/info/marketcap', async (req, res) => {
    try {
        const response = await axios.get(`${COINGECKO_API}/simple/price`, {
            params: {
                ids: 'kaspa',
                vs_currencies: 'usd',
                include_market_cap: 'true'
            },
            timeout: 5000
        });
        res.json(response.data);
    } catch (error) {
        console.error('❌ /info/marketcap error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper function
function formatHashrate(hashrate) {
    const units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s'];
    let value = hashrate;
    let unitIndex = 0;
    
    while (value >= 1000 && unitIndex < units.length - 1) {
        value /= 1000;
        unitIndex++;
    }
    
    return `${value.toFixed(2)} ${units[unitIndex]}`;
}

// Start server
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`✅ Kaspa REST API (Corrected) listening on port ${PORT}`);
    console.log(`📡 Upstream: api.kaspa.org with corrected calculations`);
    console.log(`💰 CoinGecko for price/market data`);
    
    try {
        const info = await kaspaApiCall('/info/network');
        console.log(`✅ Kaspa Network: ${info.networkName}`);
    } catch (error) {
        console.error(`❌ Warning: ${error.message}`);
    }
});
