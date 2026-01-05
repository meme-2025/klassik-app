import { useState, useEffect, useRef } from 'react';
import './RushGame.css';

interface Player {
  id: string;
  address: string;
  avatar: string;
  betAmount: number;
  cashOutMultiplier?: number;
  winAmount?: number;
  status: 'active' | 'cashed-out' | 'lost';
  position: number;
}

interface GameState {
  status: 'waiting' | 'starting' | 'running' | 'crashed' | 'finished';
  currentMultiplier: number;
  players: Player[];
  pot: number;
  crashPoint?: number;
  seedHash?: string;
  revealedSeed?: string;
}

const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
  '#F8B739', '#52B788'
];

const RushGame = () => {
  const [gameState, setGameState] = useState<GameState>({
    status: 'waiting',
    currentMultiplier: 1.0,
    players: [],
    pot: 0
  });
  
  const [userPlayer, setUserPlayer] = useState<Player | null>(null);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const gameStartTimeRef = useRef<number>(0);

  // Initialize game
  useEffect(() => {
    // Mock players for testing
    const mockPlayers: Player[] = Array.from({ length: 10 }, (_, i) => ({
      id: `player-${i}`,
      address: `kaspa:qq${Math.random().toString(36).substring(7)}`,
      avatar: AVATAR_COLORS[i],
      betAmount: 10,
      status: 'active',
      position: i
    }));
    
    setGameState(prev => ({
      ...prev,
      players: mockPlayers,
      pot: 100 // 10 players * 10 KAS
    }));

    // Set user as first player for testing
    setUserPlayer(mockPlayers[0]);
  }, []);

  // Draw heatmap curve
  useEffect(() => {
    if (!canvasRef.current || gameState.status !== 'running') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const animate = () => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Calculate time elapsed
      const elapsed = (Date.now() - gameStartTimeRef.current) / 1000;
      const multiplier = 1 + Math.pow(elapsed, 1.8) * 0.1; // Exponential growth

      // Update multiplier
      setGameState(prev => ({
        ...prev,
        currentMultiplier: Number(multiplier.toFixed(2))
      }));

      // Determine color based on multiplier
      let gradient;
      if (multiplier < 1.5) {
        // Blue to Cyan (safe zone)
        gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#1E3A8A');
        gradient.addColorStop(1, '#06B6D4');
      } else if (multiplier < 3.0) {
        // Yellow to Orange (warning zone)
        gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#FCD34D');
        gradient.addColorStop(1, '#F97316');
      } else {
        // Red to Glowing Red (danger zone)
        gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#DC2626');
        gradient.addColorStop(1, '#7F1D1D');
      }

      // Draw curve
      ctx.beginPath();
      ctx.moveTo(0, height);

      for (let x = 0; x < width; x++) {
        const t = (x / width) * elapsed;
        const m = 1 + Math.pow(t, 1.8) * 0.1;
        const y = height - (m - 1) * (height / 10); // Scale to canvas
        ctx.lineTo(x, y);
      }

      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Add glow effect for high multipliers
      if (multiplier > 3.0) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#EF4444';
        ctx.strokeStyle = '#FEF2F2';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Vibrate on mobile at dangerous levels
      if (vibrationEnabled && multiplier > 2.0 && navigator.vibrate) {
        const intensity = Math.min((multiplier - 2.0) * 10, 50);
        navigator.vibrate(intensity);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState.status, vibrationEnabled]);

  // Start game
  const startGame = () => {
    // Generate provably fair seed
    const seed = Math.random().toString(36).substring(2, 15);
    const seedHash = btoa(seed); // In production, use crypto hash
    
    // Determine crash point (provably fair)
    const crashPoint = 1 + Math.random() * 9; // 1x to 10x

    gameStartTimeRef.current = Date.now();
    
    setGameState(prev => ({
      ...prev,
      status: 'running',
      currentMultiplier: 1.0,
      seedHash,
      crashPoint
    }));

    // Simulate game crash
    const crashTime = Math.log(crashPoint - 1) / Math.log(1.8) / 0.1 * 1000;
    setTimeout(() => {
      crashGame(seed);
    }, crashTime);
  };

  // Cash out
  const cashOut = () => {
    if (!userPlayer || gameState.status !== 'running') return;

    const winAmount = userPlayer.betAmount * gameState.currentMultiplier;
    
    setUserPlayer(prev => prev ? {
      ...prev,
      cashOutMultiplier: gameState.currentMultiplier,
      winAmount,
      status: 'cashed-out'
    } : null);

    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p => 
        p.id === userPlayer.id 
          ? { ...p, cashOutMultiplier: gameState.currentMultiplier, winAmount, status: 'cashed-out' }
          : p
      ),
      pot: prev.pot - winAmount
    }));

    // Vibrate success
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  };

  // Crash game
  const crashGame = (revealedSeed: string) => {
    setGameState(prev => ({
      ...prev,
      status: 'crashed',
      revealedSeed,
      players: prev.players.map(p => 
        p.status === 'active' ? { ...p, status: 'lost' } : p
      )
    }));

    // Heavy vibration for crash
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }

    // Reset after 5 seconds
    setTimeout(() => {
      setGameState({
        status: 'waiting',
        currentMultiplier: 1.0,
        players: [],
        pot: 0
      });
    }, 5000);
  };

  // Get multiplier color class
  const getMultiplierClass = () => {
    const m = gameState.currentMultiplier;
    if (m < 1.5) return 'safe';
    if (m < 3.0) return 'warning';
    return 'danger';
  };

  return (
    <div className="rush-game">
      {/* Header */}
      <div className="rush-header">
        <div className="game-info">
          <h1>⚡ Rush Game</h1>
          <div className="pot-display">
            <span className="pot-label">Total Pot:</span>
            <span className="pot-amount">{gameState.pot} KAS</span>
          </div>
        </div>
        
        {gameState.seedHash && (
          <div className="provably-fair">
            <span className="seed-hash" title="Provably Fair Hash">
              🔒 {gameState.seedHash.substring(0, 10)}...
            </span>
          </div>
        )}
      </div>

      {/* Main Game Area */}
      <div className="game-area">
        {/* Heatmap Curve */}
        <div className="curve-container">
          <canvas 
            ref={canvasRef} 
            width={800} 
            height={400}
            className="heatmap-canvas"
          />
          
          {/* Multiplier Display */}
          <div className={`multiplier-display ${getMultiplierClass()}`}>
            {gameState.status === 'crashed' ? (
              <span className="crash-text">💥 CRASHED!</span>
            ) : (
              <span className="multiplier-value">{gameState.currentMultiplier}x</span>
            )}
          </div>
        </div>

        {/* Player Avatars Circle */}
        <div className="players-circle">
          {gameState.players.map((player, index) => {
            const angle = (index / gameState.players.length) * 2 * Math.PI - Math.PI / 2;
            const radius = 150;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            return (
              <div
                key={player.id}
                className={`player-avatar ${player.status}`}
                style={{
                  transform: `translate(${x}px, ${y}px)`,
                  backgroundColor: player.avatar,
                  border: player.id === userPlayer?.id ? '3px solid #FCD34D' : 'none'
                }}
              >
                {player.status === 'cashed-out' && (
                  <div className="cash-out-animation">
                    <span className="coins">💰</span>
                    <span className="multiplier">{player.cashOutMultiplier}x</span>
                  </div>
                )}
                {player.status === 'lost' && (
                  <div className="lost-animation">💀</div>
                )}
                <div className="player-info">
                  <div className="player-address">
                    {player.address.substring(0, 10)}...
                  </div>
                  {player.winAmount && (
                    <div className="win-amount">+{player.winAmount.toFixed(2)} KAS</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="game-controls">
        {gameState.status === 'waiting' && (
          <button className="btn-start" onClick={startGame}>
            🚀 Start Game
          </button>
        )}

        {gameState.status === 'running' && userPlayer?.status === 'active' && (
          <button className="btn-cashout" onClick={cashOut}>
            💵 Cash Out at {gameState.currentMultiplier}x
          </button>
        )}

        {userPlayer?.status === 'cashed-out' && (
          <div className="cashed-out-message">
            ✅ You cashed out at {userPlayer.cashOutMultiplier}x!
            <br />
            Won: {userPlayer.winAmount?.toFixed(2)} KAS
          </div>
        )}

        {gameState.status === 'crashed' && (
          <div className="game-result">
            <h2>Game Crashed at {gameState.currentMultiplier}x!</h2>
            {gameState.revealedSeed && (
              <div className="revealed-seed">
                <p>Revealed Seed: {gameState.revealedSeed}</p>
                <p className="verify-hint">Verify fairness by checking the hash</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="game-settings">
        <label className="vibration-toggle">
          <input 
            type="checkbox" 
            checked={vibrationEnabled}
            onChange={(e) => setVibrationEnabled(e.target.checked)}
          />
          <span>Haptic Feedback</span>
        </label>
      </div>

      {/* Live Stats */}
      <div className="live-stats">
        <div className="stat-item">
          <span className="stat-label">Active Players</span>
          <span className="stat-value">
            {gameState.players.filter(p => p.status === 'active').length}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Cashed Out</span>
          <span className="stat-value">
            {gameState.players.filter(p => p.status === 'cashed-out').length}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Remaining Pot</span>
          <span className="stat-value">{gameState.pot.toFixed(2)} KAS</span>
        </div>
      </div>
    </div>
  );
};

export default RushGame;
