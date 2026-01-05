// Provably Fair System for Rush Game
// Implements cryptographic verification of game fairness

import crypto from 'crypto';

export interface GameSeed {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  hash: string;
}

export interface GameResult {
  crashPoint: number;
  seed: GameSeed;
  verifiable: boolean;
}

/**
 * Provably Fair System
 * Ensures that the game outcome is predetermined and cannot be manipulated
 */
class ProvablyFairSystem {
  /**
   * Generate server seed (hidden until game ends)
   */
  generateServerSeed(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate client seed (provided by player or random)
   */
  generateClientSeed(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Create hash of server seed (shown before game starts)
   */
  createSeedHash(serverSeed: string): string {
    return crypto
      .createHash('sha256')
      .update(serverSeed)
      .digest('hex');
  }

  /**
   * Combine seeds and nonce to generate game outcome
   */
  generateCrashPoint(serverSeed: string, clientSeed: string, nonce: number): number {
    // Combine seeds with nonce
    const combined = `${serverSeed}:${clientSeed}:${nonce}`;
    
    // Generate hash
    const hash = crypto
      .createHash('sha256')
      .update(combined)
      .digest('hex');
    
    // Convert first 8 hex characters to number
    const hex = hash.substring(0, 8);
    const decimal = parseInt(hex, 16);
    
    // Calculate crash point using house edge formula
    // This ensures fair distribution with house edge
    const houseEdge = 0.01; // 1% house edge
    const maxMultiplier = 100;
    
    // Use exponential distribution for realistic crash points
    const value = decimal / 0xFFFFFFFF; // Normalize to 0-1
    const crashPoint = Math.max(1.0, Math.min(maxMultiplier, 
      Math.pow(1 - houseEdge, -1) * Math.pow(value, -1)
    ));
    
    // Round to 2 decimal places
    return Math.round(crashPoint * 100) / 100;
  }

  /**
   * Create a complete game seed with hash
   */
  createGameSeed(nonce: number = 0, clientSeed?: string): GameSeed {
    const serverSeed = this.generateServerSeed();
    const finalClientSeed = clientSeed || this.generateClientSeed();
    const hash = this.createSeedHash(serverSeed);

    return {
      serverSeed,
      clientSeed: finalClientSeed,
      nonce,
      hash
    };
  }

  /**
   * Generate complete game result
   */
  generateGameResult(seed?: GameSeed): GameResult {
    const gameSeed = seed || this.createGameSeed();
    const crashPoint = this.generateCrashPoint(
      gameSeed.serverSeed,
      gameSeed.clientSeed,
      gameSeed.nonce
    );

    return {
      crashPoint,
      seed: gameSeed,
      verifiable: true
    };
  }

  /**
   * Verify game result (called after game ends)
   */
  verifyGameResult(result: GameResult): boolean {
    try {
      // Verify hash matches server seed
      const calculatedHash = this.createSeedHash(result.seed.serverSeed);
      if (calculatedHash !== result.seed.hash) {
        console.error('❌ Hash verification failed!');
        return false;
      }

      // Verify crash point calculation
      const calculatedCrashPoint = this.generateCrashPoint(
        result.seed.serverSeed,
        result.seed.clientSeed,
        result.seed.nonce
      );

      if (Math.abs(calculatedCrashPoint - result.crashPoint) > 0.01) {
        console.error('❌ Crash point verification failed!');
        return false;
      }

      console.log('✅ Game result verified as fair!');
      return true;
    } catch (error) {
      console.error('❌ Verification error:', error);
      return false;
    }
  }

  /**
   * Get verification link for external verification
   */
  getVerificationLink(result: GameResult): string {
    const params = new URLSearchParams({
      serverSeed: result.seed.serverSeed,
      clientSeed: result.seed.clientSeed,
      nonce: result.seed.nonce.toString(),
      hash: result.seed.hash,
      crashPoint: result.crashPoint.toString()
    });

    return `https://verify.rushgame.io/?${params.toString()}`;
  }

  /**
   * Generate multiple game results for testing
   */
  generateTestResults(count: number): GameResult[] {
    const results: GameResult[] = [];
    const baseSeed = this.createGameSeed();

    for (let i = 0; i < count; i++) {
      const seed: GameSeed = {
        ...baseSeed,
        nonce: i
      };
      results.push(this.generateGameResult(seed));
    }

    return results;
  }

  /**
   * Calculate statistics from game results
   */
  calculateStatistics(results: GameResult[]): {
    averageCrashPoint: number;
    medianCrashPoint: number;
    maxCrashPoint: number;
    minCrashPoint: number;
    distribution: { [key: string]: number };
  } {
    const crashPoints = results.map(r => r.crashPoint).sort((a, b) => a - b);
    
    const average = crashPoints.reduce((sum, cp) => sum + cp, 0) / crashPoints.length;
    const median = crashPoints[Math.floor(crashPoints.length / 2)];
    const max = Math.max(...crashPoints);
    const min = Math.min(...crashPoints);

    // Distribution buckets
    const distribution: { [key: string]: number } = {
      '1.0-1.5': 0,
      '1.5-2.0': 0,
      '2.0-3.0': 0,
      '3.0-5.0': 0,
      '5.0-10.0': 0,
      '10.0+': 0
    };

    crashPoints.forEach(cp => {
      if (cp < 1.5) distribution['1.0-1.5']++;
      else if (cp < 2.0) distribution['1.5-2.0']++;
      else if (cp < 3.0) distribution['2.0-3.0']++;
      else if (cp < 5.0) distribution['3.0-5.0']++;
      else if (cp < 10.0) distribution['5.0-10.0']++;
      else distribution['10.0+']++;
    });

    return {
      averageCrashPoint: average,
      medianCrashPoint: median,
      maxCrashPoint: max,
      minCrashPoint: min,
      distribution
    };
  }
}

// Export singleton
export const provablyFair = new ProvablyFairSystem();

// Browser-compatible version (without crypto module)
export class BrowserProvablyFair {
  async generateServerSeed(): Promise<string> {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async generateClientSeed(): Promise<string> {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async createSeedHash(serverSeed: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(serverSeed);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  generateCrashPoint(serverSeed: string, clientSeed: string, nonce: number): number {
    // Simple hash-based crash point generation
    const combined = `${serverSeed}:${clientSeed}:${nonce}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash) + combined.charCodeAt(i);
      hash = hash & hash;
    }
    
    const normalized = Math.abs(hash) / 2147483647;
    const houseEdge = 0.01;
    const crashPoint = Math.max(1.0, Math.min(100, 
      Math.pow(1 - houseEdge, -1) / Math.pow(normalized, 0.5)
    ));
    
    return Math.round(crashPoint * 100) / 100;
  }
}

export const browserProvablyFair = new BrowserProvablyFair();
export default provablyFair;
