'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useWalletStore } from '@/lib/store/wallet-store';
import { useGameStore } from '@/lib/store/game-store';
import { Wallet, Rocket, Users, Coins } from 'lucide-react';
import { CrashGame } from '@/components/game/crash-game';

export default function LobbyPage() {
  const router = useRouter();
  const { wallet, connect, isConnecting, error } = useWalletStore();
  const { socket, connect: connectGame, gameStatus } = useGameStore();
  const [showGame, setShowGame] = useState(false);

  useEffect(() => {
    // Connect to game server
    if (!socket) {
      connectGame();
    }
  }, [socket, connectGame]);

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const handlePlayNow = () => {
    if (wallet) {
      setShowGame(true);
    }
  };

  if (showGame && wallet) {
    return <CrashGame />;
  }

  return (
    <main className="min-h-screen gradient-bg p-4">
      {/* Header */}
      <header className="max-w-7xl mx-auto py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Rocket className="w-8 h-8 text-kaspa-blue" />
          <h1 className="text-2xl font-display font-bold">
            Klassik <span className="text-kaspa-blue">Gaming</span>
          </h1>
        </div>

        {/* Wallet Button */}
        {!wallet ? (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="glass-morphism px-6 py-3 rounded-xl font-semibold 
                     hover:bg-kaspa-blue/20 transition flex items-center gap-2
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Wallet className="w-5 h-5" />
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        ) : (
          <div className="glass-morphism px-6 py-3 rounded-xl flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-400">Balance</div>
              <div className="font-bold text-kaspa-blue">
                {wallet.balance.toFixed(4)} KAS
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-kaspa-blue/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-kaspa-blue" />
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto mt-12">
        {error && (
          <div className="mb-6 glass-morphism border-red-500/50 p-4 rounded-xl">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {!wallet ? (
          /* Welcome Screen */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="glass-morphism p-12 rounded-3xl">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-24 h-24 mx-auto mb-6 glass-morphism rounded-full flex items-center justify-center neon-border"
              >
                <Rocket className="w-12 h-12 text-kaspa-blue" />
              </motion.div>

              <h2 className="text-4xl font-display font-bold mb-4">
                Welcome to <span className="text-kaspa-blue">Crash Game</span>
              </h2>

              <p className="text-lg text-gray-400 mb-8">
                Multiplayer crash game powered by Kaspa blockchain.<br />
                Watch the multiplier rise and cash out before it crashes!
              </p>

              {/* How to Play */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="glass-morphism p-6 rounded-xl">
                  <div className="text-3xl mb-3">💰</div>
                  <h3 className="font-semibold mb-2">1. Pay Entry Fee</h3>
                  <p className="text-sm text-gray-400">
                    0.1 KAS to join the lobby
                  </p>
                </div>

                <div className="glass-morphism p-6 rounded-xl">
                  <div className="text-3xl mb-3">🚀</div>
                  <h3 className="font-semibold mb-2">2. Watch Multiplier</h3>
                  <p className="text-sm text-gray-400">
                    It rises exponentially
                  </p>
                </div>

                <div className="glass-morphism p-6 rounded-xl">
                  <div className="text-3xl mb-3">💎</div>
                  <h3 className="font-semibold mb-2">3. Cash Out!</h3>
                  <p className="text-sm text-gray-400">
                    Before it crashes to win
                  </p>
                </div>
              </div>

              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="bg-kaspa-blue text-kaspa-dark px-8 py-4 rounded-xl 
                         font-bold text-lg glow-on-hover disabled:opacity-50
                         disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet to Play'}
              </button>

              <p className="text-sm text-gray-500 mt-4">
                Need a wallet? Install{' '}
                <a
                  href="https://kasware.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-kaspa-blue hover:underline"
                >
                  KasWare
                </a>
              </p>
            </div>
          </motion.div>
        ) : (
          /* Lobby Info */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Lobby Card */}
            <div className="lg:col-span-2 glass-morphism p-8 rounded-3xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-display font-bold mb-2">
                    Crash Game Lobby
                  </h2>
                  <p className="text-gray-400">
                    {gameStatus === 'idle'
                      ? 'Ready to play'
                      : gameStatus === 'waiting'
                      ? 'Waiting for players...'
                      : gameStatus === 'countdown'
                      ? 'Game starting soon!'
                      : 'Game in progress'}
                  </p>
                </div>
                <div className="w-16 h-16 rounded-full bg-kaspa-blue/20 flex items-center justify-center">
                  <Rocket className="w-8 h-8 text-kaspa-blue" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="glass-morphism p-4 rounded-xl">
                  <div className="text-gray-400 text-sm mb-1">Entry Fee</div>
                  <div className="text-2xl font-bold">0.1 KAS</div>
                </div>
                <div className="glass-morphism p-4 rounded-xl">
                  <div className="text-gray-400 text-sm mb-1">Max Players</div>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    10
                  </div>
                </div>
                <div className="glass-morphism p-4 rounded-xl">
                  <div className="text-gray-400 text-sm mb-1">House Edge</div>
                  <div className="text-2xl font-bold">2%</div>
                </div>
              </div>

              <button
                onClick={handlePlayNow}
                className="w-full bg-kaspa-blue text-kaspa-dark py-4 rounded-xl 
                         font-bold text-lg glow-on-hover flex items-center 
                         justify-center gap-2"
              >
                <Rocket className="w-6 h-6" />
                Play Now
              </button>
            </div>

            {/* Stats Sidebar */}
            <div className="space-y-6">
              <div className="glass-morphism p-6 rounded-xl">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-kaspa-blue" />
                  Your Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Games Played</span>
                    <span className="font-semibold">0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Wagered</span>
                    <span className="font-semibold">0 KAS</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Won</span>
                    <span className="font-semibold text-neon-green">0 KAS</span>
                  </div>
                </div>
              </div>

              <div className="glass-morphism p-6 rounded-xl">
                <h3 className="font-semibold mb-4">Recent Games</h3>
                <div className="text-center text-gray-500 py-8">
                  No games yet
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
