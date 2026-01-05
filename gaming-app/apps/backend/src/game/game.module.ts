import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { GameEngine } from './game.engine';
import { ProvablyFairService } from './provably-fair.service';
import { Game } from './entities/game.entity';
import { Bet } from './entities/bet.entity';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game, Bet]),
    RedisModule,
  ],
  providers: [GameGateway, GameService, GameEngine, ProvablyFairService],
  exports: [GameService],
})
export class GameModule {}
