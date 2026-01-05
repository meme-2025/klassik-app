'use client'

import { Trophy, Medal, Award } from 'lucide-react'
import { motion } from 'framer-motion'

const mockLeaderboard = [
  { rank: 1, username: 'CryptoKing', winnings: 15420.50, wins: 234 },
  { rank: 2, username: 'MoonShot', winnings: 12350.25, wins: 198 },
  { rank: 3, username: 'DiamondHands', winnings: 9875.75, wins: 156 },
  { rank: 4, username: 'RocketMan', winnings: 7542.00, wins: 142 },
  { rank: 5, username: 'LuckyStrike', winnings: 6234.50, wins: 128 },
]

export function Leaderboard() {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-400" />
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />
      case 3:
        return <Award className="w-6 h-6 text-orange-600" />
      default:
        return <span className="w-6 h-6 flex items-center justify-center font-bold text-sm">{rank}</span>
    }
  }

  return (
    <div className="glass-morphism rounded-xl p-6">
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="w-6 h-6 text-yellow-400" />
        <h3 className="text-xl font-display font-bold">Leaderboard</h3>
      </div>

      <div className="space-y-3">
        {mockLeaderboard.map((player, index) => (
          <motion.div
            key={player.username}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
          >
            <div className="shrink-0">
              {getRankIcon(player.rank)}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{player.username}</p>
              <p className="text-xs text-muted-foreground">
                {player.wins} wins
              </p>
            </div>

            <div className="text-right">
              <p className="font-bold text-kaspa-blue font-mono">
                {player.winnings.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">KAS</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
