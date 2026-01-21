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

// Cache für BPS Berechnung
let bpsCache = {
  value: 1.0,
  timestamp: 0,
  blocks: []
};

// Hilfsfunktion: BPS exakt berechnen aus Block-Timestamps
async function calculateExactBPS() {
  try {
    // Cache für 30 Sekunden
    if (Date.now() - bpsCache.timestamp < 30000 && bpsCache.value) {
      return bpsCache.value;
    }

    // Hole die letzten 100 Blocks
    const blockdag = await axios.get(`${KASPA_API}/info/blockdag`, { timeout: 5000 });
    const tipHash = blockdag.data.tipHashes[0];
    
    const blocks = [];
    let currentHash = tipHash;
    
    for (let i = 0; i < 100; i++) {
      try {
        const block = await axios.get(`${KASPA_API}/blocks/${currentHash}`, { timeout: 5000 });
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
      return 1.0; // Fallback
    }

    // Sortiere nach blueScore
    blocks.sort((a, b) => a.blueScore - b.blueScore);
    
    // Berechne durchschnittliche Zeit zwischen Blocks
    let totalTimeDiff = 0;
    let totalScoreDiff = 0;
    
    for (let i = 1; i < blocks.length; i++) {
      const timeDiff = blocks[i].timestamp - blocks[i-1].timestamp;
      const scoreDiff = blocks[i].blueScore - blocks[i-1].blueScore;
      
      if (timeDiff > 0 && scoreDiff > 0) {
        totalTimeDiff += timeDiff;
        totalScoreDiff += scoreDiff;
      }
    }
    
    // BPS = blocks / seconds
    const avgTimePerBlock = totalTimeDiff / totalScoreDiff; // in milliseconds
    const bps = avgTimePerBlock > 0 ? 1000 / avgTimePerBlock : 1.0;
    
    // Cache result
    bpsCache = {
      value: bps,
      timestamp: Date.now(),
      blocks: blocks
    };
    
    return bps;
  } catch (error) {
    console.error('BPS calculation failed:', error.message);
    return 1.0; // Fallback zu theoretischer 1 BPS
  }
}

// Health check
app.get('/health', async (req, res) => {
  try {
    const info = await axios.get(`${KASPA_API}/info/network`, { timeout: 5000 });
    res.json({
      status: 'healthy',
      kaspad: {
        connected: true,
        network: info.data.networkName
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Network info
app.get('/info/network', async (req, res) => {
  try {
    const data = await axios.get(`${KASPA_API}/info/network`, { timeout: 5000 });
    res.json(data.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// BlockDAG info mit BPS
app.get('/info/blockdag', async (req, res) => {
  try {
    const data = await axios.get(`${KASPA_API}/info/blockdag`, { timeout: 5000 });
    const bps = await calculateExactBPS();
    
    res.json({
      ...data.data,
      bps: bps,
      bpsFormatted: bps.toFixed(2)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Virtual chain blue score
app.get('/info/virtual-chain-blue-score', async (req, res) => {
  try {
    const data = await axios.get(`${KASPA_API}/info/blockdag`, { timeout: 5000 });
    res.json({
      blueScore: data.data.virtualDaaScore.toString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Coin supply mit Remaining Supply
app.get('/info/coinsupply', async (req, res) => {
  try {
    const blockdag = await axios.get(`${KASPA_API}/info/blockdag`, { timeout: 5000 });
    const blockCount = blockdag.data.virtualDaaScore;
    
    // Kaspa emission: 440 KAS/block, halving alle 12 Monate
    const blocksPerMonth = 2628000; // 30.5 days * 86400 seconds * 1 BPS
    const blocksPerHalving = blocksPerMonth * 12;
    
    let totalSupply = 0;
    let currentReward = 440;
    let blocksProcessed = 0;
    
    while (blocksProcessed < blockCount) {
      const blocksInThisPhase = Math.min(blocksPerHalving, blockCount - blocksProcessed);
      totalSupply += blocksInThisPhase * currentReward;
      blocksProcessed += blocksInThisPhase;
      currentReward /= 2;
    }
    
    const maxSupply = 28704026601.692;
    const remainingSupply = maxSupply - totalSupply;
    
    // Convert to sompi (1 KAS = 100,000,000 sompi)
    res.json({
      circulatingSompi: (totalSupply * 100000000).toString(),
      totalSompi: (totalSupply * 100000000).toString(),
      maxSompi: (maxSupply * 100000000).toString(),
      remainingSompi: (remainingSupply * 100000000).toString(),
      // Also provide in KAS
      circulatingKAS: Math.floor(totalSupply),
      totalKAS: Math.floor(totalSupply),
      maxKAS: Math.floor(maxSupply),
      remainingKAS: Math.floor(remainingSupply)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Block reward
app.get('/info/blockreward', async (req, res) => {
  try {
    const blockdag = await axios.get(`${KASPA_API}/info/blockdag`, { timeout: 5000 });
    const blockCount = blockdag.data.virtualDaaScore;
    
    const blocksPerMonth = 2628000;
    const blocksPerHalving = blocksPerMonth * 12;
    
    const halvingPhase = Math.floor(blockCount / blocksPerHalving);
    let currentReward = 440;
    
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
    const blockdag = await axios.get(`${KASPA_API}/info/blockdag`, { timeout: 5000 });
    const blockCount = blockdag.data.virtualDaaScore;
    const bps = await calculateExactBPS();
    
    const blocksPerMonth = 2628000;
    const blocksPerHalving = blocksPerMonth * 12;
    
    const currentPhase = Math.floor(blockCount / blocksPerHalving);
    const nextHalvingBlock = (currentPhase + 1) * blocksPerHalving;
    const blocksUntilHalving = nextHalvingBlock - blockCount;
    
    // Berechne Zeit bis Halving
    const secondsUntilHalving = blocksUntilHalving / bps;
    const daysUntilHalving = secondsUntilHalving / 86400;
    
    res.json({
      currentPhase: currentPhase.toString(),
      nextHalvingDaaScore: nextHalvingBlock.toString(),
      blocksUntilHalving: blocksUntilHalving.toString(),
      secondsUntilHalving: Math.floor(secondsUntilHalving),
      daysUntilHalving: daysUntilHalving.toFixed(1),
      // Countdown Format
      countdown: {
        days: Math.floor(daysUntilHalving),
        hours: Math.floor((daysUntilHalving % 1) * 24),
        minutes: Math.floor(((daysUntilHalving % 1) * 24 % 1) * 60)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Hashrate - KORREKT berechnet: hashrate = difficulty * BPS * 2
app.get('/info/hashrate', async (req, res) => {
  try {
    const blockdag = await axios.get(`${KASPA_API}/info/blockdag`, { timeout: 5000 });
    const difficulty = parseFloat(blockdag.data.difficulty);
    const bps = await calculateExactBPS();
    
    // Kaspa Hashrate Formel: H = D * BPS * 2
    const hashrate = difficulty * bps * 2;
    
    // Format in PH/s
    const hashrateInPH = hashrate / 1e15;
    
    res.json({
      hashrate: hashrate,
      hashrateInPH: hashrateInPH,
      hashrateFormatted: `${hashrateInPH.toFixed(2)} PH/s`,
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
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const blockdag = await axios.get(`${KASPA_API}/info/blockdag`, { timeout: 5000 });
    const tipHash = blockdag.data.tipHashes[0];
    
    const blocks = [];
    let currentHash = tipHash;
    
    for (let i = 0; i < limit; i++) {
      try {
        const block = await axios.get(`${KASPA_API}/blocks/${currentHash}`, { timeout: 5000 });
        
        blocks.push({
          hash: currentHash,
          timestamp: block.data.header.timestamp,
          blueScore: block.data.header.blueScore,
          difficulty: block.data.header.difficulty,
          transactionCount: block.data.transactions ? block.data.transactions.length : 0,
          transactions: block.data.transactions || []
        });
        
        if (block.data.header.parents && block.data.header.parents[0]) {
          currentHash = block.data.header.parents[0].parentHashes[0];
        } else {
          break;
        }
      } catch (e) {
        console.error(`Failed to fetch block ${currentHash}:`, e.message);
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
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const blockdag = await axios.get(`${KASPA_API}/info/blockdag`, { timeout: 5000 });
    const tipHash = blockdag.data.tipHashes[0];
    
    const transactions = [];
    let currentHash = tipHash;
    let blocksChecked = 0;
    
    while (transactions.length < limit && blocksChecked < 50) {
      try {
        const block = await axios.get(`${KASPA_API}/blocks/${currentHash}`, { timeout: 5000 });
        
        if (block.data.transactions && Array.isArray(block.data.transactions)) {
          for (const tx of block.data.transactions) {
            if (transactions.length >= limit) break;
            
            transactions.push({
              txId: tx.verboseData?.transactionId || tx.subnetworkId || 'unknown',
              blockHash: currentHash,
              timestamp: block.data.header.timestamp,
              inputs: tx.inputs || [],
              outputs: tx.outputs || []
            });
          }
        }
        
        if (block.data.header.parents && block.data.header.parents[0]) {
          currentHash = block.data.header.parents[0].parentHashes[0];
        } else {
          break;
        }
        
        blocksChecked++;
      } catch (e) {
        console.error(`Failed to fetch transactions from block ${currentHash}:`, e.message);
        blocksChecked++;
      }
    }
    
    res.json({ transactions });
  } catch (error) {
    res.status(500).json({ error: error.message, transactions: [] });
  }
});

// Transactions 24h - Zähle aus Blocks der letzten 24 Stunden
app.get('/info/transactions-24h', async (req, res) => {
  try {
    const bps = await calculateExactBPS();
    const blocksIn24h = Math.floor(bps * 86400); // 86400 seconds in 24h
    
    const blockdag = await axios.get(`${KASPA_API}/info/blockdag`, { timeout: 5000 });
    const tipHash = blockdag.data.tipHashes[0];
    
    let totalTxCount = 0;
    let currentHash = tipHash;
    let blocksChecked = 0;
    const maxBlocksToCheck = Math.min(blocksIn24h, 5000); // Limit für Performance
    
    while (blocksChecked < maxBlocksToCheck) {
      try {
        const block = await axios.get(`${KASPA_API}/blocks/${currentHash}`, { timeout: 5000 });
        
        if (block.data.transactions) {
          totalTxCount += block.data.transactions.length;
        }
        
        if (block.data.header.parents && block.data.header.parents[0]) {
          currentHash = block.data.header.parents[0].parentHashes[0];
        } else {
          break;
        }
        
        blocksChecked++;
      } catch (e) {
        break;
      }
    }
    
    // Hochrechnen wenn nicht alle Blocks gecheckt wurden
    const estimatedTotal = blocksChecked > 0 
      ? Math.floor((totalTxCount / blocksChecked) * blocksIn24h)
      : 0;
    
    res.json({
      transactions24h: estimatedTotal,
      blocksChecked: blocksChecked,
      blocksIn24h: blocksIn24h,
      avgTxPerBlock: blocksChecked > 0 ? (totalTxCount / blocksChecked).toFixed(2) : 0
    });
  } catch (error) {
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
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ Kaspa REST API listening on port ${PORT}`);
  console.log(`📡 Using api.kaspa.org for blockchain data`);
  console.log(`💰 CoinGecko for price/market data`);
  console.log(`🔢 BPS calculated from actual block timestamps`);
  console.log(`⚡ Hashrate = difficulty * BPS * 2`);
  
  try {
    const bps = await calculateExactBPS();
    console.log(`✅ Initial BPS calculation: ${bps.toFixed(2)} blocks/second`);
  } catch (error) {
    console.error(`❌ Initial BPS calculation failed: ${error.message}`);
  }
});
