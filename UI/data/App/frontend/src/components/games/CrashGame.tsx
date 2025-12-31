import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, DollarSign } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { gameSocket } from '../../services/socket';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import './CrashGame.css';

interface CrashResult {
  multiplier: number;
  cashedOut: boolean;
  cashedAtMultiplier?: number;
  betAmount: number;
  winAmount: number;
}

const CrashGame: React.FC = () => {
  const { sessionId } = useParams();
  const { user, updateBalance } = useGameStore();
  const [betAmount, setBetAmount] = useState(1);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [gameState, setGameState] = useState<'betting' | 'running' | 'crashed'>('betting');
  const [hasBet, setHasBet] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [gameHistory, setGameHistory] = useState<number[]>([]);
  const [players, setPlayers] = useState<Array<{name: string, bet: number, cashedAt?: number}>>([]);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    // Simulate game cycle
    if (gameState === 'betting' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (gameState === 'betting' && countdown === 0) {
      startGame();
    }
  }, [countdown, gameState]);

  useEffect(() => {
    // Start betting phase
    if (gameState === 'crashed') {
      setTimeout(() => {
        setGameState('betting');
        setCountdown(10);
        setHasBet(false);
        setCashedOut(false);
        setCurrentMultiplier(1.0);
        
        // Add some mock players
        setPlayers([
          { name: 'Player1', bet: Math.random() * 10 + 1 },
          { name: 'Player2', bet: Math.random() * 5 + 0.5 },
          { name: 'Player3', bet: Math.random() * 20 + 2 }
        ]);
      }, 3000);
    }
  }, [gameState]);

  const startGame = () => {
    if (hasBet) {
      updateBalance(-betAmount);
    }
    
    setGameState('running');
    setCountdown(0);
    
    // Simulate crash game
    const targetMultiplier = Math.random() * 10 + 1; // Random crash between 1x and 11x
    let current = 1.0;
    
    const interval = setInterval(() => {
      current += 0.01 + (current * 0.001); // Accelerating multiplier
      setCurrentMultiplier(current);
      
      // Simulate other players cashing out
      setPlayers(prev => prev.map(player => {
        if (!player.cashedAt && Math.random() < 0.01 * current) {
          return { ...player, cashedAt: current };
        }
        return player;
      }));
      
      if (current >= targetMultiplier) {
        clearInterval(interval);
        crashGame(targetMultiplier);
      }
    }, 100);
  };

  const crashGame = (crashPoint: number) => {
    setGameState('crashed');
    setGameHistory(prev => [crashPoint, ...prev.slice(0, 19)]);
    
    if (hasBet && !cashedOut) {
      toast.error(`Crashed at ${crashPoint.toFixed(2)}x - You lost ${betAmount.toFixed(3)} KAS`);
    }
  };

  const placeBet = () => {
    if (!user || betAmount > user.balance || betAmount <= 0) {
      toast.error('Invalid bet amount');
      return;
    }
    
    if (gameState !== 'betting') {
      toast.error('Betting is closed');
      return;
    }
    
    setHasBet(true);
    toast.success(`Bet placed: ${betAmount.toFixed(3)} KAS`);
  };

  const cashOut = () => {
    if (!hasBet || cashedOut || gameState !== 'running') {
      return;
    }
    
    const winAmount = betAmount * currentMultiplier;
    setCashedOut(true);
    updateBalance(winAmount);
    
    toast.success(`Cashed out at ${currentMultiplier.toFixed(2)}x! Won ${winAmount.toFixed(3)} KAS`);
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00ff88', '#0088ff', '#ff0080']
    });
  };

  const maxBet = () => {
    setBetAmount(user?.balance || 0);
  };

  const halfBet = () => {
    setBetAmount(prev => prev / 2);
  };

  const doubleBet = () => {
    setBetAmount(prev => Math.min(prev * 2, user?.balance || 0));
  };

  return (
    <div className="crash-game">
      <div className="game-header">
        <Link to="/dashboard" className="back-btn">
          <ArrowLeft size={20} />
          Back to Dashboard
        </Link>
        <h1>🚀 Crash Game</h1>
        <div className="balance-display">
          {user?.balance.toFixed(3)} KAS
        </div>
      </div>

      <div className="game-content">
        {/* Main Game Display */}
        <motion.div 
          className="game-display"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {gameState === 'betting' && (
            <div className="betting-phase">
              <div className="countdown-display">
                <h2>Next Game In</h2>
                <div className="countdown-number">{countdown}</div>
                <p>Place your bets!</p>
              </div>
            </div>
          )}

          {gameState === 'running' && (
            <div className="running-phase">
              <motion.div
                className="multiplier-display"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                <div className="multiplier-number">
                  {currentMultiplier.toFixed(2)}x
                </div>
                <div className="rocket">🚀</div>
              </motion.div>
              
              {hasBet && !cashedOut && (
                <button 
                  className="cash-out-btn"
                  onClick={cashOut}
                >
                  Cash Out {(betAmount * currentMultiplier).toFixed(3)} KAS
                </button>
              )}
              
              {cashedOut && (
                <div className="cashed-out-message">
                  ✅ Cashed out at {currentMultiplier.toFixed(2)}x
                </div>
              )}
            </div>
          )}

          {gameState === 'crashed' && (
            <div className="crashed-phase">
              <div className="crash-display">
                <h2>💥 CRASHED!</h2>
                <div className="crash-multiplier">
                  at {gameHistory[0]?.toFixed(2)}x
                </div>
              </div>
            </div>
          )}

          {/* Game Chart */}
          <div className="game-chart">
            <div className="chart-line" />
            <div 
              className="multiplier-line"
              style={{
                height: `${Math.min((currentMultiplier - 1) * 20, 80)}%`,
                background: gameState === 'crashed' ? '#ff4757' : '#00ff88'
              }}
            />
          </div>
        </motion.div>

        {/* Sidebar */}
        <div className="game-sidebar">
          {/* Bet Controls */}
          <motion.div 
            className="bet-controls"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h3>Place Bet</h3>
            
            <div className="bet-input-group">
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                disabled={gameState !== 'betting' || hasBet}
                step="0.001"
                min="0"
                max={user?.balance || 0}
              />
              <span className="currency">KAS</span>
            </div>
            
            <div className="bet-buttons">
              <button onClick={halfBet} disabled={gameState !== 'betting' || hasBet}>1/2</button>
              <button onClick={doubleBet} disabled={gameState !== 'betting' || hasBet}>2x</button>
              <button onClick={maxBet} disabled={gameState !== 'betting' || hasBet}>Max</button>
            </div>

            <button 
              className={`place-bet-btn ${hasBet ? 'bet-placed' : ''}`}
              onClick={placeBet}
              disabled={gameState !== 'betting' || hasBet || betAmount <= 0 || betAmount > (user?.balance || 0)}
            >
              {hasBet ? (
                <>✅ Bet Placed</>
              ) : (
                <>Place Bet {betAmount.toFixed(3)} KAS</>
              )}
            </button>

            {hasBet && gameState === 'betting' && (
              <div className="bet-info">
                <p>Potential win at 2x: <span className="win-amount">{(betAmount * 2).toFixed(3)} KAS</span></p>
              </div>
            )}
          </motion.div>

          {/* Players List */}
          <motion.div 
            className="players-list"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <h3>Players ({players.length + (hasBet ? 1 : 0)})</h3>
            <div className="players-container">
              {hasBet && (
                <div className={`player-item ${cashedOut ? 'cashed-out' : ''}`}>
                  <span className="player-name">You</span>
                  <span className="player-bet">{betAmount.toFixed(2)}</span>
                  {cashedOut && (
                    <span className="cash-out-mult">{currentMultiplier.toFixed(2)}x</span>
                  )}
                </div>
              )}
              
              {players.map((player, index) => (
                <div 
                  key={index}
                  className={`player-item ${player.cashedAt ? 'cashed-out' : ''}`}
                >
                  <span className="player-name">{player.name}</span>
                  <span className="player-bet">{player.bet.toFixed(2)}</span>
                  {player.cashedAt && (
                    <span className="cash-out-mult">{player.cashedAt.toFixed(2)}x</span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Game History */}
          <motion.div 
            className="game-history"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <h3>Recent Crashes</h3>
            <div className="history-list">
              {gameHistory.map((crash, index) => (
                <div 
                  key={index}
                  className={`history-item ${crash < 2 ? 'low' : crash < 5 ? 'medium' : 'high'}`}
                >
                  {crash.toFixed(2)}x
                </div>
              ))}
              {gameHistory.length === 0 && (
                <p className="no-history">No games yet</p>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default CrashGame;