import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, TrendingUp, TrendingDown, RotateCcw, Dice1 } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { gameSocket } from '../../services/socket';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import './DiceGame.css';

interface DiceResult {
  result: number;
  prediction: 'higher' | 'lower';
  target: number;
  won: boolean;
  winAmount: number;
  multiplier: number;
}

const DiceGame: React.FC = () => {
  const { sessionId } = useParams();
  const { user, updateBalance } = useGameStore();
  const [betAmount, setBetAmount] = useState(1);
  const [prediction, setPrediction] = useState<'higher' | 'lower'>('higher');
  const [target, setTarget] = useState(50);
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<DiceResult | null>(null);
  const [diceAnimation, setDiceAnimation] = useState(false);
  const [gameHistory, setGameHistory] = useState<DiceResult[]>([]);
  const [winChance, setWinChance] = useState(50);
  const [multiplier, setMultiplier] = useState(1.98);

  useEffect(() => {
    // Calculate win chance and multiplier based on target and prediction
    const chance = prediction === 'higher' ? (100 - target) : target;
    const mult = chance > 0 ? (95 / chance) : 1; // 95% RTP with 5% house edge
    
    setWinChance(chance);
    setMultiplier(mult);
  }, [target, prediction]);

  const rollDice = async () => {
    if (!user || betAmount > user.balance) {
      toast.error('Insufficient balance');
      return;
    }

    if (betAmount <= 0) {
      toast.error('Please enter a valid bet amount');
      return;
    }

    setIsRolling(true);
    setDiceAnimation(true);

    // Deduct bet amount immediately
    updateBalance(-betAmount);

    try {
      // Simulate dice roll (in real app, this would come from server)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const result = Math.floor(Math.random() * 100) + 1;
      const won = prediction === 'higher' ? result > target : result < target;
      const winAmount = won ? betAmount * multiplier : 0;

      const diceResult: DiceResult = {
        result,
        prediction,
        target,
        won,
        winAmount,
        multiplier
      };

      setLastResult(diceResult);
      setGameHistory(prev => [diceResult, ...prev.slice(0, 9)]);

      if (won) {
        updateBalance(winAmount);
        toast.success(`You won ${winAmount.toFixed(3)} KAS!`);
        
        // Celebration effect
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00ff88', '#0088ff', '#ff0080']
        });
      } else {
        toast.error(`You lost ${betAmount.toFixed(3)} KAS`);
      }

      // Send to socket if in multiplayer session
      if (sessionId) {
        gameSocket.rollDice(sessionId, prediction, target);
      }

    } catch (error) {
      console.error('Dice roll failed:', error);
      // Refund bet on error
      updateBalance(betAmount);
      toast.error('Dice roll failed. Bet refunded.');
    } finally {
      setIsRolling(false);
      setTimeout(() => setDiceAnimation(false), 500);
    }
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
    <div className="dice-game">
      <div className="game-header">
        <Link to="/dashboard" className="back-btn">
          <ArrowLeft size={20} />
          Back to Dashboard
        </Link>
        <h1>🎲 Dice Roll</h1>
        <div className="balance-display">
          {user?.balance.toFixed(3)} KAS
        </div>
      </div>

      <div className="game-content">
        {/* Left Panel - Game Controls */}
        <motion.div 
          className="game-controls"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="control-section">
            <h3>Bet Amount</h3>
            <div className="bet-input-group">
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                disabled={isRolling}
                step="0.001"
                min="0"
                max={user?.balance || 0}
              />
              <span className="currency">KAS</span>
            </div>
            <div className="bet-buttons">
              <button onClick={halfBet} disabled={isRolling}>1/2</button>
              <button onClick={doubleBet} disabled={isRolling}>2x</button>
              <button onClick={maxBet} disabled={isRolling}>Max</button>
            </div>
          </div>

          <div className="control-section">
            <h3>Prediction</h3>
            <div className="prediction-buttons">
              <button
                className={`prediction-btn ${prediction === 'higher' ? 'active' : ''}`}
                onClick={() => setPrediction('higher')}
                disabled={isRolling}
              >
                <TrendingUp size={20} />
                Roll Over
              </button>
              <button
                className={`prediction-btn ${prediction === 'lower' ? 'active' : ''}`}
                onClick={() => setPrediction('lower')}
                disabled={isRolling}
              >
                <TrendingDown size={20} />
                Roll Under
              </button>
            </div>
          </div>

          <div className="control-section">
            <h3>Target Number</h3>
            <div className="target-input">
              <input
                type="range"
                value={target}
                onChange={(e) => setTarget(parseInt(e.target.value))}
                disabled={isRolling}
                min="2"
                max="98"
                className="target-slider"
              />
              <div className="target-display">
                <span className="target-value">{target}</span>
                <span className="target-label">
                  {prediction === 'higher' ? '> Roll Over' : '< Roll Under'}
                </span>
              </div>
            </div>
          </div>

          <div className="game-info">
            <div className="info-row">
              <span>Win Chance:</span>
              <span className="value">{winChance.toFixed(2)}%</span>
            </div>
            <div className="info-row">
              <span>Multiplier:</span>
              <span className="value">{multiplier.toFixed(2)}x</span>
            </div>
            <div className="info-row">
              <span>Potential Win:</span>
              <span className="value positive">{(betAmount * multiplier).toFixed(3)} KAS</span>
            </div>
          </div>

          <motion.button
            className="roll-btn"
            onClick={rollDice}
            disabled={isRolling || !user || betAmount <= 0 || betAmount > (user?.balance || 0)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isRolling ? (
              <>
                <RotateCcw className="spinning" size={20} />
                Rolling...
              </>
            ) : (
              <>
                <Dice1 size={20} />
                Roll Dice
              </>
            )}
          </motion.button>
        </motion.div>

        {/* Center Panel - Dice Display */}
        <motion.div 
          className="dice-display"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="dice-container">
            <AnimatePresence>
              <motion.div
                key={lastResult?.result || 'initial'}
                className={`dice ${diceAnimation ? 'rolling' : ''}`}
                initial={{ scale: 0, rotate: 0 }}
                animate={{ scale: 1, rotate: diceAnimation ? 720 : 0 }}
                exit={{ scale: 0, rotate: 720 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <span className="dice-number">
                  {lastResult ? lastResult.result : '?'}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          {lastResult && (
            <motion.div
              className={`result-display ${lastResult.won ? 'win' : 'lose'}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h3>{lastResult.won ? '🎉 YOU WON!' : '😔 YOU LOST'}</h3>
              <p>
                Rolled {lastResult.result} - Needed to roll{' '}
                {lastResult.prediction === 'higher' ? 'over' : 'under'} {lastResult.target}
              </p>
              {lastResult.won && (
                <p className="win-amount">
                  Won: {lastResult.winAmount.toFixed(3)} KAS
                </p>
              )}
            </motion.div>
          )}

          <div className="dice-scale">
            <div className="scale-line" />
            <div 
              className="scale-marker target-marker"
              style={{ left: `${target}%` }}
            >
              <div className="marker-line" />
              <span className="marker-label">{target}</span>
            </div>
            {lastResult && (
              <div 
                className={`scale-marker result-marker ${lastResult.won ? 'win' : 'lose'}`}
                style={{ left: `${lastResult.result}%` }}
              >
                <div className="marker-line" />
                <span className="marker-label">{lastResult.result}</span>
              </div>
            )}
            <div className="scale-numbers">
              <span>1</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
          </div>
        </motion.div>

        {/* Right Panel - Game History */}
        <motion.div 
          className="game-history"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h3>Recent Rolls</h3>
          <div className="history-list">
            {gameHistory.length === 0 ? (
              <p className="no-history">No rolls yet. Start playing!</p>
            ) : (
              gameHistory.map((roll, index) => (
                <motion.div
                  key={index}
                  className={`history-item ${roll.won ? 'win' : 'lose'}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <div className="roll-info">
                    <span className="roll-number">{roll.result}</span>
                    <span className="roll-details">
                      {roll.prediction === 'higher' ? '>' : '<'} {roll.target}
                    </span>
                  </div>
                  <div className="roll-result">
                    {roll.won ? (
                      <span className="win-amount">+{roll.winAmount.toFixed(3)}</span>
                    ) : (
                      <span className="lose-amount">-{betAmount.toFixed(3)}</span>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>

          <div className="history-stats">
            <h4>Session Stats</h4>
            <div className="stat-row">
              <span>Total Rolls:</span>
              <span>{gameHistory.length}</span>
            </div>
            <div className="stat-row">
              <span>Wins:</span>
              <span>{gameHistory.filter(r => r.won).length}</span>
            </div>
            <div className="stat-row">
              <span>Win Rate:</span>
              <span>
                {gameHistory.length > 0 
                  ? ((gameHistory.filter(r => r.won).length / gameHistory.length) * 100).toFixed(1) + '%'
                  : '0%'
                }
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DiceGame;