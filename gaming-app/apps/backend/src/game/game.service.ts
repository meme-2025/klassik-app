import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './entities/game.entity';
import { Bet } from './entities/bet.entity';

@Injectable()
export class GameService {
  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(Bet)
    private betRepository: Repository<Bet>,
  ) {}

  async getGameById(id: string): Promise<Game | null> {
    return this.gameRepository.findOne({ where: { id } });
  }

  async getRecentGames(limit: number = 20): Promise<Game[]> {
    return this.gameRepository.find({
      where: { state: 'crashed' },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getGameBets(gameId: string): Promise<Bet[]> {
    return this.betRepository.find({
      where: { gameId },
      order: { createdAt: 'ASC' },
    });
  }

  async getUserStats(userId: string) {
    const bets = await this.betRepository.find({ where: { userId } });
    
    const totalBets = bets.length;
    const totalWagered = bets.reduce((sum, bet) => sum + bet.amount, 0);
    const totalWon = bets.reduce((sum, bet) => sum + (bet.winAmount || 0), 0);
    const wins = bets.filter(bet => bet.cashedOut).length;
    const winRate = totalBets > 0 ? (wins / totalBets) * 100 : 0;

    return {
      totalBets,
      totalWagered,
      totalWon,
      netProfit: totalWon - totalWagered,
      wins,
      losses: totalBets - wins,
      winRate,
    };
  }
}
