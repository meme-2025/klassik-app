'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Minus, Plus, Coins, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useGameStore } from '@/lib/store/game-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const QUICK_BETS = [10, 25, 50, 100, 250, 500]

export function BetControls() {
  const { 
    gameState, 
    betAmount, 
    autoCashout,
    isPlaying,
    balance,
    setBetAmount,
    setAutoCashout,
    placeBet,
    cashOut 
  } = useGameStore()

  const [localBetAmount, setLocalBetAmount] = useState(betAmount.toString())
  const [localAutoCashout, setLocalAutoCashout] = useState(autoCashout?.toString() || '')

  const canPlaceBet = gameState === 'waiting' && !isPlaying && balance >= betAmount
  const canCashOut = gameState === 'running' && isPlaying

  const handleBetChange = (value: string) => {
    const numValue = parseFloat(value) || 0
    setLocalBetAmount(value)
    setBetAmount(numValue)
  }

  const handleAutoCashoutChange = (value: string) => {
    const numValue = parseFloat(value) || 0
    setLocalAutoCashout(value)
    setAutoCashout(numValue > 1 ? numValue : null)
  }

  const adjustBet = (multiplier: number) => {
    const newAmount = Math.max(1, betAmount * multiplier)
    setLocalBetAmount(newAmount.toString())
    setBetAmount(newAmount)
  }

  const handlePlaceBet = () => {
    if (betAmount < 1) {
      toast.error('Minimum bet is 1 KAS')
      return
    }
    if (betAmount > balance) {
      toast.error('Insufficient balance')
      return
    }
    placeBet()
    toast.success(`Bet placed: ${betAmount} KAS`)
  }

  const handleCashOut = () => {
    const multiplier = useGameStore.getState().currentMultiplier
    const winAmount = betAmount * multiplier
    cashOut()
    toast.success(`Cashed out at ${multiplier.toFixed(2)}x! Won ${winAmount.toFixed(2)} KAS`, {
      icon: '🎉',
    })
  }

  return (
    <div className="space-y-4">
      {/* Balance Display */}
      <div className="flex items-center justify-between p-4 glass-morphism rounded-xl">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-yellow-400" />
          <span className="text-sm text-muted-foreground">Balance</span>
        </div>
        <span className="text-xl font-bold font-mono text-kaspa-blue">
          {balance.toFixed(2)} KAS
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bet Amount */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Bet Amount (KAS)
          </label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => adjustBet(0.5)}
              disabled={gameState === 'running'}
              className="shrink-0"
            >
              <Minus className="w-4 h-4" />
            </Button>
            <Input
              type="number"
              value={localBetAmount}
              onChange={(e) => handleBetChange(e.target.value)}
              disabled={gameState === 'running'}
              className="text-center font-mono text-lg"
              min="1"
              step="0.1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => adjustBet(2)}
              disabled={gameState === 'running'}
              className="shrink-0"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Quick Bet Buttons */}
          <div className="grid grid-cols-6 gap-1">
            {QUICK_BETS.map((amount) => (
              <Button
                key={amount}
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLocalBetAmount(amount.toString())
                  setBetAmount(amount)
                }}
                disabled={gameState === 'running'}
                className="text-xs h-7"
              >
                {amount}
              </Button>
            ))}
          </div>
        </div>

        {/* Auto Cashout */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Auto Cashout (Multiplier)
          </label>
          <div className="flex gap-2">
            <TrendingUp className="w-10 h-10 text-neon-green shrink-0 mt-1" />
            <Input
              type="number"
              value={localAutoCashout}
              onChange={(e) => handleAutoCashoutChange(e.target.value)}
              placeholder="Off"
              className="text-center font-mono text-lg"
              min="1.01"
              step="0.1"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {autoCashout 
              ? `Will auto cash out at ${autoCashout.toFixed(2)}x`
              : 'No auto cashout set'}
          </p>
        </div>
      </div>

      {/* Action Button */}
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {canCashOut ? (
          <Button
            onClick={handleCashOut}
            className={cn(
              "w-full h-16 text-xl font-bold",
              "bg-gradient-win hover:bg-gradient-win/90",
              "neon-border animate-pulse-glow"
            )}
            size="lg"
          >
            💰 CASH OUT NOW! 💰
          </Button>
        ) : (
          <Button
            onClick={handlePlaceBet}
            disabled={!canPlaceBet}
            className={cn(
              "w-full h-16 text-xl font-bold",
              canPlaceBet 
                ? "bg-gradient-kaspa hover:opacity-90 neon-border" 
                : "bg-muted"
            )}
            size="lg"
          >
            {isPlaying ? (
              '✓ BET PLACED'
            ) : gameState === 'running' ? (
              '🚀 IN PROGRESS...'
            ) : (
              '🎮 PLACE BET'
            )}
          </Button>
        )}
      </motion.div>

      {/* Potential Win Display */}
      {isPlaying && gameState === 'running' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 glass-morphism rounded-xl text-center"
        >
          <p className="text-sm text-muted-foreground mb-1">Potential Win</p>
          <p className="text-3xl font-bold font-mono text-gradient animate-pulse">
            {(betAmount * useGameStore.getState().currentMultiplier).toFixed(2)} KAS
          </p>
        </motion.div>
      )}
    </div>
  )
}
