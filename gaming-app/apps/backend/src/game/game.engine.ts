import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './entities/game.entity';
import { Bet } from './entities/bet.entity';
import { ProvablyFairService } from './provably-fair.service';
import { v4 as uuidv4 } from 'uuid';

export interface GameState {
  id: string;
  state: 'idle' | 'waiting' | 'running' | 'crashed';
  currentMultiplier: number;
  crashPoint: number;
  startTime: number | null;
  serverSeed: string;
  publicSeed: string;
  bets: Map<string, BetData>;
}

export interface BetData {
  userId: string;
  username: string;
  amount: number;
  autoCashout: number | null;
  cashedOut: boolean;
  cashoutMultiplier: number | null;
  winAmount: number | null;
}

@Injectable()
export class GameEngine {
  private readonly logger = new Logger(GameEngine.name);
  private currentGame: GameState | null = null;
  private gameInterval: NodeJS.Timeout | null = null;
  private readonly TICK_RATE = 100; // Update every 100ms
  private readonly WAITING_TIME = 5000; // 5 seconds waiting time
  private readonly MIN_CRASH = 1.01;
  private readonly MAX_CRASH = 100;

  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(Bet)
    private betRepository: Repository<Bet>,
    private provablyFairService: ProvablyFairService,
  ) {}

  async startNewGame(): Promise<GameState> {
    this.logger.log('Starting new game...');

    // Generate provably fair crash point
    const { serverSeed, publicSeed, crashPoint } = 
      this.provablyFairService.generateGame();

    const gameId = uuidv4();
    
    this.currentGame = {
      id: gameId,
      state: 'waiting',
      currentMultiplier: 1.0,
      crashPoint,
      startTime: null,
      serverSeed,
      publicSeed,
      bets: new Map(),
    };

    // Save game to database
    const game = this.gameRepository.create({
      id: gameId,
      serverSeed,
      publicSeed,
      crashPoint,
      state: 'waiting',
    });
    await this.gameRepository.save(game);

    // Start waiting period
    setTimeout(() => this.runGame(), this.WAITING_TIME);

    return this.currentGame;
  }

  private async runGame() {
    if (!this.currentGame) return;

    this.logger.log(`Game ${this.currentGame.id} starting...`);
    this.currentGame.state = 'running';
    this.currentGame.startTime = Date.now();
    this.currentGame.currentMultiplier = 1.0;

    // Update game in database
    await this.gameRepository.update(this.currentGame.id, {
      state: 'running',
      startTime: new Date(this.currentGame.startTime),
    });

    // Start game loop
    this.gameInterval = setInterval(() => {
      this.updateMultiplier();
    }, this.TICK_RATE);
  }

  private updateMultiplier() {
    if (!this.currentGame || this.currentGame.state !== 'running') {
      return;
    }

    const elapsed = Date.now() - this.currentGame.startTime!;
    const growthRate = 0.00006; // Exponential growth rate
    
    // Calculate current multiplier using exponential function
    this.currentGame.currentMultiplier = 
      Math.pow(Math.E, elapsed * growthRate);

    // Check if we've reached crash point
    if (this.currentGame.currentMultiplier >= this.currentGame.crashPoint) {
      this.crashGame();
    }

    // Auto cashout check
    this.checkAutoCashouts();
  }

  private async crashGame() {
    if (!this.currentGame) return;

    this.logger.log(
      `Game ${this.currentGame.id} crashed at ${this.currentGame.crashPoint.toFixed(2)}x`
    );

    clearInterval(this.gameInterval!);
    this.currentGame.state = 'crashed';

    // Update game in database
    await this.gameRepository.update(this.currentGame.id, {
      state: 'crashed',
      endTime: new Date(),
      finalMultiplier: this.currentGame.crashPoint,
    });

    // Process all remaining bets as losses
    for (const [userId, bet] of this.currentGame.bets.entries()) {
      if (!bet.cashedOut) {
        await this.processBetLoss(userId, bet);
      }
    }

    // Start new game after delay
    setTimeout(() => this.startNewGame(), 3000);
  }

  private checkAutoCashouts() {
    if (!this.currentGame) return;

    for (const [userId, bet] of this.currentGame.bets.entries()) {
      if (!bet.cashedOut && 
          bet.autoCashout && 
          this.currentGame.currentMultiplier >= bet.autoCashout) {
        this.cashoutBet(userId);
      }
    }
  }

  async placeBet(
    userId: string,
    username: string,
    amount: number,
    autoCashout: number | null,
  ): Promise<boolean> {
    if (!this.currentGame || this.currentGame.state !== 'waiting') {
      return false;
    }

    const bet: BetData = {
      userId,
      username,
      amount,
      autoCashout,
      cashedOut: false,
      cashoutMultiplier: null,
      winAmount: null,
    };

    this.currentGame.bets.set(userId, bet);

    // Save bet to database
    const betEntity = this.betRepository.create({
      gameId: this.currentGame.id,
      userId,
      amount,
      autoCashout,
    });
    await this.betRepository.save(betEntity);

    this.logger.log(`User ${username} placed bet of ${amount} KAS`);
    return true;
  }

  async cashoutBet(userId: string): Promise<number | null> {
    if (!this.currentGame || this.currentGame.state !== 'running') {
      return null;
    }

    const bet = this.currentGame.bets.get(userId);
    if (!bet || bet.cashedOut) {
      return null;
    }

    const cashoutMultiplier = this.currentGame.currentMultiplier;
    const winAmount = bet.amount * cashoutMultiplier;

    bet.cashedOut = true;
    bet.cashoutMultiplier = cashoutMultiplier;
    bet.winAmount = winAmount;

    // Update bet in database
    await this.betRepository.update(
      { gameId: this.currentGame.id, userId },
      {
        cashedOut: true,
        cashoutMultiplier,
        winAmount,
      },
    );

    this.logger.log(
      `User ${bet.username} cashed out at ${cashoutMultiplier.toFixed(2)}x for ${winAmount.toFixed(2)} KAS`
    );

    return winAmount;
  }

  private async processBetLoss(userId: string, bet: BetData) {
    await this.betRepository.update(
      { gameId: this.currentGame!.id, userId },
      {
        cashedOut: false,
        cashoutMultiplier: this.currentGame!.crashPoint,
        winAmount: 0,
      },
    );
  }

  getCurrentGame(): GameState | null {
    return this.currentGame;
  }

  getGameHistory(limit: number = 10): Promise<Game[]> {
    return this.gameRepository.find({
      where: { state: 'crashed' },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
