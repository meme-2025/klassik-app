// WebSocket Service for Real-time Rush Game
// Handles live game updates, player synchronization, and events

import { io, Socket } from 'socket.io-client';

export interface PlayerUpdate {
  id: string;
  address: string;
  action: 'joined' | 'cashed-out' | 'lost';
  multiplier?: number;
  winAmount?: number;
  timestamp: number;
}

export interface GameUpdate {
  lobbyId: string;
  status: 'waiting' | 'starting' | 'running' | 'crashed';
  currentMultiplier: number;
  players: any[];
  pot: number;
  crashPoint?: number;
  elapsedTime: number;
}

export interface LobbyInfo {
  id: string;
  playerCount: number;
  maxPlayers: number;
  betAmount: number;
  status: 'open' | 'full' | 'playing';
  pot: number;
}

class RushGameSocket {
  private socket: Socket | null = null;
  private currentLobby: string | null = null;
  private connected: boolean = false;
  private eventHandlers: Map<string, Function[]> = new Map();

  /**
   * Connect to WebSocket server
   */
  connect(serverUrl: string = 'http://localhost:3001'): void {
    if (this.socket) {
      console.log('Already connected to server');
      return;
    }

    console.log('🔌 Connecting to Rush Game server...');

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.setupSocketListeners();
  }

  /**
   * Setup socket event listeners
   */
  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Connected to Rush Game server');
      this.connected = true;
      this.emit('connected', {});
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Disconnected from server');
      this.connected = false;
      this.emit('disconnected', {});
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      this.emit('error', error);
    });

    // Game-specific events
    this.socket.on('game:update', (update: GameUpdate) => {
      this.emit('gameUpdate', update);
    });

    this.socket.on('player:joined', (player: PlayerUpdate) => {
      console.log('👤 Player joined:', player);
      this.emit('playerJoined', player);
    });

    this.socket.on('player:cashedOut', (player: PlayerUpdate) => {
      console.log('💰 Player cashed out:', player);
      this.emit('playerCashedOut', player);
    });

    this.socket.on('game:started', (data: any) => {
      console.log('🚀 Game started!', data);
      this.emit('gameStarted', data);
    });

    this.socket.on('game:crashed', (data: any) => {
      console.log('💥 Game crashed!', data);
      this.emit('gameCrashed', data);
    });

    this.socket.on('lobby:list', (lobbies: LobbyInfo[]) => {
      this.emit('lobbyList', lobbies);
    });
  }

  /**
   * Join a lobby
   */
  joinLobby(lobbyId: string, playerData: { address: string; betAmount: number }): void {
    if (!this.socket || !this.connected) {
      throw new Error('Not connected to server');
    }

    console.log(`🎮 Joining lobby ${lobbyId}...`);
    this.currentLobby = lobbyId;
    
    this.socket.emit('lobby:join', {
      lobbyId,
      ...playerData
    });
  }

  /**
   * Leave current lobby
   */
  leaveLobby(): void {
    if (!this.socket || !this.currentLobby) return;

    console.log(`👋 Leaving lobby ${this.currentLobby}...`);
    this.socket.emit('lobby:leave', { lobbyId: this.currentLobby });
    this.currentLobby = null;
  }

  /**
   * Cash out from game
   */
  cashOut(multiplier: number): void {
    if (!this.socket || !this.currentLobby) {
      throw new Error('Not in a game');
    }

    console.log(`💵 Cashing out at ${multiplier}x...`);
    this.socket.emit('game:cashout', {
      lobbyId: this.currentLobby,
      multiplier
    });
  }

  /**
   * Request lobby list
   */
  getLobbies(): void {
    if (!this.socket) {
      throw new Error('Not connected to server');
    }

    this.socket.emit('lobby:list');
  }

  /**
   * Create new lobby
   */
  createLobby(config: { betAmount: number; maxPlayers: number }): void {
    if (!this.socket) {
      throw new Error('Not connected to server');
    }

    console.log('🏗️ Creating new lobby...', config);
    this.socket.emit('lobby:create', config);
  }

  /**
   * Register event handler
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Unregister event handler
   */
  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to handlers
   */
  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Disconnecting from server...');
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.currentLobby = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get current lobby
   */
  getCurrentLobby(): string | null {
    return this.currentLobby;
  }
}

// Export singleton
export const rushGameSocket = new RushGameSocket();

// Mock WebSocket for testing
export class MockRushGameSocket {
  private currentLobby: string | null = null;
  private mockPlayers: any[] = [];
  private gameInterval: any = null;
  private eventHandlers: Map<string, Function[]> = new Map();

  connect(serverUrl?: string): void {
    console.log('🧪 Mock socket connected');
    setTimeout(() => this.emit('connected', {}), 100);
  }

  joinLobby(lobbyId: string, playerData: any): void {
    console.log('🧪 Mock joined lobby:', lobbyId);
    this.currentLobby = lobbyId;
    
    // Simulate other players
    setTimeout(() => {
      for (let i = 0; i < 9; i++) {
        this.emit('playerJoined', {
          id: `player-${i}`,
          address: `kaspa:mock${i}`,
          action: 'joined',
          timestamp: Date.now()
        });
      }
    }, 500);

    // Auto-start game after 3 seconds
    setTimeout(() => {
      this.startMockGame();
    }, 3000);
  }

  private startMockGame(): void {
    console.log('🧪 Mock game starting...');
    this.emit('gameStarted', { crashPoint: 3.5 });

    let multiplier = 1.0;
    this.gameInterval = setInterval(() => {
      multiplier += 0.1;
      
      this.emit('gameUpdate', {
        lobbyId: this.currentLobby,
        status: 'running',
        currentMultiplier: multiplier,
        players: this.mockPlayers,
        pot: 100,
        elapsedTime: (multiplier - 1) * 1000
      });

      // Random player cash outs
      if (Math.random() > 0.9 && this.mockPlayers.length > 0) {
        const player = this.mockPlayers.shift();
        this.emit('playerCashedOut', {
          ...player,
          action: 'cashed-out',
          multiplier,
          winAmount: 10 * multiplier
        });
      }

      // Crash at predetermined point
      if (multiplier >= 3.5) {
        clearInterval(this.gameInterval);
        this.emit('gameCrashed', {
          crashPoint: 3.5,
          timestamp: Date.now()
        });
      }
    }, 100);
  }

  cashOut(multiplier: number): void {
    console.log('🧪 Mock cash out at', multiplier);
    this.emit('playerCashedOut', {
      id: 'you',
      multiplier,
      winAmount: 10 * multiplier,
      timestamp: Date.now()
    });
  }

  leaveLobby(): void {
    this.currentLobby = null;
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
    }
  }

  disconnect(): void {
    console.log('🧪 Mock socket disconnected');
    this.leaveLobby();
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  isConnected(): boolean {
    return true;
  }

  getCurrentLobby(): string | null {
    return this.currentLobby;
  }

  getLobbies(): void {
    this.emit('lobbyList', [
      { id: 'lobby-1', playerCount: 5, maxPlayers: 10, betAmount: 10, status: 'open', pot: 50 },
      { id: 'lobby-2', playerCount: 8, maxPlayers: 10, betAmount: 10, status: 'open', pot: 80 },
      { id: 'lobby-3', playerCount: 10, maxPlayers: 10, betAmount: 10, status: 'full', pot: 100 }
    ]);
  }

  createLobby(config: any): void {
    console.log('🧪 Mock lobby created', config);
  }
}

// Use mock in development
export const isDevelopment = process.env.NODE_ENV === 'development';
export default isDevelopment ? new MockRushGameSocket() : rushGameSocket;
