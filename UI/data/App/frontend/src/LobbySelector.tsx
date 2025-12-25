import React, { useState, useEffect } from 'react';
import './LobbySelector.css';

interface Lobby {
  id: string;
  name: string;
  players: number;
  maxPlayers: number;
  stake: number;
}

const LobbySelector: React.FC = () => {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Lade verfügbare Lobbys vom Backend
    fetchLobbies();
  }, []);

  const fetchLobbies = async () => {
    try {
      const response = await fetch('/api/lobbies', {
        headers: { Authorization: `Bearer ${localStorage.getItem('jwtToken')}` },
      });
      const data = await response.json();
      setLobbies(data.lobbies);
    } catch (err) {
      console.error('Fehler beim Laden der Lobbys');
    }
    setLoading(false);
  };

  const joinLobby = async (lobbyId: string) => {
    try {
      const response = await fetch('/api/lobby/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('jwtToken')}`,
        },
        body: JSON.stringify({ lobbyId }),
      });
      if (response.ok) {
        alert('Beigetreten!');
        // Navigiere zum Spiel
      } else {
        alert('Fehler beim Beitreten');
      }
    } catch (err) {
      alert('Netzwerkfehler');
    }
  };

  const createLobby = async () => {
    const name = prompt('Lobby-Name:');
    const maxPlayers = parseInt(prompt('Max Spieler:') || '4');
    const stake = parseFloat(prompt('Stake:') || '10');
    try {
      const response = await fetch('/api/lobby/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('jwtToken')}`,
        },
        body: JSON.stringify({ name, maxPlayers, stake }),
      });
      if (response.ok) {
        fetchLobbies(); // Aktualisiere Liste
      }
    } catch (err) {
      alert('Fehler beim Erstellen');
    }
  };

  return (
    <div className="lobby-selector">
      <h2>Lobby-Auswahl</h2>
      <button onClick={createLobby}>Neue Lobby erstellen</button>
      {loading ? (
        <p>Lade Lobbys...</p>
      ) : (
        <ul>
          {lobbies.map((lobby) => (
            <li key={lobby.id}>
              <span>{lobby.name} - {lobby.players}/{lobby.maxPlayers} Spieler - Stake: {lobby.stake} KAS</span>
              <button onClick={() => joinLobby(lobby.id)} disabled={lobby.players >= lobby.maxPlayers}>
                Beitreten
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LobbySelector;