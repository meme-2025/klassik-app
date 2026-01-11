const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 8082;

// APIs
const KASPA_API = 'https://api.kaspa.org';
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

app.use(cors());
app.use(express.json());

// ============================================================
// KONSTANTEN
// ============================================================
const KASPA_MAX_SUPPLY = 28704026601.692; // KAS
const BLOCKS_PER_MONTH = 2628000; // 30.5 days * 86400 seconds * 1 BPS
const MONTHS_PER_HALVING = 12;
const BLOCKS_PER_HALVING = BLOCKS_PER_MONTH * MONTHS_PER_HALVING;
const INITIAL_BLOCK_REWARD = 440; // KAS

// ============================================================
// CACHE
// ============================================================
let bpsCache = {
  value: 1.0,
  timestamp: 0
};

let blockdagCache = {
  data: null,
  timestamp: 0
};

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

// Blockdag Info cachen (10 Sekunden)
async function getBlockdagInfo() {
  const now = Date.now();
  if (blockdagCache.data && (now - blockdagCache.timestamp < 10000)) {
    return blockdagCache.data;
  }

  try {
    const response = await axios.get(`${KASPA_API}/info/blockdag`, { timeout: 5000 });
    blockdagCache.data = response.data;
    blockdagCache.timestamp = now;
    return response.data;
  } catch (error) {
    console.error('❌ Blockdag fetch failed:', error.message);
    if (blockdagCache.data) return blockdagCache.data; // Return stale data
    throw error;
  }
}

// Exakte BPS Berechnung aus Block-Timestamps
async function calculateExactBPS() {
  try {
    // Cache für 30 Sekunden
    if (Date.now() - bpsCache.timestamp < 30000 && bpsCache.value) {
      return bpsCache.value;
    }

    const blockdag = await getBlockdagInfo();
    const tipHash = blockdag.tipHashes[0];
    
    // Hole 50 Blocks für BPS Berechnung
    const blocks = [];
    let currentHash = tipHash;
    
    for (let i = 0; i < 50 && blocks.length < 50; i++) {
      try {
        const block = await axios.get(`${KASPA_API}/blocks/${currentHash}`, { timeout: 3000 });
        blocks.push({
          timestamp: block.data.header.timestamp,
          blueScore: block.data.header.blueScore
        });
        
        if (block.data.header.parents && block.data.header.parents[0]) {
          currentHash = block.data.header.parents[0].parentHashes[0];
        } else {
          break;
        }
      } catch (e) {
        break;
      }
    }

    if (blocks.length < 10) {
      console.log('⚠️ Not enough blocks for BPS calculation, using default 1.0');
      return 1.0;
    }

    // Sortiere nach blueScore
    blocks.sort((a, b) => a.blueScore - b.blueScore);
    
    // Berechne BPS
    const firstBlock = blocks[0];
    const lastBlock = blocks[blocks.length - 1];
    const timeDiff = lastBlock.timestamp - firstBlock.timestamp; // milliseconds
    const scoreDiff = lastBlock.blueScore - firstBlock.blueScore;
    
    if (timeDiff > 0 && scoreDiff > 0) {
      const bps = (scoreDiff / timeDiff) * 1000; // blocks per second
      
      bpsCache = {
        value: bps,
        timestamp: Date.now()
      };
      
      console.log(`✅ BPS calculated: ${bps.toFixed(4)} from ${blocks.length} blocks`);
      return bps;
    }
    
    return 1.0;
  } catch (error) {
    console.error('❌ BPS calculation error:', error.message);
    return bpsCache.value || 1.0;
  }
}

// ============================================================
// ENDPOINTS
// ============================================================

// Health check
app.get('/health', async (req, res) => {
  try {
    const blockdag = await getBlockdagInfo();
    const bps = await calculateExactBPS();
    
    res.json({
      status: 'healthy',
      kaspad: {
        connected: true,
        blockCount: blockdag.blockCount,
        bps: bps,
        network: blockdag.networkName
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Network info
app.get('/info/network', async (req, res) => {
  try {
    const blockdag = await getBlockdagInfo();
    res.json({
      networkName: blockdag.networkName,
      blockCount: blockdag.blockCount,
      headerCount: blockdag.headerCount,
      tipHashes: blockdag.tipHashes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// BlockDAG info (mit BPS)
app.get('/info/blockdag', async (req, res) => {
  try {
    const blockdag = await getBlockdagInfo();
    const bps = await calculateExactBPS();
    
    res.json({
      networkName: blockdag.networkName,
      blockCount: blockdag.blockCount,
      headerCount: blockdag.headerCount,
      difficulty: blockdag.difficulty,
      tipHashes: blockdag.tipHashes,
      virtualDaaScore: blockdag.virtualDaaScore,
      bps: bps
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Virtual chain blue score
app.get('/info/virtual-chain-blue-score', async (req, res) => {
  try {
    const blockdag = await getBlockdagInfo();
    res.json({
      blueScore: blockdag.virtualDaaScore
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Coin supply
app.get('/info/coinsupply', async (req, res) => {
  try {
    const blockdag = await getBlockdagInfo();
    const blockHeight = blockdag.virtualDaaScore;
    
    // Berechne Emission basierend auf Halving-Phasen
    let totalSupply = 0;
    let currentReward = INITIAL_BLOCK_REWARD;
    let blocksProcessed = 0;
    
    while (blocksProcessed < blockHeight) {
      const blocksInPhase = Math.min(BLOCKS_PER_HALVING, blockHeight - blocksProcessed);
      totalSupply += blocksInPhase * currentReward;
      blocksProcessed += blocksInPhase;
      currentReward /= 2;
    }
    
    const circulatingKAS = Math.floor(totalSupply);
    const remainingKAS = Math.floor(KASPA_MAX_SUPPLY - circulatingKAS);
    
    res.json({
      circulatingSompi: (BigInt(circulatingKAS) * BigInt(100000000)).toString(),
      circulatingKAS: circulatingKAS,
      remainingKAS: remainingKAS,
      maxKAS: Math.floor(KASPA_MAX_SUPPLY),
      maxSompi: '2870402660169200000'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Block reward
app.get('/info/blockreward', async (req, res) => {
  try {
    const blockdag = await getBlockdagInfo();
    const blockHeight = blockdag.virtualDaaScore;
    
    // Berechne aktuelle Halving-Phase
    const halvingPhase = Math.floor(blockHeight / BLOCKS_PER_HALVING);
    let currentReward = INITIAL_BLOCK_REWARD;
    
    for (let i = 0; i < halvingPhase; i++) {
      currentReward /= 2;
    }
    
    res.json({
      blockreward: (currentReward * 100000000).toString(), // in sompi
      blockrewardKAS: currentReward,
      halvingPhase: halvingPhase
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Halving info mit Countdown
app.get('/info/halving', async (req, res) => {
  try {
    const blockdag = await getBlockdagInfo();
    const blockHeight = blockdag.virtualDaaScore;
    const bps = await calculateExactBPS();
    
    const currentPhase = Math.floor(blockHeight / BLOCKS_PER_HALVING);
    const nextHalvingBlock = (currentPhase + 1) * BLOCKS_PER_HALVING;
    const blocksUntilHalving = nextHalvingBlock - blockHeight;
    
    // Berechne Zeit bis zum Halving
    const secondsUntilHalving = blocksUntilHalving / bps;
    const daysUntilHalving = secondsUntilHalving / 86400;
    const hoursUntilHalving = (secondsUntilHalving % 86400) / 3600;
    const minutesUntilHalving = (secondsUntilHalving % 3600) / 60;
    
    // Countdown String
    const days = Math.floor(daysUntilHalving);
    const hours = Math.floor(hoursUntilHalving);
    const minutes = Math.floor(minutesUntilHalving);
    const countdown = `${days}d ${hours}h ${minutes}m`;
    
    res.json({
      currentPhase: currentPhase,
      nextHalvingDaaScore: nextHalvingBlock,
      blocksUntilHalving: blocksUntilHalving,
      secondsUntilHalving: Math.floor(secondsUntilHalving),
      daysUntilHalving: daysUntilHalving.toFixed(2),
      countdown: countdown
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Hashrate (korrigierte Formel)
app.get('/info/hashrate', async (req, res) => {
  try {
    const blockdag = await getBlockdagInfo();
    const bps = await calculateExactBPS();
    
    const difficulty = parseFloat(blockdag.difficulty);
    
    // Korrekte Formel: Hashrate = difficulty * BPS * 2
    const hashrate = difficulty * bps * 2;
    
    res.json({
      hashrate: hashrate,
      hashrateFormatted: formatHashrate(hashrate),
      difficulty: difficulty,
      bps: bps
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Latest blocks
app.get('/blocks/latest', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const blockdag = await getBlockdagInfo();
    const tipHash = blockdag.tipHashes[0];
    
    const blocks = [];
    let currentHash = tipHash;
    
    for (let i = 0; i < limit && blocks.length < limit; i++) {
      try {
        const block = await axios.get(`${KASPA_API}/blocks/${currentHash}`, { timeout: 3000 });
        const blockData = block.data;
        
        blocks.push({
          hash: currentHash,
          timestamp: blockData.header.timestamp,
          blueScore: blockData.header.blueScore,
          difficulty: blockData.header.bits,
          transactionCount: blockData.transactions ? blockData.transactions.length : 0,
          transactions: blockData.transactions || []
        });
        
        if (blockData.header.parents && blockData.header.parents[0]) {
          currentHash = blockData.header.parents[0].parentHashes[0];
        } else {
          break;
        }
      } catch (e) {
        console.error(`Block fetch error: ${e.message}`);
        break;
      }
    }
    
    res.json({ blocks });
  } catch (error) {
    res.status(500).json({ error: error.message, blocks: [] });
  }
});

// Latest transactions
app.get('/transactions/latest', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const blockdag = await getBlockdagInfo();
    const tipHash = blockdag.tipHashes[0];
    
    const transactions = [];
    let currentHash = tipHash;
    let blocksChecked = 0;
    
    while (transactions.length < limit && blocksChecked < 50) {
      try {
        const block = await axios.get(`${KASPA_API}/blocks/${currentHash}`, { timeout: 3000 });
        const blockData = block.data;
        
        if (blockData.transactions) {
          for (const tx of blockData.transactions) {
            if (transactions.length >= limit) break;
            
            transactions.push({
              txId: tx.verboseData?.transactionId || tx.subnetworkId || 'unknown',
              blockHash: currentHash,
              timestamp: blockData.header.timestamp,
              inputs: tx.inputs || [],
              outputs: tx.outputs || []
            });
          }
        }
        
        if (blockData.header.parents && blockData.header.parents[0]) {
          currentHash = blockData.header.parents[0].parentHashes[0];
        } else {
          break;
        }
        
        blocksChecked++;
      } catch (e) {
        console.error(`Transaction fetch error: ${e.message}`);
        break;
      }
    }
    
    res.json({ transactions });
  } catch (error) {
    res.status(500).json({ error: error.message, transactions: [] });
  }
});

// Price (CoinGecko - Original-Struktur beibehalten)
app.get('/info/price', async (req, res) => {
  try {
    const response = await axios.get(`${COINGECKO_API}/simple/price`, {
      params: {
        ids: 'kaspa',
        vs_currencies: 'usd',
        include_24hr_change: 'true',
        include_24hr_vol: 'true',
        include_market_cap: 'true'
      },
      timeout: 5000
    });
    
    // Original CoinGecko Struktur beibehalten für Backend-Kompatibilität
    res.json(response.data);
  } catch (error) {
    console.error('❌ CoinGecko price error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Market cap (CoinGecko - Original-Struktur)
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
    console.error('❌ CoinGecko marketcap error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

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

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ Kaspa REST API listening on port ${PORT}`);
  console.log(`📡 Upstream: ${KASPA_API}`);
  console.log(`💰 CoinGecko: ${COINGECKO_API}`);
  
  try {
    const blockdag = await getBlockdagInfo();
    const bps = await calculateExactBPS();
    console.log(`✅ Connected - Block: ${blockdag.virtualDaaScore}, BPS: ${bps.toFixed(4)}`);
  } catch (error) {
    console.error(`❌ Startup check failed: ${error.message}`);
  }
});
