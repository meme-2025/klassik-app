// Enhanced Kaspa Routes with proper API proxies
// Löst CORS-Probleme und stellt alle benötigten Kaspa-Daten zur Verfügung

const express = require('express');
const axios = require('axios');
const router = express.Router();

// API Configuration
const KASPA_APIS = {
  primary: 'https://api.kaspa.org',
  explorer: 'https://explorer.kaspa.org/api',
  coingecko: 'https://api.coingecko.com/api/v3',
  kaspascan: 'https://api.kaspascan.io/v1'
};

// Cache configuration
const cache = new Map();
const CACHE_DURATION = {
  price: 30 * 1000,        // 30 seconds
  stats: 10 * 1000,        // 10 seconds  
  blocks: 5 * 1000,        // 5 seconds
  transactions: 5 * 1000,  // 5 seconds
  info: 60 * 1000          // 60 seconds
};

// Helper function to get cached data or fetch new
async function getCachedData(key, fetchFunction, duration = 30000) {
  const cached = cache.get(key);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < duration) {
    return cached.data;
  }
  
  try {
    const data = await fetchFunction();
    cache.set(key, { data, timestamp: now });
    return data;
  } catch (error) {
    // Return cached data if fetch fails and we have it
    if (cached) {
      console.warn(`API call failed for ${key}, returning cached data:`, error.message);
      return cached.data;
    }
    throw error;
  }
}

// Kaspa Price Endpoint
router.get('/price', async (req, res) => {
  try {
    const priceData = await getCachedData('kaspa-price', async () => {
      const response = await axios.get(`${KASPA_APIS.coingecko}/simple/price`, {
        params: { 
          ids: 'kaspa', 
          vs_currencies: 'usd,eur,btc',
          include_24hr_change: 'true',
          include_market_cap: 'true',
          include_24hr_vol: 'true'
        },
        timeout: 5000
      });
      
      const kaspa = response.data.kaspa;
      return {
        usd: kaspa.usd,
        eur: kaspa.eur,
        btc: kaspa.btc,
        usd_24h_change: kaspa.usd_24h_change,
        usd_market_cap: kaspa.usd_market_cap,
        usd_24h_vol: kaspa.usd_24h_vol,
        last_updated: new Date().toISOString()
      };
    }, CACHE_DURATION.price);

    res.json(priceData);
  } catch (error) {
    console.error('Price API error:', error);
    res.status(500).json({
      error: 'Failed to fetch price data',
      fallback: { usd: 0.15, eur: 0.13, btc: 0.0000015, last_updated: new Date().toISOString() }
    });
  }
});

// Kaspa Network Stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await getCachedData('kaspa-stats', async () => {
      // Hole verschiedene Statistiken parallel
      const [infoResp, halvingResp, networkResp] = await Promise.allSettled([
        axios.get(`${KASPA_APIS.primary}/info/virtual-chain-blue-score`, { timeout: 5000 }),
        axios.get(`${KASPA_APIS.primary}/info/halving`, { timeout: 5000 }),
        axios.get(`${KASPA_APIS.primary}/info/network`, { timeout: 5000 })
      ]);

      const result = {
        timestamp: new Date().toISOString(),
        blockHeight: null,
        hashrate: null,
        difficulty: null,
        supply: null,
        halving: null,
        network: null,
        errors: []
      };

      // Parse results
      if (infoResp.status === 'fulfilled') {
        result.blockHeight = infoResp.value.data?.blueScore || null;
      } else {
        result.errors.push('Failed to fetch block height');
      }

      if (halvingResp.status === 'fulfilled') {
        result.halving = halvingResp.value.data;
      } else {
        result.errors.push('Failed to fetch halving info');
      }

      if (networkResp.status === 'fulfilled') {
        const networkData = networkResp.value.data;
        result.network = {
          hashrate: networkData?.hashrate || null,
          difficulty: networkData?.difficulty || null,
          supply: networkData?.supply || null
        };
      } else {
        result.errors.push('Failed to fetch network info');
      }

      return result;
    }, CACHE_DURATION.stats);

    res.json(stats);
  } catch (error) {
    console.error('Stats API error:', error);
    res.status(500).json({
      error: 'Failed to fetch network stats',
      timestamp: new Date().toISOString()
    });
  }
});

// Latest Blocks
router.get('/blocks/latest', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    
    const blocks = await getCachedData(`blocks-latest-${limit}`, async () => {
      const response = await axios.get(`${KASPA_APIS.kaspascan}/blocks/latest`, {
        params: { limit },
        timeout: 5000
      });
      
      return response.data?.blocks || [];
    }, CACHE_DURATION.blocks);

    res.json({ blocks, count: blocks.length });
  } catch (error) {
    console.error('Blocks API error:', error);
    res.status(500).json({
      error: 'Failed to fetch latest blocks',
      blocks: [],
      count: 0
    });
  }
});

// Latest Transactions  
router.get('/transactions/latest', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    
    const transactions = await getCachedData(`tx-latest-${limit}`, async () => {
      const response = await axios.get(`${KASPA_APIS.kaspascan}/transactions/latest`, {
        params: { limit },
        timeout: 5000
      });
      
      return response.data?.transactions || [];
    }, CACHE_DURATION.transactions);

    res.json({ transactions, count: transactions.length });
  } catch (error) {
    console.error('Transactions API error:', error);
    res.status(500).json({
      error: 'Failed to fetch latest transactions',
      transactions: [],
      count: 0
    });
  }
});

// Block by hash or height
router.get('/block/:hashOrHeight', async (req, res) => {
  try {
    const { hashOrHeight } = req.params;
    
    const block = await getCachedData(`block-${hashOrHeight}`, async () => {
      const response = await axios.get(`${KASPA_APIS.kaspascan}/blocks/${hashOrHeight}`, {
        timeout: 5000
      });
      
      return response.data;
    }, CACHE_DURATION.blocks);

    res.json(block);
  } catch (error) {
    console.error('Block API error:', error);
    if (error.response?.status === 404) {
      res.status(404).json({ error: 'Block not found' });
    } else {
      res.status(500).json({ error: 'Failed to fetch block data' });
    }
  }
});

// Transaction by hash
router.get('/transaction/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    
    const transaction = await getCachedData(`tx-${hash}`, async () => {
      const response = await axios.get(`${KASPA_APIS.kaspascan}/transactions/${hash}`, {
        timeout: 5000
      });
      
      return response.data;
    }, CACHE_DURATION.transactions);

    res.json(transaction);
  } catch (error) {
    console.error('Transaction API error:', error);
    if (error.response?.status === 404) {
      res.status(404).json({ error: 'Transaction not found' });
    } else {
      res.status(500).json({ error: 'Failed to fetch transaction data' });
    }
  }
});

// Address balance and UTXOS
router.get('/address/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const addressData = await getCachedData(`address-${address}`, async () => {
      const response = await axios.get(`${KASPA_APIS.kaspascan}/address/${address}`, {
        timeout: 5000
      });
      
      return response.data;
    }, CACHE_DURATION.transactions);

    res.json(addressData);
  } catch (error) {
    console.error('Address API error:', error);
    if (error.response?.status === 404) {
      res.status(404).json({ error: 'Address not found', balance: 0 });
    } else {
      res.status(500).json({ error: 'Failed to fetch address data' });
    }
  }
});

// Address UTXOs specifically
router.get('/address/:address/utxos', async (req, res) => {
  try {
    const { address } = req.params;
    
    const utxos = await getCachedData(`utxos-${address}`, async () => {
      const response = await axios.get(`${KASPA_APIS.kaspascan}/address/${address}/utxos`, {
        timeout: 5000
      });
      
      return response.data?.utxos || [];
    }, CACHE_DURATION.transactions);

    res.json({ utxos, count: utxos.length });
  } catch (error) {
    console.error('UTXOs API error:', error);
    res.status(500).json({
      error: 'Failed to fetch address UTXOs',
      utxos: [],
      count: 0
    });
  }
});

// Search endpoint for addresses, transactions, blocks
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    
    // Bestimme Suchtyp basierend auf Query-Format
    let searchType = 'unknown';
    let result = null;
    
    if (query.startsWith('kaspa:')) {
      searchType = 'address';
      result = await axios.get(`${KASPA_APIS.kaspascan}/address/${query}`, { timeout: 5000 });
    } else if (query.length === 64 && /^[a-fA-F0-9]+$/.test(query)) {
      // Wahrscheinlich ein Transaction Hash
      searchType = 'transaction';
      try {
        result = await axios.get(`${KASPA_APIS.kaspascan}/transactions/${query}`, { timeout: 5000 });
      } catch {
        // Wenn Transaction nicht gefunden, versuche Block
        searchType = 'block';
        result = await axios.get(`${KASPA_APIS.kaspascan}/blocks/${query}`, { timeout: 5000 });
      }
    } else if (/^\d+$/.test(query)) {
      // Wahrscheinlich Block Height
      searchType = 'block';
      result = await axios.get(`${KASPA_APIS.kaspascan}/blocks/${query}`, { timeout: 5000 });
    }

    if (result) {
      res.json({
        type: searchType,
        query,
        data: result.data,
        found: true
      });
    } else {
      res.status(404).json({
        type: 'unknown',
        query,
        found: false,
        error: 'No matching data found'
      });
    }
  } catch (error) {
    console.error('Search API error:', error);
    res.status(500).json({
      error: 'Search failed',
      query: req.params.query,
      found: false
    });
  }
});

// System Health Check
router.get('/health', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Teste alle APIs
    const apiTests = await Promise.allSettled([
      axios.get(`${KASPA_APIS.primary}/info/halving`, { timeout: 2000 }),
      axios.get(`${KASPA_APIS.coingecko}/simple/price?ids=kaspa&vs_currencies=usd`, { timeout: 2000 }),
      axios.get(`${KASPA_APIS.kaspascan}/blocks/latest?limit=1`, { timeout: 2000 })
    ]);

    const responseTime = Date.now() - startTime;
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      apis: {
        kaspa: apiTests[0].status === 'fulfilled' ? 'online' : 'offline',
        coingecko: apiTests[1].status === 'fulfilled' ? 'online' : 'offline', 
        kaspascan: apiTests[2].status === 'fulfilled' ? 'online' : 'offline'
      },
      cache: {
        entries: cache.size,
        memory: `${(JSON.stringify([...cache.values()]).length / 1024).toFixed(2)}KB`
      }
    };

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Cache management
router.post('/cache/clear', (req, res) => {
  cache.clear();
  res.json({ 
    message: 'Cache cleared successfully',
    timestamp: new Date().toISOString()
  });
});

router.get('/cache/stats', (req, res) => {
  res.json({
    entries: cache.size,
    keys: [...cache.keys()],
    memory: `${(JSON.stringify([...cache.values()]).length / 1024).toFixed(2)}KB`,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;