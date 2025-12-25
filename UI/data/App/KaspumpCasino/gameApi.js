// gameApi.js - Backend API für Klassik Pump
// Express + Socket.io + kaspa-rpc-js Skeleton
// Diese Datei orchestriert Lobby-Management, Runden, Claims und Payouts.
// On-chain-first: Alle kritischen Events werden on-chain committed oder verifiziert.

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken'); // Für Auth
const GameEngine = require('./gameEngine'); // Unsere Spiel-Engine (siehe gameEngine.js)
require('dotenv').config(); // Lade .env

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } }); // CORS für Web-Client

// Middleware
app.use(express.json());

// JWT Auth Middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Kaspa RPC Client (Stub - anpassen für echte Chain)
const kaspaClient = {
  commit: (hash) => console.log('Committed:', hash),
  reveal: (secret) => console.log('Revealed:', secret),
  getBlockHash: async () => 'mockBlockHash',
};

// Game Engine Instanz
const gameEngine = new GameEngine({
  db: {}, // Stub für DB (später PostgreSQL)
  blockchain: kaspaClient,
  ws: io,
});

// REST Endpoints

// POST /api/auth/login
// Diese Funktion loggt User ein und gibt JWT zurück.
// Erwartet: { wallet: string }
// Gibt: { token: string, user: { id, wallet } }
app.post('/api/auth/login', async (req, res) => {
  try {
    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ error: 'Wallet required' });

    // Stub: Prüfe DB, ob registriert
    const user = { id: 'user1', wallet }; // Stub
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    res.json({ token, user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/user/registered
// Prüft, ob User registriert ist.
app.get('/api/user/registered', auth, async (req, res) => {
  // Stub: immer true
  res.json({ registered: true });
});

// GET /api/blockchain/balance
// Gibt Balance der Wallet zurück.
app.get('/api/blockchain/balance', auth, async (req, res) => {
  // Stub: 100 KAS
  res.json({ balance: 100 });
});

// GET /api/lobbies
// Gibt Liste der Lobbys zurück.
app.get('/api/lobbies', auth, async (req, res) => {
  // Stub: Beispiel-Lobby
  const lobbies = [{ id: 'lobby1', name: 'Test Lobby', players: 2, maxPlayers: 4, stake: 10 }];
  res.json({ lobbies });
});

// POST /api/lobby/create
// Diese Funktion legt eine neue Lobby an.
// Erwartet: { maxPlayers: int, stake: float, gameType: string }
// Gibt: { lobbyId: string, status: 'created' }
// Auth: erforderlich
app.post('/api/lobby/create', auth, async (req, res) => {
  try {
    const { maxPlayers, stake, gameType } = req.body;
    if (!maxPlayers || !stake) return res.status(400).json({ error: 'Missing params' });

    const lobby = await gameEngine.createLobby(req.user.id, { maxPlayers, stake, gameType });
    res.status(201).json({ lobbyId: lobby.id, status: 'created' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/lobby/join
// Diese Funktion lässt einen Spieler einer Lobby beitreten.
// Erwartet: { lobbyId: string }
// Gibt: { status: 'joined', players: [...] }
// Auth: erforderlich
app.post('/api/lobby/join', auth, async (req, res) => {
  try {
    const { lobbyId } = req.body;
    if (!lobbyId) return res.status(400).json({ error: 'Missing lobbyId' });

    const lobby = await gameEngine.joinLobby(lobbyId, req.user);
    res.json({ status: 'joined', players: lobby.players });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/round/start
// Diese Funktion startet eine Runde in einer Lobby.
// Erwartet: { lobbyId: string }
// Gibt: { roundId: string, commitHash: string }
// Auth: erforderlich (nur Lobby-Owner)
app.post('/api/round/start', auth, async (req, res) => {
  try {
    const { lobbyId } = req.body;
    if (!lobbyId) return res.status(400).json({ error: 'Missing lobbyId' });

    const round = gameEngine.startRound(lobbyId);
    res.json({ roundId: round.id, commitHash: round.commit });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/claim
// Diese Funktion registriert einen Claim eines Spielers.
// Erwartet: { lobbyId: string, signature: string }
// Gibt: { status: 'claimed' }
// Auth: erforderlich
app.post('/api/claim', auth, async (req, res) => {
  try {
    const { lobbyId, signature } = req.body;
    if (!lobbyId) return res.status(400).json({ error: 'Missing lobbyId' });

    // Stub: Claim registrieren
    res.json({ status: 'claimed' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
// Erwartet: { lobbyId: string, signature: string }
// Gibt: { status: 'claimed', multiplier: float }
// Auth: erforderlich
app.post('/claim', auth, async (req, res) => {
  try {
    const { lobbyId, signature } = req.body;
    if (!lobbyId || !signature) return res.status(400).json({ error: 'Missing params' });

    await gameEngine.handleClaim(lobbyId, req.user.id, signature);
    res.json({ status: 'claimed' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /round/finalize
// Diese Funktion finalisiert eine Runde und berechnet Payouts.
// Erwartet: { lobbyId: string }
// Gibt: { payouts: [...] }
// Auth: erforderlich
app.post('/round/finalize', auth, async (req, res) => {
  try {
    const { lobbyId } = req.body;
    if (!lobbyId) return res.status(400).json({ error: 'Missing lobbyId' });

    const result = await gameEngine.finalizeRound(lobbyId);
    res.json({ payouts: result.payouts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /replay/:roundId
// Diese Funktion gibt Replay-Daten für eine Runde zurück (für Verifikation).
// Gibt: { commit: string, reveal: string, claims: [...], payouts: [...] }
app.get('/replay/:roundId', async (req, res) => {
  try {
    const { roundId } = req.params;
    const replay = await gameEngine.getReplay(roundId);
    res.json(replay);
  } catch (e) {
    res.status(404).json({ error: 'Round not found' });
  }
});

// WebSocket Events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-lobby', (lobbyId) => {
    socket.join(lobbyId);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// GameEngine Events weiterleiten
gameEngine.on('lobby:update', (data) => {
  io.to(data.lobbyId).emit('lobby:update', data);
});

gameEngine.on('round:start', (data) => {
  io.to(data.lobbyId).emit('round:start', data);
});

gameEngine.on('round:multiplierUpdate', (data) => {
  io.to(data.lobbyId).emit('round:multiplierUpdate', data);
});

gameEngine.on('player:claimed', (data) => {
  io.to(data.lobbyId).emit('player:claimed', data);
});

gameEngine.on('round:settled', (data) => {
  io.to(data.lobbyId).emit('round:settled', data);
});

// Server starten
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;