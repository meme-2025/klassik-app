import { Pool, PoolClient } from 'pg';
import { config } from './config';
import { logger } from './logger';

export class DatabaseService {
    private pool: Pool;
    private connected = false;

    constructor() {
        this.pool = new Pool({
            connectionString: config.databaseUrl,
            max: 50, // Increased for high throughput
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            // Optimization for high-frequency operations
            keepAlive: true,
            allowExitOnIdle: false,
            statement_timeout: 30000,
            query_timeout: 30000,
        });

        this.pool.on('connect', () => {
            this.connected = true;
        });

        this.pool.on('error', (err) => {
            logger.error('Database pool error:', err);
            this.connected = false;
        });
    }

    async connect(): Promise<void> {
        try {
            const client = await this.pool.connect();
            
            // Optimize PostgreSQL settings for high throughput
            await client.query(`
                SET statement_timeout = '30s';
                SET lock_timeout = '10s';
                SET idle_in_transaction_session_timeout = '30s';
                SET synchronous_commit = off;
                SET checkpoint_completion_target = 0.9;
            `);
            
            client.release();
            logger.info('✓ Database connected with optimizations');
            this.connected = true;
        } catch (error) {
            logger.error('Database connection failed:', error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        await this.pool.end();
        this.connected = false;
    }

    isConnected(): boolean {
        return this.connected;
    }

    // Bulk insert operations for high-throughput (10 BPS optimization)
    async bulkInsertBlocks(blocks: any[]): Promise<void> {
        if (blocks.length === 0) return;
        
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            
            // Use COPY for maximum performance
            const copyText = `
                COPY blocks (hash, height, timestamp, blue_score, blue_work, difficulty, 
                           parent_hashes, transaction_count, size, miner_data)
                FROM STDIN WITH (FORMAT csv, NULL 'null')
            `;
            
            const stream = client.query(copyText);
            
            for (const block of blocks) {
                const row = [
                    block.hash,
                    block.height,
                    new Date(block.timestamp),
                    block.blueScore,
                    block.blueWork,
                    block.difficulty,
                    JSON.stringify(block.parentHashes),
                    block.transactionCount,
                    block.size,
                    block.minerData
                ].map(val => val === undefined || val === null ? 'null' : 
                       typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
                ).join(',');
                
                stream.write(row + '\n');
            }
            
            await stream.end();
            await client.query('COMMIT');
            
            logger.debug(`Bulk inserted ${blocks.length} blocks`);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async bulkInsertTransactions(transactions: any[]): Promise<void> {
        if (transactions.length === 0) return;
        
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            
            // Prepare bulk insert with ON CONFLICT handling
            const values = transactions.map((tx, index) => {
                const baseIndex = index * 8;
                return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, 
                        $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8})`;
            }).join(',');
            
            const params = transactions.flatMap(tx => [
                tx.hash,
                tx.blockHash,
                tx.mass,
                tx.fee,
                JSON.stringify(tx.inputs),
                JSON.stringify(tx.outputs),
                new Date(tx.timestamp),
                tx.acceptingBlockHash
            ]);
            
            const query = `
                INSERT INTO transactions (hash, block_hash, mass, fee, inputs, outputs, timestamp, accepting_block_hash)
                VALUES ${values}
                ON CONFLICT (hash) DO UPDATE SET
                    accepting_block_hash = EXCLUDED.accepting_block_hash,
                    timestamp = EXCLUDED.timestamp
            `;
            
            await client.query(query, params);
            await client.query('COMMIT');
            
            logger.debug(`Bulk inserted ${transactions.length} transactions`);
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Bulk insert transactions failed:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async bulkUpdateAddresses(addresses: any[]): Promise<void> {
        if (addresses.length === 0) return;
        
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            
            // Use temporary table for bulk upsert
            await client.query(`
                CREATE TEMP TABLE temp_addresses (
                    address VARCHAR(255),
                    balance BIGINT,
                    transaction_count INTEGER,
                    first_seen TIMESTAMP,
                    last_seen TIMESTAMP
                ) ON COMMIT DROP
            `);
            
            // Insert into temp table
            const values = addresses.map((addr, index) => {
                const baseIndex = index * 5;
                return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`;
            }).join(',');
            
            const params = addresses.flatMap(addr => [
                addr.address,
                addr.balance,
                addr.transactionCount,
                new Date(addr.firstSeen),
                new Date(addr.lastSeen)
            ]);
            
            await client.query(`INSERT INTO temp_addresses VALUES ${values}`, params);
            
            // Perform upsert from temp table
            await client.query(`
                INSERT INTO addresses (address, balance, transaction_count, first_seen, last_seen)
                SELECT * FROM temp_addresses
                ON CONFLICT (address) DO UPDATE SET
                    balance = EXCLUDED.balance,
                    transaction_count = addresses.transaction_count + 1,
                    last_seen = EXCLUDED.last_seen,
                    first_seen = LEAST(addresses.first_seen, EXCLUDED.first_seen)
            `);
            
            await client.query('COMMIT');
            
            logger.debug(`Bulk updated ${addresses.length} addresses`);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async query(text: string, params?: any[]): Promise<any> {
        const start = Date.now();
        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            logger.debug(`Query executed in ${duration}ms: ${text}`);
            return result;
        } catch (error) {
            logger.error('Query error:', error);
            throw error;
        }
    }

    async getClient(): Promise<PoolClient> {
        return await this.pool.query();
    }

    // Optimized queries for 10 BPS
    async getLatestBlocks(limit: number = 50): Promise<any[]> {
        const result = await this.query(
            'SELECT * FROM blocks ORDER BY blue_score DESC LIMIT $1',
            [limit]
        );
        return result.rows;
    }

    async getBlockByHash(hash: string): Promise<any> {
        const result = await this.query(
            'SELECT * FROM blocks WHERE hash = $1',
            [hash]
        );
        return result.rows[0];
    }

    async getTransactionsByBlockHash(blockHash: string): Promise<any[]> {
        const result = await this.query(
            'SELECT * FROM transactions WHERE block_hash = $1',
            [blockHash]
        );
        return result.rows;
    }

    async getAddressBalance(address: string): Promise<any> {
        const result = await this.query(
            'SELECT * FROM address_balances WHERE address = $1',
            [address]
        );
        return result.rows[0];
    }

    async getNetworkStats(): Promise<any> {
        const result = await this.query(
            'SELECT * FROM network_stats ORDER BY timestamp DESC LIMIT 1'
        );
        return result.rows[0];
    }
}
