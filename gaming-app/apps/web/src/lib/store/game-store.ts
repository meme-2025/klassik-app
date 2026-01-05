import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type GameState = 'idle' | 'waiting' | 'running' | 'crashed'

interface Player {
  id: string
  username: string
  betAmount: number
  cashedOut: boolean
  cashoutMultiplier?: number
  winAmount?: number
}

interface GameHistory {
  gameId: string
  crashPoint: number
  timestamp: number
}

interface GameStore {
  // Game State
  gameState: GameState
  gameId: string | null
  currentMultiplier: number
  crashPoint: number | null
  startTime: number | null
  
  // Player State
  balance: number
  betAmount: number
  autoCashout: number | null
  isPlaying: boolean
  currentBetId: string | null
  
  // Game Data
  players: Player[]
  graphHistory: GameHistory[]
  
  // Actions
  setGameState: (state: GameState) => void
  setCurrentMultiplier: (multiplier: number) => void
  setCrashPoint: (point: number) => void
  setBetAmount: (amount: number) => void
  setAutoCashout: (multiplier: number | null) => void
  setBalance: (balance: number) => void
  placeBet: () => void
  cashOut: () => void
  addPlayer: (player: Player) => void
  updatePlayer: (playerId: string, updates: Partial<Player>) => void
  removePlayer: (playerId: string) => void
  addToHistory: (game: GameHistory) => void
  resetGame: () => void
}

export const useGameStore = create<GameStore>()(
  devtools(
    (set, get) => ({
      // Initial State
      gameState: 'idle',
      gameId: null,
      currentMultiplier: 1.0,
      crashPoint: null,
      startTime: null,
      balance: 1000, // Demo balance
      betAmount: 10,
      autoCashout: null,
      isPlaying: false,
      currentBetId: null,
      players: [],
      graphHistory: [],

      // Actions
      setGameState: (state) => set({ gameState: state }),
      
      setCurrentMultiplier: (multiplier) => {
        const { autoCashout, isPlaying } = get()
        set({ currentMultiplier: multiplier })
        
        // Auto cashout logic
        if (autoCashout && isPlaying && multiplier >= autoCashout) {
          get().cashOut()
        }
      },
      
      setCrashPoint: (point) => set({ crashPoint: point }),
      
      setBetAmount: (amount) => set({ betAmount: Math.max(1, amount) }),
      
      setAutoCashout: (multiplier) => set({ autoCashout: multiplier }),
      
      setBalance: (balance) => set({ balance }),
      
      placeBet: () => {
        const { betAmount, balance, gameState } = get()
        if (gameState !== 'waiting') return
        if (betAmount > balance) return
        
        set({
          isPlaying: true,
          balance: balance - betAmount,
          currentBetId: `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        })
      },
      
      cashOut: () => {
        const { betAmount, currentMultiplier, balance, isPlaying } = get()
        if (!isPlaying) return
        
        const winAmount = betAmount * currentMultiplier
        
        set({
          isPlaying: false,
          balance: balance + winAmount,
          currentBetId: null,
        })
      },
      
      addPlayer: (player) => {
        set((state) => ({
          players: [...state.players, player],
        }))
      },
      
      updatePlayer: (playerId, updates) => {
        set((state) => ({
          players: state.players.map((p) =>
            p.id === playerId ? { ...p, ...updates } : p
          ),
        }))
      },
      
      removePlayer: (playerId) => {
        set((state) => ({
          players: state.players.filter((p) => p.id !== playerId),
        }))
      },
      
      addToHistory: (game) => {
        set((state) => ({
          graphHistory: [...state.graphHistory.slice(-9), game],
        }))
      },
      
      resetGame: () => {
        set({
          gameState: 'idle',
          currentMultiplier: 1.0,
          crashPoint: null,
          startTime: null,
          isPlaying: false,
          currentBetId: null,
          players: [],
        })
      },
    }),
    { name: 'GameStore' }
  )
)
