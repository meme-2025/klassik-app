const express = require('express');
const router = express.Router();
const axios = require('axios');

// Cache for API responses
let cachedData = null;
let lastFetch = 0;
const CACHE_DURATION = 25000; // 25 seconds (refresh before 30s interval)

// Public Kaspa API endpoints (fallbacks).
// You can set `KASPA_REST_SERVER` env var to point to a local kaspa-rest-server (e.g. http://localhost:8080)
const KASPA_APIS = {
    restServer: process.env.KASPA_REST_SERVER || null,
    primary: 'https://api.kaspa.org',
    explorer: 'https://explorer.kaspa.org/api',
    coingecko: 'https://api.coingecko.com/api/v3'
};

/**
 * GET /api/kaspa/stats
 * Returns comprehensive Kaspa blockchain statistics
 */
router.get('/stats', async (req, res) => {
    try {
        // Return cached data if still fresh
        const now = Date.now();
        if (cachedData && (now - lastFetch) < CACHE_DURATION) {
            return res.json({
                ...cachedData,
                cached: true,
                cacheAge: Math.floor((now - lastFetch) / 1000)
            });
        }

        // Fetch fresh data from multiple sources in parallel
        const [priceData, blockchainData] = await Promise.allSettled([
            fetchPriceData(),
            fetchBlockchainData()
        ]);

        // Combine results
        const stats = {
            price: priceData.status === 'fulfilled' ? priceData.value : null,
            blockchain: blockchainData.status === 'fulfilled' ? blockchainData.value : null,
            timestamp: new Date().toISOString(),
            cached: false
        };

        // Cache successful response
        if (stats.price || stats.blockchain) {
            cachedData = stats;
            lastFetch = now;
        }

        res.json(stats);

    } catch (error) {
        console.error('Error fetching Kaspa stats:', error.message);
        
        // Return cached data if available, even if expired
        if (cachedData) {
            return res.json({
                ...cachedData,
                cached: true,
                stale: true,
                cacheAge: Math.floor((Date.now() - lastFetch) / 1000)
            });
        }

        res.status(500).json({
            error: 'Failed to fetch Kaspa statistics',
            message: error.message
        });
    }
});

/**
 * Fetch price data from CoinGecko
 */
async function fetchPriceData() {
    try {
        const response = await axios.get(
            `${KASPA_APIS.coingecko}/simple/price`,
            {
                params: {
                    ids: 'kaspa',
                    vs_currencies: 'usd,btc',
                    include_24hr_change: true,
                    include_market_cap: true,
                    include_24hr_vol: true
                },
                timeout: 5000
            }
        );

        const data = response.data.kaspa;
        if (!data) throw new Error('No Kaspa data in response');

        return {
            usd: data.usd,
            btc: data.btc,
            change24h: data.usd_24h_change || 0,
            marketCap: data.usd_market_cap || 0,
            volume24h: data.usd_24h_vol || 0
        };
    } catch (error) {
        console.error('CoinGecko API error:', error.message);
        throw error;
    }
}

/**
 * Fetch blockchain data from Kaspa API
 */
async function fetchBlockchainData() {
    try {
        // Prefer an explicitly configured kaspa-rest-server when available
        let response = null;

        if (KASPA_APIS.restServer) {
            try {
                // kaspa-rest-server may expose a blockdag/info or similar endpoint; try common paths
                response = await axios.get(`${KASPA_APIS.restServer}/info/blockdag`, { timeout: 5000 });
            } catch (err) {
                try {
                    response = await axios.get(`${KASPA_APIS.restServer}/info`, { timeout: 5000 });
                } catch (err2) {
                    response = null;
                }
            }
        }

        // If no rest server or request failed, fall back to public APIs
        if (!response) {
            // Try primary Kaspa API first
            response = await axios.get(`${KASPA_APIS.primary}/info/blockdag`, { timeout: 5000 }).catch(async () => {
                // Fallback to explorer API
                return await axios.get(`${KASPA_APIS.explorer}/info`, { timeout: 5000 });
            });
        }

        const data = response.data;

        return {
            blockCount: data.blockCount || data.blocks || 0,
            headerCount: data.headerCount || data.headers || 0,
            tipHashes: data.tipHashes || [],
            difficulty: data.difficulty || 0,
            pastMedianTime: data.pastMedianTime || 0,
            virtualParentHashes: data.virtualParentHashes || [],
            pruningPoint: data.pruningPoint || '',
            virtualDaaScore: data.virtualDaaScore || 0,
            sink: data.sink || ''
        };
    } catch (error) {
        console.error('Kaspa API error:', error.message);
        
        // Return minimal fallback data
        return {
            blockCount: 0,
            headerCount: 0,
            tipHashes: [],
            difficulty: 0,
            error: 'API unavailable'
        };
    }
}

/**
 * GET /api/kaspa/blocks/latest
 * Returns latest blocks
 */
router.get('/blocks/latest', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        let response = null;

        // Try configured kaspa-rest-server first (common paths)
        if (KASPA_APIS.restServer) {
            try {
                response = await axios.get(`${KASPA_APIS.restServer}/blocks`, { params: { limit }, timeout: 5000 });
            } catch (err) {
                try {
                    response = await axios.get(`${KASPA_APIS.restServer}/api/blocks`, { params: { limit }, timeout: 5000 });
                } catch (err2) {
                    response = null;
                }
            }
        }

        // Fallback to public explorer API
        if (!response) {
            response = await axios.get(`${KASPA_APIS.explorer}/blocks`, { params: { limit }, timeout: 5000 });
        }

        res.json({ blocks: response.data, timestamp: new Date().toISOString() });

    } catch (error) {
        console.error('Error fetching blocks:', error.message);
        res.status(500).json({
            error: 'Failed to fetch blocks',
            message: error.message
        });
    }
});

/**
 * GET /api/kaspa/transactions/latest
 * Returns latest transactions
 */
router.get('/transactions/latest', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        let response = null;

        if (KASPA_APIS.restServer) {
            try {
                response = await axios.get(`${KASPA_APIS.restServer}/transactions`, { params: { limit }, timeout: 5000 });
            } catch (err) {
                try {
                    response = await axios.get(`${KASPA_APIS.restServer}/api/transactions`, { params: { limit }, timeout: 5000 });
                } catch (err2) {
                    response = null;
                }
            }
        }

        if (!response) {
            response = await axios.get(`${KASPA_APIS.explorer}/transactions`, { params: { limit }, timeout: 5000 });
        }

        res.json({ transactions: response.data, timestamp: new Date().toISOString() });

    } catch (error) {
        console.error('Error fetching transactions:', error.message);
        res.status(500).json({
            error: 'Failed to fetch transactions',
            message: error.message
        });
    }
});

module.exports = router;
