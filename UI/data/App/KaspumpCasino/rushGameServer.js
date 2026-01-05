// Rush Game Backend Server
// Handles game logic, player management, and real-time communication

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Game Configuration
const GAME_CONFIG = {
  MAX_PLAYERS: 10,
  BET_AMOUNT: 10, // KAS
  COUNTDOWN_DURATION: 5000, // 5 seconds
  HOUSE_EDGE: 0.01, // 1%
  MIN_CRASH_POINT: 1.01,
  MAX_CRASH_POINT: 100.0
};

// Lobby Management
class Lobby {
  constructor(id, betAmount = GAME_CONFIG.BET_AMOUNT) {
    this.id = id;
    this.betAmount = betAmount;
    this.maxPlayers = GAME_CONFIG.MAX_PLAYERS;
    this.players = [];
    this.status = 'waiting'; // waiting, countdown, playing, finished
    this.gameState = {
      startTime: null,
      currentMultiplier: 1.0,
      crashPoint: null,
      serverSeed: null,
      clientSeed: null,
      seedHash: null
    };
    this.pot = 0;
    this.cashedOutPlayers = [];
  }

  addPlayer(playerData) {
    if (this.players.length >= this.maxPlayers) {
      throw new Error('Lobby is full');
    }

    if (this.status !== 'waiting') {
      throw new Error('Game already started');
    }

    const player = {
      id: playerData.socketId,
      address: playerData.address,
      betAmount: this.betAmount,
      joinedAt: Date.now(),
      status: 'active',
      cashOutMultiplier: null,
      winAmount: null
    };

    this.players.push(player);
    this.pot += this.betAmount;

    console.log(`✅ Player ${player.address} joined lobby ${this.id}`);

    // Auto-start if lobby is full
    if (this.players.length === this.maxPlayers) {
      this.startCountdown();
    }

    return player;
  }

  removePlayer(socketId) {
    const index = this.players.findIndex(p => p.id === socketId);
    if (index > -1) {
      const player = this.players[index];
      this.players.splice(index, 1);
      this.pot -= this.betAmount;
      console.log(`👋 Player ${player.address} left lobby ${this.id}`);
      return player;
    }
    return null;
  }

  startCountdown() {
    if (this.status !== 'waiting') return;

    console.log(`⏰ Countdown started for lobby ${this.id}`);
    this.status = 'countdown';

    setTimeout(() => {
      this.startGame();
    }, GAME_CONFIG.COUNTDOWN_DURATION);
  }

  startGame() {
    console.log(`🚀 Game started in lobby ${this.id}`);
    this.status = 'playing';

    // Generate provably fair seed
    this.gameState.serverSeed = crypto.randomBytes(32).toString('hex');
    this.gameState.clientSeed = crypto.randomBytes(16).toString('hex');
    this.gameState.seedHash = crypto
      .createHash('sha256')
      .update(this.gameState.serverSeed)
      .digest('hex');

    // Calculate crash point
    this.gameState.crashPoint = this.calculateCrashPoint();
    this.gameState.startTime = Date.now();

    console.log(`🎯 Crash point: ${this.gameState.crashPoint}x`);

    // Start game loop
    this.gameLoop();
  }

  calculateCrashPoint() {
    const combined = `${this.gameState.serverSeed}:${this.gameState.clientSeed}:0`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    const hex = hash.substring(0, 8);
    const decimal = parseInt(hex, 16);
    
    const value = decimal / 0xFFFFFFFF;
    const houseEdge = GAME_CONFIG.HOUSE_EDGE;
    
    const crashPoint = Math.max(
      GAME_CONFIG.MIN_CRASH_POINT,
      Math.min(
        GAME_CONFIG.MAX_CRASH_POINT,
        Math.pow(1 - houseEdge, -1) * Math.pow(value, -1)
      )
    );
    
    return Math.round(crashPoint * 100) / 100;
  }

  gameLoop() {
    const gameInterval = setInterval(() => {
      if (this.status !== 'playing') {
        clearInterval(gameInterval);
        return;
      }

      const elapsed = (Date.now() - this.gameState.startTime) / 1000;
      const multiplier = 1 + Math.pow(elapsed, 1.8) * 0.1;
      this.gameState.currentMultiplier = Math.round(multiplier * 100) / 100;

      // Broadcast update
      io.to(this.id).emit('game:update', {
        lobbyId: this.id,
        status: this.status,
        currentMultiplier: this.gameState.currentMultiplier,
        pot: this.pot,
        players: this.players.map(p => ({
          id: p.id,
          address: p.address,
          status: p.status,
          cashOutMultiplier: p.cashOutMultiplier,
          winAmount: p.winAmount
        })),
        elapsedTime: elapsed * 1000
      });

      // Check if game should crash
      if (this.gameState.currentMultiplier >= this.gameState.crashPoint) {
        this.crashGame();
        clearInterval(gameInterval);
      }
    }, 50); // Update every 50ms
  }

  crashGame() {
    console.log(`💥 Game crashed at ${this.gameState.crashPoint}x in lobby ${this.id}`);
    this.status = 'finished';

    // Mark remaining players as lost
    this.players.forEach(player => {
      if (player.status === 'active') {
        player.status = 'lost';
      }
    });

    // Broadcast crash
    io.to(this.id).emit('game:crashed', {
      lobbyId: this.id,
      crashPoint: this.gameState.crashPoint,
      serverSeed: this.gameState.serverSeed,
      clientSeed: this.gameState.clientSeed,
      seedHash: this.gameState.seedHash,
      players: this.players,
      cashedOut: this.cashedOutPlayers.length,
      lost: this.players.filter(p => p.status === 'lost').length
    });

    // Reset lobby after 5 seconds
    setTimeout(() => {
      this.reset();
    }, 5000);
  }

  cashOut(socketId, multiplier) {
    const player = this.players.find(p => p.id === socketId);
    
    if (!player) {
      throw new Error('Player not found');
    }

    if (player.status !== 'active') {
      throw new Error('Player already cashed out or lost');
    }

    if (this.status !== 'playing') {
      throw new Error('Game not running');
    }

    // Calculate winnings
    const winAmount = player.betAmount * multiplier;
    player.status = 'cashed-out';
    player.cashOutMultiplier = multiplier;
    player.winAmount = winAmount;

    this.cashedOutPlayers.push({
      ...player,
      cashOutTime: Date.now()
    });

    this.pot -= winAmount;

    console.log(`💰 Player ${player.address} cashed out at ${multiplier}x for ${winAmount} KAS`);

    // Broadcast cash out
    io.to(this.id).emit('player:cashedOut', {
      id: player.id,
      address: player.address,
      multiplier,
      winAmount,
      timestamp: Date.now()
    });

    return player;
  }

  reset() {
    console.log(`🔄 Resetting lobby ${this.id}`);
    this.players = [];
    this.status = 'waiting';
    this.gameState = {
      startTime: null,
      currentMultiplier: 1.0,
      crashPoint: null,
      serverSeed: null,
      clientSeed: null,
      seedHash: null
    };
    this.pot = 0;
    this.cashedOutPlayers = [];

    io.to(this.id).emit('lobby:reset', { lobbyId: this.id });
  }

  getInfo() {
    return {
      id: this.id,
      playerCount: this.players.length,
      maxPlayers: this.maxPlayers,
      betAmount: this.betAmount,
      status: this.status === 'waiting' ? 'open' : this.status === 'playing' ? 'playing' : 'full',
      pot: this.pot
    };
  }
}

// Lobby Manager
const lobbies = new Map();

function createLobby(betAmount) {
  const lobbyId = `lobby-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const lobby = new Lobby(lobbyId, betAmount);
  lobbies.set(lobbyId, lobby);
  console.log(`🏗️ Created lobby ${lobbyId}`);
  return lobby;
}

function getLobby(lobbyId) {
  return lobbies.get(lobbyId);
}

function getAvailableLobbies() {
  return Array.from(lobbies.values())
    .filter(l => l.status === 'waiting' && l.players.length < l.maxPlayers)
    .map(l => l.getInfo());
}

// Create default lobbies
createLobby(10);
createLobby(10);
createLobby(10);

// Socket.IO Events
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on('lobby:list', () => {
    const lobbiesList = getAvailableLobbies();
    socket.emit('lobby:list', lobbiesList);
  });

  socket.on('lobby:create', ({ betAmount, maxPlayers }) => {
    const lobby = createLobby(betAmount || GAME_CONFIG.BET_AMOUNT);
    socket.emit('lobby:created', lobby.getInfo());
  });

  socket.on('lobby:join', ({ lobbyId, address, betAmount }) => {
    try {
      const lobby = getLobby(lobbyId);
      
      if (!lobby) {
        socket.emit('error', { message: 'Lobby not found' });
        return;
      }

      const player = lobby.addPlayer({
        socketId: socket.id,
        address,
        betAmount
      });

      socket.join(lobbyId);
      
      socket.emit('lobby:joined', {
        lobbyId,
        player,
        pot: lobby.pot
      });

      io.to(lobbyId).emit('player:joined', {
        id: player.id,
        address: player.address,
        action: 'joined',
        timestamp: Date.now()
      });

      // Broadcast updated lobby info
      io.emit('lobby:updated', lobby.getInfo());

    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('lobby:leave', ({ lobbyId }) => {
    const lobby = getLobby(lobbyId);
    if (lobby) {
      const player = lobby.removePlayer(socket.id);
      if (player) {
        socket.leave(lobbyId);
        io.to(lobbyId).emit('player:left', {
          id: player.id,
          address: player.address
        });
      }
    }
  });

  socket.on('game:cashout', ({ lobbyId, multiplier }) => {
    try {
      const lobby = getLobby(lobbyId);
      
      if (!lobby) {
        socket.emit('error', { message: 'Lobby not found' });
        return;
      }

      const player = lobby.cashOut(socket.id, multiplier);
      
      socket.emit('game:cashedOut', {
        success: true,
        winAmount: player.winAmount
      });

    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    
    // Remove player from all lobbies
    lobbies.forEach((lobby) => {
      const player = lobby.removePlayer(socket.id);
      if (player) {
        io.to(lobby.id).emit('player:left', {
          id: player.id,
          address: player.address
        });
      }
    });
  });
});

// REST API
app.get('/api/lobbies', (req, res) => {
  const lobbiesList = Array.from(lobbies.values()).map(l => l.getInfo());
  res.json(lobbiesList);
});

app.get('/api/lobby/:id', (req, res) => {
  const lobby = getLobby(req.params.id);
  if (lobby) {
    res.json(lobby.getInfo());
  } else {
    res.status(404).json({ error: 'Lobby not found' });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    lobbies: lobbies.size,
    uptime: process.uptime()
  });
});

// Start server
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`
  ⚡ Rush Game Server started!
  🌐 HTTP API: http://localhost:${PORT}
  🔌 WebSocket: ws://localhost:${PORT}
  🎮 Active lobbies: ${lobbies.size}
  `);
});

module.exports = { app, server, io };
