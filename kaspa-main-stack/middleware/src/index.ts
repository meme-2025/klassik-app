import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createPrometheusMetrics } from './metrics';
import { logger } from './logger';
import { RedisCache } from './cache';
import { DatabaseService } from './database';
import { KaspaService } from './kaspa';
import { WebSocketService } from './websocket';
import { apiRouter } from './routes/api';
import { config } from './config';

class MiddlewareServer {
    private app: express.Application;
    private server: http.Server;
    private wss: WebSocketServer;
    private redis: RedisCache;
    private db: DatabaseService;
    private kaspa: KaspaService;
    private wsService: WebSocketService;

    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocketServer({ server: this.server, path: '/ws' });
        
        this.redis = new RedisCache();
        this.db = new DatabaseService();
        this.kaspa = new KaspaService(this.db, this.redis);
        this.wsService = new WebSocketService(this.wss, this.kaspa);
    }

    async initialize(): Promise<void> {
        try {
            // Setup middleware
            this.setupMiddleware();
            
            // Initialize services
            await this.redis.connect();
            await this.db.connect();
            await this.kaspa.initialize();
            
            // Setup routes
            this.setupRoutes();
            
            // Start monitoring blocks
            this.kaspa.startBlockMonitoring((block) => {
                this.wsService.broadcastNewBlock(block);
            });

            logger.info('✓ Middleware server initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize middleware server:', error);
            throw error;
        }
    }

    private setupMiddleware(): void {
        // Security
        this.app.use(helmet());
        
        // CORS
        this.app.use(cors({
            origin: config.corsOrigins,
            credentials: true
        }));

        // Compression
        this.app.use(compression({
            level: 6,
            threshold: 1024
        }));

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: config.rateLimit,
            message: 'Too many requests from this IP'
        });
        this.app.use('/api', limiter);

        // API Key authentication
        this.app.use('/api', (req, res, next) => {
            const apiKey = req.headers['x-api-key'];
            if (apiKey !== config.apiKey) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            next();
        });

        // Request logging
        this.app.use((req, res, next) => {
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
            });
            next();
        });
    }

    private setupRoutes(): void {
        // Health check (no auth required)
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                uptime: process.uptime(),
                timestamp: Date.now(),
                services: {
                    database: this.db.isConnected(),
                    redis: this.redis.isConnected(),
                    kaspa: this.kaspa.isConnected()
                }
            });
        });

        // Metrics endpoint (no auth required)
        this.app.get('/metrics', async (req, res) => {
            res.set('Content-Type', 'text/plain');
            res.send(await createPrometheusMetrics());
        });

        // API routes
        this.app.use('/api', apiRouter(this.kaspa, this.db, this.redis));

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({ error: 'Not found' });
        });

        // Error handler
        this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
            logger.error('Unhandled error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });
    }

    async start(): Promise<void> {
        await this.initialize();
        
        this.server.listen(config.port, () => {
            logger.info(`🚀 Kaspa Middleware Server running on port ${config.port}`);
            logger.info(`📊 Metrics: http://localhost:${config.port}/metrics`);
            logger.info(`🔌 WebSocket: ws://localhost:${config.port}/ws`);
            logger.info(`⚡ Optimized for 10 BPS throughput`);
        });
    }

    async shutdown(): Promise<void> {
        logger.info('Shutting down middleware server...');
        
        this.kaspa.stopBlockMonitoring();
        this.wsService.closeAll();
        
        await this.db.disconnect();
        await this.redis.disconnect();
        
        this.server.close(() => {
            logger.info('✓ Server shut down gracefully');
            process.exit(0);
        });
    }
}

// Start server
const server = new MiddlewareServer();

server.start().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => server.shutdown());
process.on('SIGINT', () => server.shutdown());

export default server;
