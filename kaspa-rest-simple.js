const express = require('express');
const WebSocket = require('ws');
const app = express();
const PORT = 8082;

// Kaspad wRPC connection
let kaspadWs = null;
let requestId = 0;
const pendingRequests = new Map();

// Connect to kaspad via WebSocket wRPC
function connectToKaspad() {
    kaspadWs = new WebSocket('ws://localhost:18110');
    
    kaspadWs.on('open', () => {
        console.log('✅ Connected to kaspad wRPC on port 18110');
    });
    
    kaspadWs.on('message', (data) => {
        try {
            const response = JSON.parse(data.toString());
            if (response.id && pendingRequests.has(response.id)) {
                const { resolve, reject } = pendingRequests.get(response.id);
                pendingRequests.delete(response.id);
                
                if (response.error) {
                    reject(new Error(response.error.message || 'RPC error'));
                } else {
                    resolve(response.result || response);
                }
            }
        } catch (err) {
            console.error('Parse error:', err);
        }
    });
    
    kaspadWs.on('error', (err) => {
        console.error('Kaspad WebSocket error:', err.message);
    });
    
    kaspadWs.on('close', () => {
        console.log('Kaspad connection closed, reconnecting in 5s...');
        setTimeout(connectToKaspad, 5000);
    });
}

// Send RPC request to kaspad
function sendRPC(method, params = {}) {
    return new Promise((resolve, reject) => {
        if (!kaspadWs || kaspadWs.readyState !== WebSocket.OPEN) {
            return reject(new Error('Kaspad not connected'));
        }
        
        const id = ++requestId;
        const request = {
            id,
            method,
            params
        };
        
        pendingRequests.set(id, { resolve, reject });
        
        kaspadWs.send(JSON.stringify(request));
        
        // Timeout after 10s
        setTimeout(() => {
            if (pendingRequests.has(id)) {
                pendingRequests.delete(id);
                reject(new Error('RPC timeout'));
            }
        }, 10000);
    });
}

// Health check
app.get('/health', async (req, res) => {
    try {
        const info = await sendRPC('getServerInfo');
        res.json({
            status: 'ok',
            network: 'kaspa-mainnet',
            source: 'local kaspad',
            isSynced: info.isSynced,
            serverVersion: info.serverVersion
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            error: error.message 
        });
    }
});

// Network Info
app.get('/info/network', async (req, res) => {
    try {
        const info = await sendRPC('getServerInfo');
        res.json({
            network: 'kaspa-mainnet',
            version: info.serverVersion || '1.0.1',
            isSynced: info.isSynced,
            isUtxoIndexed: info.isUtxoIndexed
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Block DAG Info
app.get('/info/blockdag', async (req, res) => {
    try {
        const info = await sendRPC('getBlockDagInfo');
        res.json({
            difficulty: info.difficulty || 0,
            tipHashes: info.tipHashes || [],
            virtualParentHashes: info.virtualParentHashes || []
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Virtual Chain Blue Score
app.get('/info/virtual-chain-blue-score', async (req, res) => {
    try {
        const info = await sendRPC('getBlockDagInfo');
        res.json({
            blueScore: info.virtualDaaScore || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Coin Supply
app.get('/info/coinsupply', async (req, res) => {
    try {
        const info = await sendRPC('getCoinSupply');
        const sompiPerKaspa = 100000000;
        res.json({
            totalSupply: (info.circulatingSompi || 0) / sompiPerKaspa,
            circulatingSupply: (info.circulatingSompi || 0) / sompiPerKaspa,
            maxSupply: 28704026601.692
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Latest Blocks
app.get('/blocks/latest', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const dagInfo = await sendRPC('getBlockDagInfo');
        const tipHash = dagInfo.tipHashes[0];
        
        const blocks = [];
        let currentHash = tipHash;
        
        for (let i = 0; i < limit && currentHash; i++) {
            try {
                const block = await sendRPC('getBlock', { 
                    hash: currentHash, 
                    includeTransactions: true 
                });
                const header = block.header;
                
                blocks.push({
                    hash: currentHash,
                    timestamp: Number(header.timestamp),
                    blueScore: Number(header.blueScore),
                    transactionCount: block.transactions?.length || 0,
                    difficulty: Number(header.bits),
                    parentHashes: header.parentHashes || []
                });
                
                currentHash = header.parentHashes?.[0];
            } catch (err) {
                console.error('Error fetching block:', err);
                break;
            }
        }
        
        res.json(blocks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Latest Transactions
app.get('/transactions/latest', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const dagInfo = await sendRPC('getBlockDagInfo');
        const virtualHash = dagInfo.virtualParentHashes[0];
        
        const block = await sendRPC('getBlock', { 
            hash: virtualHash, 
            includeTransactions: true 
        });
        
        const transactions = (block.transactions || []).slice(0, limit).map(tx => ({
            id: tx.verboseData?.transactionId || tx.hash || 'unknown',
            inputs: tx.inputs?.length || 0,
            outputs: tx.outputs?.length || 0,
            mass: tx.mass || 0,
            timestamp: Date.now()
        }));
        
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server and connect to kaspad
connectToKaspad();

app.listen(PORT, () => {
    console.log(`Kaspa REST API running on port ${PORT}`);
    console.log('Connecting to local kaspad on ws://localhost:18110');
});
