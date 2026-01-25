import { register, Counter, Gauge, Histogram } from 'prom-client';

// API Request Counter
export const httpRequestCounter = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status']
});

// Block Processing Metrics
export const blockProcessingDuration = new Histogram({
    name: 'block_processing_duration_seconds',
    help: 'Time to process a block',
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

export const blocksProcessedCounter = new Counter({
    name: 'blocks_processed_total',
    help: 'Total number of blocks processed'
});

// WebSocket Metrics
export const websocketConnectionsGauge = new Gauge({
    name: 'websocket_connections',
    help: 'Number of active WebSocket connections'
});

// Cache Metrics
export const cacheHitsCounter = new Counter({
    name: 'cache_hits_total',
    help: 'Total number of cache hits'
});

export const cacheMissesCounter = new Counter({
    name: 'cache_misses_total',
    help: 'Total number of cache misses'
});

// Database Metrics
export const dbQueryDuration = new Histogram({
    name: 'db_query_duration_seconds',
    help: 'Database query duration',
    buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1]
});

export async function createPrometheusMetrics(): Promise<string> {
    return await register.metrics();
}
