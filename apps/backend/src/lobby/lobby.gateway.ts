import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { LobbyService } from './lobby.service';
import { ProvablyFairService } from '../game/provably-fair.service';
import { KaspaPaymentService } from '../kaspa/kaspa-payment.service';
import { UserService } from '../user/user.service';

interface GameState {
  lobbyId: string;
  status: 'waiting' | 'countdown' | 'playing' | 'crashed';
  currentMultiplier: number;
  crashPoint: number;
  startTime: number | null;
  players: any[];
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class LobbyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LobbyGateway.name);
  private activeGames = new Map<string, GameState>();
  private gameIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private lobbyService: LobbyService,
    private provablyFairService: ProvablyFairService,
    private kaspaPaymentService: KaspaPaymentService,
    private userService: UserService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_lobby')
  async handleJoinLobby(
    @MessageBody() data: { kaspaAddress: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Find or create user
      const user = await this.userService.findOrCreate(data.kaspaAddress);

      // Find available lobby
      const lobby = await this.lobbyService.findOrCreateAvailableLobby();

      // Join room
      client.join(lobby.id);

      // Send lobby info
      client.emit('lobby_info', {
        lobbyId: lobby.id,
        buyInKas: lobby.buyInKas,
        maxPlayers: lobby.maxPlayers,
        currentPlayers: lobby.currentPlayers,
        serverSeedHash: lobby.serverSeedHash, // For verification
        publicSeed: lobby.publicSeed,
      });

      this.logger.log(`User ${user.kaspaAddress} joined lobby ${lobby.id}`);

      return { success: true, lobbyId: lobby.id, userId: user.id };
    } catch (error) {
      this.logger.error(`Error joining lobby: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('confirm_payment')
  async handleConfirmPayment(
    @MessageBody()
    data: { lobbyId: string; userId: string; txId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Verify payment
      const lobby = await this.lobbyService.getLobbyWithEntries(data.lobbyId);
      const isValid = await this.kaspaPaymentService.verifyLobbyPayment(
        data.txId,
        lobby.lobby.buyInKas,
      );

      if (!isValid) {
        client.emit('payment_failed', { message: 'Invalid payment' });
        return { success: false };
      }

      // Add player to lobby
      await this.lobbyService.joinLobby(
        data.lobbyId,
        data.userId,
        client.id,
        data.txId,
      );

      // Get updated lobby
      const updated = await this.lobbyService.getLobbyWithEntries(data.lobbyId);

      // Notify all players in lobby
      this.server.to(data.lobbyId).emit('player_joined', {
        currentPlayers: updated.lobby.currentPlayers,
        maxPlayers: updated.lobby.maxPlayers,
        pot: updated.lobby.potKas,
      });

      // Check if we should start countdown
      const minPlayers = 2;
      if (
        updated.lobby.currentPlayers >= minPlayers &&
        updated.lobby.status === 'waiting'
      ) {
        await this.startCountdown(data.lobbyId);
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Payment confirmation failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('cash_out')
  async handleCashOut(
    @MessageBody() data: { entryId: string; lobbyId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const gameState = this.activeGames.get(data.lobbyId);
      if (!gameState || gameState.status !== 'playing') {
        return { success: false, error: 'Game not running' };
      }

      const { winAmount } = await this.lobbyService.cashOut(
        data.entryId,
        gameState.currentMultiplier,
      );

      // Notify player
      client.emit('cash_out_success', {
        multiplier: gameState.currentMultiplier,
        winAmount,
      });

      // Notify others
      client.to(data.lobbyId).emit('player_cashed_out', {
        socketId: client.id,
        multiplier: gameState.currentMultiplier,
      });

      // TODO: Send payout transaction

      return { success: true, winAmount };
    } catch (error) {
      this.logger.error(`Cash out failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start countdown before game
   */
  private async startCountdown(lobbyId: string) {
    await this.lobbyService.startCountdown(lobbyId);
    
    const countdownDuration = 15; // 15 seconds
    let remaining = countdownDuration;

    const countdownInterval = setInterval(() => {
      this.server.to(lobbyId).emit('countdown', { remaining });
      remaining--;

      if (remaining <= 0) {
        clearInterval(countdownInterval);
        this.startGame(lobbyId);
      }
    }, 1000);
  }

  /**
   * Start the actual game
   */
  private async startGame(lobbyId: string) {
    const { lobby, entries } = await this.lobbyService.getLobbyWithEntries(
      lobbyId,
    );

    await this.lobbyService.startGame(lobbyId);

    const gameState: GameState = {
      lobbyId,
      status: 'playing',
      currentMultiplier: 1.0,
      crashPoint: lobby.crashPoint,
      startTime: Date.now(),
      players: entries.map((e) => ({
        id: e.id,
        userId: e.userId,
        betAmount: e.betAmount,
        status: 'active',
      })),
    };

    this.activeGames.set(lobbyId, gameState);

    // Notify game started
    this.server.to(lobbyId).emit('game_started', {
      publicSeed: lobby.publicSeed,
      serverSeedHash: lobby.serverSeedHash,
    });

    // Start game loop
    const interval = setInterval(() => {
      const elapsed = Date.now() - gameState.startTime;
      gameState.currentMultiplier = this.provablyFairService.calculateMultiplier(elapsed);

      // Send update to all players
      this.server.to(lobbyId).emit('multiplier_update', {
        multiplier: gameState.currentMultiplier.toFixed(2),
      });

      // Check if crashed
      if (gameState.currentMultiplier >= gameState.crashPoint) {
        clearInterval(interval);
        this.crashGame(lobbyId);
      }
    }, 50); // Update every 50ms (20 FPS)

    this.gameIntervals.set(lobbyId, interval);
  }

  /**
   * Handle game crash
   */
  private async crashGame(lobbyId: string) {
    const gameState = this.activeGames.get(lobbyId);
    if (!gameState) return;

    gameState.status = 'crashed';

    // Mark remaining players as lost
    await this.lobbyService.crashGame(lobbyId);

    // Get lobby to reveal server seed
    const { lobby } = await this.lobbyService.getLobbyWithEntries(lobbyId);

    // Notify crash
    this.server.to(lobbyId).emit('game_crashed', {
      crashPoint: gameState.crashPoint,
      serverSeed: lobby.serverSeed, // Reveal seed for verification
    });

    // Clean up
    this.activeGames.delete(lobbyId);
    const interval = this.gameIntervals.get(lobbyId);
    if (interval) {
      clearInterval(interval);
      this.gameIntervals.delete(lobbyId);
    }

    this.logger.log(`💥 Game crashed at ${gameState.crashPoint}x in lobby ${lobbyId}`);
  }
}
