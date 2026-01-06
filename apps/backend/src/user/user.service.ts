import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findByKaspaAddress(kaspaAddress: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { kaspaAddress } });
  }

  async createUser(kaspaAddress: string, username?: string): Promise<User> {
    const user = this.userRepository.create({
      kaspaAddress,
      username: username || `Player_${kaspaAddress.substring(6, 12)}`,
    });
    
    return this.userRepository.save(user);
  }

  async findOrCreate(kaspaAddress: string): Promise<User> {
    let user = await this.findByKaspaAddress(kaspaAddress);
    
    if (!user) {
      user = await this.createUser(kaspaAddress);
      this.logger.log(`✅ New user created: ${kaspaAddress}`);
    }
    
    return user;
  }

  async updateStats(
    userId: string,
    wagered: number,
    won: number,
    isWin: boolean,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    
    if (user) {
      user.totalWagered += wagered;
      user.totalWon += won;
      user.gamesPlayed += 1;
      
      if (isWin) {
        user.wins += 1;
      } else {
        user.losses += 1;
      }
      
      await this.userRepository.save(user);
    }
  }

  async getUserStats(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    
    if (!user) return null;

    const winRate = user.gamesPlayed > 0 
      ? (user.wins / user.gamesPlayed) * 100 
      : 0;

    return {
      userId: user.id,
      kaspaAddress: user.kaspaAddress,
      username: user.username,
      totalWagered: user.totalWagered,
      totalWon: user.totalWon,
      netProfit: user.totalWon - user.totalWagered,
      gamesPlayed: user.gamesPlayed,
      wins: user.wins,
      losses: user.losses,
      winRate: winRate.toFixed(2),
    };
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.update(userId, { lastLogin: new Date() });
  }
}
