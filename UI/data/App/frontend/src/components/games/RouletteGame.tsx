import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Play, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useGameStore } from '../../store/gameStore';
import { gameSocket } from '../../services/socket';
import './RouletteGame.css';

interface BetOption {
  type: 'number' | 'color' | 'range';
  value: string | number;
  payout: number;
  color?: string;
}

interface RouletteBet {
  option: BetOption;
  amount: number;
}

interface RouletteResult {
  number: number;
  color: 'red' | 'black' | 'green';
  winning: boolean;
  payout?: number;
}

const ROULETTE_NUMBERS = [
  { number: 0, color: 'green' },
  { number: 1, color: 'red' }, { number: 2, color: 'black' }, { number: 3, color: 'red' },
  { number: 4, color: 'black' }, { number: 5, color: 'red' }, { number: 6, color: 'black' },
  { number: 7, color: 'red' }, { number: 8, color: 'black' }, { number: 9, color: 'red' },
  { number: 10, color: 'black' }, { number: 11, color: 'black' }, { number: 12, color: 'red' },
  { number: 13, color: 'black' }, { number: 14, color: 'red' }, { number: 15, color: 'black' },
  { number: 16, color: 'red' }, { number: 17, color: 'black' }, { number: 18, color: 'red' },
  { number: 19, color: 'red' }, { number: 20, color: 'black' }, { number: 21, color: 'red' },
  { number: 22, color: 'black' }, { number: 23, color: 'red' }, { number: 24, color: 'black' },
  { number: 25, color: 'red' }, { number: 26, color: 'black' }, { number: 27, color: 'red' },
  { number: 28, color: 'black' }, { number: 29, color: 'black' }, { number: 30, color: 'red' },
  { number: 31, color: 'black' }, { number: 32, color: 'red' }, { number: 33, color: 'black' },
  { number: 34, color: 'red' }, { number: 35, color: 'black' }, { number: 36, color: 'red' }
];

const BET_OPTIONS: BetOption[] = [
  { type: 'color', value: 'red', payout: 2, color: 'red' },
  { type: 'color', value: 'black', payout: 2, color: 'black' },
  { type: 'color', value: 'green', payout: 35, color: 'green' },
  { type: 'range', value: '1-18', payout: 2 },
  { type: 'range', value: '19-36', payout: 2 },
  { type: 'range', value: 'even', payout: 2 },
  { type: 'range', value: 'odd', payout: 2 }
];

export default function RouletteGame() {
  const { user, updateBalance } = useGameStore();
  const [betAmount, setBetAmount] = useState('');
  const [activeBets, setActiveBets] = useState<RouletteBet[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [gameHistory, setGameHistory] = useState<number[]>([]);
  const [selectedBetOption, setSelectedBetOption] = useState<BetOption | null>(null);
  const [showResult, setShowResult] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Connect to socket and join roulette room
    gameSocket.connect();
    gameSocket.joinGame('roulette');

    gameSocket.socket?.on('roulette:result', (data: any) => {
      handleGameResult(data.number);
    });

    return () => {
      gameSocket.socket?.off('roulette:result');
    };
  }, []);

  const calculateWinning = (number: number, bet: RouletteBet): boolean => {
    const numberData = ROULETTE_NUMBERS.find(n => n.number === number);
    if (!numberData) return false;

    switch (bet.option.type) {
      case 'number':
        return bet.option.value === number;
      case 'color':
        return bet.option.value === numberData.color;
      case 'range':
        if (bet.option.value === '1-18') return number >= 1 && number <= 18;
        if (bet.option.value === '19-36') return number >= 19 && number <= 36;
        if (bet.option.value === 'even') return number !== 0 && number % 2 === 0;
        if (bet.option.value === 'odd') return number !== 0 && number % 2 === 1;
        return false;
      default:
        return false;
    }
  };

  const handleSpin = () => {
    if (activeBets.length === 0 || isSpinning) return;

    const totalBet = activeBets.reduce((sum, bet) => sum + bet.amount, 0);
    if (totalBet > (user?.balance || 0)) return;

    setIsSpinning(true);
    setResult(null);
    setShowResult(false);

    // Update balance immediately for bets
    updateBalance(-(totalBet));

    // Generate random number and calculate rotations
    const resultNumber = Math.floor(Math.random() * 37);
    const segmentAngle = 360 / 37;
    const resultAngle = resultNumber * segmentAngle;
    const spins = 5 + Math.random() * 3; // 5-8 full rotations
    const totalRotation = wheelRotation + (spins * 360) + (360 - resultAngle);

    setWheelRotation(totalRotation);

    // Animate wheel and ball
    if (wheelRef.current) {
      wheelRef.current.style.transform = `rotate(${totalRotation}deg)`;
      wheelRef.current.style.transition = 'transform 4s cubic-bezier(0.25, 0.1, 0.25, 1)';
    }

    // Simulate socket result after spin animation
    setTimeout(() => {
      handleGameResult(resultNumber);
    }, 4200);
  };

  const handleGameResult = (resultNumber: number) => {
    const numberData = ROULETTE_NUMBERS.find(n => n.number === resultNumber)!;
    let totalWinnings = 0;
    let hasWinningBet = false;

    activeBets.forEach(bet => {
      const isWinning = calculateWinning(resultNumber, bet);
      if (isWinning) {
        totalWinnings += bet.amount * bet.option.payout;
        hasWinningBet = true;
      }
    });

    if (hasWinningBet) {
      updateBalance(totalWinnings);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    setResult({
      number: resultNumber,
      color: numberData.color,
      winning: hasWinningBet,
      payout: totalWinnings
    });

    setGameHistory(prev => [resultNumber, ...prev.slice(0, 19)]);
    setIsSpinning(false);
    setShowResult(true);
    setActiveBets([]);

    // Clear result after delay
    setTimeout(() => {
      setShowResult(false);
      setResult(null);
    }, 5000);
  };

  const placeBet = () => {
    if (!selectedBetOption || !betAmount || parseFloat(betAmount) <= 0) return;

    const amount = parseFloat(betAmount);
    if (amount > (user?.balance || 0)) return;

    const newBet: RouletteBet = {
      option: selectedBetOption,
      amount
    };

    setActiveBets(prev => [...prev, newBet]);
    setBetAmount('');
  };

  const clearBets = () => {
    setActiveBets([]);
  };

  const getNumberColor = (number: number): string => {
    const numberData = ROULETTE_NUMBERS.find(n => n.number === number);
    return numberData?.color || 'black';
  };

  const renderWheel = () => (
    <div className="roulette-wheel-container">
      <div ref={wheelRef} className="roulette-wheel">
        {ROULETTE_NUMBERS.map((num, index) => {
          const angle = (index * 360) / 37;
          return (
            <div
              key={num.number}
              className={`wheel-segment ${num.color}`}
              style={{
                transform: `rotate(${angle}deg)`
              }}
            >
              <span className="number-label">{num.number}</span>
            </div>
          );
        })}
      </div>
      <div ref={ballRef} className="roulette-ball" />
      <div className="wheel-pointer" />
    </div>
  );

  return (
    <div className="roulette-game">
      <header className="game-header">
        <Link to="/" className="back-btn">
          <ArrowLeft size={20} />
          Back to Dashboard
        </Link>
        <h1>🎰 Roulette</h1>
        <div className="balance-display">
          💰 {user?.balance?.toFixed(3) || '0.000'} KAS
        </div>
      </header>

      <div className="game-content">
        <div className="game-display">
          {renderWheel()}
          
          <AnimatePresence>
            {showResult && result && (
              <motion.div
                className="result-overlay"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.5 }}
              >
                <div className={`result-display ${result.winning ? 'win' : 'lose'}`}>
                  <div className={`winning-number ${getNumberColor(result.number)}`}>
                    {result.number}
                  </div>
                  <h2>{result.winning ? '🎉 You Won!' : '💥 House Wins'}</h2>
                  {result.winning && (
                    <p className="win-amount">+{result.payout?.toFixed(3)} KAS</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="game-sidebar">
          {/* Betting Board */}
          <div className="betting-board">
            <h3>Place Your Bets</h3>
            
            <div className="numbers-grid">
              {ROULETTE_NUMBERS.slice(1).map(num => (
                <button
                  key={num.number}
                  className={`number-bet ${num.color} ${
                    selectedBetOption?.type === 'number' && 
                    selectedBetOption?.value === num.number ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedBetOption({ 
                    type: 'number', 
                    value: num.number, 
                    payout: 35 
                  })}
                  disabled={isSpinning}
                >
                  {num.number}
                </button>
              ))}
              <button
                className={`number-bet green zero ${
                  selectedBetOption?.type === 'number' && 
                  selectedBetOption?.value === 0 ? 'selected' : ''
                }`}
                onClick={() => setSelectedBetOption({ 
                  type: 'number', 
                  value: 0, 
                  payout: 35 
                })}
                disabled={isSpinning}
              >
                0
              </button>
            </div>

            <div className="outside-bets">
              {BET_OPTIONS.map((option, index) => (
                <button
                  key={index}
                  className={`outside-bet ${option.color || ''} ${
                    selectedBetOption === option ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedBetOption(option)}
                  disabled={isSpinning}
                >
                  <span>{option.value.toString().toUpperCase()}</span>
                  <span className="payout">{option.payout}:1</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bet Controls */}
          <div className="bet-controls">
            <h3>Bet Amount</h3>
            <div className="bet-input-group">
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="Enter bet amount"
                step="0.001"
                min="0"
                disabled={isSpinning}
              />
              <span className="currency">KAS</span>
            </div>

            <div className="bet-buttons">
              <button onClick={() => setBetAmount('0.001')} disabled={isSpinning}>0.001</button>
              <button onClick={() => setBetAmount('0.01')} disabled={isSpinning}>0.01</button>
              <button onClick={() => setBetAmount('0.1')} disabled={isSpinning}>0.1</button>
              <button onClick={() => setBetAmount('1')} disabled={isSpinning}>1</button>
              <button onClick={() => setBetAmount('10')} disabled={isSpinning}>10</button>
              <button onClick={() => setBetAmount('100')} disabled={isSpinning}>100</button>
            </div>

            <button
              className="place-bet-btn"
              onClick={placeBet}
              disabled={!selectedBetOption || !betAmount || isSpinning}
            >
              Place Bet
            </button>

            {activeBets.length > 0 && (
              <div className="active-bets">
                <h4>Active Bets ({activeBets.length})</h4>
                {activeBets.map((bet, index) => (
                  <div key={index} className="active-bet">
                    <span>{bet.option.value.toString().toUpperCase()}</span>
                    <span>{bet.amount.toFixed(3)} KAS</span>
                  </div>
                ))}
                <div className="bet-total">
                  Total: {activeBets.reduce((sum, bet) => sum + bet.amount, 0).toFixed(3)} KAS
                </div>
              </div>
            )}

            <div className="game-controls">
              <button
                className="spin-btn"
                onClick={handleSpin}
                disabled={activeBets.length === 0 || isSpinning}
              >
                <Play size={20} />
                {isSpinning ? 'Spinning...' : 'SPIN'}
              </button>
              
              <button
                className="clear-btn"
                onClick={clearBets}
                disabled={activeBets.length === 0 || isSpinning}
              >
                <RotateCcw size={20} />
                Clear Bets
              </button>
            </div>
          </div>

          {/* Game History */}
          <div className="game-history">
            <h3>Recent Results</h3>
            {gameHistory.length === 0 ? (
              <p className="no-history">No results yet</p>
            ) : (
              <div className="history-list">
                {gameHistory.map((number, index) => (
                  <div
                    key={index}
                    className={`history-item ${getNumberColor(number)}`}
                  >
                    {number}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}