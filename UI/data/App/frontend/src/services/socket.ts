import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';
import toast from 'react-hot-toast';

class GameSocket {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    const { setConnectionStatus, updateSession, addActiveGame, removeActiveGame } = useGameStore.getState();
    
    try {
      this.socket = io('http://localhost:3000', {
        timeout: 5000,
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('🎮 Connected to game server');
        setConnectionStatus('connected');
        this.reconnectAttempts = 0;
        toast.success('Connected to game server');
      });

      this.socket.on('disconnect', () => {
        console.log('🎮 Disconnected from game server');
        setConnectionStatus('disconnected');
        toast.error('Disconnected from server');
        this.handleReconnect();
      });

      this.socket.on('connect_error', (error) => {
        console.error('🎮 Connection error:', error);
        setConnectionStatus('disconnected');
        this.handleReconnect();
      });

      // Game events
      this.socket.on('game:session_updated', (session) => {
        updateSession(session);
        toast.success('Game session updated');
      });

      this.socket.on('game:session_started', (session) => {
        updateSession(session);
        toast.success('Game started!');
      });

      this.socket.on('game:session_ended', (result) => {
        console.log('Game ended:', result);
        toast.success('Game completed!');
      });

      this.socket.on('game:new_game', (game) => {
        addActiveGame(game);
      });

      this.socket.on('game:game_removed', (gameId) => {
        removeActiveGame(gameId);
      });

      this.socket.on('game:bet_result', (result) => {
        const { updateBalance } = useGameStore.getState();
        updateBalance(result.winAmount - result.betAmount);
        
        if (result.winAmount > 0) {
          toast.success(`You won ${result.winAmount} KAS!`);
        } else {
          toast.error(`You lost ${result.betAmount} KAS`);
        }
      });

      this.socket.on('game:error', (error) => {
        console.error('Game error:', error);
        toast.error(error.message || 'Game error occurred');
      });

    } catch (error) {
      console.error('🎮 Failed to connect:', error);
      setConnectionStatus('disconnected');
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const { setConnectionStatus } = useGameStore.getState();
      
      setConnectionStatus('connecting');
      console.log(`🎮 Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      setTimeout(() => {
        this.connect();
      }, Math.pow(2, this.reconnectAttempts) * 1000);
    } else {
      toast.error('Failed to reconnect to game server');
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Game actions
  joinGame(gameId: string, betAmount: number) {
    if (this.socket?.connected) {
      this.socket.emit('game:join', { gameId, betAmount });
    } else {
      toast.error('Not connected to server');
    }
  }

  leaveGame(gameId: string) {
    if (this.socket?.connected) {
      this.socket.emit('game:leave', { gameId });
    }
  }

  placeBet(gameId: string, bet: any) {
    if (this.socket?.connected) {
      this.socket.emit('game:bet', { gameId, bet });
    } else {
      toast.error('Not connected to server');
    }
  }

  createGame(gameType: string, options: any) {
    if (this.socket?.connected) {
      this.socket.emit('game:create', { gameType, options });
    } else {
      toast.error('Not connected to server');
    }
  }

  sendMessage(gameId: string, message: string) {
    if (this.socket?.connected) {
      this.socket.emit('game:chat', { gameId, message });
    }
  }

  // Dice game specific
  rollDice(gameId: string, prediction: 'higher' | 'lower', target: number) {
    this.placeBet(gameId, { type: 'dice', prediction, target });
  }

  // Crash game specific
  cashOut(gameId: string) {
    if (this.socket?.connected) {
      this.socket.emit('game:crash_cashout', { gameId });
    }
  }

  // Roulette game specific
  placeBetRoulette(gameId: string, bets: Array<{type: string, value: any, amount: number}>) {
    this.placeBet(gameId, { type: 'roulette', bets });
  }
}

export const gameSocket = new GameSocket();
export const socketService = gameSocket; // Alias for compatibility