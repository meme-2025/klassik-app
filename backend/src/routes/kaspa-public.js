/**
 * ============================================
 * KASPA PUBLIC API - NO AUTH REQUIRED
 * ============================================
 * 
 * Lightweight public search API for landing page
 * Only basic queries allowed, no full explorer access
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');

const KASPA_API_URL = process.env.KASPA_REST_SERVER || 'http://localhost:16110';

// ===== ADDRESS SEARCH =====
router.get('/address/:address', async (req, res) => {
    try {
        const { address } = req.params;
        
        const response = await axios.get(`${KASPA_API_URL}/addresses/${address}/full`, {
            timeout: 10000
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Public address search error:', error.message);
        res.status(404).json({ 
            error: 'Address not found',
            message: error.response?.data?.errorMessage || error.message
        });
    }
});

// ===== TRANSACTION SEARCH =====
router.get('/transaction/:txHash', async (req, res) => {
    try {
        const { txHash } = req.params;
        
        const response = await axios.get(`${KASPA_API_URL}/transactions/${txHash}`, {
            timeout: 10000
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Public transaction search error:', error.message);
        res.status(404).json({ 
            error: 'Transaction not found',
            message: error.response?.data?.errorMessage || error.message
        });
    }
});

// ===== BLOCK SEARCH =====
router.get('/block/:hashOrHeight', async (req, res) => {
    try {
        const { hashOrHeight } = req.params;
        
        const response = await axios.get(`${KASPA_API_URL}/blocks/${hashOrHeight}`, {
            timeout: 10000
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Public block search error:', error.message);
        res.status(404).json({ 
            error: 'Block not found',
            message: error.response?.data?.errorMessage || error.message
        });
    }
});

// ===== NETWORK STATS (BASIC) =====
router.get('/stats', async (req, res) => {
    try {
        const response = await axios.get(`${KASPA_API_URL}/info/blocklist?limit=1`, {
            timeout: 10000
        });
        
        res.json({
            network: 'mainnet',
            blockHeight: response.data?.[0]?.blueScore || 0,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Public stats error:', error.message);
        res.status(500).json({ 
            error: 'Stats unavailable',
            message: error.message
        });
    }
});

module.exports = router;
