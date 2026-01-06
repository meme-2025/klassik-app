import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class ProvablyFairService {
  private readonly logger = new Logger(ProvablyFairService.name);

  /**
   * Generate a new game with provably fair crash point
   */
  generateGame(): {
    serverSeed: string;
    serverSeedHash: string;
    publicSeed: string;
    crashPoint: number;
  } {
    // Generate random server seed (kept secret until game ends)
    const serverSeed = crypto.randomBytes(32).toString('hex');

    // Generate hash for pre-commitment
    const serverSeedHash = this.hashServerSeed(serverSeed);

    // Generate public seed (revealed before game starts)
    const publicSeed = crypto.randomBytes(16).toString('hex');

    // Calculate crash point
    const crashPoint = this.calculateCrashPoint(serverSeed, publicSeed);

    return {
      serverSeed,
      serverSeedHash,
      publicSeed,
      crashPoint,
    };
  }

  /**
   * Calculate crash point using HMAC-SHA256
   * Ensures deterministic and verifiable results
   */
  calculateCrashPoint(serverSeed: string, publicSeed: string): number {
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
    let crashPoint = Math.floor((maxValue / (int || 1)) * (1 - houseEdge));

    // Convert to multiplier (1.01x - 100.00x range)
    crashPoint = Math.max(1.01, Math.min(100, crashPoint / 100));

    // Apply curve for more realistic distribution
    if (crashPoint > 10) {
      crashPoint = Math.pow(crashPoint, 0.7);
    }

    return Math.max(1.01, parseFloat(crashPoint.toFixed(2)));
  }

  /**
   * Verify game fairness
   */
  verifyGame(
    serverSeed: string,
    publicSeed: string,
    claimedCrashPoint: number,
  ): boolean {
    const calculatedCrashPoint = this.calculateCrashPoint(
      serverSeed,
      publicSeed,
    );
    return Math.abs(calculatedCrashPoint - claimedCrashPoint) < 0.01;
  }

  /**
   * Hash server seed for pre-commitment
   */
  hashServerSeed(serverSeed: string): string {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  /**
   * Calculate multiplier at a given time
   */
  calculateMultiplier(elapsedMs: number): number {
    const elapsedSeconds = elapsedMs / 1000;
    // Exponential growth: 1 + (time^1.8 * 0.1)
    return 1 + Math.pow(elapsedSeconds, 1.8) * 0.1;
  }
}
