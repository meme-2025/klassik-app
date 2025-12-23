import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Coins, Wallet, Trophy, Users, Play, Pause } from 'lucide-react';
import confetti from 'canvas-confetti';
import './App.css';

function App() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [balance, setBalance] = useState(0);
  const [multiplier, setMultiplier] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [players, setPlayers] = useState([
    { id: 1, name: 'Player1', avatar: '🤑', buzzed: false },
    { id: 2, name: 'Player2', avatar: '😎', buzzed: false },
    { id: 3, name: 'Player3', avatar: '🔥', buzzed: false },
    { id: 4, name: 'Player4', avatar: '💎', buzzed: false },
  ]);
  const [tickSpeed, setTickSpeed] = useState(1000);

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setMultiplier(prev => prev + 0.1);
        setTickSpeed(prev => Math.max(100, prev - 10));
        // Simulate crash at random
        if (Math.random() < 0.01) {
          setIsPlaying(false);
          setMultiplier(1.0);
        }
      }, tickSpeed);
      return () => clearInterval(interval);
    }
  }, [isPlaying, tickSpeed]);

  const connectWallet = () => {
    setWalletConnected(true);
    setBalance(1000);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FF4500']
    });
  };

  const startGame = () => {
    setIsPlaying(true);
    setMultiplier(1.0);
    setTickSpeed(1000);
  };

  const buzzOut = (playerId: number) => {
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, buzzed: true } : p));
    // Explosion effect
    confetti({
      particleCount: 50,
      spread: 360,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#FFD700', '#FFA500']
    });
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(multiplier * 100);
    }
  };

  const getMultiplierColor = (mult: number) => {
    if (mult < 2) return 'text-blue-400';
    if (mult < 5) return 'text-yellow-400';
    return 'text-red-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-orange-900 to-black text-white overflow-hidden">
      {/* Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="flex justify-between items-center p-6 bg-black/70 backdrop-blur-md border-b border-orange-500/20"
      >
        <motion.h1
          className="text-4xl font-bold bg-gradient-to-r from-orange-400 via-yellow-400 to-red-400 bg-clip-text text-transparent drop-shadow-lg"
          whileHover={{ scale: 1.05 }}
        >
          Kaspump Casino
        </motion.h1>
        <div className="flex items-center gap-4">
          {walletConnected ? (
            <div className="flex items-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 px-4 py-2 rounded-full shadow-lg shadow-orange-500/50">
              <Wallet className="w-5 h-5" />
              <span className="font-semibold">{balance} KAS</span>
            </div>
          ) : (
            <motion.button
              onClick={connectWallet}
              className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-2 rounded-full font-semibold hover:shadow-lg hover:shadow-orange-500/50"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Connect Kaspa Wallet
            </motion.button>
          )}
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Crash Game */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-black/50 backdrop-blur-md rounded-2xl p-8 border border-orange-500/20 shadow-2xl"
            >
              <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
                Crash Game
              </h2>
              
              {/* Heatmap Curve */}
              <div className="relative h-64 mb-6 bg-gray-800/50 rounded-lg overflow-hidden">
                <motion.div
                  className="absolute bottom-0 left-0 w-full h-full"
                  animate={{ background: `linear-gradient(to top, ${multiplier < 2 ? '#3B82F6' : multiplier < 5 ? '#FACC15' : '#EF4444'} 0%, transparent 100%)` }}
                >
                  <motion.div
                    className="absolute bottom-0 left-0 h-2 bg-gradient-to-r from-blue-400 via-yellow-400 to-red-500 rounded-full"
                    animate={{ width: `${Math.min(100, multiplier * 10)}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </motion.div>
                <div className="absolute top-4 left-4">
                  <motion.span
                    className={`text-4xl font-bold ${getMultiplierColor(multiplier)} drop-shadow-lg`}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    {multiplier.toFixed(2)}x
                  </motion.span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex gap-4">
                <motion.button
                  onClick={startGame}
                  disabled={isPlaying}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-3 rounded-full font-semibold disabled:opacity-50 shadow-lg shadow-green-500/50"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Play className="w-5 h-5 inline mr-2" />
                  Start Game
                </motion.button>
                <motion.button
                  onClick={() => setIsPlaying(false)}
                  disabled={!isPlaying}
                  className="bg-gradient-to-r from-red-500 to-pink-600 px-8 py-3 rounded-full font-semibold disabled:opacity-50 shadow-lg shadow-red-500/50"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Pause className="w-5 h-5 inline mr-2" />
                  Cash Out
                </motion.button>
              </div>
            </motion.div>
          </div>

          {/* Player Lobby */}
          <div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-black/50 backdrop-blur-md rounded-2xl p-6 border border-orange-500/20 shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Users className="w-6 h-6" />
                Live Players
              </h3>
              
              {/* Circular Avatar Layout */}
              <div className="relative w-48 h-48 mx-auto mb-6">
                {players.map((player, index) => {
                  const angle = (index / players.length) * 2 * Math.PI;
                  const radius = 80;
                  const x = Math.cos(angle) * radius;
                  const y = Math.sin(angle) * radius;
                  
                  return (
                    <AnimatePresence key={player.id}>
                      {!player.buzzed && (
                        <motion.div
                          className="absolute w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-2xl cursor-pointer shadow-lg shadow-orange-500/50"
                          style={{ left: `calc(50% + ${x}px - 24px)`, top: `calc(50% + ${y}px - 24px)` }}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.8 }}
                          onClick={() => buzzOut(player.id)}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                        >
                          {player.avatar}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  );
                })}
              </div>

              <p className="text-center text-gray-300">Click to buzz out!</p>
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center mt-12 text-gray-400"
        >
          <p>Powered by Kaspa BlockDAG | Provably Fair, Lightning Fast!</p>
        </motion.footer>
      </main>
    </div>
  );
}

export default App;
