import { Router } from 'express';
import { KaspaService } from '../kaspa';
import { DatabaseService } from '../database';
import { RedisCache } from '../cache';
import { logger } from '../logger';

export function apiRouter(kaspa: KaspaService, db: DatabaseService, cache: RedisCache): Router {
    const router = Router();

    // Health check
    router.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            services: {
                kaspa: kaspa.isConnected(),
                database: db.isConnected(),
                cache: cache.isConnected()
            }
        });
    });

    // Network info
    router.get('/info', async (req, res) => {
        try {
            const info = await kaspa.getNetworkInfo();
            res.json(info);
        } catch (error) {
            logger.error('Get network info error:', error);
            res.status(500).json({ error: 'Failed to get network info' });
        }
    });

    // Latest blocks
    router.get('/blocks', async (req, res) => {
        try {
            const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
            const blocks = await kaspa.getLatestBlocks(limit);
            res.json({
                blocks,
                count: blocks.length
            });
        } catch (error) {
            logger.error('Get blocks error:', error);
            res.status(500).json({ error: 'Failed to get blocks' });
        }
    });

    // Block by hash
    router.get('/blocks/:hash', async (req, res) => {
        try {
            const block = await kaspa.getBlockByHash(req.params.hash);
            if (!block) {
                return res.status(404).json({ error: 'Block not found' });
            }
            res.json(block);
        } catch (error) {
            logger.error('Get block error:', error);
            res.status(500).json({ error: 'Failed to get block' });
        }
    });

    // Transaction by ID
    router.get('/transactions/:txId', async (req, res) => {
        try {
            const tx = await kaspa.getTransaction(req.params.txId);
            if (!tx) {
                return res.status(404).json({ error: 'Transaction not found' });
            }
            res.json(tx);
        } catch (error) {
            logger.error('Get transaction error:', error);
            res.status(500).json({ error: 'Failed to get transaction' });
        }
    });

    // Address info
    router.get('/addresses/:address', async (req, res) => {
        try {
            const info = await kaspa.getAddressInfo(req.params.address);
            res.json(info);
        } catch (error) {
            logger.error('Get address info error:', error);
            res.status(500).json({ error: 'Failed to get address info' });
        }
    });

    // Network statistics
    router.get('/stats', async (req, res) => {
        try {
            const stats = await db.getNetworkStats();
            res.json(stats || {});
        } catch (error) {
            logger.error('Get stats error:', error);
            res.status(500).json({ error: 'Failed to get statistics' });
        }
    });

    return router;
}
