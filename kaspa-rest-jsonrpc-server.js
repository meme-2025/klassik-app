const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 8082;

// CoinGecko for price data (as user requested)
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Use JSON-RPC on port 18110 as it's more stable
const KASPAD_RPC_URL = 'http://127.0.0.1:18110';

app.use(cors());
app.use(express.json());

// JSON-RPC helper
async function kaspadRpc(method, params = []) {
    try {
        const response = await axios.post(KASPAD_RPC_URL, {
            jsonrpc: '2.0',
            id: Date.now(),
            method: method,
            params: params
        }, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.data.error) {
            throw new Error(response.data.error.message || JSON.stringify(response.data.error));
        }
        
        return response.data.result;
    } catch (error) {
        console.error(`❌ RPC call ${method} failed:`, error.message);
        throw error;
    }
}

// Health check
app.get('/health', async (req, res) => {
    try {
        const info = await kaspadRpc('getInfo');
        res.json({
            status: 'healthy',
            kaspad: {
                connected: true,
                isSynced: info.isSynced,
                serverVersion: info.serverVersion,
                mempoolSize: info.mempoolSize,
                connections: info.connections
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Network info
app.get('/info/network', async (req, res) => {
    try {
        const info = await kaspadRpc('getInfo');
        res.json({
            networkName: 'kaspa-mainnet',
            isSynced: info.isSynced,
            serverVersion: info.serverVersion,
            mempoolSize: info.mempoolSize,
            connections: info.connections
        });
    } catch (error) {
        console.error('❌ /info/network error:', error);
        res.status(500).json({ error: error.message });
    }
});

// BlockDAG info
app.get('/info/blockdag', async (req, res) => {
    try {
        const blockCount = await kaspadRpc('getBlockCount');
        const info = await kaspadRpc('getInfo');
        
        res.json({
            networkName: 'kaspa-mainnet',
            blockCount: blockCount,
            isSynced: info.isSynced,
            difficulty: info.difficulty,
            serverVersion: info.serverVersion
        });
    } catch (error) {
        console.error('❌ /info/blockdag error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Virtual chain blue score (use block count as proxy)
app.get('/info/virtual-chain-blue-score', async (req, res) => {
    try {
        const blockCount = await kaspadRpc('getBlockCount');
        res.json({
            blueScore: blockCount.toString()
        });
    } catch (error) {
        console.error('❌ /info/virtual-chain-blue-score error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Coin supply
app.get('/info/coinsupply', async (req, res) => {
    try {
        // Kaspa emission schedule: start at 440 KAS per block, halves every 12 months
        // Block time: 1 second, blocks per month ~= 2,628,000
        const blockCount = await kaspadRpc('getBlockCount');
        const blocksPerMonth = 2628000;
        const monthsPerHalving = 12;
        const blocksPerHalving = monthsPerMonth * monthsPerHalving;
        
        let totalSupply = 0;
        let currentReward = 440;
        let blocksProcessed = 0;
        
        while (blocksProcessed < blockCount) {
            const blocksInThisPhase = Math.min(blocksPerHalving, blockCount - blocksProcessed);
            totalSupply += blocksInThisPhase * currentReward;
            blocksProcessed += blocksInThisPhase;
            currentReward /= 2;
        }
        
        // Convert to sompi (1 KAS = 100,000,000 sompi)
        const circulatingSompi = BigInt(Math.floor(totalSupply * 100000000));
        const maxSompi = BigInt('28700000000000000'); // 287 billion KAS max supply
        
        res.json({
            circulatingSompi: circulatingSompi.toString(),
            totalSompi: circulatingSompi.toString(),
            maxSompi: maxSompi.toString()
        });
    } catch (error) {
        console.error('❌ /info/coinsupply error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Block reward
app.get('/info/blockreward', async (req, res) => {
    try {
        const blockCount = await kaspadRpc('getBlockCount');
        const blocksPerMonth = 2628000;
        const monthsPerHalving = 12;
        const blocksPerHalving = blocksPerMonth * monthsPerHalving;
        
        const halvingPhase = Math.floor(blockCount / blocksPerHalving);
        let currentReward = 440;
        for (let i = 0; i < halvingPhase; i++) {
            currentReward /= 2;
        }
        
        // Convert to sompi
        const rewardSompi = BigInt(Math.floor(currentReward * 100000000));
        
        res.json({
            blockreward: rewardSompi.toString()
        });
    } catch (error) {
        console.error('❌ /info/blockreward error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Halving info
app.get('/info/halving', async (req, res) => {
    try {
        const blockCount = await kaspadRpc('getBlockCount');
        const blocksPerMonth = 2628000;
        const monthsPerHalving = 12;
        const blocksPerHalving = blocksPerMonth * monthsPerHalving;
        
        const currentPhase = Math.floor(blockCount / blocksPerHalving);
        const nextHalvingBlock = (currentPhase + 1) * blocksPerHalving;
        const blocksUntilHalving = nextHalvingBlock - blockCount;
        
        res.json({
            currentPhase: currentPhase.toString(),
            nextHalvingDaaScore: nextHalvingBlock.toString(),
            blocksUntilHalving: blocksUntilHalving.toString()
        });
    } catch (error) {
        console.error('❌ /info/halving error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Hashrate
app.get('/info/hashrate', async (req, res) => {
    try {
        const info = await kaspadRpc('getInfo');
        const difficulty = parseFloat(info.difficulty);
        
        // Hashrate = difficulty * blocks_per_second / 2
        // Kaspa: 1 BPS
        const hashrate = (difficulty * 1) / 2;
        
        res.json({
            hashrate: hashrate.toString(),
            hashrateFormatted: formatHashrate(hashrate),
            difficulty: info.difficulty.toString()
        });
    } catch (error) {
        console.error('❌ /info/hashrate error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Latest blocks
app.get('/blocks/latest', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const blockCount = await kaspadRpc('getBlockCount');
        
        const blocks = [];
        for (let i = 0; i < limit; i++) {
            try {
                const height = blockCount - i;
                if (height < 1) break;
                
                const blockHash = await kaspadRpc('getBlockHash', [height]);
                const block = await kaspadRpc('getBlock', [blockHash]);
                
                blocks.push({
                    hash: blockHash,
                    height: height,
                    timestamp: block.time,
                    difficulty: block.difficulty,
                    transactionCount: block.tx ? block.tx.length : 0,
                    transactions: block.tx || []
                });
            } catch (blockError) {
                console.error(`❌ Error fetching block at height ${blockCount - i}:`, blockError.message);
            }
        }
        
        res.json({ blocks });
    } catch (error) {
        console.error('❌ /blocks/latest error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Latest transactions
app.get('/transactions/latest', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const blockCount = await kaspadRpc('getBlockCount');
        
        const transactions = [];
        let blocksChecked = 0;
        
        while (transactions.length < limit && blocksChecked < 50) {
            try {
                const height = blockCount - blocksChecked;
                if (height < 1) break;
                
                const blockHash = await kaspadRpc('getBlockHash', [height]);
                const block = await kaspadRpc('getBlock', [blockHash]);
                
                if (block.tx && Array.isArray(block.tx)) {
                    for (const txid of block.tx) {
                        if (transactions.length >= limit) break;
                        
                        try {
                            const tx = await kaspadRpc('getRawTransaction', [txid, 1]);
                            transactions.push({
                                txId: txid,
                                blockHash: blockHash,
                                blockHeight: height,
                                timestamp: block.time,
                                size: tx.size || 0,
                                vin: tx.vin || [],
                                vout: tx.vout || []
                            });
                        } catch (txError) {
                            // Skip failed transactions
                        }
                    }
                }
                
                blocksChecked++;
            } catch (blockError) {
                console.error(`❌ Error fetching transactions from block ${blockCount - blocksChecked}:`, blockError.message);
                blocksChecked++;
            }
        }
        
        res.json({ transactions });
    } catch (error) {
        console.error('❌ /transactions/latest error:', error);
        res.status(500).json({ error: error.message });
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
    console.log(`✅ Kaspa REST API (JSON-RPC) listening on port ${PORT}`);
    console.log(`📡 Connecting to kaspad JSON-RPC at ${KASPAD_RPC_URL}`);
    
    try {
        const info = await kaspadRpc('getInfo');
        console.log(`✅ Connected to kaspad: ${info.serverVersion}`);
        console.log(`📊 Synced: ${info.isSynced}, Connections: ${info.connections}`);
    } catch (error) {
        console.error(`❌ Warning: Could not connect to kaspad: ${error.message}`);
    }
});
