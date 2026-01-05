import { CrashGame } from '@/components/game/crash-game'
import { GameHeader } from '@/components/layout/game-header'
import { GameStats } from '@/components/game/game-stats'
import { Leaderboard } from '@/components/game/leaderboard'
import { ChatPanel } from '@/components/game/chat-panel'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <GameHeader />
      
      <main className="flex-1 container mx-auto px-4 py-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Main Game Area */}
        <div className="xl:col-span-8 space-y-6">
          <CrashGame />
          <GameStats />
        </div>

        {/* Side Panel */}
        <div className="xl:col-span-4 space-y-6">
          <Leaderboard />
          <ChatPanel />
        </div>
      </main>
    </div>
  )
}
