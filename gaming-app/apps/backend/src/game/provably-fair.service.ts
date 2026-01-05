import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class ProvablyFairService {
  private readonly logger = new Logger(ProvablyFairService.name);

  /**
   * Generates a new game with provably fair crash point
   * Uses cryptographic hashing to ensure fairness and verifiability
   */
  generateGame(): { serverSeed: string; publicSeed: string; crashPoint: number } {
    // Generate random server seed (kept secret until game ends)
    const serverSeed = crypto.randomBytes(32).toString('hex');
    
    // Generate public seed (revealed before game starts)
    const publicSeed = crypto.randomBytes(16).toString('hex');
    
    // Calculate crash point using provably fair algorithm
    const crashPoint = this.calculateCrashPoint(serverSeed, publicSeed);

    this.logger.debug(`Generated game - Crash point: ${crashPoint.toFixed(2)}x`);

    return {
      serverSeed,
      publicSeed,
      crashPoint,
    };
  }

  /**
   * Calculate crash point using HMAC-SHA256
   * This ensures the crash point is deterministic and verifiable
   */
  private calculateCrashPoint(serverSeed: string, publicSeed: string): number {
    // Create HMAC hash
    const hmac = crypto.createHmac('sha256', serverSeed);
    hmac.update(publicSeed);
    const hash = hmac.digest('hex');

    // Take first 13 hex characters (52 bits)
    const hex = hash.substring(0, 13);
    const int = parseInt(hex, 16);

    // House edge: 2%
    const houseEdge = 0.02;
    const maxValue = Math.pow(2, 52);

    // Calculate crash point with exponential distribution
    // Most games will crash early, but there's always a chance for high multipliers
    let crashPoint = Math.floor((maxValue / (int || 1)) * (1 - houseEdge));
    
    // Convert to multiplier (1.00x - 100.00x range)
    crashPoint = Math.max(1.01, Math.min(100, crashPoint / 100));

    // Apply curve for more realistic distribution
    if (crashPoint > 10) {
      crashPoint = Math.pow(crashPoint, 0.7); // Reduce extreme high values
    }

    return Math.max(1.01, parseFloat(crashPoint.toFixed(2)));
  }

  /**
   * Verify a game's fairness by recalculating the crash point
   */
  verifyGame(serverSeed: string, publicSeed: string, claimedCrashPoint: number): boolean {
    const calculatedCrashPoint = this.calculateCrashPoint(serverSeed, publicSeed);
    return Math.abs(calculatedCrashPoint - claimedCrashPoint) < 0.01;
  }

  /**
   * Generate a hash of the server seed for pre-commitment
   * Players can verify this hash after the game ends
   */
  hashServerSeed(serverSeed: string): string {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  /**
   * Enhanced crash point generation with better distribution
   */
  generateEnhancedCrashPoint(): number {
    const random = Math.random();
    
    // 50% chance: 1.00x - 2.00x
    if (random < 0.5) {
      return 1.0 + Math.random();
    }
    
    // 30% chance: 2.00x - 5.00x
    if (random < 0.8) {
      return 2.0 + Math.random() * 3;
    }
    
    // 15% chance: 5.00x - 20.00x
    if (random < 0.95) {
      return 5.0 + Math.random() * 15;
    }
    
    // 5% chance: 20.00x - 100.00x (MOON SHOTS!)
    return 20.0 + Math.random() * 80;
  }
}
