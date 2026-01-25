import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port: parseInt(process.env.API_PORT || '8080'),
    nodeEnv: process.env.NODE_ENV || 'production',
    
    // Kaspa
    restServerUrl: process.env.REST_SERVER_URL || 'http://localhost:8081',
    
    // Database
    databaseUrl: process.env.DATABASE_URL || '',
    
    // Redis
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    
    // Security
    apiKey: process.env.API_KEY || 'kaspa-elite-2026-key',
    
    // CORS
    corsOrigins: (process.env.CORS_ORIGINS || 'https://klassik.99pace.space,http://localhost:3000').split(','),
    
    // Rate limiting
    rateLimit: parseInt(process.env.RATE_LIMIT || '100'),
    
    // WebSocket
    enableWebSocket: process.env.ENABLE_WEBSOCKET === 'true',
    wsHeartbeatInterval: 30000, // 30 seconds
    
    // Performance
    blockPollInterval: 100, // Poll for new blocks every 100ms (10 BPS = 100ms/block)
    cacheDefaultTTL: 300, // 5 minutes
    
    // Batch processing
    batchSize: parseInt(process.env.BATCH_SIZE || '50'),
    batchIntervalMs: parseInt(process.env.BATCH_INTERVAL_MS || '5000'),
};
