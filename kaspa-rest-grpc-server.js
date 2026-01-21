const express = require('express');
const cors = require('cors');
const { Client } = require('@kaspa/grpc-node');

const app = express();
const PORT = 8082;

// Kaspad gRPC connection
const KASPAD_HOST = '127.0.0.1:16110';
let rpcClient = null;

// Initialize gRPC client
async function initRpcClient() {
    try {
        console.log(`🔌 Connecting to kaspad gRPC at ${KASPAD_HOST}...`);
        rpcClient = new Client({
            host: KASPAD_HOST,
            reconnect: true,
            verbose: false
        });
        
        await rpcClient.connect();
        console.log('✅ Connected to kaspad via gRPC');
        
        // Test connection
        const info = await rpcClient.call('getBlockDagInfoRequest', {});
        console.log(`✅ BlockDAG Info - Network: ${info.networkName}, DAA Score: ${info.virtualDaaScore}`);
        
        return true;
    } catch (error) {
        console.error('❌ gRPC connection failed:', error.message);
        return false;
    }
}

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
    try {
        if (!rpcClient) {
            return res.status(503).json({ error: 'RPC client not initialized' });
        }
        
        const info = await rpcClient.call('getBlockDagInfoRequest', {});
        res.json({
            status: 'healthy',
            kaspad: {
                connected: true,
                network: info.networkName,
                blockCount: info.blockCount,
                tipHashes: info.tipHashes,
                virtualDaaScore: info.virtualDaaScore
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Network info
app.get('/info/network', async (req, res) => {
    try {
        const info = await rpcClient.call('getBlockDagInfoRequest', {});
        res.json({
            networkName: info.networkName,
            blockCount: info.blockCount,
            headerCount: info.headerCount,
            tipHashes: info.tipHashes,
            difficulty: info.difficulty,
            pastMedianTime: info.pastMedianTime,
            virtualParentHashes: info.virtualParentHashes,
            pruningPointHash: info.pruningPointHash,
            virtualDaaScore: info.virtualDaaScore
        });
    } catch (error) {
        console.error('❌ /info/network error:', error);
        res.status(500).json({ error: error.message });
    }
});

// BlockDAG info
app.get('/info/blockdag', async (req, res) => {
    try {
        const info = await rpcClient.call('getBlockDagInfoRequest', {});
        res.json({
            networkName: info.networkName,
            blockCount: info.blockCount,
            headerCount: info.headerCount,
            tipHashes: info.tipHashes,
            difficulty: info.difficulty,
            pastMedianTime: info.pastMedianTime,
            virtualParentHashes: info.virtualParentHashes,
            pruningPointHash: info.pruningPointHash,
            virtualDaaScore: info.virtualDaaScore
        });
    } catch (error) {
        console.error('❌ /info/blockdag error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Virtual chain blue score
app.get('/info/virtual-chain-blue-score', async (req, res) => {
    try {
        const info = await rpcClient.call('getBlockDagInfoRequest', {});
        res.json({
            blueScore: info.virtualDaaScore.toString()
        });
    } catch (error) {
        console.error('❌ /info/virtual-chain-blue-score error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Coin supply
app.get('/info/coinsupply', async (req, res) => {
    try {
        const supply = await rpcClient.call('getCoinSupplyRequest', {});
        res.json({
            circulatingSompi: supply.circulatingSompi.toString(),
            totalSompi: supply.totalSompi ? supply.totalSompi.toString() : supply.circulatingSompi.toString(),
            maxSompi: supply.maxSompi ? supply.maxSompi.toString() : '28700000000000000'
        });
    } catch (error) {
        console.error('❌ /info/coinsupply error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Block reward (estimated from latest block)
app.get('/info/blockreward', async (req, res) => {
    try {
        const info = await rpcClient.call('getBlockDagInfoRequest', {});
        const blockHash = info.tipHashes[0];
        const block = await rpcClient.call('getBlockRequest', { hash: blockHash, includeTransactions: true });
        
        // Find coinbase transaction (first tx in block)
        if (block.transactions && block.transactions.length > 0) {
            const coinbaseTx = block.transactions[0];
            if (coinbaseTx.outputs && coinbaseTx.outputs.length > 0) {
                const reward = coinbaseTx.outputs.reduce((sum, output) => sum + BigInt(output.value), BigInt(0));
                res.json({
                    blockreward: reward.toString()
                });
                return;
            }
        }
        
        // Fallback: estimated block reward based on DAA score
        const daaScore = BigInt(info.virtualDaaScore);
        const monthsPerHalving = BigInt(12);
        const blocksPerMonth = BigInt(2628000); // 30.5 days * 24h * 3600s * 1 block/s
        const blocksPerHalving = monthsPerHalving * blocksPerMonth;
        
        let currentReward = BigInt(44000000000); // 440 KAS initial
        let halving = daaScore / blocksPerHalving;
        
        for (let i = BigInt(0); i < halving; i++) {
            currentReward = currentReward / BigInt(2);
        }
        
        res.json({
            blockreward: currentReward.toString(),
            estimated: true
        });
    } catch (error) {
        console.error('❌ /info/blockreward error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Halving info
app.get('/info/halving', async (req, res) => {
    try {
        const info = await rpcClient.call('getBlockDagInfoRequest', {});
        const daaScore = BigInt(info.virtualDaaScore);
        
        const monthsPerHalving = BigInt(12);
        const blocksPerMonth = BigInt(2628000);
        const blocksPerHalving = monthsPerHalving * blocksPerMonth;
        
        const currentHalving = daaScore / blocksPerHalving;
        const nextHalvingDaa = (currentHalving + BigInt(1)) * blocksPerHalving;
        const blocksUntilHalving = nextHalvingDaa - daaScore;
        
        res.json({
            currentPhase: currentHalving.toString(),
            nextHalvingDaaScore: nextHalvingDaa.toString(),
            blocksUntilHalving: blocksUntilHalving.toString()
        });
    } catch (error) {
        console.error('❌ /info/halving error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Hashrate (calculated from difficulty)
app.get('/info/hashrate', async (req, res) => {
    try {
        const info = await rpcClient.call('getBlockDagInfoRequest', {});
        const difficulty = parseFloat(info.difficulty);
        
        // Hashrate calculation: difficulty * blocks_per_second / 2
        // Kaspa: 1 block per second (BPS = 1)
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
        const info = await rpcClient.call('getBlockDagInfoRequest', {});
        
        const blocks = [];
        const tipHash = info.tipHashes[0];
        
        let currentHash = tipHash;
        for (let i = 0; i < limit; i++) {
            try {
                const block = await rpcClient.call('getBlockRequest', { hash: currentHash, includeTransactions: true });
                
                blocks.push({
                    hash: currentHash,
                    timestamp: block.header.timestamp,
                    blueScore: block.header.daaScore,
                    parentHashes: block.header.parentHashes,
                    difficulty: block.header.bits,
                    transactionCount: block.transactions ? block.transactions.length : 0,
                    transactions: block.transactions || []
                });
                
                // Get parent block for next iteration
                if (block.header.parentHashes && block.header.parentHashes.length > 0) {
                    currentHash = block.header.parentHashes[0];
                } else {
                    break;
                }
            } catch (blockError) {
                console.error(`❌ Error fetching block ${currentHash}:`, blockError.message);
                break;
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
        const info = await rpcClient.call('getBlockDagInfoRequest', {});
        
        const transactions = [];
        const tipHash = info.tipHashes[0];
        
        let currentHash = tipHash;
        let blocksChecked = 0;
        
        while (transactions.length < limit && blocksChecked < 50) {
            try {
                const block = await rpcClient.call('getBlockRequest', { hash: currentHash, includeTransactions: true });
                
                if (block.transactions) {
                    for (const tx of block.transactions) {
                        if (transactions.length >= limit) break;
                        
                        transactions.push({
                            txId: tx.verboseData?.transactionId || 'unknown',
                            blockHash: currentHash,
                            timestamp: block.header.timestamp,
                            inputs: tx.inputs || [],
                            outputs: tx.outputs || [],
                            mass: tx.mass || 0
                        });
                    }
                }
                
                // Get parent block
                if (block.header.parentHashes && block.header.parentHashes.length > 0) {
                    currentHash = block.header.parentHashes[0];
                } else {
                    break;
                }
                
                blocksChecked++;
            } catch (blockError) {
                console.error(`❌ Error fetching block ${currentHash}:`, blockError.message);
                break;
            }
        }
        
        res.json({ transactions });
    } catch (error) {
        console.error('❌ /transactions/latest error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper function to format hashrate
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
async function startServer() {
    const connected = await initRpcClient();
    
    if (!connected) {
        console.error('❌ Failed to connect to kaspad - exiting');
        process.exit(1);
    }
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Kaspa REST API (gRPC) listening on port ${PORT}`);
        console.log(`📡 Connected to kaspad at ${KASPAD_HOST}`);
    });
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('⏸️  SIGTERM received, closing connections...');
    if (rpcClient) {
        await rpcClient.disconnect();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('⏸️  SIGINT received, closing connections...');
    if (rpcClient) {
        await rpcClient.disconnect();
    }
    process.exit(0);
});

startServer().catch(err => {
    console.error('❌ Server failed to start:', err);
    process.exit(1);
});
