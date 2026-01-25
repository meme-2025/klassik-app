import Redis from 'ioredis';
import { config } from './config';
import { logger } from './logger';

export class RedisCache {
    private client: Redis;
    private connected = false;

    constructor() {
        this.client = new Redis(config.redisUrl, {
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: true
        });

        this.client.on('connect', () => {
            logger.info('✓ Redis connected');
            this.connected = true;
        });

        this.client.on('error', (err) => {
            logger.error('Redis error:', err);
            this.connected = false;
        });
    }

    async connect(): Promise<void> {
        await this.client.connect();
    }

    async disconnect(): Promise<void> {
        await this.client.quit();
        this.connected = false;
    }

    isConnected(): boolean {
        return this.connected;
    }

    async get<T>(key: string): Promise<T | null> {
        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error(`Cache get error for key ${key}:`, error);
            return null;
        }
    }

    async set(key: string, value: any, ttl: number = config.cacheDefaultTTL): Promise<void> {
        try {
            await this.client.setex(key, ttl, JSON.stringify(value));
        } catch (error) {
            logger.error(`Cache set error for key ${key}:`, error);
        }
    }

    async del(key: string): Promise<void> {
        try {
            await this.client.del(key);
        } catch (error) {
            logger.error(`Cache delete error for key ${key}:`, error);
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            return (await this.client.exists(key)) === 1;
        } catch (error) {
            logger.error(`Cache exists error for key ${key}:`, error);
            return false;
        }
    }

    async flush(): Promise<void> {
        await this.client.flushall();
    }
}
