'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useWalletStore } from '@/lib/store/wallet-store';
import { useGameStore } from '@/lib/store/game-store';
import { kaspaWallet } from '@/lib/kaspa/wallet';
import { ArrowLeft, Rocket, TrendingUp, Trophy, Zap } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const CASINO_ADDRESS = process.env.NEXT_PUBLIC_CASINO_ADDRESS || 'kaspa:qz...';

export function CrashGame() {
  const router = useRouter();
  const { wallet, refreshBalance } = useWalletStore();
  const {
    lobbyId,
    gameStatus,
    currentMultiplier,
    crashPoint,
    countdown,
    hasCashedOut,
    winAmount,
    joinLobby,
    confirmPayment,
    cashOut: gameCashOut,
  } = useGameStore();

  const [isJoining, setIsJoining] = useState(false);
  const [hasJoinedLobby, setHasJoinedLobby] = useState(false);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [showWinAnimation, setShowWinAnimation] = useState(false);
  const [showCrashAnimation, setShowCrashAnimation] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Join lobby on mount
  useEffect(() => {
    if (wallet && !hasJoinedLobby) {
      joinLobby(wallet.address);
    }
  }, [wallet, hasJoinedLobby, joinLobby]);

  // Handle game crash
  useEffect(() => {
    if (gameStatus === 'crashed') {
      setShowCrashAnimation(true);
      setTimeout(() => {
        setShowCrashAnimation(false);
      }, 3000);
    }
  }, [gameStatus]);

  // Handle win
  useEffect(() => {
    if (hasCashedOut && winAmount) {
      setShowWinAnimation(true);
      refreshBalance();
      setTimeout(() => {
        setShowWinAnimation(false);
      }, 3000);
    }
  }, [hasCashedOut, winAmount, refreshBalance]);

  // Draw crash curve
  useEffect(() => {
    if (!canvasRef.current || gameStatus !== 'playing') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Determine color based on multiplier
      let gradient;
      if (currentMultiplier < 1.5) {
        gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#1E3A8A');
        gradient.addColorStop(1, '#06B6D4');
      } else if (currentMultiplier < 3.0) {
        gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#FCD34D');
        gradient.addColorStop(1, '#F97316');
      } else {
        gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#DC2626');
        gradient.addColorStop(1, '#7F1D1D');
      }

      // Draw curve
      ctx.beginPath();
      ctx.moveTo(0, height);

      const maxMult = Math.max(currentMultiplier, 2);
      for (let x = 0; x < width; x++) {
        const progress = x / width;
        const mult = 1 + (progress * (currentMultiplier - 1));
        const y = height - ((mult - 1) / (maxMult - 1)) * height;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      if (currentMultiplier > 3.0) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#EF4444';
        ctx.strokeStyle = '#FEF2F2';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameStatus, currentMultiplier]);

  const handleJoinGame = async () => {
    if (!wallet || !lobbyId) return;

    setIsJoining(true);
    try {
      // Send 0.1 KAS to casino address
      const txId = await kaspaWallet.sendTransaction(CASINO_ADDRESS, 0.1);
      console.log('Payment sent:', txId);

      // Get or create user
      const userResponse = await axios.get(
        `${API_URL}/api/users/${wallet.address}`,
      );
      const userId = userResponse.data?.id;

      if (!userId) {
        throw new Error('Failed to get user ID');
      }

      // Wait a bit for transaction to be detected
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Confirm payment to backend
      confirmPayment(userId, txId);

      // Join lobby entry
      const entryResponse = await axios.post(
        `${API_URL}/api/lobby/${lobbyId}/join`,
        {
          userId,
          socketId: 'socket-id', // TODO: Get from socket
          txId,
        },
      );

      setEntryId(entryResponse.data.id);
      setHasJoinedLobby(true);
      refreshBalance();
    } catch (error: any) {
      console.error('Failed to join game:', error);
      alert(error.message || 'Failed to join game');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCashOut = () => {
    if (!entryId) return;
    gameCashOut(entryId);
  };

  const getMultiplierColor = () => {
    if (currentMultiplier < 1.5) return 'text-cyan-400';
    if (currentMultiplier < 3.0) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen gradient-bg p-4">
      {/* Header */}
      <header className="max-w-7xl mx-auto py-4 flex items-center justify-between">
        <button
          onClick={() => router.push('/lobby')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Lobby
        </button>

        <div className="glass-morphism px-6 py-2 rounded-xl">
          <div className="text-sm text-gray-400">Balance</div>
          <div className="font-bold text-kaspa-blue">
            {wallet?.balance.toFixed(4)} KAS
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <div className="max-w-7xl mx-auto mt-8">
        <div className="glass-morphism rounded-3xl overflow-hidden">
          {/* Crash Visualization */}
          <div className="relative h-96 bg-kaspa-dark/50">
            <canvas
              ref={canvasRef}
              width={1200}
              height={400}
              className="w-full h-full"
            />

            {/* Multiplier Display */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <AnimatePresence>
                {gameStatus === 'playing' && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="text-center"
                  >
                    <div
                      className={`text-9xl font-display font-bold ${getMultiplierColor()}`}
                    >
                      {currentMultiplier.toFixed(2)}x
                    </div>
                  </motion.div>
                )}

                {gameStatus === 'waiting' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center"
                  >
                    <Rocket className="w-24 h-24 text-gray-600 mx-auto mb-4" />
                    <div className="text-2xl text-gray-400">
                      Waiting for players...
                    </div>
                  </motion.div>
                )}

                {gameStatus === 'countdown' && (
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="text-center"
                  >
                    <div className="text-9xl font-display font-bold text-kaspa-blue">
                      {countdown}
                    </div>
                    <div className="text-2xl text-gray-400">
                      Game starting...
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Win Animation */}
              <AnimatePresence>
                {showWinAnimation && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="text-center">
                      <Trophy className="w-32 h-32 text-yellow-400 mx-auto mb-4 animate-pulse-glow" />
                      <div className="text-4xl font-bold text-neon-green mb-2">
                        YOU WON!
                      </div>
                      <div className="text-6xl font-display font-bold text-yellow-400">
                        +{winAmount?.toFixed(4)} KAS
                      </div>
                    </div>
                  </motion.div>
                )}

                {showCrashAnimation && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="text-9xl crash-glow">💥</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Controls */}
          <div className="p-8 bg-kaspa-dark-lighter">
            {!hasJoinedLobby ? (
              <button
                onClick={handleJoinGame}
                disabled={isJoining || !wallet}
                className="w-full bg-kaspa-blue text-kaspa-dark py-4 rounded-xl 
                         font-bold text-lg glow-on-hover disabled:opacity-50 
                         disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isJoining ? (
                  'Processing Payment...'
                ) : (
                  <>
                    <Zap className="w-6 h-6" />
                    Join Game (0.1 KAS)
                  </>
                )}
              </button>
            ) : gameStatus === 'playing' && !hasCashedOut ? (
              <button
                onClick={handleCashOut}
                className="w-full bg-neon-green text-kaspa-dark py-4 rounded-xl 
                         font-bold text-lg glow-on-hover flex items-center 
                         justify-center gap-2 hover:bg-neon-green/90"
              >
                <TrendingUp className="w-6 h-6" />
                Cash Out @ {currentMultiplier.toFixed(2)}x
              </button>
            ) : (
              <div className="text-center text-gray-400 py-4">
                {hasCashedOut
                  ? 'Cashed out! Waiting for next round...'
                  : 'Waiting for game to start...'}
              </div>
            )}

            {gameStatus === 'crashed' && crashPoint && (
              <div className="mt-4 glass-morphism p-4 rounded-xl text-center">
                <div className="text-gray-400 mb-1">Crashed at</div>
                <div className="text-3xl font-bold text-red-400">
                  {crashPoint.toFixed(2)}x
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
