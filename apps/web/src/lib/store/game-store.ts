import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface GameStore {
  socket: Socket | null;
  lobbyId: string | null;
  gameStatus: 'idle' | 'waiting' | 'countdown' | 'playing' | 'crashed';
  currentMultiplier: number;
  crashPoint: number | null;
  players: any[];
  countdown: number;
  hasJoined: boolean;
  hasCashedOut: boolean;
  winAmount: number | null;

  connect: () => void;
  disconnect: () => void;
  joinLobby: (kaspaAddress: string) => void;
  confirmPayment: (userId: string, txId: string) => void;
  cashOut: (entryId: string) => void;
  reset: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const useGameStore = create<GameStore>((set, get) => ({
  socket: null,
  lobbyId: null,
  gameStatus: 'idle',
  currentMultiplier: 1.0,
  crashPoint: null,
  players: [],
  countdown: 0,
  hasJoined: false,
  hasCashedOut: false,
  winAmount: null,

  connect: () => {
    const socket = io(API_URL);

    socket.on('connect', () => {
      console.log('✅ Connected to game server');
    });

    socket.on('lobby_info', (data) => {
      set({ 
        lobbyId: data.lobbyId,
        gameStatus: 'waiting',
      });
    });

    socket.on('countdown', (data) => {
      set({ 
        gameStatus: 'countdown',
        countdown: data.remaining 
      });
    });

    socket.on('game_started', (data) => {
      set({ 
        gameStatus: 'playing',
        currentMultiplier: 1.0,
      });
    });

    socket.on('multiplier_update', (data) => {
      set({ currentMultiplier: parseFloat(data.multiplier) });
    });

    socket.on('game_crashed', (data) => {
      set({ 
        gameStatus: 'crashed',
        crashPoint: data.crashPoint,
      });

      // Reset after 5 seconds
      setTimeout(() => {
        get().reset();
      }, 5000);
    });

    socket.on('cash_out_success', (data) => {
      set({ 
        hasCashedOut: true,
        winAmount: data.winAmount,
      });
    });

    socket.on('player_joined', (data) => {
      console.log('Player joined lobby:', data);
    });

    socket.on('payment_failed', (data) => {
      console.error('Payment failed:', data.message);
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },

  joinLobby: (kaspaAddress: string) => {
    const { socket } = get();
    if (!socket) return;

    socket.emit('join_lobby', { kaspaAddress });
    set({ hasJoined: true });
  },

  confirmPayment: (userId: string, txId: string) => {
    const { socket, lobbyId } = get();
    if (!socket || !lobbyId) return;

    socket.emit('confirm_payment', { lobbyId, userId, txId });
  },

  cashOut: (entryId: string) => {
    const { socket, lobbyId } = get();
    if (!socket || !lobbyId) return;

    socket.emit('cash_out', { entryId, lobbyId });
  },

  reset: () => {
    set({
      gameStatus: 'idle',
      currentMultiplier: 1.0,
      crashPoint: null,
      countdown: 0,
      hasCashedOut: false,
      winAmount: null,
    });
  },
}));
