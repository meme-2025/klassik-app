// gameEngine.js - Erweitertes Spiel-Engine für Klassik Pump
// Diese Klasse orchestriert Lobbies, Runden, Claims und Payouts.
// On-chain-first: Commits und Reveals werden on-chain gehandhabt.
// Erweiterungen: AI-Autorouting, Replay Validator, Stateless Verification

const EventEmitter = require('events');
const crypto = require('crypto');

class GameEngine extends EventEmitter {
  constructor({ db, blockchain, ws }) {
    super();
    this.db = db; // DB Stub
    this.blockchain = blockchain; // Kaspa RPC
    this.ws = ws; // Socket.io
    this.lobbies = new Map();
    this.rounds = new Map();
    this.replayCache = new Map(); // Cache für Replays
  }

  // AI-Autorouting: Classify events and route to queues (stub)
  _routeEvent(eventType, data) {
    if (eventType === 'round:settled') {
      // Route to analytics queue
      console.log('Routed to analytics:', data);
    } else if (eventType.includes('claim')) {
      // Route to streamer/incident queue
      console.log('Routed to streamer:', data);
    }
  }

  // Diese Funktion legt eine Lobby an und persistiert sie.
  async createLobby(ownerId, opts) {
    const lobbyId = crypto.randomUUID();
    const lobby = {
      id: lobbyId,
      ownerId,
      players: [],
      opts,
      status: 'waiting',
      currentRound: null,
    };
    this.lobbies.set(lobbyId, lobby);
    // Persist in DB (stub)
    this.db.lobbies = this.db.lobbies || [];
    this.db.lobbies.push(lobby);
    return lobby;
  }

  // Diese Funktion lässt einen Spieler beitreten, prüft Balance.
  async joinLobby(lobbyId, player) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby || lobby.players.length >= lobby.opts.maxPlayers) {
      throw new Error('Lobby full or not found');
    }
    const balance = await this.verifyBalance(player.id);
    if (balance < lobby.opts.stake) {
      throw new Error('Insufficient balance');
    }
    lobby.players.push(player);
    this.emit('lobby:update', { lobbyId, players: lobby.players });
    return lobby;
  }

  // Diese Funktion startet eine Runde, committet Secret on-chain.
  startRound(lobbyId) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby || lobby.status !== 'waiting') {
      throw new Error('Invalid lobby state');
    }
    const roundId = crypto.randomUUID();
    const secret = crypto.randomBytes(32).toString('hex');
    const commit = crypto.createHash('sha256').update(secret).digest('hex');
    // On-chain commit (stub)
    this.blockchain.commit(commit); // Anpassen für echte TX
    const round = {
      id: roundId,
      lobbyId,
      commit,
      secret, // Später reveal
      claims: [],
      status: 'running',
      multiplier: 1.0,
      startTime: Date.now(),
    };
    this.rounds.set(roundId, round);
    lobby.currentRound = roundId;
    lobby.status = 'running';
    this.emit('round:start', { lobbyId, roundId, commitHash: commit });
    this._routeEvent('round:start', { lobbyId, roundId });
    this._startMultiplierLoop(lobbyId);
    return round;
  }

  // Private Funktion für Multiplier-Loop
  _startMultiplierLoop(lobbyId) {
    const lobby = this.lobbies.get(lobbyId);
    const round = this.rounds.get(lobby.currentRound);
    const interval = setInterval(() => {
      if (round.status !== 'running') {
        clearInterval(interval);
        return;
      }
      round.multiplier += 0.01; // Easing (anpassen)
      this.emit('round:multiplierUpdate', { lobbyId, m: round.multiplier });
    }, 100); // 10x/s
  }

  // Diese Funktion handhabt Claims mit Signature.
  async handleClaim(lobbyId, playerId, signature) {
    const lobby = this.lobbies.get(lobbyId);
    const round = this.rounds.get(lobby.currentRound);
    if (!round || round.status !== 'running') {
      throw new Error('Round not running');
    }
    // Verify signature (stub)
    round.claims.push({ playerId, multiplier: round.multiplier, timestamp: Date.now() });
    this.emit('player:claimed', { lobbyId, playerId, m: round.multiplier });
    this._routeEvent('player:claimed', { lobbyId, playerId });
  }

  // Diese Funktion finalisiert Runde, reveals Secret, berechnet Payouts.
  async finalizeRound(lobbyId) {
    const lobby = this.lobbies.get(lobbyId);
    const round = this.rounds.get(lobby.currentRound);
    if (!round) throw new Error('No round');
    // Reveal on-chain (stub)
    const reveal = round.secret;
    this.blockchain.reveal(reveal);
    // RNG: H(secret || blockhash)
    const blockhash = await this.blockchain.getBlockHash(); // Stub
    const rng = crypto.createHash('sha256').update(reveal + blockhash).digest('hex');
    // Bust logic (stub: if rng < threshold, bust)
    round.status = 'settled';
    const payouts = this._computePayouts(round, lobby.players);
    // Distribute (on-chain TX stub)
    this.emit('round:settled', { lobbyId, payouts });
    this._routeEvent('round:settled', { lobbyId, payouts });
    lobby.status = 'waiting';
    // Cache replay
    this.replayCache.set(round.id, {
      commit: round.commit,
      reveal,
      claims: round.claims,
      payouts,
      blockhash,
    });
    return { payouts };
  }

  // Private Funktion für Payout-Berechnung
  _computePayouts(round, players) {
    const pool = players.length * round.stake; // Stub stake
    const fee = pool * 0.001; // 10 bps
    const netPool = pool - fee;
    const claims = round.claims;
    if (claims.length === 0) return []; // House wins
    // Simple: equal share for claimants
    const share = netPool / claims.length;
    return claims.map(c => ({ playerId: c.playerId, amount: share }));
  }

  // Diese Funktion prüft Balance (on-chain/off-chain).
  async verifyBalance(playerId) {
    // Stub: return 1000
    return 1000;
  }

  // Diese Funktion gibt Replay-Daten zurück.
  async getReplay(roundId) {
    const round = this.rounds.get(roundId);
    if (!round) throw new Error('Round not found');
    return {
      commit: round.commit,
      reveal: round.secret,
      claims: round.claims,
      payouts: this._computePayouts(round, []), // Stub
    };
  }

  // Stateless Replay Validator: Given event list + reveal, compute payouts
  validateReplay(eventList, reveal, blockhash) {
    // Reconstruct round from events
    const claims = eventList.filter(e => e.type === 'claim');
    const players = eventList.filter(e => e.type === 'join').map(e => e.player);
    const stake = 10; // Stub
    const pool = players.length * stake;
    const fee = pool * 0.001;
    const netPool = pool - fee;
    const rng = crypto.createHash('sha256').update(reveal + blockhash).digest('hex');
    // Assume no bust for simplicity
    const payouts = claims.length > 0 ? claims.map(c => ({ playerId: c.playerId, amount: netPool / claims.length })) : [];
    return { payouts, valid: true }; // Always valid in stub
  }
}

module.exports = GameEngine;