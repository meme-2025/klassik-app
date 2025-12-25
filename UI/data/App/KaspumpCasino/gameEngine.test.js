// gameEngine.test.js - Unit Tests für GameEngine
// Nutzt Jest für Tests, KI-generierte Testdaten für Edgecases.

const GameEngine = require('./gameEngine');

describe('GameEngine', () => {
  let engine;
  let mockDb;
  let mockBlockchain;
  let mockWs;

  beforeEach(() => {
    mockDb = {};
    mockBlockchain = {
      commit: jest.fn(),
      reveal: jest.fn(),
      getBlockHash: jest.fn().mockResolvedValue('mockBlockHash'),
    };
    mockWs = { emit: jest.fn() };
    engine = new GameEngine({ db: mockDb, blockchain: mockBlockchain, ws: mockWs });
  });

  test('createLobby sollte eine neue Lobby erstellen', async () => {
    const lobby = await engine.createLobby('owner1', { maxPlayers: 4, stake: 10 });
    expect(lobby.id).toBeDefined();
    expect(lobby.ownerId).toBe('owner1');
    expect(lobby.opts.maxPlayers).toBe(4);
  });

  test('joinLobby sollte Spieler hinzufügen, wenn Balance ausreicht', async () => {
    const lobby = await engine.createLobby('owner1', { maxPlayers: 4, stake: 10 });
    const player = { id: 'player1' };
    const result = await engine.joinLobby(lobby.id, player);
    expect(result.players).toContain(player);
  });

  test('joinLobby sollte Fehler werfen, wenn Balance zu niedrig', async () => {
    const lobby = await engine.createLobby('owner1', { maxPlayers: 4, stake: 10000 });
    const player = { id: 'player1' };
    await expect(engine.joinLobby(lobby.id, player)).rejects.toThrow('Insufficient balance');
  });

  test('startRound sollte Runde starten und commit on-chain', () => {
    const lobby = { id: 'lobby1', status: 'waiting', players: [{ id: 'p1' }, { id: 'p2' }] };
    engine.lobbies.set('lobby1', lobby);
    const round = engine.startRound('lobby1');
    expect(round.commit).toBeDefined();
    expect(mockBlockchain.commit).toHaveBeenCalledWith(round.commit);
  });

  test('handleClaim sollte Claim registrieren', async () => {
    const lobby = { id: 'lobby1', status: 'running', currentRound: 'round1' };
    const round = { id: 'round1', status: 'running', claims: [], multiplier: 1.5 };
    engine.lobbies.set('lobby1', lobby);
    engine.rounds.set('round1', round);
    await engine.handleClaim('lobby1', 'player1', 'signature');
    expect(round.claims).toHaveLength(1);
    expect(round.claims[0].playerId).toBe('player1');
  });

  test('finalizeRound sollte Payouts berechnen und reveal', async () => {
    const lobby = { id: 'lobby1', status: 'running', currentRound: 'round1', players: [{ id: 'p1' }, { id: 'p2' }] };
    const round = { id: 'round1', status: 'running', claims: [{ playerId: 'p1', multiplier: 2.0 }], stake: 10 };
    engine.lobbies.set('lobby1', lobby);
    engine.rounds.set('round1', round);
    const result = await engine.finalizeRound('lobby1');
    expect(result.payouts).toBeDefined();
    expect(mockBlockchain.reveal).toHaveBeenCalled();
  });

  // KI-generierte Edgecase Tests
  test('Edgecase: Niemand claimt - House gewinnt', async () => {
    const lobby = { id: 'lobby1', status: 'running', currentRound: 'round1', players: [{ id: 'p1' }] };
    const round = { id: 'round1', status: 'running', claims: [], stake: 10 };
    engine.lobbies.set('lobby1', lobby);
    engine.rounds.set('round1', round);
    const result = await engine.finalizeRound('lobby1');
    expect(result.payouts).toHaveLength(0); // House wins
  });

  test('Edgecase: Alle claimen gleichzeitig - gleiche Anteile', async () => {
    const lobby = { id: 'lobby1', status: 'running', currentRound: 'round1', players: [{ id: 'p1' }, { id: 'p2' }] };
    const round = { id: 'round1', status: 'running', claims: [
      { playerId: 'p1', multiplier: 2.0 },
      { playerId: 'p2', multiplier: 2.0 }
    ], stake: 10 };
    engine.lobbies.set('lobby1', lobby);
    engine.rounds.set('round1', round);
    const result = await engine.finalizeRound('lobby1');
    expect(result.payouts).toHaveLength(2);
    expect(result.payouts[0].amount).toBe(result.payouts[1].amount); // Equal shares
  });

  test('getReplay sollte Replay-Daten zurückgeben', async () => {
    const round = { id: 'round1', commit: 'hash', secret: 'secret', claims: [], stake: 10 };
    engine.rounds.set('round1', round);
    const replay = await engine.getReplay('round1');
    expect(replay.commit).toBe('hash');
    expect(replay.reveal).toBe('secret');
  });
});