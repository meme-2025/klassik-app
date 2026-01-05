'use client'

import { motion } from 'framer-motion'
import { BarChart3, Clock, Flame, Target } from 'lucide-react'
import { useGameStore } from '@/lib/store/game-store'

export function GameStats() {
  const { graphHistory } = useGameStore()

  const averageCrash = graphHistory.length > 0
    ? graphHistory.reduce((sum, g) => sum + g.crashPoint, 0) / graphHistory.length
    : 0

  const highestCrash = graphHistory.length > 0
    ? Math.max(...graphHistory.map(g => g.crashPoint))
    : 0

  const stats = [
    {
      icon: BarChart3,
      label: 'Average Crash',
      value: `${averageCrash.toFixed(2)}x`,
      color: 'text-kaspa-blue',
    },
    {
      icon: Flame,
      label: 'Highest Crash',
      value: `${highestCrash.toFixed(2)}x`,
      color: 'text-orange-500',
    },
    {
      icon: Target,
      label: 'Games Played',
      value: graphHistory.length.toString(),
      color: 'text-purple-500',
    },
    {
      icon: Clock,
      label: 'Win Rate',
      value: '68%',
      color: 'text-green-500',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="glass-morphism rounded-xl p-4 text-center"
        >
          <stat.icon className={`w-8 h-8 mx-auto mb-2 ${stat.color}`} />
          <p className="text-2xl font-bold font-mono mb-1">{stat.value}</p>
          <p className="text-xs text-muted-foreground">{stat.label}</p>
        </motion.div>
      ))}
    </div>
  )
}
