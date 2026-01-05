'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Rocket, TrendingUp, Zap, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CrashGraph } from './crash-graph'
import { BetControls } from './bet-controls'
import { PlayerList } from './player-list'
import { useGameStore } from '@/lib/store/game-store'
import { useSound } from '@/hooks/use-sound'
import { cn } from '@/lib/utils'

export function CrashGame() {
  const { 
    gameState, 
    currentMultiplier, 
    betAmount, 
    isPlaying,
    placeBet,
    cashOut,
    setBetAmount 
  } = useGameStore()

  const { playSound } = useSound()
  const [showWinAnimation, setShowWinAnimation] = useState(false)
  const [showCrashAnimation, setShowCrashAnimation] = useState(false)

  useEffect(() => {
    if (gameState === 'crashed') {
      setShowCrashAnimation(true)
      playSound('crash')
      setTimeout(() => setShowCrashAnimation(false), 2000)
    }
  }, [gameState])

  const handleCashOut = () => {
    setShowWinAnimation(true)
    playSound('win')
    cashOut()
    setTimeout(() => setShowWinAnimation(false), 2000)
  }

  const getGameStateDisplay = () => {
    switch (gameState) {
      case 'waiting':
        return { text: 'Starting Soon...', color: 'text-yellow-400' }
      case 'running':
        return { text: `${currentMultiplier.toFixed(2)}x`, color: 'text-kaspa-blue' }
      case 'crashed':
        return { text: 'CRASHED!', color: 'text-red-500' }
      default:
        return { text: 'Ready', color: 'text-gray-400' }
    }
  }

  const stateDisplay = getGameStateDisplay()

  return (
    <div className="relative">
      {/* Win Animation Overlay */}
      <AnimatePresence>
        {showWinAnimation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="relative">
              <Trophy className="w-32 h-32 text-yellow-400 animate-pulse-glow" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Zap className="w-16 h-16 text-neon-green" />
              </motion.div>
            </div>
          </motion.div>
        )}

        {showCrashAnimation && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="text-9xl font-display font-bold text-red-500 crash-glow">
              💥
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Game Card */}
      <div className="glass-morphism rounded-3xl p-6 space-y-6 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-kaspa animate-pulse" />
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={gameState === 'running' ? { rotate: 360 } : {}}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Rocket className="w-8 h-8 text-kaspa-blue" />
            </motion.div>
            <div>
              <h2 className="text-2xl font-display font-bold text-gradient">
                Kaspa Crash
              </h2>
              <p className="text-sm text-muted-foreground">Provably Fair</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm text-muted-foreground">Current Game</p>
            <p className="text-lg font-mono font-bold text-kaspa-blue">
              #{useGameStore.getState().gameId || '---'}
            </p>
          </div>
        </div>

        {/* Multiplier Display */}
        <motion.div
          className={cn(
            "relative py-12 text-center",
            gameState === 'running' && "animate-pulse-glow"
          )}
          animate={gameState === 'running' ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          <div className={cn(
            "text-8xl md:text-9xl font-display font-black transition-colors duration-300",
            stateDisplay.color
          )}>
            {stateDisplay.text}
          </div>
          
          {gameState === 'running' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-2xl font-bold text-neon-green"
            >
              <TrendingUp className="inline w-8 h-8 mr-2" />
              TO THE MOON! 🚀
            </motion.div>
          )}
        </motion.div>

        {/* Crash Graph */}
        <div className="relative h-64 md:h-80">
          <CrashGraph />
        </div>

        {/* Bet Controls */}
        <BetControls />

        {/* Active Players */}
        <PlayerList />
      </div>
    </div>
  )
}
