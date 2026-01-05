'use client'

import { motion } from 'framer-motion'
import { Users, Trophy, TrendingUp } from 'lucide-react'
import { useGameStore } from '@/lib/store/game-store'
import { formatKAS } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function PlayerList() {
  const { players } = useGameStore()

  if (players.length === 0) {
    return (
      <div className="glass-morphism rounded-xl p-6 text-center">
        <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Waiting for players...
        </p>
      </div>
    )
  }

  return (
    <div className="glass-morphism rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-kaspa-blue" />
          <h3 className="font-semibold">Active Players</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          {players.length} playing
        </span>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto hide-scrollbar">
        {players.map((player) => (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg transition-all",
              player.cashedOut 
                ? "bg-green-500/10 border border-green-500/20" 
                : "bg-slate-800/50"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-2 h-2 rounded-full",
                player.cashedOut ? "bg-green-500" : "bg-kaspa-blue animate-pulse"
              )} />
              <div>
                <p className="font-medium text-sm">{player.username}</p>
                <p className="text-xs text-muted-foreground">
                  Bet: {formatKAS(player.betAmount)}
                </p>
              </div>
            </div>

            {player.cashedOut && player.cashoutMultiplier && (
              <div className="text-right">
                <div className="flex items-center gap-1 text-green-500 font-bold">
                  <Trophy className="w-4 h-4" />
                  <span>{player.cashoutMultiplier.toFixed(2)}x</span>
                </div>
                <p className="text-xs text-green-400">
                  +{formatKAS(player.winAmount || 0)}
                </p>
              </div>
            )}

            {!player.cashedOut && (
              <TrendingUp className="w-5 h-5 text-kaspa-blue animate-pulse" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
