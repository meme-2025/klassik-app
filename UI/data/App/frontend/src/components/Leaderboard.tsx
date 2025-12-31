import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Crown, Medal, TrendingUp, Calendar, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { apiService } from '../services/api';
import './Leaderboard.css';

interface LeaderboardEntry {
  id: string;
  username: string;
  totalWinnings: number;
  totalBets: number;
  winRate: number;
  biggestWin: number;
  gamesPlayed: number;
  rank: number;
  avatar?: string;
}

interface LeaderboardStats {
  totalPlayers: number;
  totalWagered: number;
  totalPaidOut: number;
  biggestWinToday: number;
}

type LeaderboardType = 'allTime' | 'weekly' | 'daily' | 'bigWins';

export default function Leaderboard() {
  const { user } = useGameStore();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<LeaderboardStats | null>(null);
  const [activeTab, setActiveTab] = useState<LeaderboardType>('allTime');
  const [loading, setLoading] = useState(true);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    fetchLeaderboardData();
  }, [activeTab]);

  const fetchLeaderboardData = async () => {
    try {
      setLoading(true);
      
      // Simulate API call with mock data
      const mockData: LeaderboardEntry[] = [
        {
          id: '1',
          username: 'KaspaMaster',
          totalWinnings: 15420.789,
          totalBets: 2840,
          winRate: 65.2,
          biggestWin: 2580.45,
          gamesPlayed: 1205,
          rank: 1
        },
        {
          id: '2',
          username: 'CryptoWhale',
          totalWinnings: 12890.234,
          totalBets: 3120,
          winRate: 58.7,
          biggestWin: 3200.12,
          gamesPlayed: 1560,
          rank: 2
        },
        {
          id: '3',
          username: 'LuckyPlayer',
          totalWinnings: 9750.567,
          totalBets: 1890,
          winRate: 72.4,
          biggestWin: 1890.78,
          gamesPlayed: 890,
          rank: 3
        },
        {
          id: '4',
          username: 'GambleKing',
          totalWinnings: 8420.123,
          totalBets: 2340,
          winRate: 61.3,
          biggestWin: 1560.90,
          gamesPlayed: 1120,
          rank: 4
        },
        {
          id: '5',
          username: 'RocketPlayer',
          totalWinnings: 7890.456,
          totalBets: 1670,
          winRate: 68.9,
          biggestWin: 2100.34,
          gamesPlayed: 780,
          rank: 5
        },
        {
          id: '6',
          username: 'DiamondHands',
          totalWinnings: 6540.789,
          totalBets: 2100,
          winRate: 55.8,
          biggestWin: 1340.67,
          gamesPlayed: 1340,
          rank: 6
        },
        {
          id: '7',
          username: 'SlotMachine',
          totalWinnings: 5670.234,
          totalBets: 1560,
          winRate: 63.7,
          biggestWin: 980.45,
          gamesPlayed: 690,
          rank: 7
        },
        {
          id: '8',
          username: 'CrashExpert',
          totalWinnings: 4890.567,
          totalBets: 1340,
          winRate: 59.2,
          biggestWin: 1200.78,
          gamesPlayed: 560,
          rank: 8
        },
        {
          id: '9',
          username: 'RouletteRider',
          totalWinnings: 4230.123,
          totalBets: 1890,
          winRate: 52.6,
          biggestWin: 890.12,
          gamesPlayed: 840,
          rank: 9
        },
        {
          id: '10',
          username: 'DiceRoller',
          totalWinnings: 3780.456,
          totalBets: 1120,
          winRate: 67.1,
          biggestWin: 750.34,
          gamesPlayed: 450,
          rank: 10
        }
      ];

      const mockStats: LeaderboardStats = {
        totalPlayers: 15420,
        totalWagered: 2456789.123,
        totalPaidOut: 1998234.567,
        biggestWinToday: 5670.89
      };

      // Add current user to leaderboard if they have stats
      if (user?.address) {
        const currentUserEntry: LeaderboardEntry = {
          id: user.address,
          username: user.username || 'You',
          totalWinnings: user.totalWinnings || 0,
          totalBets: user.totalBets || 0,
          winRate: user.winRate || 0,
          biggestWin: user.biggestWin || 0,
          gamesPlayed: user.gamesPlayed || 0,
          rank: mockData.length + 1
        };
        setUserRank(currentUserEntry);
      }

      setLeaderboardData(mockData);
      setStats(mockStats);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="rank-icon gold" size={24} />;
      case 2:
        return <Medal className="rank-icon silver" size={24} />;
      case 3:
        return <Medal className="rank-icon bronze" size={24} />;
      default:
        return <span className="rank-number">#{rank}</span>;
    }
  };

  const getTabData = () => {
    switch (activeTab) {
      case 'weekly':
        return leaderboardData.map(entry => ({
          ...entry,
          totalWinnings: entry.totalWinnings * 0.15 // Weekly earnings simulation
        }));
      case 'daily':
        return leaderboardData.map(entry => ({
          ...entry,
          totalWinnings: entry.totalWinnings * 0.05 // Daily earnings simulation
        }));
      case 'bigWins':
        return [...leaderboardData].sort((a, b) => b.biggestWin - a.biggestWin);
      default:
        return leaderboardData;
    }
  };

  const renderLeaderboardEntry = (entry: LeaderboardEntry, index: number) => (
    <motion.div
      key={entry.id}
      className={`leaderboard-entry ${entry.rank <= 3 ? 'top-three' : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <div className="rank-section">
        {getRankIcon(entry.rank)}
      </div>
      
      <div className="player-info">
        <div className="player-avatar">
          {entry.avatar ? (
            <img src={entry.avatar} alt={entry.username} />
          ) : (
            <div className="avatar-placeholder">
              {entry.username[0].toUpperCase()}
            </div>
          )}
        </div>
        <div className="player-details">
          <div className="username">{entry.username}</div>
          <div className="games-played">{entry.gamesPlayed} games</div>
        </div>
      </div>

      <div className="stats-section">
        <div className="primary-stat">
          <span className="stat-value">
            {entry.totalWinnings.toFixed(3)} KAS
          </span>
          <span className="stat-label">Total Winnings</span>
        </div>
        
        <div className="secondary-stats">
          <div className="stat">
            <span className="value">{entry.winRate.toFixed(1)}%</span>
            <span className="label">Win Rate</span>
          </div>
          <div className="stat">
            <span className="value">{entry.biggestWin.toFixed(3)}</span>
            <span className="label">Biggest Win</span>
          </div>
        </div>
      </div>

      {entry.rank <= 3 && (
        <div className="rank-badge">
          <Trophy size={16} />
          <span>Top {entry.rank}</span>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="leaderboard-page">
      <header className="page-header">
        <Link to="/" className="back-btn">
          <ArrowLeft size={20} />
          Back to Dashboard
        </Link>
        <h1>🏆 Leaderboard</h1>
        <div className="header-stats">
          <Users size={20} />
          <span>{stats?.totalPlayers?.toLocaleString() || '0'} Players</span>
        </div>
      </header>

      <div className="page-content">
        {/* Stats Overview */}
        <div className="stats-overview">
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-info">
              <span className="stat-title">Total Wagered</span>
              <span className="stat-value">
                {stats?.totalWagered?.toFixed(3) || '0.000'} KAS
              </span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🎉</div>
            <div className="stat-info">
              <span className="stat-title">Total Paid Out</span>
              <span className="stat-value">
                {stats?.totalPaidOut?.toFixed(3) || '0.000'} KAS
              </span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🔥</div>
            <div className="stat-info">
              <span className="stat-title">Biggest Win Today</span>
              <span className="stat-value">
                {stats?.biggestWinToday?.toFixed(3) || '0.000'} KAS
              </span>
            </div>
          </div>
        </div>

        <div className="leaderboard-container">
          {/* Tabs */}
          <div className="leaderboard-tabs">
            <button
              className={`tab ${activeTab === 'allTime' ? 'active' : ''}`}
              onClick={() => setActiveTab('allTime')}
            >
              <TrendingUp size={18} />
              All Time
            </button>
            <button
              className={`tab ${activeTab === 'weekly' ? 'active' : ''}`}
              onClick={() => setActiveTab('weekly')}
            >
              <Calendar size={18} />
              Weekly
            </button>
            <button
              className={`tab ${activeTab === 'daily' ? 'active' : ''}`}
              onClick={() => setActiveTab('daily')}
            >
              <Calendar size={18} />
              Daily
            </button>
            <button
              className={`tab ${activeTab === 'bigWins' ? 'active' : ''}`}
              onClick={() => setActiveTab('bigWins')}
            >
              <Trophy size={18} />
              Big Wins
            </button>
          </div>

          {/* Your Rank */}
          {userRank && (
            <div className="your-rank">
              <h3>Your Ranking</h3>
              {renderLeaderboardEntry(userRank, 0)}
            </div>
          )}

          {/* Leaderboard List */}
          <div className="leaderboard-list">
            <div className="list-header">
              <h3>Top Players</h3>
              <span className="last-updated">
                Updated just now
              </span>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading leaderboard...</p>
              </div>
            ) : (
              <div className="entries-container">
                {getTabData().map((entry, index) => 
                  renderLeaderboardEntry(entry, index)
                )}
              </div>
            )}
          </div>
        </div>

        {/* Achievement Showcase */}
        <div className="achievements-section">
          <h3>🏅 Recent Achievements</h3>
          <div className="achievements-grid">
            <div className="achievement-card">
              <div className="achievement-icon">👑</div>
              <div className="achievement-info">
                <span className="achievement-title">High Roller</span>
                <span className="achievement-desc">Won over 1000 KAS in a single game</span>
                <span className="achievement-player">KaspaMaster</span>
              </div>
            </div>
            
            <div className="achievement-card">
              <div className="achievement-icon">🔥</div>
              <div className="achievement-info">
                <span className="achievement-title">Hot Streak</span>
                <span className="achievement-desc">Won 10 games in a row</span>
                <span className="achievement-player">LuckyPlayer</span>
              </div>
            </div>
            
            <div className="achievement-card">
              <div className="achievement-icon">💎</div>
              <div className="achievement-info">
                <span className="achievement-title">Diamond Hands</span>
                <span className="achievement-desc">Played 1000+ games total</span>
                <span className="achievement-player">DiamondHands</span>
              </div>
            </div>
            
            <div className="achievement-card">
              <div className="achievement-icon">🎰</div>
              <div className="achievement-info">
                <span className="achievement-title">Jackpot Winner</span>
                <span className="achievement-desc">Hit the slots jackpot</span>
                <span className="achievement-player">SlotMachine</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}