import { WebSocketServer, WebSocket } from 'ws';
import { logger } from './logger';
import { KaspaService } from './kaspa';
import { config } from './config';

interface Client {
    ws: WebSocket;
    subscriptions: Set<string>;
    isAlive: boolean;
}

export class WebSocketService {
    private wss: WebSocketServer;
    private kaspa: KaspaService;
    private clients: Map<WebSocket, Client> = new Map();
    private heartbeatInterval: NodeJS.Timeout | null = null;

    constructor(wss: WebSocketServer, kaspa: KaspaService) {
        this.wss = wss;
        this.kaspa = kaspa;
        this.initialize();
    }

    private initialize(): void {
        this.wss.on('connection', (ws: WebSocket) => {
            this.handleConnection(ws);
        });

        // Heartbeat to detect dead connections
        this.heartbeatInterval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                const client = this.clients.get(ws);
                if (client && !client.isAlive) {
                    logger.debug('Terminating dead WebSocket connection');
                    return ws.terminate();
                }
                if (client) {
                    client.isAlive = false;
                    ws.ping();
                }
            });
        }, config.wsHeartbeatInterval);

        logger.info('✓ WebSocket service initialized');
    }

    private handleConnection(ws: WebSocket): void {
        const client: Client = {
            ws,
            subscriptions: new Set(),
            isAlive: true
        };

        this.clients.set(ws, client);
        logger.info(`New WebSocket connection (total: ${this.clients.size})`);

        // Send welcome message
        this.sendToClient(ws, {
            type: 'connected',
            message: 'Connected to Kaspa WebSocket API',
            timestamp: Date.now()
        });

        ws.on('pong', () => {
            const c = this.clients.get(ws);
            if (c) c.isAlive = true;
        });

        ws.on('message', (data: Buffer) => {
            this.handleMessage(ws, data);
        });

        ws.on('close', () => {
            this.clients.delete(ws);
            logger.info(`WebSocket disconnected (total: ${this.clients.size})`);
        });

        ws.on('error', (error) => {
            logger.error('WebSocket error:', error);
        });
    }

    private handleMessage(ws: WebSocket, data: Buffer): void {
        try {
            const message = JSON.parse(data.toString());
            const client = this.clients.get(ws);
            if (!client) return;

            switch (message.type) {
                case 'subscribe':
                    this.handleSubscribe(client, message.channel);
                    break;
                case 'unsubscribe':
                    this.handleUnsubscribe(client, message.channel);
                    break;
                case 'ping':
                    this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
                    break;
                default:
                    this.sendToClient(ws, { type: 'error', message: 'Unknown message type' });
            }
        } catch (error) {
            logger.error('WebSocket message parsing error:', error);
            this.sendToClient(ws, { type: 'error', message: 'Invalid message format' });
        }
    }

    private handleSubscribe(client: Client, channel: string): void {
        client.subscriptions.add(channel);
        this.sendToClient(client.ws, {
            type: 'subscribed',
            channel,
            timestamp: Date.now()
        });
        logger.debug(`Client subscribed to ${channel}`);
    }

    private handleUnsubscribe(client: Client, channel: string): void {
        client.subscriptions.delete(channel);
        this.sendToClient(client.ws, {
            type: 'unsubscribed',
            channel,
            timestamp: Date.now()
        });
        logger.debug(`Client unsubscribed from ${channel}`);
    }

    private sendToClient(ws: WebSocket, data: any): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    // Broadcast new block to all subscribed clients
    broadcastNewBlock(block: any): void {
        const message = {
            type: 'new_block',
            data: block,
            timestamp: Date.now()
        };

        let sentCount = 0;
        this.clients.forEach((client) => {
            if (client.subscriptions.has('blocks') || client.subscriptions.has('all')) {
                this.sendToClient(client.ws, message);
                sentCount++;
            }
        });

        if (sentCount > 0) {
            logger.debug(`Broadcasted new block ${block.hash} to ${sentCount} clients`);
        }
    }

    // Broadcast transaction to subscribed clients
    broadcastTransaction(tx: any): void {
        const message = {
            type: 'new_transaction',
            data: tx,
            timestamp: Date.now()
        };

        this.clients.forEach((client) => {
            if (client.subscriptions.has('transactions') || client.subscriptions.has('all')) {
                this.sendToClient(client.ws, message);
            }
        });
    }

    closeAll(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.clients.forEach((client) => {
            client.ws.close();
        });

        this.clients.clear();
        logger.info('All WebSocket connections closed');
    }
}
