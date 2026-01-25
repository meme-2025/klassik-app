import axios from 'axios';
import { config } from './config';
import { logger } from './logger';
import { DatabaseService } from './database';
import { RedisCache } from './cache';

export class KaspaService {
    private restClient: any;
    private db: DatabaseService;
    private cache: RedisCache;
    private isMonitoring = false;
    private monitoringInterval: NodeJS.Timeout | null = null;
    private lastProcessedBlueScore = 0;
    private connected = false;
    
    // Batching and performance optimization
    private pendingRequests: Array<{
        request: any;
        resolve: Function;
        reject: Function;
        timestamp: number;
    }> = [];
    private batchTimer: NodeJS.Timeout | null = null;
    private readonly BATCH_SIZE = parseInt(process.env.RPC_BATCH_SIZE || '10');
    private readonly BATCH_INTERVAL = parseInt(process.env.RPC_BATCH_INTERVAL || '100'); // 100ms for 10 BPS
    private readonly DB_BATCH_SIZE = parseInt(process.env.DB_BATCH_SIZE || '100');
    private dbQueue: any[] = [];
    private dbBatchTimer: NodeJS.Timeout | null = null;

    constructor(db: DatabaseService, cache: RedisCache) {
        this.db = db;
        this.cache = cache;
        this.restClient = axios.create({
            baseURL: config.restServerUrl,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            },
            // Connection pooling for better performance
            httpAgent: new (require('http')).Agent({
                keepAlive: true,
                keepAliveMsecs: 30000,
                maxSockets: 20
            })
        });
    }

    async initialize(): Promise<void> {
        try {
            // Test connection to kaspa-rest-server
            await this.getNetworkInfo();
            this.connected = true;
            
            // Start monitoring and batching
            this.startBlockMonitoring();
            this.startBatchProcessing();
            
            logger.info('✓ Kaspa service initialized with batching (10 BPS target)');
        } catch (error) {
            logger.error('Failed to initialize Kaspa service:', error);
            throw error;
        }
    }

    isConnected(): boolean {
        return this.connected;
    }

    // Optimized batch request handler
    private async batchRequest(requestData: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.pendingRequests.push({
                request: requestData,
                resolve,
                reject,
                timestamp: Date.now()
            });

            // Start batch timer if not running
            if (!this.batchTimer && this.pendingRequests.length > 0) {
                this.batchTimer = setTimeout(() => {
                    this.processBatch();
                }, this.BATCH_INTERVAL);
            }

            // Force batch if we hit the limit
            if (this.pendingRequests.length >= this.BATCH_SIZE) {
                if (this.batchTimer) {
                    clearTimeout(this.batchTimer);
                    this.batchTimer = null;
                }
                this.processBatch();
            }
        });
    }

    private async processBatch(): Promise<void> {
        if (this.pendingRequests.length === 0) return;

        const batch = this.pendingRequests.splice(0, this.BATCH_SIZE);
        this.batchTimer = null;

        try {
            // Process batch requests in parallel with controlled concurrency
            const promises = batch.map(async (item) => {
                try {
                    const result = await this.restClient(item.request);
                    item.resolve(result.data);
                } catch (error) {
                    item.reject(error);
                }
            });

            await Promise.allSettled(promises);
            
            // Restart timer for next batch if there are pending requests
            if (this.pendingRequests.length > 0) {
                this.batchTimer = setTimeout(() => {
                    this.processBatch();
                }, this.BATCH_INTERVAL);
            }
        } catch (error) {
            // Reject all requests in batch on critical error
            batch.forEach(item => item.reject(error));
            logger.error('Batch processing failed:', error);
        }
    }

    // Database batch operations
    private async addToDBQueue(operation: any): Promise<void> {
        this.dbQueue.push(operation);
        
        if (!this.dbBatchTimer && this.dbQueue.length > 0) {
            this.dbBatchTimer = setTimeout(() => {
                this.processDBBatch();
            }, 1000); // 1 second batch window for DB
        }
        
        if (this.dbQueue.length >= this.DB_BATCH_SIZE) {
            if (this.dbBatchTimer) {
                clearTimeout(this.dbBatchTimer);
                this.dbBatchTimer = null;
            }
            this.processDBBatch();
        }
    }

    private async processDBBatch(): Promise<void> {
        if (this.dbQueue.length === 0) return;
        
        const batch = this.dbQueue.splice(0, this.DB_BATCH_SIZE);
        this.dbBatchTimer = null;
        
        try {
            // Group operations by type for bulk processing
            const insertBlocks: any[] = [];
            const insertTransactions: any[] = [];
            const updateAddresses: any[] = [];
            
            batch.forEach(op => {
                switch (op.type) {
                    case 'block': insertBlocks.push(op.data); break;
                    case 'transaction': insertTransactions.push(op.data); break;
                    case 'address': updateAddresses.push(op.data); break;
                }
            });
            
            // Execute bulk operations
            const promises = [];
            if (insertBlocks.length > 0) {
                promises.push(this.db.bulkInsertBlocks(insertBlocks));
            }
            if (insertTransactions.length > 0) {
                promises.push(this.db.bulkInsertTransactions(insertTransactions));
            }
            if (updateAddresses.length > 0) {
                promises.push(this.db.bulkUpdateAddresses(updateAddresses));
            }
            
            await Promise.allSettled(promises);
            
            // Continue processing if queue has items
            if (this.dbQueue.length > 0) {
                this.dbBatchTimer = setTimeout(() => {
                    this.processDBBatch();
                }, 1000);
            }
            
        } catch (error) {
            logger.error('DB batch processing failed:', error);
        }
    }

    async getNetworkInfo(): Promise<any> {
        const cacheKey = 'network:info';
        
        // Check cache first
        const cached = await this.cache.get(cacheKey);
        if (cached) return cached;

        const response = await this.restClient.get('/info');
        const data = response.data;

        // Cache for 10 seconds
        await this.cache.set(cacheKey, data, 10);
        return data;
    }

    async getBlockByHash(hash: string): Promise<any> {
        const cacheKey = `block:${hash}`;
        
        const cached = await this.cache.get(cacheKey);
        if (cached) return cached;

        // Try database first
        const dbBlock = await this.db.getBlockByHash(hash);
        if (dbBlock) {
            await this.cache.set(cacheKey, dbBlock, 3600); // Cache 1 hour
            return dbBlock;
        }

        // Fallback to REST server
        const response = await this.restClient.get(`/blocks/${hash}`);
        const data = response.data;
        
        await this.cache.set(cacheKey, data, 3600);
        return data;
    }

    async getLatestBlocks(limit: number = 50): Promise<any[]> {
        const cacheKey = `blocks:latest:${limit}`;
        
        const cached = await this.cache.get(cacheKey);
        if (cached) return cached;

        const blocks = await this.db.getLatestBlocks(limit);
        
        await this.cache.set(cacheKey, blocks, 5); // Cache 5 seconds
        return blocks;
    }

    async getTransaction(txId: string): Promise<any> {
        const cacheKey = `tx:${txId}`;
        
        const cached = await this.cache.get(cacheKey);
        if (cached) return cached;

        const response = await this.restClient.get(`/transactions/${txId}`);
        const data = response.data;
        
        await this.cache.set(cacheKey, data, 3600);
        return data;
    }

    async getAddressInfo(address: string): Promise<any> {
        const cacheKey = `address:${address}`;
        
        const cached = await this.cache.get(cacheKey);
        if (cached) return cached;

        // Get from database
        const balance = await this.db.getAddressBalance(address);
        
        if (balance) {
            await this.cache.set(cacheKey, balance, 30); // Cache 30 seconds
            return balance;
        }

        // Fallback to REST
        const response = await this.restClient.get(`/addresses/${address}`);
        const data = response.data;
        
        await this.cache.set(cacheKey, data, 30);
        return data;
    }

    // Real-time block monitoring optimized for 10 BPS
    startBlockMonitoring(callback: (block: any) => void): void {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        logger.info('Starting block monitoring (10 BPS mode)');

        // Poll every 100ms (10 blocks per second = 100ms per block)
        this.monitoringInterval = setInterval(async () => {
            try {
                const networkInfo = await this.getNetworkInfo();
                const currentBlueScore = networkInfo.virtualDaaScore || 0;

                if (currentBlueScore > this.lastProcessedBlueScore) {
                    const blocksToFetch = currentBlueScore - this.lastProcessedBlueScore;
                    
                    // Fetch new blocks (with limit to prevent overload)
                    const limit = Math.min(blocksToFetch, 50);
                    const blocks = await this.getLatestBlocks(limit);
                    
                    // Process each new block
                    for (const block of blocks) {
                        if (block.blue_score > this.lastProcessedBlueScore) {
                            callback(block);
                        }
                    }
                    
                    this.lastProcessedBlueScore = currentBlueScore;
                }
            } catch (error) {
                logger.error('Block monitoring error:', error);
            }
        }, config.blockPollInterval);
    }

    stopBlockMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
        logger.info('Stopped block monitoring');
    }
}
