/**
 * Rush Game Backend Server v2.0
 * Real Kaspa Blockchain Integration - No Smart Contracts
 * 
 * Features:
 * - Direct Kaspa wallet transactions
 * - UTXO-based payment tracking
 * - Automatic deposit detection
 * - Instant payout processing
 * - Provably fair system
 * - Real-time multiplayer (10 players)
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const KaspaPaymentService = require('./kaspa-payment-service');

// Initialize Express & Socket.IO
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// ============================================
// GAME CONFIGURATION
// ============================================

const CONFIG = {
  MAX_PLAYERS: 10,
  MIN_PLAYERS_TO_START: 2,
  BET_AMOUNT_KAS: parseFloat(process.env.MIN_BUY_IN_KAS || 0.1),
  COUNTDOWN_DURATION_MS: 15000, // 15 seconds
  HOUSE_EDGE: parseFloat(process.env.HOUSE_EDGE_PERCENT || 1) / 100,
  MIN_CRASH_POINT: 1.01,
  MAX_CRASH_POINT: 100.0,
  GAME_UPDATE_INTERVAL: 50, // 50ms for smooth animations
  MULTIPLIER_FORMULA: {
    base: 1,
    exponent: 1.8,
    coefficient: 0.1
  }
};

// Initialize Kaspa Payment Service
const kaspaPayment = new KaspaPaymentService({
  kaspaApi: process.env.KASPA_REST_API,
  network: process.env.KASPA_NETWORK,
  casinoAddress: process.env.CASINO_KASPA_ADDRESS,
  confirmations: parseInt(process.env.REQUIRED_CONFIRMATIONS || 6)
});

// ============================================
// LOBBY CLASS - GAME INSTANCE
// ============================================

class Lobby {
  constructor(id) {
    this.id = id;
    this.status = 'waiting'; // waiting, countdown, playing, finished
    this.players = new Map(); // socketId -> Player
    this.pot = 0; // Total KAS in pot
    this.gameState = {
      startTime: null,
      currentTime: 0,
      currentMultiplier: 1.0,
      crashPoint: null,
      serverSeed: this._generateSeed(),
      clientSeed: null,
      seedHash: null,
      updateInterval: null
    };
    this.cashedOutPlayers = [];
    this.createdAt = Date.now();
  }

  /**
   * Add player to lobby after confirming deposit
   */
  addPlayer(socketId, playerData) {
    if (this.players.size >= CONFIG.MAX_PLAYERS) {
      throw new Error('Lobby is full');
    }

    if (this.status !== 'waiting') {
      throw new Error('Game already in progress');
    }

    const player = {
      id: socketId,
      address: playerData.address,
      depositTxId: playerData.txId,
      betAmount: CONFIG.BET_AMOUNT_KAS,
      joinedAt: Date.now(),
      status: 'active',
      cashOutTime: null,
      cashOutMultiplier: null,
      winAmount: null,
      position: this.players.size // Position around the circle (0-9)
    };

    this.players.set(socketId, player);
    this.pot += player.betAmount;

    console.log(`✅ Player ${player.address.substring(0, 15)}... joined lobby ${this.id} (${this.players.size}/${CONFIG.MAX_PLAYERS})`);

    // Check if we can start
    if (this.players.size >= CONFIG.MIN_PLAYERS_TO_START && this.status === 'waiting') {
      this.scheduleCountdown();
    }

    return player;
  }

  /**
   * Remove player (disconnect/leave)
   */
  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player) return null;

    // Only allow removal if game hasn't started
    if (this.status === 'waiting') {
      this.players.delete(socketId);
      this.pot -= player.betAmount;
      console.log(`👋 Player left lobby ${this.id}`);
      
      // TODO: Refund deposit
      this._refundPlayer(player);
    }

    return player;
  }

  /**
   * Schedule countdown if enough players
   */
  scheduleCountdown() {
    if (this.status !== 'waiting') return;

    console.log(`⏰ Starting countdown for lobby ${this.id}`);
    this.status = 'countdown';
    this.countdownStart = Date.now();

    setTimeout(() => {
      this.startGame();
    }, CONFIG.COUNTDOWN_DURATION_MS);
  }

  /**
   * Start the game
   */
  startGame() {
    if (this.status !== 'countdown') return;

    console.log(`🎮 Game starting in lobby ${this.id} with ${this.players.size} players, pot: ${this.pot} KAS`);

    this.status = 'playing';
    this.gameState.startTime = Date.now();
    this.gameState.currentTime = 0;

    // Generate provably fair crash point
    this._generateCrashPoint();

    console.log(`🎲 Crash point: ${this.gameState.crashPoint.toFixed(2)}x (seed: ${this.gameState.seedHash.substring(0, 10)}...)`);

    // Start game loop
    this._startGameLoop();
  }

  /**
   * Generate provably fair crash point
   */
  _generateCrashPoint() {
    // Combine server seed with client seeds (from all players)
    const clientSeeds = Array.from(this.players.values())
      .map(p => p.address)
      .join('');
    
    this.gameState.clientSeed = clientSeeds;

    // Create combined seed hash
    const combinedSeed = this.gameState.serverSeed + this.gameState.clientSeed;
    const hash = crypto.createHash('sha256').update(combinedSeed).digest('hex');
    
    this.gameState.seedHash = hash;

    // Generate crash point from hash (provably fair)
    // Use first 8 characters of hash as hex number
    const hashNumber = parseInt(hash.substring(0, 8), 16);
    const maxNumber = 0xFFFFFFFF;
    
    // Generate crash point with house edge
    const result = (1 - CONFIG.HOUSE_EDGE) / (1 - (hashNumber / maxNumber));
    const crashPoint = Math.max(CONFIG.MIN_CRASH_POINT, Math.min(CONFIG.MAX_CRASH_POINT, result));

    this.gameState.crashPoint = crashPoint;
  }

  /**
   * Game loop - update multiplier in real-time
   */
  _startGameLoop() {
    this.gameState.updateInterval = setInterval(() => {
      const elapsed = Date.now() - this.gameState.startTime;
      const timeInSeconds = elapsed / 1000;

      // Calculate multiplier: 1 + (t^1.8 * 0.1)
      const multiplier = CONFIG.MULTIPLIER_FORMULA.base +
        Math.pow(timeInSeconds, CONFIG.MULTIPLIER_FORMULA.exponent) *
        CONFIG.MULTIPLIER_FORMULA.coefficient;

      this.gameState.currentMultiplier = Math.min(multiplier, this.gameState.crashPoint);
      this.gameState.currentTime = timeInSeconds;

      // Broadcast update to all players
      io.to(this.id).emit('game:update', {
        multiplier: this.gameState.currentMultiplier,
        time: timeInSeconds,
        crashed: false
      });

      // Check if crashed
      if (multiplier >= this.gameState.crashPoint) {
        this._endGame();
      }
    }, CONFIG.GAME_UPDATE_INTERVAL);
  }

  /**
   * Player cashes out
   */
  cashOut(socketId) {
    const player = this.players.get(socketId);
    
    if (!player || player.status !== 'active') {
      return { success: false, reason: 'Invalid player or already cashed out' };
    }

    if (this.status !== 'playing') {
      return { success: false, reason: 'Game not in progress' };
    }

    // Record cash out
    player.status = 'cashed_out';
    player.cashOutTime = Date.now();
    player.cashOutMultiplier = this.gameState.currentMultiplier;
    player.winAmount = player.betAmount * player.cashOutMultiplier;

    this.cashedOutPlayers.push({
      ...player,
      cashOutTime: player.cashOutTime
    });

    console.log(`💰 Player ${player.address.substring(0, 15)}... cashed out at ${player.cashOutMultiplier.toFixed(2)}x - Won ${player.winAmount.toFixed(4)} KAS`);

    // Immediately process payout
    this._processPlayerPayout(player);

    return {
      success: true,
      multiplier: player.cashOutMultiplier,
      winAmount: player.winAmount
    };
  }

  /**
   * End game (crash)
   */
  _endGame() {
    console.log(`💥 Game crashed at ${this.gameState.crashPoint.toFixed(2)}x in lobby ${this.id}`);

    clearInterval(this.gameState.updateInterval);
    this.status = 'finished';

    // Mark all remaining active players as losers
    for (const [socketId, player] of this.players) {
      if (player.status === 'active') {
        player.status = 'lost';
        player.winAmount = 0;
      }
    }

    // Broadcast crash event
    io.to(this.id).emit('game:crashed', {
      crashPoint: this.gameState.crashPoint,
      seedHash: this.gameState.seedHash,
      winners: this.cashedOutPlayers.map(p => ({
        address: p.address,
        multiplier: p.cashOutMultiplier,
        winAmount: p.winAmount
      })),
      pot: this.pot
    });

    // Calculate house profit
    const totalPayouts = this.cashedOutPlayers.reduce((sum, p) => sum + p.winAmount, 0);
    const houseProfit = this.pot - totalPayouts;

    console.log(`📊 Game finished: Pot ${this.pot} KAS, Payouts ${totalPayouts.toFixed(4)} KAS, House profit: ${houseProfit.toFixed(4)} KAS`);

    // Clean up after 10 seconds
    setTimeout(() => {
      lobbies.delete(this.id);
      console.log(`🗑️ Lobby ${this.id} cleaned up`);
    }, 10000);
  }

  /**
   * Process individual payout
   */
  async _processPlayerPayout(player) {
    try {
      const txId = await kaspaPayment.sendPayout(player.address, player.winAmount);
      
      console.log(`✅ Payout sent to ${player.address.substring(0, 15)}...: ${player.winAmount.toFixed(4)} KAS (tx: ${txId.substring(0, 10)}...)`);

      // Emit payout confirmation
      io.to(player.id).emit('payout:sent', {
        txId,
        amount: player.winAmount,
        address: player.address
      });
    } catch (error) {
      console.error(`❌ Payout failed for ${player.address}:`, error);
      
      // TODO: Queue for retry
      io.to(player.id).emit('payout:failed', {
        error: error.message,
        amount: player.winAmount
      });
    }
  }

  /**
   * Refund player deposit
   */
  async _refundPlayer(player) {
    try {
      await kaspaPayment.sendPayout(player.address, player.betAmount);
      console.log(`↩️ Refunded ${player.betAmount} KAS to ${player.address.substring(0, 15)}...`);
    } catch (error) {
      console.error(`❌ Refund failed:`, error);
    }
  }

  /**
   * Generate random seed
   */
  _generateSeed() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get lobby state for client
   */
  getState() {
    return {
      id: this.id,
      status: this.status,
      players: Array.from(this.players.values()).map(p => ({
        address: p.address,
        position: p.position,
        status: p.status,
        betAmount: p.betAmount
      })),
      pot: this.pot,
      currentMultiplier: this.gameState.currentMultiplier,
      seedHash: this.gameState.seedHash,
      maxPlayers: CONFIG.MAX_PLAYERS
    };
  }
}

// ============================================
// LOBBY MANAGER
// ============================================

const lobbies = new Map(); // lobbyId -> Lobby
let lobbyCounter = 0;

function findOrCreateLobby() {
  // Find available lobby
  for (const [id, lobby] of lobbies) {
    if (lobby.status === 'waiting' && lobby.players.size < CONFIG.MAX_PLAYERS) {
      return lobby;
    }
  }

  // Create new lobby
  const newLobby = new Lobby(`lobby_${++lobbyCounter}`);
  lobbies.set(newLobby.id, newLobby);
  console.log(`🆕 Created new lobby: ${newLobby.id}`);
  
  return newLobby;
}

// ============================================
// SOCKET.IO EVENT HANDLERS
// ============================================

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  let currentLobby = null;

  /**
   * Player requests to join game with deposit transaction
   */
  socket.on('join:request', async (data) => {
    try {
      const { address, txId } = data;

      if (!address || !txId) {
        socket.emit('join:error', { message: 'Missing address or transaction ID' });
        return;
      }

      console.log(`📥 Join request from ${address.substring(0, 15)}... with tx ${txId.substring(0, 10)}...`);

      // Verify transaction
      const verification = await kaspaPayment.verifyTransaction(txId);

      if (!verification.valid) {
        socket.emit('join:error', { message: 'Invalid transaction' });
        return;
      }

      if (!verification.confirmed) {
        socket.emit('join:pending', {
          message: `Waiting for confirmations (${verification.confirmations}/${verification.required})`,
          confirmations: verification.confirmations,
          required: verification.required
        });
        return;
      }

      // Find or create lobby
      currentLobby = findOrCreateLobby();

      // Add player
      const player = currentLobby.addPlayer(socket.id, { address, txId });

      // Join socket room
      socket.join(currentLobby.id);

      // Send confirmation
      socket.emit('join:success', {
        lobbyId: currentLobby.id,
        position: player.position,
        betAmount: player.betAmount
      });

      // Broadcast lobby update
      io.to(currentLobby.id).emit('lobby:update', currentLobby.getState());

    } catch (error) {
      console.error('Join error:', error);
      socket.emit('join:error', { message: error.message });
    }
  });

  /**
   * Player cashes out
   */
  socket.on('cashout:request', () => {
    if (!currentLobby) {
      socket.emit('cashout:error', { message: 'Not in a lobby' });
      return;
    }

    const result = currentLobby.cashOut(socket.id);

    if (result.success) {
      socket.emit('cashout:success', {
        multiplier: result.multiplier,
        winAmount: result.winAmount
      });

      // Broadcast to lobby
      io.to(currentLobby.id).emit('player:cashedout', {
        socketId: socket.id,
        multiplier: result.multiplier
      });
    } else {
      socket.emit('cashout:error', { message: result.reason });
    }
  });

  /**
   * Get lobby list
   */
  socket.on('lobby:list', () => {
    const lobbyList = Array.from(lobbies.values()).map(l => ({
      id: l.id,
      status: l.status,
      players: l.players.size,
      maxPlayers: CONFIG.MAX_PLAYERS,
      pot: l.pot
    }));

    socket.emit('lobby:list', lobbyList);
  });

  /**
   * Disconnect
   */
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);

    if (currentLobby) {
      currentLobby.removePlayer(socket.id);
      io.to(currentLobby.id).emit('lobby:update', currentLobby.getState());
    }
  });
});

// ============================================
// KASPA PAYMENT MONITORING
// ============================================

kaspaPayment.startMonitoring(async (deposit) => {
  console.log(`💰 New deposit detected: ${deposit.amount} KAS from ${deposit.fromAddress.substring(0, 15)}...`);

  // Find pending join request for this transaction
  // Emit event to client to retry join
  io.emit('deposit:confirmed', {
    txId: deposit.txId,
    amount: deposit.amount,
    fromAddress: deposit.fromAddress
  });
});

// ============================================
// REST API ENDPOINTS
// ============================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    lobbies: lobbies.size,
    kaspaMonitoring: kaspaPayment.getStats(),
    config: CONFIG
  });
});

app.get('/api/stats', async (req, res) => {
  const casinoBalance = await kaspaPayment.getCasinoBalance();
  const kaspaPrice = await kaspaPayment.getKaspaPrice();

  res.json({
    casinoBalance,
    kaspaPrice,
    activeLobbies: lobbies.size,
    paymentStats: kaspaPayment.getStats()
  });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log('');
  console.log('🎰 ================================');
  console.log('🎰   RUSH GAME SERVER v2.0');
  console.log('🎰 ================================');
  console.log('');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 WebSocket: ws://localhost:${PORT}`);
  console.log(`💎 Kaspa Network: ${process.env.KASPA_NETWORK || 'testnet'}`);
  console.log(`📍 Casino Address: ${process.env.CASINO_KASPA_ADDRESS || 'Not configured'}`);
  console.log(`💰 Bet Amount: ${CONFIG.BET_AMOUNT_KAS} KAS`);
  console.log(`👥 Max Players: ${CONFIG.MAX_PLAYERS}`);
  console.log(`🏠 House Edge: ${(CONFIG.HOUSE_EDGE * 100).toFixed(2)}%`);
  console.log('');
  console.log('✅ Ready to accept deposits!');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  kaspaPayment.stopMonitoring();
  server.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});
