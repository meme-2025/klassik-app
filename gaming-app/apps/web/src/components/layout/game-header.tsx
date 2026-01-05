'use client'

import { motion } from 'framer-motion'
import { Wallet, Menu, Settings, Volume2, VolumeX, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGameStore } from '@/lib/store/game-store'
import { useSound } from '@/hooks/use-sound'
import { formatKAS } from '@/lib/utils'
import { useState } from 'react'

export function GameHeader() {
  const { balance } = useGameStore()
  const { toggleMute, isMuted } = useSound()
  const [soundMuted, setSoundMuted] = useState(false)

  const handleToggleSound = () => {
    toggleMute()
    setSoundMuted(!soundMuted)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <motion.div
            className="flex items-center gap-3"
            whileHover={{ scale: 1.05 }}
          >
            <div className="relative">
              <Zap className="w-10 h-10 text-kaspa-blue animate-pulse-glow" />
              <div className="absolute inset-0 blur-xl bg-kaspa-blue/50 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-black text-gradient">
                KASPA RUSH
              </h1>
              <p className="text-xs text-muted-foreground">
                Provably Fair Gaming
              </p>
            </div>
          </motion.div>

          {/* Center - Balance */}
          <motion.div
            className="glass-morphism px-6 py-2 rounded-full neon-border"
            whileHover={{ scale: 1.05 }}
          >
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-yellow-400" />
              <div>
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="text-lg font-bold font-mono text-gradient">
                  {formatKAS(balance)}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right - Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleSound}
              className="rounded-full"
            >
              {soundMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
            >
              <Settings className="w-5 h-5" />
            </Button>

            <Button className="bg-gradient-kaspa hover:opacity-90 neon-border">
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
