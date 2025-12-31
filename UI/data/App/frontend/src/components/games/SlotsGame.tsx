import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Play, Settings, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useGameStore } from '../../store/gameStore';
import { gameSocket } from '../../services/socket';
import './SlotsGame.css';

interface SlotSymbol {
  id: string;
  emoji: string;
  name: string;
  value: number;
  rarity: number; // Higher = rarer
}

const SLOT_SYMBOLS: SlotSymbol[] = [
  { id: 'cherry', emoji: '🍒', name: 'Cherry', value: 2, rarity: 1 },
  { id: 'lemon', emoji: '🍋', name: 'Lemon', value: 3, rarity: 2 },
  { id: 'orange', emoji: '🍊', name: 'Orange', value: 4, rarity: 3 },
  { id: 'grape', emoji: '🍇', name: 'Grape', value: 5, rarity: 4 },
  { id: 'bell', emoji: '🔔', name: 'Bell', value: 10, rarity: 6 },
  { id: 'diamond', emoji: '💎', name: 'Diamond', value: 20, rarity: 8 },
  { id: 'star', emoji: '⭐', name: 'Star', value: 50, rarity: 10 },
  { id: 'seven', emoji: '7️⃣', name: 'Lucky Seven', value: 100, rarity: 15 },
  { id: 'jackpot', emoji: '🎰', name: 'Jackpot', value: 1000, rarity: 50 }
];

interface SpinResult {
  reels: SlotSymbol[][];
  winLines: number[][];
  totalWin: number;
  multiplier: number;
}

export default function SlotsGame() {
  const { user, updateBalance } = useGameStore();
  const [betAmount, setBetAmount] = useState('1');
  const [isSpinning, setIsSpinning] = useState(false);
  const [reels, setReels] = useState<SlotSymbol[][]>([[], [], [], [], []]);
  const [visibleReels, setVisibleReels] = useState<SlotSymbol[][]>([[], [], [], [], []]);
  const [winLines, setWinLines] = useState<number[][]>([]);
  const [lastWin, setLastWin] = useState<SpinResult | null>(null);
  const [autoSpin, setAutoSpin] = useState(false);
  const [autoSpinCount, setAutoSpinCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [winHistory, setWinHistory] = useState<number[]>([]);
  const [jackpotAmount, setJackpotAmount] = useState(1000);
  const reelRefs = useRef<HTMLDivElement[]>([]);
  const [showWinAnimation, setShowWinAnimation] = useState(false);

  useEffect(() => {
    // Initialize reels with random symbols
    initializeReels();
    
    // Connect to socket
    gameSocket.connect();
    gameSocket.joinGame('slots');

    gameSocket.socket?.on('slots:result', (data: SpinResult) => {
      handleSpinResult(data);
    });

    gameSocket.socket?.on('slots:jackpot', (amount: number) => {
      setJackpotAmount(amount);
    });

    return () => {
      gameSocket.socket?.off('slots:result');
      gameSocket.socket?.off('slots:jackpot');
    };
  }, []);

  const initializeReels = () => {
    const initialReels = Array(5).fill(null).map(() => 
      Array(100).fill(null).map(() => getRandomSymbol())
    );
    setReels(initialReels);
    setVisibleReels(initialReels.map(reel => reel.slice(0, 3)));
  };

  const getRandomSymbol = (): SlotSymbol => {
    const random = Math.random() * 100;
    let cumulativeChance = 0;
    
    for (const symbol of SLOT_SYMBOLS) {
      cumulativeChance += (100 / symbol.rarity);
      if (random < cumulativeChance) {
        return symbol;
      }
    }
    
    return SLOT_SYMBOLS[0]; // Fallback to cherry
  };

  const generateWinningCombination = (betValue: number): SlotSymbol[][] => {
    const newReels = Array(5).fill(null).map(() => Array(3).fill(null));
    
    // Determine if this should be a winning spin
    const winChance = Math.min(20 + (betValue * 2), 40); // Higher bets = better win chance
    const shouldWin = Math.random() * 100 < winChance;
    
    if (shouldWin) {
      // Create a winning combination
      const winSymbol = getRandomSymbol();
      const lineCount = Math.floor(Math.random() * 3) + 1; // 1-3 winning lines
      
      for (let line = 0; line < lineCount; line++) {
        for (let reel = 0; reel < 5; reel++) {
          if (Math.random() < 0.8) { // 80% chance to continue the line
            newReels[reel][line] = winSymbol;
          } else {
            break;
          }
        }
      }
    }
    
    // Fill remaining positions with random symbols
    for (let reel = 0; reel < 5; reel++) {
      for (let row = 0; row < 3; row++) {
        if (!newReels[reel][row]) {
          newReels[reel][row] = getRandomSymbol();
        }
      }
    }
    
    return newReels;
  };

  const calculateWins = (reelResult: SlotSymbol[][]): SpinResult => {
    const winLines: number[][] = [];
    let totalWin = 0;
    let multiplier = 1;
    
    // Check horizontal lines
    for (let row = 0; row < 3; row++) {
      let consecutiveCount = 1;
      let currentSymbol = reelResult[0][row];
      
      for (let reel = 1; reel < 5; reel++) {
        if (reelResult[reel][row]?.id === currentSymbol?.id) {
          consecutiveCount++;
        } else {
          break;
        }
      }
      
      if (consecutiveCount >= 3) {
        const lineWin = currentSymbol.value * consecutiveCount * parseFloat(betAmount);
        totalWin += lineWin;
        winLines.push([row, row, row, row, row].slice(0, consecutiveCount));
        
        if (currentSymbol.id === 'jackpot') {
          multiplier = 10;
          totalWin += jackpotAmount;
        }
      }
    }
    
    // Check diagonal lines
    const diagonal1 = [0, 1, 2, 1, 0];
    const diagonal2 = [2, 1, 0, 1, 2];
    
    [diagonal1, diagonal2].forEach((diagonal, diagIndex) => {
      let consecutiveCount = 1;
      let currentSymbol = reelResult[0][diagonal[0]];
      
      for (let reel = 1; reel < 5; reel++) {
        if (reelResult[reel][diagonal[reel]]?.id === currentSymbol?.id) {
          consecutiveCount++;
        } else {
          break;
        }
      }
      
      if (consecutiveCount >= 3) {
        const lineWin = currentSymbol.value * consecutiveCount * parseFloat(betAmount);
        totalWin += lineWin;
        winLines.push(diagonal.slice(0, consecutiveCount));
      }
    });
    
    return {
      reels: reelResult,
      winLines,
      totalWin: totalWin * multiplier,
      multiplier
    };
  };

  const handleSpin = async () => {
    const betValue = parseFloat(betAmount);
    if (betValue <= 0 || betValue > (user?.balance || 0) || isSpinning) return;

    setIsSpinning(true);
    setWinLines([]);
    setLastWin(null);
    setShowWinAnimation(false);

    // Deduct bet amount
    updateBalance(-betValue);

    // Animate reels
    const spinDuration = 2000 + Math.random() * 1000; // 2-3 seconds
    
    // Generate result
    const resultReels = generateWinningCombination(betValue);
    const spinResult = calculateWins(resultReels);
    
    // Animate spinning
    reelRefs.current.forEach((reel, index) => {
      if (reel) {
        const spins = 5 + Math.random() * 3;
        const delay = index * 200; // Stagger reel stops
        
        setTimeout(() => {
          reel.style.transform = `translateY(-${(spins * 100) % 300}%)`;
          reel.style.transition = `transform ${1000 + index * 200}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
          
          setTimeout(() => {
            setVisibleReels(prev => {
              const newVisible = [...prev];
              newVisible[index] = resultReels[index];
              return newVisible;
            });
          }, 1000 + index * 200);
        }, delay);
      }
    });

    // Handle result after all reels stop
    setTimeout(() => {
      handleSpinResult(spinResult);
    }, spinDuration + 1000);
  };

  const handleSpinResult = (result: SpinResult) => {
    setVisibleReels(result.reels);
    setWinLines(result.winLines);
    setLastWin(result);
    setIsSpinning(false);

    if (result.totalWin > 0) {
      updateBalance(result.totalWin);
      setWinHistory(prev => [result.totalWin, ...prev.slice(0, 9)]);
      setShowWinAnimation(true);
      
      if (result.totalWin >= parseFloat(betAmount) * 10) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
      
      setTimeout(() => setShowWinAnimation(false), 3000);
    }

    // Handle auto-spin
    if (autoSpin && autoSpinCount > 0) {
      setAutoSpinCount(prev => prev - 1);
      setTimeout(() => {
        if (autoSpinCount > 1) {
          handleSpin();
        } else {
          setAutoSpin(false);
        }
      }, 1500);
    }
  };

  const startAutoSpin = (count: number) => {
    setAutoSpin(true);
    setAutoSpinCount(count);
    if (!isSpinning) {
      handleSpin();
    }
  };

  const stopAutoSpin = () => {
    setAutoSpin(false);
    setAutoSpinCount(0);
  };

  const renderReel = (reelIndex: number) => (
    <div className="reel-container" key={reelIndex}>
      <div 
        className="reel" 
        ref={el => reelRefs.current[reelIndex] = el!}
      >
        {visibleReels[reelIndex]?.map((symbol, symbolIndex) => (
          <div 
            key={symbolIndex} 
            className={`symbol ${winLines.some(line => 
              line[reelIndex] === symbolIndex
            ) ? 'winning' : ''}`}
          >
            <span className="symbol-emoji">{symbol?.emoji}</span>
            <span className="symbol-name">{symbol?.name}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="slots-game">
      <header className="game-header">
        <Link to="/" className="back-btn">
          <ArrowLeft size={20} />
          Back to Dashboard
        </Link>
        <h1>🎰 Vegas Slots</h1>
        <div className="header-controls">
          <button 
            className="sound-btn"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <div className="balance-display">
            💰 {user?.balance?.toFixed(3) || '0.000'} KAS
          </div>
        </div>
      </header>

      <div className="game-content">
        <div className="slots-machine">
          <div className="jackpot-display">
            <div className="jackpot-text">JACKPOT</div>
            <div className="jackpot-amount">{jackpotAmount.toFixed(3)} KAS</div>
          </div>

          <div className="reels-container">
            <div className="reels-wrapper">
              {Array(5).fill(null).map((_, index) => renderReel(index))}
            </div>
            <div className="paylines">
              {winLines.map((line, index) => (
                <div key={index} className={`payline line-${index}`} />
              ))}
            </div>
          </div>

          <AnimatePresence>
            {showWinAnimation && lastWin && (
              <motion.div
                className="win-overlay"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.5 }}
              >
                <div className="win-display">
                  <h2>🎉 BIG WIN! 🎉</h2>
                  <div className="win-amount">+{lastWin.totalWin.toFixed(3)} KAS</div>
                  {lastWin.multiplier > 1 && (
                    <div className="multiplier">x{lastWin.multiplier} MULTIPLIER!</div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="game-controls">
            <div className="bet-controls">
              <div className="bet-section">
                <label>Bet Amount</label>
                <div className="bet-input-group">
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    step="0.001"
                    min="0.001"
                    max={user?.balance || 0}
                    disabled={isSpinning || autoSpin}
                  />
                  <span className="currency">KAS</span>
                </div>
                <div className="bet-buttons">
                  <button onClick={() => setBetAmount('0.1')} disabled={isSpinning || autoSpin}>0.1</button>
                  <button onClick={() => setBetAmount('1')} disabled={isSpinning || autoSpin}>1</button>
                  <button onClick={() => setBetAmount('10')} disabled={isSpinning || autoSpin}>10</button>
                  <button onClick={() => setBetAmount('100')} disabled={isSpinning || autoSpin}>100</button>
                </div>
              </div>

              <div className="spin-section">
                <button
                  className="spin-btn"
                  onClick={handleSpin}
                  disabled={
                    isSpinning || 
                    autoSpin || 
                    parseFloat(betAmount) <= 0 || 
                    parseFloat(betAmount) > (user?.balance || 0)
                  }
                >
                  <Play size={24} />
                  {isSpinning ? 'SPINNING...' : 'SPIN'}
                </button>

                <div className="auto-spin-controls">
                  {!autoSpin ? (
                    <div className="auto-spin-buttons">
                      <button onClick={() => startAutoSpin(10)} disabled={isSpinning}>
                        AUTO x10
                      </button>
                      <button onClick={() => startAutoSpin(25)} disabled={isSpinning}>
                        AUTO x25
                      </button>
                      <button onClick={() => startAutoSpin(50)} disabled={isSpinning}>
                        AUTO x50
                      </button>
                    </div>
                  ) : (
                    <div className="auto-spin-status">
                      <div className="auto-spin-counter">
                        Auto Spins: {autoSpinCount}
                      </div>
                      <button className="stop-auto-btn" onClick={stopAutoSpin}>
                        STOP AUTO
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="game-sidebar">
          <div className="paytable">
            <h3>💰 Paytable</h3>
            <div className="symbol-list">
              {SLOT_SYMBOLS.map(symbol => (
                <div key={symbol.id} className="symbol-row">
                  <div className="symbol-info">
                    <span className="table-emoji">{symbol.emoji}</span>
                    <span className="table-name">{symbol.name}</span>
                  </div>
                  <div className="symbol-payout">
                    <span>3x = {(symbol.value * 3).toFixed(1)}x</span>
                    <span>4x = {(symbol.value * 4).toFixed(1)}x</span>
                    <span>5x = {(symbol.value * 5).toFixed(1)}x</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="win-history">
            <h3>🏆 Recent Wins</h3>
            {winHistory.length === 0 ? (
              <p className="no-history">No wins yet</p>
            ) : (
              <div className="history-list">
                {winHistory.map((win, index) => (
                  <div key={index} className="history-item">
                    <span className="win-amount">+{win.toFixed(3)} KAS</span>
                    <span className="win-multiplier">
                      {(win / parseFloat(betAmount)).toFixed(1)}x
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="game-stats">
            <h3>📊 Game Stats</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Total Spins</span>
                <span className="stat-value">{winHistory.length + 1}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Win Rate</span>
                <span className="stat-value">
                  {winHistory.length > 0 ? 
                    ((winHistory.length / (winHistory.length + 1)) * 100).toFixed(1) : '0.0'
                  }%
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Biggest Win</span>
                <span className="stat-value">
                  {winHistory.length > 0 ? 
                    Math.max(...winHistory).toFixed(3) : '0.000'
                  } KAS
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}