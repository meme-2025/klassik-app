import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, User, Trophy, TrendingUp, Calendar, Settings, Edit, Save, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import './Profile.css';

interface UserStats {
  totalGames: number;
  totalWinnings: number;
  totalLosses: number;
  winRate: number;
  biggestWin: number;
  currentStreak: number;
  longestStreak: number;
  favoriteGame: string;
  totalTimeSpent: number;
  level: number;
  experience: number;
  nextLevelExp: number;
}

interface GameHistory {
  id: string;
  game: string;
  type: 'win' | 'loss';
  amount: number;
  multiplier?: number;
  timestamp: string;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number;
  maxProgress?: number;
}

export default function Profile() {
  const { user, updateUser } = useGameStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editedUsername, setEditedUsername] = useState(user?.username || '');
  const [stats, setStats] = useState<UserStats | null>(null);
  const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [activeTab, setActiveTab] = useState<'stats' | 'history' | 'achievements'>('stats');

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    // Mock data for demonstration
    const mockStats: UserStats = {
      totalGames: 245,
      totalWinnings: 1250.789,
      totalLosses: 380.456,
      winRate: 68.5,
      biggestWin: 145.67,
      currentStreak: 5,
      longestStreak: 12,
      favoriteGame: 'Crash',
      totalTimeSpent: 18.5, // hours
      level: 8,
      experience: 2450,
      nextLevelExp: 3000
    };

    const mockHistory: GameHistory[] = [
      {
        id: '1',
        game: 'Crash',
        type: 'win',
        amount: 25.67,
        multiplier: 2.5,
        timestamp: '2024-01-20T14:30:00Z'
      },
      {
        id: '2',
        game: 'Dice',
        type: 'win',
        amount: 15.23,
        timestamp: '2024-01-20T14:25:00Z'
      },
      {
        id: '3',
        game: 'Roulette',
        type: 'loss',
        amount: -10.00,
        timestamp: '2024-01-20T14:20:00Z'
      },
      {
        id: '4',
        game: 'Slots',
        type: 'win',
        amount: 45.89,
        multiplier: 15.3,
        timestamp: '2024-01-20T14:15:00Z'
      },
      {
        id: '5',
        game: 'Crash',
        type: 'win',
        amount: 8.45,
        multiplier: 1.8,
        timestamp: '2024-01-20T14:10:00Z'
      }
    ];

    const mockAchievements: Achievement[] = [
      {
        id: '1',
        name: 'First Win',
        description: 'Win your first game',
        icon: '🎉',
        unlocked: true
      },
      {
        id: '2',
        name: 'High Roller',
        description: 'Win over 100 KAS in a single game',
        icon: '💎',
        unlocked: true
      },
      {
        id: '3',
        name: 'Lucky Streak',
        description: 'Win 10 games in a row',
        icon: '🔥',
        unlocked: true
      },
      {
        id: '4',
        name: 'Crash Master',
        description: 'Play 100 Crash games',
        icon: '🚀',
        unlocked: false,
        progress: 67,
        maxProgress: 100
      },
      {
        id: '5',
        name: 'Dice Legend',
        description: 'Win 50 Dice games',
        icon: '🎲',
        unlocked: false,
        progress: 23,
        maxProgress: 50
      },
      {
        id: '6',
        name: 'Slots Enthusiast',
        description: 'Hit 5 jackpots',
        icon: '🎰',
        unlocked: false,
        progress: 2,
        maxProgress: 5
      }
    ];

    setStats(mockStats);
    setGameHistory(mockHistory);
    setAchievements(mockAchievements);
  };

  const handleSaveUsername = () => {
    updateUser({ username: editedUsername });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedUsername(user?.username || '');
    setIsEditing(false);
  };

  const formatTime = (hours: number): string => {
    if (hours < 1) return `${Math.floor(hours * 60)}m`;
    return `${hours.toFixed(1)}h`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getGameIcon = (game: string): string => {
    switch (game.toLowerCase()) {
      case 'crash': return '🚀';
      case 'dice': return '🎲';
      case 'roulette': return '🎯';
      case 'slots': return '🎰';
      default: return '🎮';
    }
  };

  const getLevelProgress = (): number => {
    if (!stats) return 0;
    return (stats.experience / stats.nextLevelExp) * 100;
  };

  const renderStatsTab = () => (
    <div className="stats-content">
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">🏆</div>
          <div className="stat-info">
            <span className="stat-value">{stats?.totalGames || 0}</span>
            <span className="stat-label">Total Games</span>
          </div>
        </div>

        <div className="stat-card primary">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <span className="stat-value">{stats?.totalWinnings?.toFixed(3) || '0.000'} KAS</span>
            <span className="stat-label">Total Winnings</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-info">
            <span className="stat-value">{stats?.winRate?.toFixed(1) || 0}%</span>
            <span className="stat-label">Win Rate</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-info">
            <span className="stat-value">{stats?.biggestWin?.toFixed(3) || '0.000'}</span>
            <span className="stat-label">Biggest Win</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🔥</div>
          <div className="stat-info">
            <span className="stat-value">{stats?.currentStreak || 0}</span>
            <span className="stat-label">Current Streak</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-info">
            <span className="stat-value">{formatTime(stats?.totalTimeSpent || 0)}</span>
            <span className="stat-label">Time Played</span>
          </div>
        </div>
      </div>

      <div className="favorite-game">
        <h3>🎮 Favorite Game</h3>
        <div className="game-card">
          <div className="game-icon">{getGameIcon(stats?.favoriteGame || '')}</div>
          <div className="game-name">{stats?.favoriteGame || 'None'}</div>
        </div>
      </div>
    </div>
  );

  const renderHistoryTab = () => (
    <div className="history-content">
      <div className="history-header">
        <h3>Recent Games</h3>
        <span className="total-games">{gameHistory.length} recent games</span>
      </div>
      
      <div className="history-list">
        {gameHistory.map(game => (
          <div key={game.id} className={`history-item ${game.type}`}>
            <div className="game-info">
              <div className="game-icon">{getGameIcon(game.game)}</div>
              <div className="game-details">
                <span className="game-name">{game.game}</span>
                <span className="game-time">{formatDate(game.timestamp)}</span>
              </div>
            </div>
            
            <div className="game-result">
              <span className={`amount ${game.type}`}>
                {game.type === 'win' ? '+' : ''}{game.amount.toFixed(3)} KAS
              </span>
              {game.multiplier && (
                <span className="multiplier">{game.multiplier}x</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAchievementsTab = () => (
    <div className="achievements-content">
      <div className="achievements-header">
        <h3>🏅 Achievements</h3>
        <span className="unlocked-count">
          {achievements.filter(a => a.unlocked).length} / {achievements.length} unlocked
        </span>
      </div>

      <div className="achievements-grid">
        {achievements.map(achievement => (
          <div key={achievement.id} className={`achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}`}>
            <div className="achievement-icon">{achievement.icon}</div>
            <div className="achievement-info">
              <span className="achievement-name">{achievement.name}</span>
              <span className="achievement-desc">{achievement.description}</span>
              {!achievement.unlocked && achievement.progress !== undefined && (
                <div className="achievement-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${(achievement.progress / (achievement.maxProgress || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="progress-text">
                    {achievement.progress} / {achievement.maxProgress}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="profile-page">
      <header className="page-header">
        <Link to="/" className="back-btn">
          <ArrowLeft size={20} />
          Back to Dashboard
        </Link>
        <h1>👤 Profile</h1>
        <div className="header-actions">
          <button className="settings-btn">
            <Settings size={20} />
          </button>
        </div>
      </header>

      <div className="page-content">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="avatar-section">
            <div className="user-avatar">
              <User size={48} />
            </div>
            <div className="level-badge">
              Level {stats?.level || 1}
            </div>
          </div>

          <div className="user-info">
            <div className="username-section">
              {isEditing ? (
                <div className="edit-username">
                  <input
                    value={editedUsername}
                    onChange={(e) => setEditedUsername(e.target.value)}
                    className="username-input"
                    placeholder="Enter username"
                  />
                  <div className="edit-actions">
                    <button onClick={handleSaveUsername} className="save-btn">
                      <Save size={16} />
                    </button>
                    <button onClick={handleCancelEdit} className="cancel-btn">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="username-display">
                  <h2>{user?.username || 'Anonymous'}</h2>
                  <button onClick={() => setIsEditing(true)} className="edit-btn">
                    <Edit size={16} />
                  </button>
                </div>
              )}
            </div>

            <div className="user-details">
              <span className="user-id">ID: {user?.address?.slice(0, 8) || 'N/A'}...</span>
              <span className="member-since">Member since January 2024</span>
            </div>

            <div className="level-progress">
              <div className="progress-header">
                <span>Level {stats?.level || 1}</span>
                <span>{stats?.experience || 0} / {stats?.nextLevelExp || 1000} XP</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${getLevelProgress()}%` }}
                />
              </div>
            </div>
          </div>

          <div className="balance-section">
            <div className="balance-card">
              <span className="balance-label">Current Balance</span>
              <span className="balance-amount">
                {user?.balance?.toFixed(3) || '0.000'} KAS
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="profile-tabs">
          <button
            className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <TrendingUp size={18} />
            Statistics
          </button>
          <button
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <Calendar size={18} />
            Game History
          </button>
          <button
            className={`tab ${activeTab === 'achievements' ? 'active' : ''}`}
            onClick={() => setActiveTab('achievements')}
          >
            <Trophy size={18} />
            Achievements
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'stats' && renderStatsTab()}
              {activeTab === 'history' && renderHistoryTab()}
              {activeTab === 'achievements' && renderAchievementsTab()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}