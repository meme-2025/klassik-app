import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GameEngine } from './game.engine';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);
  private connectedClients = new Map<string, Socket>();
  private gameUpdateInterval: NodeJS.Timeout | null = null;

  constructor(private gameEngine: GameEngine) {}

  async afterInit() {
    this.logger.log('WebSocket Gateway initialized');
    
    // Start first game
    await this.gameEngine.startNewGame();
    
    // Start broadcasting game state
    this.startGameBroadcast();
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);

    // Send current game state to new client
    const currentGame = this.gameEngine.getCurrentGame();
    if (currentGame) {
      client.emit('game:state', {
        state: currentGame.state,
        gameId: currentGame.id,
        currentMultiplier: currentGame.currentMultiplier,
      });
    }

    // Send game history
    this.gameEngine.getGameHistory(10).then((history) => {
      client.emit('game:history', history);
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('game:placeBet')
  async handlePlaceBet(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { amount: number; autoCashout: number | null },
  ) {
    const userId = client.id;
    const username = `Player_${userId.substring(0, 6)}`;

    const success = await this.gameEngine.placeBet(
      userId,
      username,
      data.amount,
      data.autoCashout,
    );

    if (success) {
      client.emit('game:betPlaced', { success: true });
      
      // Notify all clients about new bet
      this.server.emit('player:bet', {
        playerId: userId,
        username,
        amount: data.amount,
      });
    } else {
      client.emit('game:betPlaced', { 
        success: false, 
        error: 'Cannot place bet at this time' 
      });
    }
  }

  @SubscribeMessage('game:cashout')
  async handleCashout(@ConnectedSocket() client: Socket) {
    const userId = client.id;
    const winAmount = await this.gameEngine.cashoutBet(userId);

    if (winAmount !== null) {
      const currentGame = this.gameEngine.getCurrentGame();
      
      client.emit('game:cashedOut', {
        success: true,
        winAmount,
        multiplier: currentGame?.currentMultiplier,
      });

      // Notify all clients
      this.server.emit('player:cashout', {
        playerId: userId,
        multiplier: currentGame?.currentMultiplier,
        winAmount,
      });
    } else {
      client.emit('game:cashedOut', {
        success: false,
        error: 'Cannot cash out at this time',
      });
    }
  }

  /**
   * Broadcast game state updates to all connected clients
   */
  private startGameBroadcast() {
    this.gameUpdateInterval = setInterval(() => {
      const currentGame = this.gameEngine.getCurrentGame();
      if (!currentGame) return;

      // Broadcast current multiplier during running state
      if (currentGame.state === 'running') {
        this.server.emit('game:multiplier', {
          multiplier: currentGame.currentMultiplier,
        });
      }

      // Broadcast state changes
      if (currentGame.state === 'waiting') {
        this.server.emit('game:state', {
          state: 'waiting',
          gameId: currentGame.id,
        });
      }

      if (currentGame.state === 'crashed') {
        this.server.emit('game:crashed', {
          crashPoint: currentGame.crashPoint,
          gameId: currentGame.id,
        });
      }
    }, 100); // Update every 100ms for smooth animations
  }

  onModuleDestroy() {
    if (this.gameUpdateInterval) {
      clearInterval(this.gameUpdateInterval);
    }
  }
}
