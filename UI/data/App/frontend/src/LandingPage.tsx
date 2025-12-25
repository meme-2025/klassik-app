import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

interface User {
  id: string;
  wallet: string;
}

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [jwtToken, setJwtToken] = useState<string>('');
  const [balance, setBalance] = useState<number>(0);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Prüfe, ob User eingeloggt ist (z.B. aus localStorage)
  useEffect(() => {
    const token = localStorage.getItem('jwtToken');
    if (token) {
      setJwtToken(token);
      // Decode token oder API call für User info
      // Stub: setUser({ id: 'user1', wallet: 'kaspa:address' });
    }
  }, []);

  // Funktion zum Login/Auth
  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      // Stub: API call zum Backend für Auth
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: 'userWallet' }), // Echte Wallet-Adresse
      });
      const data = await response.json();
      if (response.ok) {
        setJwtToken(data.token);
        localStorage.setItem('jwtToken', data.token);
        setUser(data.user);
        // Prüfe DB und Balance
        await checkRegistrationAndBalance(data.user);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Login fehlgeschlagen');
    }
    setLoading(false);
  };

  // Prüfe DB, JWT, Balance
  const checkRegistrationAndBalance = async (user: User) => {
    try {
      // 1. DB-Prüfung: Ist User registriert?
      const regResponse = await fetch('/api/user/registered', {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      if (!regResponse.ok) throw new Error('Nicht registriert');
      setIsRegistered(true);

      // 2. JWT gültig? (bereits geprüft beim Login)

      // 3. Blockchain-Guthaben >1 KAS
      const balanceResponse = await fetch('/api/blockchain/balance', {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      const balData = await balanceResponse.json();
      if (balData.balance > 1) {
        setBalance(balData.balance);
        // Erfolgreich: Gehe zu Lobby
        navigate('/lobby');
      } else {
        setError('Unzureichendes Guthaben (>1 KAS erforderlich)');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="landing-page">
      <h1>Klassik Pump - Multiplayer Game</h1>
      {!user ? (
        <div>
          <button onClick={handleLogin} disabled={loading}>
            {loading ? 'Einloggen...' : 'Mit Wallet einloggen'}
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      ) : (
        <div>
          <p>Willkommen, {user.id}!</p>
          <p>Wallet: {user.wallet}</p>
          <p>Balance: {balance} KAS</p>
          {isRegistered && balance > 1 ? (
            <button onClick={() => alert('Gehe zu Lobby-Auswahl')}>
              Lobby beitreten
            </button>
          ) : (
            <p>Prüfungen laufen...</p>
          )}
        </div>
      )}
    </div>
  );
};

export default LandingPage;