/**
 * Unit Tests - Rush Game Server Logic
 * Tests game mechanics, provably fair, and lobby management
 */

const crypto = require('crypto');

describe('Rush Game - Provably Fair System', () => {
  
  /**
   * Generate crash point using provably fair algorithm
   */
  function generateCrashPoint(serverSeed, clientSeed, houseEdge = 0.01) {
    const combinedSeed = serverSeed + clientSeed;
    const hash = crypto.createHash('sha256').update(combinedSeed).digest('hex');
    
    const hashNumber = parseInt(hash.substring(0, 8), 16);
    const maxNumber = 0xFFFFFFFF;
    
    const result = (1 - houseEdge) / (1 - (hashNumber / maxNumber));
    return Math.max(1.01, Math.min(100.0, result));
  }

  test('should generate deterministic crash point', () => {
    const serverSeed = 'test-server-seed-123';
    const clientSeed = 'test-client-seed-456';
    
    const crashPoint1 = generateCrashPoint(serverSeed, clientSeed);
    const crashPoint2 = generateCrashPoint(serverSeed, clientSeed);
    
    expect(crashPoint1).toBe(crashPoint2); // Same seeds = same result
    expect(crashPoint1).toBeGreaterThanOrEqual(1.01);
    expect(crashPoint1).toBeLessThanOrEqual(100.0);
  });

  test('should generate different results for different seeds', () => {
    const serverSeed = 'server-seed-1';
    const clientSeed1 = 'client-seed-1';
    const clientSeed2 = 'client-seed-2';
    
    const crashPoint1 = generateCrashPoint(serverSeed, clientSeed1);
    const crashPoint2 = generateCrashPoint(serverSeed, clientSeed2);
    
    expect(crashPoint1).not.toBe(crashPoint2);
  });

  test('should respect house edge', () => {
    const serverSeed = 'test-seed';
    const clientSeed = 'client-seed';
    
    const results = [];
    
    // Generate 1000 crash points
    for (let i = 0; i < 1000; i++) {
      const seed = serverSeed + i;
      const crashPoint = generateCrashPoint(seed, clientSeed, 0.01);
      results.push(crashPoint);
    }
    
    // Calculate average expected value
    const averageMultiplier = results.reduce((sum, cp) => sum + cp, 0) / results.length;
    
    // With 1% house edge, average should be close to 0.99
    expect(averageMultiplier).toBeLessThan(1.0);
    expect(averageMultiplier).toBeGreaterThan(0.9); // Variance expected
  });

  test('should handle edge cases in hash generation', () => {
    const testCases = [
      { serverSeed: '', clientSeed: '' },
      { serverSeed: 'a', clientSeed: 'b' },
      { serverSeed: 'x'.repeat(100), clientSeed: 'y'.repeat(100) }
    ];
    
    testCases.forEach(({ serverSeed, clientSeed }) => {
      const crashPoint = generateCrashPoint(serverSeed, clientSeed);
      
      expect(crashPoint).toBeGreaterThanOrEqual(1.01);
      expect(crashPoint).toBeLessThanOrEqual(100.0);
      expect(typeof crashPoint).toBe('number');
      expect(isNaN(crashPoint)).toBe(false);
    });
  });
});

describe('Rush Game - Multiplier Calculation', () => {
  
  /**
   * Calculate multiplier based on time elapsed
   */
  function calculateMultiplier(timeInSeconds) {
    const base = 1;
    const exponent = 1.8;
    const coefficient = 0.1;
    
    return base + Math.pow(timeInSeconds, exponent) * coefficient;
  }

  test('should start at 1.0x', () => {
    const multiplier = calculateMultiplier(0);
    expect(multiplier).toBe(1.0);
  });

  test('should increase exponentially', () => {
    const multipliers = [
      calculateMultiplier(1),
      calculateMultiplier(2),
      calculateMultiplier(3),
      calculateMultiplier(5),
      calculateMultiplier(10)
    ];
    
    // Each multiplier should be greater than the previous
    for (let i = 1; i < multipliers.length; i++) {
      expect(multipliers[i]).toBeGreaterThan(multipliers[i - 1]);
    }
  });

  test('should match expected values', () => {
    expect(calculateMultiplier(1)).toBeCloseTo(1.1, 1);
    expect(calculateMultiplier(5)).toBeCloseTo(2.44, 1);
    expect(calculateMultiplier(10)).toBeCloseTo(7.31, 1);
  });
});

describe('Rush Game - Pot & Payout Calculation', () => {
  
  test('should calculate correct pot size', () => {
    const betAmount = 0.1; // KAS
    const playerCount = 10;
    const expectedPot = betAmount * playerCount;
    
    expect(expectedPot).toBe(1.0);
  });

  test('should calculate player winnings correctly', () => {
    const betAmount = 0.1;
    const cashOutMultiplier = 2.5;
    const winAmount = betAmount * cashOutMultiplier;
    
    expect(winAmount).toBe(0.25);
  });

  test('should calculate house profit correctly', () => {
    const pot = 1.0; // 10 players × 0.1 KAS
    const payouts = [
      { amount: 0.15 }, // 1.5x
      { amount: 0.20 }, // 2.0x
      { amount: 0.35 }  // 3.5x
    ];
    
    const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0);
    const houseProfit = pot - totalPayouts;
    
    expect(totalPayouts).toBe(0.70);
    expect(houseProfit).toBe(0.30);
    expect(houseProfit).toBeGreaterThan(0); // House should always profit
  });

  test('should handle worst case (all players cash out high)', () => {
    const pot = 1.0;
    const worstCasePayouts = Array(10).fill({ amount: 0.10 * 5.0 }); // All 5x
    const totalPayouts = worstCasePayouts.reduce((sum, p) => sum + p.amount, 0);
    const houseProfit = pot - totalPayouts;
    
    expect(totalPayouts).toBe(5.0);
    expect(houseProfit).toBe(-4.0); // House loses in this edge case
    
    // This should be extremely rare with provably fair system
  });
});

describe('Rush Game - Player Management', () => {
  
  class SimpleLobby {
    constructor() {
      this.players = new Map();
      this.maxPlayers = 10;
      this.pot = 0;
      this.betAmount = 0.1;
    }
    
    addPlayer(socketId, address) {
      if (this.players.size >= this.maxPlayers) {
        throw new Error('Lobby is full');
      }
      
      const player = {
        id: socketId,
        address,
        betAmount: this.betAmount,
        status: 'active'
      };
      
      this.players.set(socketId, player);
      this.pot += this.betAmount;
      
      return player;
    }
    
    removePlayer(socketId) {
      const player = this.players.get(socketId);
      if (player) {
        this.players.delete(socketId);
        this.pot -= this.betAmount;
      }
      return player;
    }
  }

  test('should add players to lobby', () => {
    const lobby = new SimpleLobby();
    
    lobby.addPlayer('socket1', 'kaspa:address1');
    lobby.addPlayer('socket2', 'kaspa:address2');
    
    expect(lobby.players.size).toBe(2);
    expect(lobby.pot).toBe(0.2);
  });

  test('should not exceed max players', () => {
    const lobby = new SimpleLobby();
    
    for (let i = 0; i < 10; i++) {
      lobby.addPlayer(`socket${i}`, `kaspa:address${i}`);
    }
    
    expect(() => {
      lobby.addPlayer('socket11', 'kaspa:address11');
    }).toThrow('Lobby is full');
  });

  test('should remove players correctly', () => {
    const lobby = new SimpleLobby();
    
    lobby.addPlayer('socket1', 'kaspa:address1');
    lobby.addPlayer('socket2', 'kaspa:address2');
    
    const removed = lobby.removePlayer('socket1');
    
    expect(removed).toBeDefined();
    expect(lobby.players.size).toBe(1);
    expect(lobby.pot).toBe(0.1);
  });
});
