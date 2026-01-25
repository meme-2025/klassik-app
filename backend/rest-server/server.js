const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const KASPAD_RPC = process.env.KASPAD_RPC_PORT || '16110';
const KASPAD_HOST = process.env.KASPAD_HOST || '127.0.0.1';

// Simple health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'kaspa-rest-adapter' });
});

// Proxy to kaspad RPC
app.post('/rpc', async (req, res) => {
    try {
        const response = await axios.post(`http://${KASPAD_HOST}:${KASPAD_RPC}`, req.body);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get network info
app.get('/info', async (req, res) => {
    try {
        const response = await axios.post(`http://${KASPAD_HOST}:${KASPAD_RPC}`, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getBlockDagInfo',
            params: []
        });
        res.json(response.data.result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 8081;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kaspa REST Adapter running on port ${PORT}`);
    console.log(`Connecting to kaspad at ${KASPAD_HOST}:${KASPAD_RPC}`);
});
