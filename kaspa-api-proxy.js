const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 8082;

// Use public API as proxy (kaspad wRPC needs proper library)
const KASPA_API = 'https://api.kaspa.org';

async function proxyRequest(endpoint) {
    try {
        const response = await axios.get(`${KASPA_API}${endpoint}`, { timeout: 5000 });
        return response.data;
    } catch (error) {
        console.error(`Proxy error [${endpoint}]:`, error.message);
        throw error;
    }
}

app.get('/health', (req, res) => {
    res.json({ status: 'ok', source: 'api.kaspa.org proxy', note: 'Local kaspad is live but wRPC needs proper client library' });
});

app.get('/info/network', async (req, res) => {
    try { res.json(await proxyRequest('/info/network')); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/info/blockdag', async (req, res) => {
    try { res.json(await proxyRequest('/info/blockdag')); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/info/virtual-chain-blue-score', async (req, res) => {
    try { res.json(await proxyRequest('/info/virtual-chain-blue-score')); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/info/coinsupply', async (req, res) => {
    try {
        const data = await proxyRequest('/info/coinsupply');
        // Convert from sompi (strings) to KAS (numbers)
        const sompiPerKas = 100000000;
        res.json({
            totalSupply: parseFloat(data.circulatingSupply) / sompiPerKas,
            circulatingSupply: parseFloat(data.circulatingSupply) / sompiPerKas,
            maxSupply: parseFloat(data.maxSupply) / sompiPerKas
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/info/blockreward', async (req, res) => {
    try { res.json(await proxyRequest('/info/blockreward')); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/info/halving', async (req, res) => {
    try { res.json(await proxyRequest('/info/halving')); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/info/hashrate', async (req, res) => {
    try {
        const data = await proxyRequest('/info/hashrate');
        // Convert to proper hashrate (currently returns H/s, we want it in H/s)
        res.json({ hashrate: parseFloat(data.hashrate) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/info/price', async (req, res) => {
    try { res.json(await proxyRequest('/info/price')); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/info/marketcap', async (req, res) => {
    try { res.json(await proxyRequest('/info/marketcap')); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/blocks/latest', async (req, res) => {
    try {
        const limit = req.query.limit || 10;
        res.json(await proxyRequest(`/blocks?limit=${limit}&resolve=light`));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/transactions/latest', async (req, res) => {
    try {
        const limit = req.query.limit || 20;
        res.json(await proxyRequest(`/transactions?limit=${limit}&resolve=light`));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
    console.log(`✅ Kaspa API Proxy running on port ${PORT}`);
    console.log(`📡 Proxying to ${KASPA_API}`);
});
