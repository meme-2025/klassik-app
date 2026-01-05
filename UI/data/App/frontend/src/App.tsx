import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LandingPage from './LandingPage';
import LobbySelector from './LobbySelector';
import GameDashboard from './components/GameDashboard';
import DiceGame from './components/games/DiceGame';
import CrashGame from './components/games/CrashGame';
import RouletteGame from './components/games/RouletteGame';
import SlotsGame from './components/games/SlotsGame';
import RushGame from './components/games/RushGame';
import WalletConnect from './components/WalletConnect';
import Leaderboard from './components/Leaderboard';
import Profile from './components/Profile';
import { gameSocket } from './services/socket';
import { useGameStore } from './store/gameStore';
import './App.css';

function App() {
  const { user, setConnectionStatus } = useGameStore();

  useEffect(() => {
    // Initialize socket connection when user is logged in
    if (user) {
      gameSocket.connect();
    }

    return () => {
      gameSocket.disconnect();
    };
  }, [user]);

  return (
    <Router>
      <div className="App">
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1a1a1a',
              color: '#00ff88',
              border: '1px solid #00ff88'
            }
          }}
        />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/connect" element={<WalletConnect />} />
          <Route path="/lobby" element={<LobbySelector />} />
          <Route path="/dashboard" element={<GameDashboard />} />
          <Route path="/game/dice/:sessionId?" element={<DiceGame />} />
          <Route path="/game/crash/:sessionId?" element={<CrashGame />} />
          <Route path="/game/roulette/:sessionId?" element={<RouletteGame />} />
          <Route path="/game/slots/:sessionId?" element={<SlotsGame />} />
          <Route path="/game/rush/:lobbyId?" element={<RushGame />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
