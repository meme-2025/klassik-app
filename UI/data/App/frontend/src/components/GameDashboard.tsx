import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Gamepad2, 
  TrendingUp, 
  Users, 
  Trophy, 
  Coins, 
  BarChart3,
  Settings,
  LogOut,
  Play,
  Zap,
  Star
} from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { gameAPI, kaspaAPI } from '../services/api';
import toast from 'react-hot-toast';
import './GameDashboard.css';

interface GameStats {
  totalGames: number;
  totalWinnings: number;
  winRate: number;
  level: number;
  rank: number;
}

interface QuickGame {
  type: string;
  name: string;
  icon: string;
  players: number;
  minBet: number;
  maxWin: number;
  description: string;
}

const GameDashboard: React.FC = () => {
  const { user, updateBalance } = useGameStore();
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [quickGames, setQuickGames] = useState<QuickGame[]>([]);
  const [kaspaPrice, setKaspaPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Redirect if not logged in
  if (!user) {
    return <Navigate to="/connect" replace />;
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Load game stats
      const [gameHistory, kaspaData, availableGames] = await Promise.all([
        gameAPI.getGameHistory(100),
        kaspaAPI.getPrice(),
        gameAPI.getGames()
      ]);

      // Calculate stats
      const stats: GameStats = {
        totalGames: gameHistory.length,
        totalWinnings: gameHistory.reduce((sum: number, game: any) => sum + (game.winAmount || 0), 0),
        winRate: gameHistory.length > 0 ? (gameHistory.filter((game: any) => game.winAmount > 0).length / gameHistory.length) * 100 : 0,
        level: user.level || 1,
        rank: 1250 // Mock rank
      };

      setGameStats(stats);
      setKaspaPrice(kaspaData.price);
      setQuickGames(availableGames || getDefaultGames());
      
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setQuickGames(getDefaultGames());
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const getDefaultGames = (): QuickGame[] => [
    {
      type: 'dice',
      name: 'Dice Roll',
      icon: '🎲',
      players: 24,
      minBet: 0.1,
      maxWin: 1000,
      description: 'Classic dice game with customizable odds'
    },
    {
      type: 'crash',
      name: 'Crash',
      icon: '🚀',
      players: 156,
      minBet: 0.5,
      maxWin: 10000,
      description: 'Cash out before the crash for massive multipliers'
    },
    {
      type: 'roulette',
      name: 'Roulette',
      icon: '🎯',
      players: 89,
      minBet: 1,
      maxWin: 3500,
      description: 'European roulette with live betting'
    },
    {
      type: 'slots',
      name: 'Kaspa Slots',
      icon: '🎰',
      players: 201,
      minBet: 0.1,
      maxWin: 5000,
      description: 'Themed slots with progressive jackpots'
    }
  ];

  const handleQuickPlay = (gameType: string) => {
    toast.success(`Joining ${gameType} game...`);
    // Navigate to game
  };

  const handleLogout = () => {
    localStorage.removeItem('klassik_auth_token');
    window.location.href = '/';
  };

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner-large"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="game-dashboard">
      {/* Header */}
      <motion.header 
        className="dashboard-header"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="header-content">
          <div className="header-left">
            <h1>KLASSIK CASINO</h1>
            <p>Welcome back, {user.username || 'Player'}</p>
          </div>
          <div className="header-right">
            <div className="balance-card">
              <span className="balance-label">Balance</span>
              <span className="balance-amount">{user.balance.toFixed(3)} KAS</span>
              <span className="balance-usd">${(user.balance * kaspaPrice).toFixed(2)}</span>
            </div>
            <div className="header-actions">
              <Link to="/profile" className="action-btn">
                <Settings size={20} />
              </Link>
              <button onClick={handleLogout} className="action-btn logout">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Stats Overview */}
      <motion.section 
        className="stats-overview"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <Gamepad2 />
            </div>
            <div className="stat-content">
              <span className="stat-number">{gameStats?.totalGames || 0}</span>
              <span className="stat-label">Games Played</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <TrendingUp />
            </div>
            <div className="stat-content">
              <span className="stat-number">{gameStats?.totalWinnings.toFixed(2) || '0.00'} KAS</span>
              <span className="stat-label">Total Winnings</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <Star />
            </div>
            <div className="stat-content">
              <span className="stat-number">{gameStats?.winRate.toFixed(1) || '0.0'}%</span>
              <span className="stat-label">Win Rate</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <Trophy />
            </div>
            <div className="stat-content">
              <span className="stat-number">#{gameStats?.rank || '???'}</span>
              <span className="stat-label">Global Rank</span>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Quick Games */}
      <motion.section 
        className="quick-games"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <h2>Quick Play</h2>
        <div className="games-grid">
          {quickGames.map((game, index) => (
            <motion.div
              key={game.type}
              className="game-card"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
              whileHover={{ scale: 1.02, y: -5 }}
            >
              <div className="game-header">
                <div className="game-icon">{game.icon}</div>
                <div className="game-info">
                  <h3>{game.name}</h3>
                  <p>{game.description}</p>
                </div>
              </div>
              
              <div className="game-stats">
                <div className="game-stat">
                  <Users size={16} />
                  <span>{game.players} playing</span>
                </div>
                <div className="game-stat">
                  <Coins size={16} />
                  <span>{game.minBet} KAS min</span>
                </div>
                <div className="game-stat">
                  <Trophy size={16} />
                  <span>Max win: {game.maxWin}</span>
                </div>
              </div>
              
              <div className="game-actions">
                <Link to={`/game/${game.type}`} className="play-btn primary">
                  <Play size={18} />
                  Play Now
                </Link>
                <Link to={`/lobby?game=${game.type}`} className="lobby-btn secondary">
                  <Users size={18} />
                  Lobbies
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Quick Actions */}
      <motion.section 
        className="quick-actions"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          <Link to="/lobby" className="action-card">
            <Gamepad2 size={32} />
            <h3>Game Lobbies</h3>
            <p>Browse and join active game sessions</p>
          </Link>
          
          <Link to="/leaderboard" className="action-card">
            <BarChart3 size={32} />
            <h3>Leaderboard</h3>
            <p>See top players and rankings</p>
          </Link>
          
          <Link to="/profile" className="action-card">
            <Trophy size={32} />
            <h3>Achievements</h3>
            <p>Track your progress and rewards</p>
          </Link>
          
          <button className="action-card" onClick={() => toast.success('Coming soon!')}>
            <Zap size={32} />
            <h3>Tournaments</h3>
            <p>Compete in scheduled events</p>
          </button>
        </div>
      </motion.section>

      {/* Recent Activity */}
      <motion.section 
        className="recent-activity"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.0 }}
      >
        <h2>Recent Activity</h2>
        <div className="activity-list">
          {/* Mock recent activity */}
          <div className="activity-item">
            <div className="activity-icon">🎲</div>
            <div className="activity-content">
              <span className="activity-title">Won Dice Game</span>
              <span className="activity-time">2 minutes ago</span>
            </div>
            <span className="activity-amount positive">+12.5 KAS</span>
          </div>
          
          <div className="activity-item">
            <div className="activity-icon">🚀</div>
            <div className="activity-content">
              <span className="activity-title">Crash Game</span>
              <span className="activity-time">15 minutes ago</span>
            </div>
            <span className="activity-amount negative">-5.0 KAS</span>
          </div>
          
          <div className="activity-item">
            <div className="activity-icon">🎯</div>
            <div className="activity-content">
              <span className="activity-title">Roulette Win</span>
              <span className="activity-time">1 hour ago</span>
            </div>
            <span className="activity-amount positive">+25.0 KAS</span>
          </div>
        </div>
        
        <Link to="/profile?tab=history" className="view-all-btn">
          View All Activity
        </Link>
      </motion.section>
    </div>
  );
};

export default GameDashboard;