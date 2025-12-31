import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  username: string;
  balance: number;
  level: number;
  xp: number;
  avatar: string;
  achievements: string[];
  joinDate: Date;
}

export interface GameSession {
  id: string;
  gameType: string;
  players: User[];
  betAmount: number;
  isActive: boolean;
  maxPlayers: number;
  startTime: Date;
  endTime?: Date;
}

interface GameStore {
  user: User | null;
  currentSession: GameSession | null;
  activeGames: GameSession[];
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  
  // Actions
  setUser: (user: User) => void;
  updateBalance: (amount: number) => void;
  joinSession: (session: GameSession) => void;
  leaveSession: () => void;
  updateSession: (session: GameSession) => void;
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'connecting') => void;
  addActiveGame: (game: GameSession) => void;
  removeActiveGame: (gameId: string) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      user: null,
      currentSession: null,
      activeGames: [],
      connectionStatus: 'disconnected',
      
      setUser: (user) => set({ user }),
      
      updateBalance: (amount) => set((state) => ({
        user: state.user ? {
          ...state.user,
          balance: Math.max(0, state.user.balance + amount)
        } : null
      })),
      
      joinSession: (session) => set({ currentSession: session }),
      
      leaveSession: () => set({ currentSession: null }),
      
      updateSession: (session) => set({ currentSession: session }),
      
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      
      addActiveGame: (game) => set((state) => ({
        activeGames: [...state.activeGames.filter(g => g.id !== game.id), game]
      })),
      
      removeActiveGame: (gameId) => set((state) => ({
        activeGames: state.activeGames.filter(g => g.id !== gameId)
      }))
    }),
    {
      name: 'klassik-game-store',
      partialize: (state) => ({ 
        user: state.user,
        // Don't persist session data
      })
    }
  )
);