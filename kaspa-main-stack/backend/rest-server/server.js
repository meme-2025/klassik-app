const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const KASPAD_RPC = process.env.KASPAD_RPC_PORT || '16110';
const KASPAD_HOST = process.env.KASPAD_HOST || '127.0.0.1';

// 10 BPS Optimization: Connection pooling and batching
const axiosInstance = axios.create({
    timeout: 5000,
    maxContentLength: 100 * 1024 * 1024,
    maxBodyLength: 100 * 1024 * 1024,
    headers: { 'Content-Type': 'application/json' },
    // Keep-alive for persistent connections
    httpAgent: new (require('http')).Agent({ 
        keepAlive: true,
        maxSockets: 50,
        maxFreeSockets: 10
    })
});

// Batch request queue for 10 BPS optimization
const requestQueue = [];
const BATCH_SIZE = 50;
const BATCH_INTERVAL = 100; // ms

// Performance metrics for monitoring
let metrics = {
    totalRequests: 0,
    batchRequests: 0,
    avgLatency: 0,
    errors: 0,
    lastReset: Date.now()
};

// Enhanced health check with kaspad validation
app.get('/health', async (req, res) => {
    try {
        const start = Date.now();
        const response = await axiosInstance.post(`http://${KASPAD_HOST}:${KASPAD_RPC}`, {
            jsonrpc: '2.0',
            id: 'health-check',
            method: 'getBlockDagInfo',
            params: []
        });
        
        const latency = Date.now() - start;
        
        res.json({
            status: 'healthy',
            service: 'kaspa-rest-adapter-v2',
            kaspad: `${KASPAD_HOST}:${KASPAD_RPC}`,
            connected: !!response.data.result,
            latency: `${latency}ms`,
            performance: {
                requestsPerMinute: Math.round(metrics.totalRequests / ((Date.now() - metrics.lastReset) / 60000)),
                avgLatency: `${metrics.avgLatency}ms`,
                errorRate: `${((metrics.errors / metrics.totalRequests) * 100 || 0).toFixed(2)}%`
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        metrics.errors++;
        res.status(503).json({
            status: 'unhealthy',
            service: 'kaspa-rest-adapter-v2',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Prometheus metrics endpoint
app.get('/metrics', (req, res) => {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    
    res.set('Content-Type', 'text/plain');
    res.send(`
# HELP kaspa_rest_requests_total Total number of requests
# TYPE kaspa_rest_requests_total counter
kaspa_rest_requests_total ${metrics.totalRequests}

# HELP kaspa_rest_batch_requests_total Total number of batch requests
# TYPE kaspa_rest_batch_requests_total counter
kaspa_rest_batch_requests_total ${metrics.batchRequests}

# HELP kaspa_rest_errors_total Total number of errors
# TYPE kaspa_rest_errors_total counter
kaspa_rest_errors_total ${metrics.errors}

# HELP kaspa_rest_latency_avg Average latency in milliseconds
# TYPE kaspa_rest_latency_avg gauge
kaspa_rest_latency_avg ${metrics.avgLatency}

# HELP kaspa_rest_uptime_seconds Uptime in seconds
# TYPE kaspa_rest_uptime_seconds gauge
kaspa_rest_uptime_seconds ${uptime}

# HELP kaspa_rest_memory_usage_bytes Memory usage in bytes
# TYPE kaspa_rest_memory_usage_bytes gauge
kaspa_rest_memory_usage_bytes{type="rss"} ${memUsage.rss}
kaspa_rest_memory_usage_bytes{type="heapUsed"} ${memUsage.heapUsed}
kaspa_rest_memory_usage_bytes{type="external"} ${memUsage.external}
`);
});

// Batch RPC processing for 10 BPS optimization
app.post('/rpc/batch', async (req, res) => {
    try {
        const requests = Array.isArray(req.body) ? req.body : [req.body];
        const batchRequests = requests.map((r, idx) => ({
            jsonrpc: '2.0',
            id: r.id || `batch_${idx}_${Date.now()}`,
            method: r.method,
            params: r.params || []
        }));
        
        const start = Date.now();
        const response = await axiosInstance.post(`http://${KASPAD_HOST}:${KASPAD_RPC}`, batchRequests);
        
        metrics.batchRequests++;
        metrics.avgLatency = ((metrics.avgLatency * metrics.totalRequests) + (Date.now() - start)) / (metrics.totalRequests + 1);
        metrics.totalRequests++;
        
        res.json(response.data);
    } catch (error) {
        metrics.errors++;
        res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: error.message }
        });
    }
});

// Enhanced single RPC with metrics
app.post('/rpc', async (req, res) => {
    try {
        const start = Date.now();
        const response = await axiosInstance.post(`http://${KASPAD_HOST}:${KASPAD_RPC}`, req.body);
        
        const latency = Date.now() - start;
        metrics.avgLatency = ((metrics.avgLatency * metrics.totalRequests) + latency) / (metrics.totalRequests + 1);
        metrics.totalRequests++;
        
        res.json(response.data);
    } catch (error) {
        metrics.errors++;
        res.status(500).json({ error: error.message });
    }
});

// Enhanced info endpoint with caching
let cachedInfo = null;
let cacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds

app.get('/info', async (req, res) => {
    try {
        const now = Date.now();
        
        // Return cached data if fresh
        if (cachedInfo && (now - cacheTime) < CACHE_TTL) {
            return res.json(cachedInfo);
        }
        
        const start = Date.now();
        const response = await axiosInstance.post(`http://${KASPAD_HOST}:${KASPAD_RPC}`, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getBlockDagInfo',
            params: []
        });
        
        // Cache the result
        cachedInfo = response.data.result;
        cacheTime = now;
        
        metrics.avgLatency = ((metrics.avgLatency * metrics.totalRequests) + (Date.now() - start)) / (metrics.totalRequests + 1);
        metrics.totalRequests++;
        
        res.json(response.data.result);
    } catch (error) {
        metrics.errors++;
        res.status(500).json({ error: error.message });
    }
});

// Reset metrics endpoint
app.post('/metrics/reset', (req, res) => {
    metrics = {
        totalRequests: 0,
        batchRequests: 0,
        avgLatency: 0,
        errors: 0,
        lastReset: Date.now()
    };
    res.json({ status: 'metrics reset' });
});

// Add error handling for startup
process.on('uncaughtException', (error) => {
    console.error(`[FATAL] Uncaught Exception: ${error.message}`);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`[FATAL] Unhandled Rejection at:`, promise, 'reason:', reason);
    process.exit(1);
});

const PORT = process.env.PORT || 8081;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[STARTUP] Kaspa REST Adapter v2.0 - 10 BPS Optimized`);
    console.log(`[CONFIG] kaspad: ${KASPAD_HOST}:${KASPAD_RPC}`);
    console.log(`[CONFIG] Batch size: ${BATCH_SIZE}, Interval: ${BATCH_INTERVAL}ms`);
    console.log(`[READY] Server running on port ${PORT}`);
    console.log(`[READY] Health: http://localhost:${PORT}/health`);
    console.log(`[READY] Metrics: http://localhost:${PORT}/metrics`);
    
    // Initial connection test
    setTimeout(async () => {
        try {
            const testResponse = await axiosInstance.post(`http://${KASPAD_HOST}:${KASPAD_RPC}`, {
                jsonrpc: '2.0',
                id: 'startup-test',
                method: 'getBlockDagInfo',
                params: []
            });
            console.log(`[STARTUP] ✅ kaspad connection verified - DAA Score: ${testResponse.data.result?.daaScore || 'unknown'}`);
        } catch (error) {
            console.error(`[STARTUP] ⚠️  kaspad connection test failed: ${error.message}`);
        }
    }, 1000);
});
